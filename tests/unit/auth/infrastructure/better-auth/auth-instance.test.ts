import { describe, expect, it, mock, beforeEach } from 'bun:test'
import type { DrizzleDb } from '../../../../../src/shared/infrastructure/db/client'

// Mock better-auth before importing createAuthInstance
const mockBetterAuth = mock((config: any) => ({
  handler: () => {},
  api: {},
  options: config, // Expose config for testing
}))

mock.module('better-auth', () => ({
  betterAuth: mockBetterAuth,
}))

// Use dynamic import to ensure mock is applied
async function getCreateAuthInstance() {
  const mod = await import('../../../../../src/auth/infrastructure/better-auth/auth-instance')
  return mod.createAuthInstance
}

describe('createAuthInstance', () => {
  const mockDb = {} as DrizzleDb
  const baseCfg = {
    secret: 'a'.repeat(32),
    baseURL: 'http://localhost:3000',
    sendVerificationEmail: async () => {},
    sendResetPassword: async () => {},
  }

  beforeEach(() => {
    mockBetterAuth.mockClear()
  })

  it('should use memory storage when secondaryStorage is not provided', async () => {
    const createAuthInstance = await getCreateAuthInstance()
    createAuthInstance(mockDb, baseCfg)
    
    expect(mockBetterAuth).toHaveBeenCalled()
    const lastCall = mockBetterAuth.mock.calls[mockBetterAuth.mock.calls.length - 1]
    const config = lastCall[0]
    
    expect(config.rateLimit.storage).toBe('memory')
    expect(config.secondaryStorage).toBeUndefined()
  })

  it('should use secondary-storage when secondaryStorage is provided', async () => {
    const createAuthInstance = await getCreateAuthInstance()
    const mockStorage = {}
    
    createAuthInstance(mockDb, { ...baseCfg, secondaryStorage: mockStorage })
    
    expect(mockBetterAuth).toHaveBeenCalled()
    const lastCall = mockBetterAuth.mock.calls[mockBetterAuth.mock.calls.length - 1]
    const config = lastCall[0]
    
    expect(config.rateLimit.storage).toBe('secondary-storage')
    expect(config.secondaryStorage).toBe(mockStorage)
  })
})
