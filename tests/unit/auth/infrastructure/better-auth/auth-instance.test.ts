import { describe, expect, it } from 'bun:test'
import { createAuthInstance } from '../../../../../src/auth/infrastructure/better-auth/auth-instance'
import type { DrizzleDb } from '../../../../../src/shared/infrastructure/db/client'

describe('createAuthInstance', () => {
  // Mock DB adapter that satisfies better-auth/drizzle-adapter requirements
  const mockDb = {
    execute: async () => [],
    query: {}
  } as unknown as DrizzleDb

  const baseCfg = {
    secret: 'a'.repeat(32),
    baseURL: 'http://localhost:3000',
    sendVerificationEmail: async () => {},
    sendResetPassword: async () => {},
  }

  it('should use memory storage when secondaryStorage is not provided', async () => {
    const auth = createAuthInstance(mockDb, baseCfg)
    
    // Verify configuration directly from the returned instance's options
    expect(auth.options.rateLimit?.storage).toBe('memory')
    expect(auth.options.secondaryStorage).toBeUndefined()
  })

  it('should use secondary-storage when secondaryStorage is provided', async () => {
    const mockStorage = {
      get: async () => null,
      set: async () => {},
      delete: async () => {},
    }
    
    const auth = createAuthInstance(mockDb, { ...baseCfg, secondaryStorage: mockStorage })
    
    expect(auth.options.rateLimit?.storage).toBe('secondary-storage')
    expect(auth.options.secondaryStorage).toBe(mockStorage)
  })
})
