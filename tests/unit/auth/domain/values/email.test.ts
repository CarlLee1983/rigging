import { describe, expect, test } from 'bun:test'
import { Email } from '../../../../../src/auth/domain/values/email'

describe('Email value object', () => {
  test('normalizes by trim + lowercase', () => {
    expect(Email('  FOO@BAR.COM  ')).toBe('foo@bar.com' as never)
  })

  test('accepts a well-formed email', () => {
    expect(Email('alice@example.com')).toBe('alice@example.com' as never)
  })

  test('rejects malformed input with ValidationError', () => {
    expect(() => Email('not-an-email')).toThrow(/Invalid email/)
    expect(() => Email('')).toThrow(/Invalid email/)
  })
})
