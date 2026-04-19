import { describe, expect, test } from 'bun:test'
import type { IAgentRepository } from '../../../src/agents/application/ports/agent-repository.port'
import { UpdateAgentUseCase } from '../../../src/agents/application/usecases/update-agent.usecase'
import type { Agent, AgentId } from '../../../src/agents/domain'
import type { AuthContext, UserId } from '../../../src/auth/domain'
import { InsufficientScopeError } from '../../../src/auth/domain'
import { ResourceNotFoundError } from '../../../src/shared/kernel/errors'

const CLOCK = { now: () => new Date('2026-04-19T12:00:00.000Z') }
const USER_A = 'user-a-uuid' as UserId
const USER_B = 'user-b-uuid' as UserId
const AGENT_ID = 'agent-1' as AgentId

function ctxWithScopes(scopes: ReadonlyArray<'*' | 'read:*'>): AuthContext {
  return {
    userId: USER_A,
    identityKind: 'human',
    scopes,
    sessionId: 'sess-1',
  }
}

const baseAgent: Agent = {
  id: AGENT_ID,
  ownerId: USER_A,
  name: 'n',
  createdAt: new Date('2026-04-19T11:00:00.000Z'),
  updatedAt: new Date('2026-04-19T11:00:00.000Z'),
}

describe('UpdateAgentUseCase', () => {
  test('rejects when scope omits * before findById', async () => {
    let findCalls = 0
    const repo: IAgentRepository = {
      findById: async () => {
        findCalls++
        return baseAgent
      },
      listByOwner: async () => [],
      create: async (a) => a,
      update: async (a) => a,
      delete: async () => true,
    }
    const uc = new UpdateAgentUseCase(repo, CLOCK)
    await expect(
      uc.execute(ctxWithScopes(['read:*']), { agentId: AGENT_ID, name: 'x' }),
    ).rejects.toBeInstanceOf(InsufficientScopeError)
    expect(findCalls).toBe(0)
  })

  test('rejects when agent missing', async () => {
    const repo: IAgentRepository = {
      findById: async () => null,
      listByOwner: async () => [],
      create: async (a) => a,
      update: async (a) => a,
      delete: async () => true,
    }
    const uc = new UpdateAgentUseCase(repo, CLOCK)
    await expect(
      uc.execute(ctxWithScopes(['*']), { agentId: AGENT_ID, name: 'x' }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })

  test('rejects cross-user', async () => {
    const repo: IAgentRepository = {
      findById: async () => ({ ...baseAgent, ownerId: USER_B }),
      listByOwner: async () => [],
      create: async (a) => a,
      update: async (a) => a,
      delete: async () => true,
    }
    const uc = new UpdateAgentUseCase(repo, CLOCK)
    await expect(
      uc.execute(ctxWithScopes(['*']), { agentId: AGENT_ID, name: 'x' }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })

  test('happy path updates name and updatedAt', async () => {
    const repo: IAgentRepository = {
      findById: async () => baseAgent,
      listByOwner: async () => [],
      create: async (a) => a,
      update: async (a) => a,
      delete: async () => true,
    }
    const uc = new UpdateAgentUseCase(repo, CLOCK)
    const result = await uc.execute(ctxWithScopes(['*']), { agentId: AGENT_ID, name: '  new  ' })
    expect(result.name).toBe('new')
    expect(result.updatedAt).toEqual(CLOCK.now())
    expect(result.id).toBe(AGENT_ID)
  })
})
