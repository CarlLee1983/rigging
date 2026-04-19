import { describe, expect, test } from 'bun:test'
import type { IAgentRepository } from '../../../src/agents/application/ports/agent-repository.port'
import { GetAgentUseCase } from '../../../src/agents/application/usecases/get-agent.usecase'
import type { Agent, AgentId } from '../../../src/agents/domain'
import type { AuthContext, UserId } from '../../../src/auth/domain'
import { ResourceNotFoundError } from '../../../src/shared/kernel/errors'

const USER_A = 'user-a-uuid' as UserId
const USER_B = 'user-b-uuid' as UserId
const AGENT_ID = 'agent-1' as AgentId

function ctx(userId: UserId = USER_A): AuthContext {
  return { userId, identityKind: 'human', scopes: ['*'], sessionId: 's1' }
}

function makeAgent(ownerId: UserId): Agent {
  return {
    id: AGENT_ID,
    ownerId,
    name: 'a',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeRepo(overrides: Partial<IAgentRepository> = {}): IAgentRepository {
  return {
    findById: async () => null,
    listByOwner: async () => [],
    create: async (a) => a,
    update: async (a) => a,
    delete: async () => true,
    ...overrides,
  }
}

describe('GetAgentUseCase', () => {
  test('throws ResourceNotFoundError when agent not in repo', async () => {
    const uc = new GetAgentUseCase(makeRepo({ findById: async () => null }))
    await expect(uc.execute(ctx(), { agentId: AGENT_ID })).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    )
  })

  test('throws ResourceNotFoundError when agent belongs to a different user (cross-user 404)', async () => {
    const uc = new GetAgentUseCase(makeRepo({ findById: async () => makeAgent(USER_B) }))
    await expect(uc.execute(ctx(USER_A), { agentId: AGENT_ID })).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    )
  })

  test('returns the agent on happy path', async () => {
    const expected = makeAgent(USER_A)
    const uc = new GetAgentUseCase(makeRepo({ findById: async () => expected }))
    const result = await uc.execute(ctx(USER_A), { agentId: AGENT_ID })
    expect(result.id).toBe(expected.id)
    expect(result.ownerId).toBe(USER_A)
  })
})
