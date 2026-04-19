import { describe, expect, test } from 'bun:test'
import {
  ALLOWED_SCOPES,
  type AuthContext,
  isAgent,
  isHuman,
  type Scope,
} from '../../../../src/auth/domain/auth-context'

describe('ALLOWED_SCOPES constant (D-01)', () => {
  test('equals exactly the two-value tuple ["*", "read:*"]', () => {
    expect(ALLOWED_SCOPES).toEqual(['*', 'read:*'])
  })

  test('retains the readonly tuple shape at compile time', () => {
    const tupleCheck: readonly ['*', 'read:*'] = ALLOWED_SCOPES
    expect(tupleCheck).toEqual(['*', 'read:*'])
  })

  test('Scope narrows to the two allowed literals', () => {
    const scopeOne: Scope = '*'
    const scopeTwo: Scope = 'read:*'
    expect(scopeOne).toBe('*')
    expect(scopeTwo).toBe('read:*')
  })
})

describe('identity helpers', () => {
  const agent: AuthContext = {
    userId: 'u-1' as never,
    identityKind: 'agent',
    scopes: ['*'],
    apiKeyId: 'k-1',
  }

  const human: AuthContext = {
    userId: 'u-2' as never,
    identityKind: 'human',
    scopes: ['*'],
    sessionId: 's-1',
  }

  test('isAgent returns true for agent, false for human', () => {
    expect(isAgent(agent)).toBe(true)
    expect(isAgent(human)).toBe(false)
  })

  test('isHuman returns true for human, false for agent', () => {
    expect(isHuman(human)).toBe(true)
    expect(isHuman(agent)).toBe(false)
  })
})
