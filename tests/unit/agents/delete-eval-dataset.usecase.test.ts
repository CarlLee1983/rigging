import { describe, expect, test } from 'bun:test'
import type { IAgentRepository } from '../../../src/agents/application/ports/agent-repository.port'
import type { IEvalDatasetRepository } from '../../../src/agents/application/ports/eval-dataset-repository.port'
import { DeleteEvalDatasetUseCase } from '../../../src/agents/application/usecases/delete-eval-dataset.usecase'
import type { Agent, AgentId, EvalDataset, EvalDatasetId } from '../../../src/agents/domain'
import type { AuthContext, UserId } from '../../../src/auth/domain'
import { InsufficientScopeError } from '../../../src/auth/domain'
import { ResourceNotFoundError } from '../../../src/shared/kernel/errors'

const USER_A = 'user-a-uuid' as UserId
const AGENT_ID = 'agent-1' as AgentId
const DS_ID = 'ed-1' as EvalDatasetId

function ctx(scopes: AuthContext['scopes'], userId = USER_A): AuthContext {
  return { userId, identityKind: 'human', scopes, sessionId: 's1' }
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
    cases: [],
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

describe('DeleteEvalDatasetUseCase', () => {
  test('InsufficientScopeError before IO', async () => {
    let findAgent = 0
    const uc = new DeleteEvalDatasetUseCase(
      agentRepo({
        findById: async () => {
          findAgent++
          return makeAgent(USER_A)
        },
      }),
      evalRepo(),
    )
    await expect(
      uc.execute(ctx(['read:*']), { agentId: AGENT_ID, datasetId: DS_ID }),
    ).rejects.toBeInstanceOf(InsufficientScopeError)
    expect(findAgent).toBe(0)
  })

  test('not found paths', async () => {
    const uc = new DeleteEvalDatasetUseCase(agentRepo({ findById: async () => null }), evalRepo())
    await expect(
      uc.execute(ctx(['*']), { agentId: AGENT_ID, datasetId: DS_ID }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })

  test('happy path deletes', async () => {
    let del = false
    const uc = new DeleteEvalDatasetUseCase(
      agentRepo({ findById: async () => makeAgent(USER_A) }),
      evalRepo({
        findById: async () => makeDs(AGENT_ID),
        delete: async () => {
          del = true
          return true
        },
      }),
    )
    await uc.execute(ctx(['*']), { agentId: AGENT_ID, datasetId: DS_ID })
    expect(del).toBe(true)
  })
})
