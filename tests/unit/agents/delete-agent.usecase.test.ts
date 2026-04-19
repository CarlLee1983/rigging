import { describe, expect, test } from 'bun:test'
import type { IAgentRepository } from '../../../src/agents/application/ports/agent-repository.port'
import { DeleteAgentUseCase } from '../../../src/agents/application/usecases/delete-agent.usecase'
import type { Agent, AgentId } from '../../../src/agents/domain'
import type { AuthContext, UserId } from '../../../src/auth/domain'
import { InsufficientScopeError } from '../../../src/auth/domain'
import { ResourceNotFoundError } from '../../../src/shared/kernel/errors'

const USER_A = 'user-a-uuid' as UserId
const USER_B = 'user-b-uuid' as UserId
const AGENT_ID = 'agent-1' as AgentId

function ctx(scopes: AuthContext['scopes'], userId = USER_A): AuthContext {
  return { userId, identityKind: 'human', scopes, sessionId: 's1' }
}

describe('DeleteAgentUseCase', () => {
  test('rejects with InsufficientScopeError when scope omits */write:* — and does NOT touch repo', async () => {
    let findCalls = 0
    let deleteCalls = 0
    const repo: IAgentRepository = {
      findById: async () => {
        findCalls++
        return null
      },
      listByOwner: async () => [],
      create: async (a) => a,
      update: async (a) => a,
      delete: async () => {
        deleteCalls++
        return true
      },
    }
    const uc = new DeleteAgentUseCase(repo)
    await expect(uc.execute(ctx(['read:*']), { agentId: AGENT_ID })).rejects.toBeInstanceOf(
      InsufficientScopeError,
    )
    expect(findCalls).toBe(0)
    expect(deleteCalls).toBe(0)
  })

  test('throws ResourceNotFoundError when agent not found OR cross-user', async () => {
    const repo1: IAgentRepository = {
      findById: async () => null,
      listByOwner: async () => [],
      create: async (a) => a,
      update: async (a) => a,
      delete: async () => true,
    }
    await expect(
      new DeleteAgentUseCase(repo1).execute(ctx(['*']), { agentId: AGENT_ID }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
    const otherAgent: Agent = {
      id: AGENT_ID,
      ownerId: USER_B,
      name: 'x',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const repo2: IAgentRepository = {
      findById: async () => otherAgent,
      listByOwner: async () => [],
      create: async (a) => a,
      update: async (a) => a,
      delete: async () => true,
    }
    await expect(
      new DeleteAgentUseCase(repo2).execute(ctx(['*'], USER_A), { agentId: AGENT_ID }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })

  test('happy path calls repo.delete', async () => {
    const ownAgent: Agent = {
      id: AGENT_ID,
      ownerId: USER_A,
      name: 'x',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    let deleteCalled = false
    const repo: IAgentRepository = {
      findById: async () => ownAgent,
      listByOwner: async () => [],
      create: async (a) => a,
      update: async (a) => a,
      delete: async () => {
        deleteCalled = true
        return true
      },
    }
    await new DeleteAgentUseCase(repo).execute(ctx(['*']), { agentId: AGENT_ID })
    expect(deleteCalled).toBe(true)
  })
})
