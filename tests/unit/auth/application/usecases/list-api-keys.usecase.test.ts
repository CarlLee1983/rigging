import { describe, expect, test } from 'bun:test'
import type { IIdentityService } from '../../../../../src/auth/application/ports/identity-service.port'
import { ListApiKeysUseCase } from '../../../../../src/auth/application/usecases/list-api-keys.usecase'
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

describe('ListApiKeysUseCase', () => {
  test('throws InsufficientScopeError when scopes too narrow', async () => {
    const uc = new ListApiKeysUseCase(makeIdentity())
    const ctx: AuthContext = {
      userId: UID,
      identityKind: 'human',
      scopes: [],
      sessionId: 's',
    }
    await expect(uc.execute(ctx)).rejects.toBeInstanceOf(InsufficientScopeError)
  })

  test('returns identity.listApiKeysByUser', async () => {
    const uc = new ListApiKeysUseCase({
      ...makeIdentity(),
      listApiKeysByUser: async () => [
        {
          id: '1',
          label: 'L',
          prefix: 'pre',
          scopes: ['*'],
          expiresAt: null,
          createdAt: new Date(),
          revokedAt: null,
        },
      ],
    })
    const ctx: AuthContext = { userId: UID, identityKind: 'human', scopes: ['*'], sessionId: 's' }
    const rows = await uc.execute(ctx)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.label).toBe('L')
  })
})
