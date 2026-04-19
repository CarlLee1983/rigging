import { describe, expect, test } from 'bun:test'
import type { IAgentRepository } from '../../../src/agents/application/ports/agent-repository.port'
import type { IEvalDatasetRepository } from '../../../src/agents/application/ports/eval-dataset-repository.port'
import { GetEvalDatasetUseCase } from '../../../src/agents/application/usecases/get-eval-dataset.usecase'
import type { Agent, AgentId, EvalDataset, EvalDatasetId } from '../../../src/agents/domain'
import type { AuthContext, UserId } from '../../../src/auth/domain'
import { ResourceNotFoundError } from '../../../src/shared/kernel/errors'

const USER_A = 'user-a-uuid' as UserId
const USER_B = 'user-b-uuid' as UserId
const AGENT_ID = 'agent-1' as AgentId
const DS_ID = 'ed-1' as EvalDatasetId

function ctx(userId: UserId = USER_A): AuthContext {
  return { userId, identityKind: 'human', scopes: ['*'], sessionId: 's1' }
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

function makeDs(agentId: AgentId): EvalDataset {
  return {
    id: DS_ID,
    agentId,
    name: 'd',
    cases: [{ input: 'i', expectedOutput: 'o' }],
    createdAt: new Date(),
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

describe('GetEvalDatasetUseCase', () => {
  test('throws when agent missing', async () => {
    const uc = new GetEvalDatasetUseCase(agentRepo({ findById: async () => null }), evalRepo())
    await expect(uc.execute(ctx(), { agentId: AGENT_ID, datasetId: DS_ID })).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    )
  })

  test('throws when cross-user', async () => {
    const uc = new GetEvalDatasetUseCase(
      agentRepo({ findById: async () => makeAgent(USER_B) }),
      evalRepo(),
    )
    await expect(
      uc.execute(ctx(USER_A), { agentId: AGENT_ID, datasetId: DS_ID }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })

  test('throws when dataset missing or wrong agent', async () => {
    const uc = new GetEvalDatasetUseCase(
      agentRepo({ findById: async () => makeAgent(USER_A) }),
      evalRepo({ findById: async () => null }),
    )
    await expect(
      uc.execute(ctx(USER_A), { agentId: AGENT_ID, datasetId: DS_ID }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
    const wrongAgent = makeDs('other-agent' as AgentId)
    const uc2 = new GetEvalDatasetUseCase(
      agentRepo({ findById: async () => makeAgent(USER_A) }),
      evalRepo({ findById: async () => wrongAgent }),
    )
    await expect(
      uc2.execute(ctx(USER_A), { agentId: AGENT_ID, datasetId: DS_ID }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })

  test('returns dataset on happy path', async () => {
    const ds = makeDs(AGENT_ID)
    const uc = new GetEvalDatasetUseCase(
      agentRepo({ findById: async () => makeAgent(USER_A) }),
      evalRepo({ findById: async () => ds }),
    )
    const out = await uc.execute(ctx(USER_A), { agentId: AGENT_ID, datasetId: DS_ID })
    expect(out.id).toBe(DS_ID)
    expect(out.cases).toHaveLength(1)
  })
})
