import { describe, expect, test } from 'bun:test'
import type { IIdentityService } from '../../../../../src/auth/application/ports/identity-service.port'
import { CreateApiKeyUseCase } from '../../../../../src/auth/application/usecases/create-api-key.usecase'
import { ScopeNotSubsetError, UserIdMismatchError } from '../../../../../src/auth/domain/errors'

type FakeIdentity = IIdentityService & { calls: Array<unknown> }

function makeIdentity(overrides?: Partial<Pick<FakeIdentity, 'createApiKey'>>): FakeIdentity {
  const calls: Array<unknown> = []
  return {
    calls,
    async createApiKey(params: unknown) {
      calls.push(params)
      return {
        id: 'api-key-1',
        rawKey: `rig_live_${'a'.repeat(64)}`,
        prefix: 'rig_live_',
        createdAt: new Date('2026-04-19T00:00:00.000Z'),
      }
    },
    ...overrides,
  } as FakeIdentity
}

const fixedClock = { now: () => new Date('2026-04-19T00:00:00.000Z') }

describe('CreateApiKeyUseCase', () => {
  test('throws UserIdMismatchError before delegating when body.userId mismatches ctx.userId', async () => {
    const identity = makeIdentity()
    const uc = new CreateApiKeyUseCase(identity, fixedClock)
    await expect(
      uc.execute(
        { userId: 'u-1' as never, identityKind: 'human', scopes: ['*'] },
        { userId: 'u-2', label: 'key', scopes: ['*'] },
      ),
    ).rejects.toBeInstanceOf(UserIdMismatchError)
    expect(identity.calls).toHaveLength(0)
  })

  test('throws ScopeNotSubsetError when requested scopes exceed session scopes', async () => {
    const identity = makeIdentity()
    const uc = new CreateApiKeyUseCase(identity, fixedClock)
    await expect(
      uc.execute(
        { userId: 'u-1' as never, identityKind: 'human', scopes: ['read:*'] },
        { label: 'key', scopes: ['write:*'] },
      ),
    ).rejects.toBeInstanceOf(ScopeNotSubsetError)
    expect(identity.calls).toHaveLength(0)
  })

  test('ctx.scopes = ["*"] allows any requested scope', async () => {
    const identity = makeIdentity()
    const uc = new CreateApiKeyUseCase(identity, fixedClock)
    const dto = await uc.execute(
      { userId: 'u-1' as never, identityKind: 'human', scopes: ['*'] },
      { label: '  Label  ', scopes: ['write:*'] },
    )
    expect(dto.label).toBe('Label')
    expect(identity.calls).toHaveLength(1)
  })

  test('uses clock.now + 90 days when expiresAt is omitted', async () => {
    const identity = makeIdentity()
    const uc = new CreateApiKeyUseCase(identity, fixedClock)
    const dto = await uc.execute(
      { userId: 'u-1' as never, identityKind: 'human', scopes: ['*'] },
      { label: 'key', scopes: ['*'] },
    )
    expect(dto.expiresAt.toISOString()).toBe('2026-07-18T00:00:00.000Z')
  })

  test('returns flat DTO with raw key once on happy path', async () => {
    const identity = makeIdentity()
    const uc = new CreateApiKeyUseCase(identity, fixedClock)
    const dto = await uc.execute(
      { userId: 'u-1' as never, identityKind: 'human', scopes: ['*'] },
      { label: 'key', scopes: ['*'] },
    )
    expect(dto).toEqual({
      id: 'api-key-1',
      key: `rig_live_${'a'.repeat(64)}`,
      prefix: 'rig_live_',
      label: 'key',
      scopes: ['*'],
      expiresAt: new Date('2026-07-18T00:00:00.000Z'),
      createdAt: new Date('2026-04-19T00:00:00.000Z'),
    })
    expect(identity.calls).toHaveLength(1)
  })
})
