import { describe, expect, test } from 'bun:test'
import type { Agent, AgentId } from '../../../../src/agents/domain'
import type { UserId } from '../../../../src/auth/domain'

describe('Agent entity', () => {
  test('constructs with branded ids and readonly timestamps', () => {
    const agent: Agent = {
      id: 'a-uuid' as AgentId,
      ownerId: 'u-uuid' as UserId,
      name: 'test',
      createdAt: new Date('2026-04-19T00:00:00.000Z'),
      updatedAt: new Date('2026-04-19T00:00:00.000Z'),
    }
    expect(agent.id as string).toBe('a-uuid')
    expect(agent.ownerId as string).toBe('u-uuid')
    expect(agent.name).toBe('test')
  })
})
