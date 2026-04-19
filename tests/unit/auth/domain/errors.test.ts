import { describe, expect, test } from 'bun:test'
import {
  EmailNotVerifiedError,
  InsufficientScopeError,
  ScopeNotSubsetError,
  UnauthenticatedError,
  UserIdMismatchError,
} from '../../../../src/auth/domain/errors'

describe('auth domain errors', () => {
  test('UserIdMismatchError uses the dedicated code and status', () => {
    const error = new UserIdMismatchError('mismatch')
    expect(error.code).toBe('USER_ID_MISMATCH')
    expect(error.httpStatus).toBe(403)
  })

  test('ScopeNotSubsetError uses the dedicated code and status', () => {
    const error = new ScopeNotSubsetError('subset')
    expect(error.code).toBe('SCOPE_NOT_SUBSET')
    expect(error.httpStatus).toBe(403)
  })

  test('InsufficientScopeError uses the dedicated code and status', () => {
    const error = new InsufficientScopeError('scope')
    expect(error.code).toBe('INSUFFICIENT_SCOPE')
    expect(error.httpStatus).toBe(403)
  })

  test('UnauthenticatedError uses the dedicated code and status', () => {
    const error = new UnauthenticatedError('auth')
    expect(error.code).toBe('UNAUTHENTICATED')
    expect(error.httpStatus).toBe(401)
  })

  test('EmailNotVerifiedError uses the dedicated code and status', () => {
    const error = new EmailNotVerifiedError('verify')
    expect(error.code).toBe('EMAIL_NOT_VERIFIED')
    expect(error.httpStatus).toBe(403)
  })
})
