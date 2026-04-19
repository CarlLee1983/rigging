import { describe, expect, test } from 'bun:test'
import type { AgentId, EvalDataset, EvalDatasetId } from '../../../../src/agents/domain'

describe('EvalDataset entity', () => {
  test('cases array is immutable snapshot', () => {
    const cases = [{ input: 'a', expectedOutput: 'b' }] as const
    const ds: EvalDataset = {
      id: 'ed-1' as EvalDatasetId,
      agentId: 'ag-1' as AgentId,
      name: 'ds',
      cases,
      createdAt: new Date(),
    }
    expect(ds.cases).toHaveLength(1)
    expect(ds.cases[0]?.input).toBe('a')
  })
})
