import { describe, expect, test } from 'bun:test'
import type { IAgentRepository } from '../../../src/agents/application/ports/agent-repository.port'
import type { IEvalDatasetRepository } from '../../../src/agents/application/ports/eval-dataset-repository.port'
import { CreateEvalDatasetUseCase } from '../../../src/agents/application/usecases/create-eval-dataset.usecase'
import type { Agent, AgentId, EvalDataset } from '../../../src/agents/domain'
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

const ownedAgent: Agent = {
  id: AGENT_ID,
  ownerId: USER_A,
  name: 'a',
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('CreateEvalDatasetUseCase', () => {
  test('rejects when scope omits *', async () => {
    const agentRepo: IAgentRepository = {
      findById: async () => ownedAgent,
      listByOwner: async () => [],
      create: async (a) => a,
      update: async (a) => a,
      delete: async () => true,
    }
    const evalRepo: IEvalDatasetRepository = {
      findById: async () => null,
      listByAgent: async () => [],
      create: async (d) => d,
      delete: async () => true,
    }
    const uc = new CreateEvalDatasetUseCase(agentRepo, evalRepo, CLOCK)
    await expect(
      uc.execute(ctxWithScopes(['read:*']), {
        agentId: AGENT_ID,
        name: 'n',
        cases: [{ input: 'a', expectedOutput: 'b' }],
      }),
    ).rejects.toBeInstanceOf(InsufficientScopeError)
  })

  test('rejects cross-user', async () => {
    const agentRepo: IAgentRepository = {
      findById: async () => ({ ...ownedAgent, ownerId: USER_B }),
      listByOwner: async () => [],
      create: async (a) => a,
      update: async (a) => a,
      delete: async () => true,
    }
    const evalRepo: IEvalDatasetRepository = {
      findById: async () => null,
      listByAgent: async () => [],
      create: async (d) => d,
      delete: async () => true,
    }
    const uc = new CreateEvalDatasetUseCase(agentRepo, evalRepo, CLOCK)
    await expect(
      uc.execute(ctxWithScopes(['*']), {
        agentId: AGENT_ID,
        name: 'n',
        cases: [{ input: 'a', expectedOutput: 'b' }],
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })

  test('happy path creates dataset', async () => {
    const agentRepo: IAgentRepository = {
      findById: async () => ownedAgent,
      listByOwner: async () => [],
      create: async (a) => a,
      update: async (a) => a,
      delete: async () => true,
    }
    const evalRepo: IEvalDatasetRepository = {
      findById: async () => null,
      listByAgent: async () => [],
      create: async (d: EvalDataset) => d,
      delete: async () => true,
    }
    const uc = new CreateEvalDatasetUseCase(agentRepo, evalRepo, CLOCK)
    const result = await uc.execute(ctxWithScopes(['*']), {
      agentId: AGENT_ID,
      name: 'ds',
      cases: [{ input: 'a', expectedOutput: 'b' }],
    })
    expect(result.agentId).toBe(AGENT_ID)
    expect(result.cases).toHaveLength(1)
    expect(result.createdAt).toEqual(CLOCK.now())
  })
})
