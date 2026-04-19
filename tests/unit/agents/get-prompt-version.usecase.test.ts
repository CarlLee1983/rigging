import { describe, expect, test } from 'bun:test'
import type { IAgentRepository } from '../../../src/agents/application/ports/agent-repository.port'
import type { IPromptVersionRepository } from '../../../src/agents/application/ports/prompt-version-repository.port'
import { GetPromptVersionUseCase } from '../../../src/agents/application/usecases/get-prompt-version.usecase'
import type { Agent, AgentId, PromptVersion, PromptVersionId } from '../../../src/agents/domain'
import type { AuthContext, UserId } from '../../../src/auth/domain'
import { ResourceNotFoundError } from '../../../src/shared/kernel/errors'

const USER_A = 'user-a-uuid' as UserId
const USER_B = 'user-b-uuid' as UserId
const AGENT_ID = 'agent-1' as AgentId
const PV_ID = 'pv-1' as PromptVersionId

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

function makePv(): PromptVersion {
  return {
    id: PV_ID,
    agentId: AGENT_ID,
    version: 1,
    content: 'hi',
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

function pvRepo(overrides: Partial<IPromptVersionRepository> = {}): IPromptVersionRepository {
  return {
    createAtomic: async () => null,
    findLatestByAgent: async () => null,
    findByAgentAndVersion: async () => null,
    listByAgent: async () => [],
    ...overrides,
  }
}

describe('GetPromptVersionUseCase', () => {
  test('throws when agent missing', async () => {
    const uc = new GetPromptVersionUseCase(agentRepo({ findById: async () => null }), pvRepo())
    await expect(uc.execute(ctx(), { agentId: AGENT_ID, version: 1 })).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    )
  })

  test('throws when cross-user', async () => {
    const uc = new GetPromptVersionUseCase(
      agentRepo({ findById: async () => makeAgent(USER_B) }),
      pvRepo(),
    )
    await expect(uc.execute(ctx(USER_A), { agentId: AGENT_ID, version: 1 })).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    )
  })

  test('throws when prompt version missing', async () => {
    const uc = new GetPromptVersionUseCase(
      agentRepo({ findById: async () => makeAgent(USER_A) }),
      pvRepo({ findByAgentAndVersion: async () => null }),
    )
    await expect(uc.execute(ctx(USER_A), { agentId: AGENT_ID, version: 1 })).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    )
  })

  test('returns prompt version on happy path', async () => {
    const pv = makePv()
    const uc = new GetPromptVersionUseCase(
      agentRepo({ findById: async () => makeAgent(USER_A) }),
      pvRepo({ findByAgentAndVersion: async () => pv }),
    )
    const out = await uc.execute(ctx(USER_A), { agentId: AGENT_ID, version: 1 })
    expect(out.version).toBe(1)
    expect(out.content).toBe('hi')
  })
})
