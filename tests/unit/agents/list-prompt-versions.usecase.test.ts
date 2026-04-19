import { describe, expect, test } from 'bun:test'
import type { IAgentRepository } from '../../../src/agents/application/ports/agent-repository.port'
import type { IPromptVersionRepository } from '../../../src/agents/application/ports/prompt-version-repository.port'
import { ListPromptVersionsUseCase } from '../../../src/agents/application/usecases/list-prompt-versions.usecase'
import type { Agent, AgentId, PromptVersion, PromptVersionId } from '../../../src/agents/domain'
import type { AuthContext, UserId } from '../../../src/auth/domain'
import { ResourceNotFoundError } from '../../../src/shared/kernel/errors'

const USER_A = 'user-a-uuid' as UserId
const USER_B = 'user-b-uuid' as UserId
const AGENT_ID = 'agent-1' as AgentId

function ctx(userId: UserId = USER_A): AuthContext {
  return { userId, identityKind: 'human', scopes: ['read:*'], sessionId: 's1' }
}

function makeAgent(owner: UserId): Agent {
  return {
    id: AGENT_ID,
    ownerId: owner,
    name: 'a',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function agentRepo(overrides: Partial<IAgentRepository> = {}): IAgentRepository {
  return {
    findById: async () => null,
    listByOwner: async () => [],
    create: async (a) => a,
    update: async (a) => a,
    delete: async () => true,
    ...overrides,
  }
}

function pvRepo(overrides: Partial<IPromptVersionRepository> = {}): IPromptVersionRepository {
  return {
    createAtomic: async () => null,
    findLatestByAgent: async () => null,
    findByAgentAndVersion: async () => null,
    listByAgent: async () => [],
    ...overrides,
  }
}

describe('ListPromptVersionsUseCase', () => {
  test('returns listByAgent when agent owned by user', async () => {
    const pv: PromptVersion = {
      id: 'pv-1' as PromptVersionId,
      agentId: AGENT_ID,
      version: 1,
      content: 'c',
      createdAt: new Date(),
    }
    const uc = new ListPromptVersionsUseCase(
      agentRepo({ findById: async () => makeAgent(USER_A) }),
      pvRepo({ listByAgent: async () => [pv] }),
    )
    const rows = await uc.execute(ctx(USER_A), { agentId: AGENT_ID })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.version).toBe(1)
  })

  test('returns empty when repo returns empty', async () => {
    const uc = new ListPromptVersionsUseCase(
      agentRepo({ findById: async () => makeAgent(USER_A) }),
      pvRepo({ listByAgent: async () => [] }),
    )
    const rows = await uc.execute(ctx(USER_A), { agentId: AGENT_ID })
    expect(rows).toEqual([])
  })

  test('throws when agent not owned', async () => {
    const uc = new ListPromptVersionsUseCase(
      agentRepo({ findById: async () => makeAgent(USER_B) }),
      pvRepo(),
    )
    await expect(uc.execute(ctx(USER_A), { agentId: AGENT_ID })).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    )
  })
})
