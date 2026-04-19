import { describe, expect, test } from 'bun:test'
import type { IAgentRepository } from '../../../src/agents/application/ports/agent-repository.port'
import type { IEvalDatasetRepository } from '../../../src/agents/application/ports/eval-dataset-repository.port'
import { ListEvalDatasetsUseCase } from '../../../src/agents/application/usecases/list-eval-datasets.usecase'
import type { Agent, AgentId, EvalDataset, EvalDatasetId } from '../../../src/agents/domain'
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

function evalRepo(overrides: Partial<IEvalDatasetRepository> = {}): IEvalDatasetRepository {
  return {
    findById: async () => null,
    listByAgent: async () => [],
    create: async (d) => d,
    delete: async () => true,
    ...overrides,
  }
}

describe('ListEvalDatasetsUseCase', () => {
  test('returns datasets for owned agent', async () => {
    const ds: EvalDataset = {
      id: 'ed-1' as EvalDatasetId,
      agentId: AGENT_ID,
      name: 'd',
      cases: [{ input: 'a', expectedOutput: 'b' }],
      createdAt: new Date(),
    }
    const uc = new ListEvalDatasetsUseCase(
      agentRepo({ findById: async () => makeAgent(USER_A) }),
      evalRepo({ listByAgent: async () => [ds] }),
    )
    const rows = await uc.execute(ctx(USER_A), { agentId: AGENT_ID })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe('d')
  })

  test('returns empty when none', async () => {
    const uc = new ListEvalDatasetsUseCase(
      agentRepo({ findById: async () => makeAgent(USER_A) }),
      evalRepo({ listByAgent: async () => [] }),
    )
    const rows = await uc.execute(ctx(USER_A), { agentId: AGENT_ID })
    expect(rows).toEqual([])
  })

  test('throws when agent not owned', async () => {
    const uc = new ListEvalDatasetsUseCase(
      agentRepo({ findById: async () => makeAgent(USER_B) }),
      evalRepo(),
    )
    await expect(uc.execute(ctx(USER_A), { agentId: AGENT_ID })).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    )
  })
})
