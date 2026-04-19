import { describe, expect, test } from 'bun:test'
import type { IAgentRepository } from '../../../src/agents/application/ports/agent-repository.port'
import { ListAgentsUseCase } from '../../../src/agents/application/usecases/list-agents.usecase'
import type { Agent, AgentId } from '../../../src/agents/domain'
import type { AuthContext, UserId } from '../../../src/auth/domain'

const USER_A = 'user-a-uuid' as UserId
const ctx: AuthContext = { userId: USER_A, identityKind: 'human', scopes: ['*'], sessionId: 's1' }

function repo(agents: Agent[]): IAgentRepository {
  return {
    findById: async () => null,
    listByOwner: async (owner) => (owner === USER_A ? agents : []),
    create: async (a) => a,
    update: async (a) => a,
    delete: async () => true,
  }
}

describe('ListAgentsUseCase', () => {
  test('returns agents owned by ctx.userId', async () => {
    const a1 = {
      id: 'a-1' as AgentId,
      ownerId: USER_A,
      name: 'one',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Agent
    const uc = new ListAgentsUseCase(repo([a1]))
    const result = await uc.execute(ctx)
    expect(result.length).toBe(1)
    expect(result[0]?.id as string).toBe('a-1')
  })

  test('returns empty array when no agents exist', async () => {
    const uc = new ListAgentsUseCase(repo([]))
    const result = await uc.execute(ctx)
    expect(result).toEqual([])
  })
})
