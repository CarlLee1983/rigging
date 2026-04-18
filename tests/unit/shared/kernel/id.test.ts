import { describe, expect, test } from 'bun:test'
import { newUUID } from '@/shared/kernel/id'

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('newUUID', () => {
  test('returns a 36-char UUID v4 string', () => {
    const id = newUUID<'TestId'>()
    expect(typeof id).toBe('string')
    expect(id.length).toBe(36)
    expect(id).toMatch(UUID_V4_REGEX)
  })

  test('no collisions across 1000 calls', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i += 1) {
      seen.add(newUUID<'X'>())
    }
    expect(seen.size).toBe(1000)
  })
})
