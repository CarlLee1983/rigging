import { describe, expect, test } from 'bun:test'
import type { IAgentRepository } from '../../../src/agents/application/ports/agent-repository.port'
import { CreateAgentUseCase } from '../../../src/agents/application/usecases/create-agent.usecase'
import type { Agent } from '../../../src/agents/domain'
import type { AuthContext, UserId } from '../../../src/auth/domain'
import { InsufficientScopeError } from '../../../src/auth/domain'

const CLOCK = { now: () => new Date('2026-04-19T12:00:00.000Z') }
const USER_A = 'user-a-uuid' as UserId

function ctxWithScopes(scopes: ReadonlyArray<'*' | 'read:*'>): AuthContext {
  return {
    userId: USER_A,
    identityKind: 'human',
    scopes,
    sessionId: 'sess-1',
  }
}

function makeAgentRepo(): IAgentRepository {
  return {
    findById: async () => null,
    listByOwner: async () => [],
    create: async (a: Agent) => a,
    update: async (a: Agent) => a,
    delete: async () => true,
  }
}

describe('CreateAgentUseCase', () => {
  test('rejects when scope omits *', async () => {
    const uc = new CreateAgentUseCase(makeAgentRepo(), CLOCK)
    await expect(uc.execute(ctxWithScopes(['read:*']), { name: 'x' })).rejects.toBeInstanceOf(
      InsufficientScopeError,
    )
  })

  test('happy path trims name and sets owner from ctx', async () => {
    const uc = new CreateAgentUseCase(makeAgentRepo(), CLOCK)
    const result = await uc.execute(ctxWithScopes(['*']), { name: '  hi  ' })
    expect(result.name).toBe('hi')
    expect(result.ownerId).toBe(USER_A)
    expect(result.createdAt).toEqual(CLOCK.now())
    expect(result.updatedAt).toEqual(CLOCK.now())
  })
})
