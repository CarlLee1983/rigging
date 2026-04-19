import { describe, expect, test } from 'bun:test'
import type { IIdentityService } from '../../../../../src/auth/application/ports/identity-service.port'
import { RevokeApiKeyUseCase } from '../../../../../src/auth/application/usecases/revoke-api-key.usecase'
import type { AuthContext, UserId } from '../../../../../src/auth/domain'
import { InsufficientScopeError } from '../../../../../src/auth/domain'

const UID = 'u-1' as UserId

function makeIdentity(): IIdentityService {
  return {
    verifySession: async () => null,
    verifyApiKey: async () => null,
    createApiKey: async () => ({ id: 'k', rawKey: 'x', prefix: 'p', createdAt: new Date() }),
    listApiKeysByUser: async () => [],
    revokeApiKey: async () => {},
  }
}

describe('RevokeApiKeyUseCase', () => {
  test('InsufficientScopeError when cannot write', async () => {
    const uc = new RevokeApiKeyUseCase(makeIdentity())
    const ctx: AuthContext = {
      userId: UID,
      identityKind: 'human',
      scopes: ['read:*'],
      sessionId: 's',
    }
    await expect(uc.execute(ctx, 'kid')).rejects.toBeInstanceOf(InsufficientScopeError)
  })

  test('happy path calls revokeApiKey', async () => {
    let called: string | undefined
    const uc = new RevokeApiKeyUseCase({
      ...makeIdentity(),
      revokeApiKey: async (id, uid) => {
        called = `${id}:${uid}`
      },
    })
    const ctx: AuthContext = { userId: UID, identityKind: 'human', scopes: ['*'], sessionId: 's' }
    await uc.execute(ctx, 'kid-1')
    expect(called).toBe(`kid-1:${UID}`)
  })
})
