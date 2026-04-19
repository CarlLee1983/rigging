import { describe, expect, test } from 'bun:test'
import { getApiKeyService } from '../../../../src/auth/domain'
import { AuthContextMissingError } from '../../../../src/auth/domain/internal/authcontext-missing-error'

describe('getApiKeyService runtime guard', () => {
  test('throws AuthContextMissingError for undefined context with a teaching message', () => {
    expect(() => getApiKeyService(undefined)).toThrow(AuthContextMissingError)
    expect(() => getApiKeyService(undefined)).toThrow(/Reason:/)
    expect(() => getApiKeyService(undefined)).toThrow(/See docs\/decisions\/0006/)
    expect(() => getApiKeyService(undefined)).toThrow(/Fix: Declare `requireAuth: true`/)
    expect(() => getApiKeyService(undefined)).toThrow(/new Elysia\(\)/)
  })

  test('throws AuthContextMissingError for null and falsy userId', () => {
    expect(() => getApiKeyService(null)).toThrow(AuthContextMissingError)
    expect(() => getApiKeyService({ userId: '' } as never)).toThrow(AuthContextMissingError)
  })

  test('returns a service instance for a valid context', () => {
    const service = getApiKeyService({
      userId: 'u-1' as never,
      identityKind: 'human',
      scopes: ['*'],
    })

    expect(service).toBeTruthy()
  })
})
