import { describe, expect, test } from 'bun:test'
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  ResourceNotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/shared/kernel/errors'

describe('DomainError hierarchy', () => {
  const cases = [
    [ValidationError, 400, 'VALIDATION_ERROR'],
    [UnauthorizedError, 401, 'UNAUTHORIZED'],
    [ForbiddenError, 403, 'FORBIDDEN'],
    [NotFoundError, 404, 'NOT_FOUND'],
    [ConflictError, 409, 'CONFLICT'],
    [ResourceNotFoundError, 404, 'RESOURCE_NOT_FOUND'],
  ] as const

  for (const [Ctor, status, code] of cases) {
    test(`${Ctor.name} maps to ${status}`, () => {
      const err = new Ctor('m')
      expect(err.httpStatus).toBe(status)
      expect(err.code).toBe(code)
      expect(err.name).toBe(Ctor.name)
      expect(err).toBeInstanceOf(DomainError)
      expect(err).toBeInstanceOf(Error)
    })
  }

  test('cause is preserved', () => {
    const cause = new TypeError('x')
    const err = new ValidationError('m', cause)
    expect(err.cause).toBe(cause)
  })
})
