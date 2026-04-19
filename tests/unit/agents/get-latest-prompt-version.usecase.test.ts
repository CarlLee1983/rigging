import { describe, expect, test } from 'bun:test'
import type { IAgentRepository } from '../../../src/agents/application/ports/agent-repository.port'
import type { IPromptVersionRepository } from '../../../src/agents/application/ports/prompt-version-repository.port'
import { GetLatestPromptVersionUseCase } from '../../../src/agents/application/usecases/get-latest-prompt-version.usecase'
import type { Agent, AgentId, PromptVersion } from '../../../src/agents/domain'
import type { AuthContext, UserId } from '../../../src/auth/domain'
import { ResourceNotFoundError } from '../../../src/shared/kernel/errors'

const USER_A = 'user-a-uuid' as UserId
const USER_B = 'user-b-uuid' as UserId
const AGENT_ID = 'agent-1' as AgentId

function ctx(): AuthContext {
  return {
    userId: USER_A,
    identityKind: 'human',
    scopes: ['*'],
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

describe('GetLatestPromptVersionUseCase', () => {
  test('rejects when agent missing', async () => {
    const agentRepo: IAgentRepository = {
      findById: async () => null,
      listByOwner: async () => [],
      create: async (a) => a,
      update: async (a) => a,
      delete: async () => true,
    }
    const pvRepo: IPromptVersionRepository = {
      createAtomic: async () => null,
      findLatestByAgent: async () => null,
      findByAgentAndVersion: async () => null,
      listByAgent: async () => [],
    }
    const uc = new GetLatestPromptVersionUseCase(agentRepo, pvRepo)
    await expect(uc.execute(ctx(), { agentId: AGENT_ID })).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    )
  })

  test('rejects cross-user', async () => {
    const agentRepo: IAgentRepository = {
      findById: async () => ({ ...ownedAgent, ownerId: USER_B }),
      listByOwner: async () => [],
      create: async (a) => a,
      update: async (a) => a,
      delete: async () => true,
    }
    const pvRepo: IPromptVersionRepository = {
      createAtomic: async () => null,
      findLatestByAgent: async () => null,
      findByAgentAndVersion: async () => null,
      listByAgent: async () => [],
    }
    const uc = new GetLatestPromptVersionUseCase(agentRepo, pvRepo)
    await expect(uc.execute(ctx(), { agentId: AGENT_ID })).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    )
  })

  test('rejects when no prompts exist', async () => {
    const agentRepo: IAgentRepository = {
      findById: async () => ownedAgent,
      listByOwner: async () => [],
      create: async (a) => a,
      update: async (a) => a,
      delete: async () => true,
    }
    const pvRepo: IPromptVersionRepository = {
      createAtomic: async () => null,
      findLatestByAgent: async () => null,
      findByAgentAndVersion: async () => null,
      listByAgent: async () => [],
    }
    const uc = new GetLatestPromptVersionUseCase(agentRepo, pvRepo)
    await expect(uc.execute(ctx(), { agentId: AGENT_ID })).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    )
  })

  test('happy path returns latest', async () => {
    const latest: PromptVersion = {
      id: 'pv-1' as PromptVersion['id'],
      agentId: AGENT_ID,
      version: 3,
      content: 'c',
      createdAt: new Date(),
    }
    const agentRepo: IAgentRepository = {
      findById: async () => ownedAgent,
      listByOwner: async () => [],
      create: async (a) => a,
      update: async (a) => a,
      delete: async () => true,
    }
    const pvRepo: IPromptVersionRepository = {
      createAtomic: async () => null,
      findLatestByAgent: async () => latest,
      findByAgentAndVersion: async () => null,
      listByAgent: async () => [],
    }
    const uc = new GetLatestPromptVersionUseCase(agentRepo, pvRepo)
    const result = await uc.execute(ctx(), { agentId: AGENT_ID })
    expect(result).toEqual(latest)
  })
})
