import { describe, expect, test } from 'bun:test'
import type { IAgentRepository } from '../../../src/agents/application/ports/agent-repository.port'
import type {
  CreatePromptVersionCommand,
  IPromptVersionRepository,
} from '../../../src/agents/application/ports/prompt-version-repository.port'
import { CreatePromptVersionUseCase } from '../../../src/agents/application/usecases/create-prompt-version.usecase'
import {
  type Agent,
  type AgentId,
  type PromptVersion,
  PromptVersionConflictError,
} from '../../../src/agents/domain'
import type { AuthContext, UserId } from '../../../src/auth/domain'
import { InsufficientScopeError } from '../../../src/auth/domain'
import { ResourceNotFoundError } from '../../../src/shared/kernel/errors'

const CLOCK = { now: () => new Date('2026-04-19T12:00:00.000Z') }
const USER_A = 'user-a-uuid' as UserId
const USER_B = 'user-b-uuid' as UserId
const AGENT_OWNED_BY_A = 'agent-a-uuid' as AgentId

function ctxWithScopes(scopes: ReadonlyArray<'*' | 'read:*'>): AuthContext {
  return {
    userId: USER_A,
    identityKind: 'human',
    scopes,
    sessionId: 'sess-1',
  }
}

const existingAgent: Agent = {
  id: AGENT_OWNED_BY_A,
  ownerId: USER_A,
  name: 'test-agent',
  createdAt: new Date('2026-04-19T11:00:00.000Z'),
  updatedAt: new Date('2026-04-19T11:00:00.000Z'),
}

function makeAgentRepo(agent: Agent | null): IAgentRepository {
  return {
    findById: async () => agent,
    listByOwner: async () => [],
    create: async (a) => a,
    update: async (a) => a,
    delete: async () => true,
  }
}

function makePromptRepo(opts: {
  latest?: PromptVersion | null
  createResults: ReadonlyArray<PromptVersion | null>
}): IPromptVersionRepository & { createCalls: number } {
  let createCalls = 0
  const repo = {
    findLatestByAgent: async () => opts.latest ?? null,
    findByAgentAndVersion: async () => null,
    listByAgent: async () => [],
    createAtomic: async (_cmd: CreatePromptVersionCommand) => {
      const result = opts.createResults[createCalls] ?? null
      createCalls++
      repo.createCalls = createCalls
      return result
    },
    createCalls: 0,
  } satisfies IPromptVersionRepository & { createCalls: number }
  return repo
}

describe('CreatePromptVersionUseCase', () => {
  test('rejects when scope omits *', async () => {
    const uc = new CreatePromptVersionUseCase(
      makeAgentRepo(existingAgent),
      makePromptRepo({ createResults: [] }),
      CLOCK,
    )
    await expect(
      uc.execute(ctxWithScopes(['read:*']), { agentId: AGENT_OWNED_BY_A, content: 'hi' }),
    ).rejects.toBeInstanceOf(InsufficientScopeError)
  })

  test('rejects when agent missing (cross-user or deleted)', async () => {
    const uc = new CreatePromptVersionUseCase(
      makeAgentRepo(null),
      makePromptRepo({ createResults: [] }),
      CLOCK,
    )
    await expect(
      uc.execute(ctxWithScopes(['*']), { agentId: AGENT_OWNED_BY_A, content: 'hi' }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })

  test('rejects when ctx.userId !== agent.ownerId (cross-user 404)', async () => {
    const crossUser: AuthContext = { ...ctxWithScopes(['*']), userId: USER_B }
    const uc = new CreatePromptVersionUseCase(
      makeAgentRepo(existingAgent),
      makePromptRepo({ createResults: [] }),
      CLOCK,
    )
    await expect(
      uc.execute(crossUser, { agentId: AGENT_OWNED_BY_A, content: 'hi' }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError)
  })

  test('happy path first attempt creates version 1 (no existing)', async () => {
    const created: PromptVersion = {
      id: 'pv-1' as PromptVersion['id'],
      agentId: AGENT_OWNED_BY_A,
      version: 1,
      content: 'hi',
      createdAt: CLOCK.now(),
    }
    const promptRepo = makePromptRepo({ latest: null, createResults: [created] })
    const uc = new CreatePromptVersionUseCase(makeAgentRepo(existingAgent), promptRepo, CLOCK)
    const result = await uc.execute(ctxWithScopes(['*']), {
      agentId: AGENT_OWNED_BY_A,
      content: 'hi',
    })
    expect(result.version).toBe(1)
    expect(promptRepo.createCalls).toBe(1)
  })

  test('happy path after existing: new version = latest + 1', async () => {
    const latest: PromptVersion = {
      id: 'pv-existing' as PromptVersion['id'],
      agentId: AGENT_OWNED_BY_A,
      version: 5,
      content: 'old',
      createdAt: new Date('2026-04-18'),
    }
    const created: PromptVersion = {
      ...latest,
      id: 'pv-new' as PromptVersion['id'],
      version: 6,
      content: 'new',
    }
    const promptRepo = makePromptRepo({ latest, createResults: [created] })
    const uc = new CreatePromptVersionUseCase(makeAgentRepo(existingAgent), promptRepo, CLOCK)
    const result = await uc.execute(ctxWithScopes(['*']), {
      agentId: AGENT_OWNED_BY_A,
      content: 'new',
    })
    expect(result.version).toBe(6)
    expect(promptRepo.createCalls).toBe(1)
  })

  test('retries on createAtomic returning null (second attempt succeeds)', async () => {
    const latest: PromptVersion = {
      id: 'pv-existing' as PromptVersion['id'],
      agentId: AGENT_OWNED_BY_A,
      version: 1,
      content: 'v1',
      createdAt: new Date('2026-04-18'),
    }
    const success: PromptVersion = {
      ...latest,
      id: 'pv-new' as PromptVersion['id'],
      version: 2,
      content: 'v2',
    }
    const promptRepo = makePromptRepo({ latest, createResults: [null, success] })
    const uc = new CreatePromptVersionUseCase(makeAgentRepo(existingAgent), promptRepo, CLOCK)
    const result = await uc.execute(ctxWithScopes(['*']), {
      agentId: AGENT_OWNED_BY_A,
      content: 'v2',
    })
    expect(result.version).toBe(2)
    expect(promptRepo.createCalls).toBe(2)
  })

  test('throws PromptVersionConflictError after MAX_RETRY nulls', async () => {
    const latest: PromptVersion = {
      id: 'pv-existing' as PromptVersion['id'],
      agentId: AGENT_OWNED_BY_A,
      version: 1,
      content: 'v1',
      createdAt: new Date('2026-04-18'),
    }
    const promptRepo = makePromptRepo({
      latest,
      createResults: Array.from({ length: 24 }, () => null),
    })
    const uc = new CreatePromptVersionUseCase(makeAgentRepo(existingAgent), promptRepo, CLOCK)
    await expect(
      uc.execute(ctxWithScopes(['*']), { agentId: AGENT_OWNED_BY_A, content: 'v2' }),
    ).rejects.toBeInstanceOf(PromptVersionConflictError)
    expect(promptRepo.createCalls).toBe(24)
  })
})
