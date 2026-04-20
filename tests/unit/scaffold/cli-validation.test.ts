import { describe, expect, test } from 'bun:test'
import {
  validateProjectName,
  isNodeVersionSufficient,
} from '../../../packages/create-rigging/lib/helpers.js'

describe('validateProjectName', () => {
  test('empty string → invalid', () => {
    const result = validateProjectName('')
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  test('"rigging" → invalid (reserved name)', () => {
    const result = validateProjectName('rigging')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('rigging')
  })

  test('"." → invalid (current dir)', () => {
    const result = validateProjectName('.')
    expect(result.valid).toBe(false)
  })

  test('".." → invalid (parent dir)', () => {
    const result = validateProjectName('..')
    expect(result.valid).toBe(false)
  })

  test('"../evil" → invalid (path traversal)', () => {
    const result = validateProjectName('../evil')
    expect(result.valid).toBe(false)
  })

  test('"path/inject" → invalid (slash)', () => {
    const result = validateProjectName('path/inject')
    expect(result.valid).toBe(false)
  })

  test('"my-app" → valid', () => {
    const result = validateProjectName('my-app')
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  test('"my_project_123" → valid', () => {
    const result = validateProjectName('my_project_123')
    expect(result.valid).toBe(true)
  })

  test('"awesome-ddd-api" → valid', () => {
    const result = validateProjectName('awesome-ddd-api')
    expect(result.valid).toBe(true)
  })
})

describe('isNodeVersionSufficient', () => {
  const cases: [string, boolean][] = [
    ['17.9.1', false],
    ['17.0.0', false],
    ['18.0.0', true],
    ['18.19.1', true],
    ['20.11.0', true],
    ['22.5.1', true],
  ]

  for (const [version, expected] of cases) {
    test(`Node ${version} → ${expected}`, () => {
      expect(isNodeVersionSufficient(version)).toBe(expected)
    })
  }
})
