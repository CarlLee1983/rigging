import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import type {
  ApiKeyRow,
  IApiKeyRepository,
} from '../../../../src/auth/application/ports/api-key-repository.port'
import { BetterAuthIdentityService } from '../../../../src/auth/infrastructure/better-auth/identity-service.adapter'

function makeApiKeyRepo(rows: Map<string, ApiKeyRow> = new Map()) {
  let lookupCount = 0
  const repo: IApiKeyRepository & { lookupCount: number } = {
    get lookupCount() {
      return lookupCount
    },
    async findByPrefix(prefix) {
      lookupCount++
      return rows.get(prefix) ?? null
    },
    async listByUserId() {
      return []
    },
    async markRevoked() {
      return true
    },
  }
  return repo
}

function makeFakeAuth(sessionResult: unknown = null) {
  return {
    api: {
      getSession: async () => sessionResult,
      createApiKey: async () => ({
        apiKey: { id: 'k-1', prefix: 'rig_live_', createdAt: new Date() },
        key: 'rig_live_raw',
      }),
    },
  } as never
}

describe('BetterAuthIdentityService (D-03 / D-10 / D-11)', () => {
  test('verifySession returns human AuthContext when session exists', async () => {
    const auth = makeFakeAuth({ user: { id: 'u-1' }, session: { id: 's-1' } })
    const svc = new BetterAuthIdentityService(auth, makeApiKeyRepo())
    const ctx = await svc.verifySession(new Headers({ cookie: 'better-auth.session_token=abc' }))
    expect(ctx).toEqual({
      userId: 'u-1' as never,
      identityKind: 'human',
      scopes: ['*'],
      sessionId: 's-1',
    })
  })

  test('verifySession returns null when no session exists', async () => {
    const auth = makeFakeAuth(null)
    const svc = new BetterAuthIdentityService(auth, makeApiKeyRepo())
    const ctx = await svc.verifySession(new Headers())
    expect(ctx).toBeNull()
  })

  test('verifyApiKey malformed key returns null and runs dummy prefix lookup', async () => {
    const repo = makeApiKeyRepo()
    const svc = new BetterAuthIdentityService(makeFakeAuth(), repo)
    const ctx = await svc.verifyApiKey('not-a-rig-key')
    expect(ctx).toBeNull()
    expect(repo.lookupCount).toBe(1)
  })

  test('verifyApiKey valid prefix without row returns null', async () => {
    const repo = makeApiKeyRepo()
    const svc = new BetterAuthIdentityService(makeFakeAuth(), repo)
    const ctx = await svc.verifyApiKey(`rig_live_${'a'.repeat(43)}`)
    expect(ctx).toBeNull()
    expect(repo.lookupCount).toBe(1)
  })

  test('verifyApiKey returns agent AuthContext when hash matches', async () => {
    const rawKey = `rig_live_${'b'.repeat(43)}`
    const hash = createHash('sha256').update(rawKey).digest('hex')
    const prefix = rawKey.slice(0, 8)
    const row: ApiKeyRow = {
      id: 'k-42',
      userId: 'u-1' as never,
      label: 'test-key',
      prefix,
      hash,
      scopes: ['read:*'],
      expiresAt: null,
      revokedAt: null,
      createdAt: new Date(),
    }
    const repo = makeApiKeyRepo(new Map([[prefix, row]]))
    const svc = new BetterAuthIdentityService(makeFakeAuth(), repo)
    const ctx = await svc.verifyApiKey(rawKey)
    expect(ctx).toEqual({
      userId: 'u-1' as never,
      identityKind: 'agent',
      scopes: ['read:*'],
      apiKeyId: 'k-42',
    })
    expect((ctx as { sessionId?: string }).sessionId).toBeUndefined()
  })

  test('verifyApiKey returns null for revoked key', async () => {
    const rawKey = `rig_live_${'c'.repeat(43)}`
    const hash = createHash('sha256').update(rawKey).digest('hex')
    const prefix = rawKey.slice(0, 8)
    const row: ApiKeyRow = {
      id: 'k',
      userId: 'u' as never,
      label: 'x',
      prefix,
      hash,
      scopes: ['*'],
      expiresAt: null,
      revokedAt: new Date(),
      createdAt: new Date(),
    }
    const repo = makeApiKeyRepo(new Map([[prefix, row]]))
    const svc = new BetterAuthIdentityService(makeFakeAuth(), repo)
    expect(await svc.verifyApiKey(rawKey)).toBeNull()
  })

  test('verifyApiKey returns null for expired key', async () => {
    const rawKey = `rig_live_${'d'.repeat(43)}`
    const hash = createHash('sha256').update(rawKey).digest('hex')
    const prefix = rawKey.slice(0, 8)
    const row: ApiKeyRow = {
      id: 'k',
      userId: 'u' as never,
      label: 'x',
      prefix,
      hash,
      scopes: ['*'],
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      createdAt: new Date(),
    }
    const repo = makeApiKeyRepo(new Map([[prefix, row]]))
    const svc = new BetterAuthIdentityService(makeFakeAuth(), repo)
    expect(await svc.verifyApiKey(rawKey)).toBeNull()
  })

  test('malformed and wrong-hash paths both do one prefix lookup', async () => {
    const repo1 = makeApiKeyRepo()
    const svc1 = new BetterAuthIdentityService(makeFakeAuth(), repo1)
    await svc1.verifyApiKey('bad-format')
    expect(repo1.lookupCount).toBe(1)

    const repo2 = makeApiKeyRepo()
    const svc2 = new BetterAuthIdentityService(makeFakeAuth(), repo2)
    await svc2.verifyApiKey(`rig_live_${'z'.repeat(43)}`)
    expect(repo2.lookupCount).toBe(1)
  })
})
