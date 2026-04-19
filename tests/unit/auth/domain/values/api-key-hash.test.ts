import { describe, expect, test } from 'bun:test'
import { ApiKeyHash } from '../../../../../src/auth/domain/values/api-key-hash'

describe('ApiKeyHash value object (D-23 sha256 = 64 hex chars)', () => {
  test('accepts a 64-hex-char lowercase string', () => {
    const hex64 = 'a'.repeat(64)
    expect(ApiKeyHash(hex64)).toBe(hex64 as never)
  })

  test('rejects short string with ValidationError', () => {
    expect(() => ApiKeyHash('short')).toThrow(/64 lowercase hex chars/)
  })

  test('rejects uppercase and non-hex input', () => {
    expect(() => ApiKeyHash('A'.repeat(64))).toThrow(/64 lowercase hex chars/)
    expect(() => ApiKeyHash('g'.repeat(64))).toThrow(/64 lowercase hex chars/)
  })
})
