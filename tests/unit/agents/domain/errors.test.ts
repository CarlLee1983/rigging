import { describe, expect, test } from 'bun:test'
import { PromptVersionConflictError } from '../../../../src/agents/domain/errors'

describe('agents domain errors', () => {
  test('PromptVersionConflictError uses the dedicated code and 500 status', () => {
    const err = new PromptVersionConflictError('conflict for agent x version 5')
    expect(err.code).toBe('PROMPT_VERSION_CONFLICT')
    expect(err.httpStatus).toBe(500)
    expect(err.message).toContain('conflict')
  })
})
