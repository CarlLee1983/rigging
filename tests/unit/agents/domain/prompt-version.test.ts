import { describe, expect, test } from 'bun:test'
import type { AgentId, PromptVersion, PromptVersionId } from '../../../../src/agents/domain'

describe('PromptVersion entity', () => {
  test('holds version number and content', () => {
    const pv: PromptVersion = {
      id: 'pv-1' as PromptVersionId,
      agentId: 'ag-1' as AgentId,
      version: 3,
      content: 'hello',
      createdAt: new Date(),
    }
    expect(pv.version).toBe(3)
    expect(pv.content).toBe('hello')
  })
})
