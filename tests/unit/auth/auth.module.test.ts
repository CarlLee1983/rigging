import { describe, expect, it, mock, beforeEach, afterEach, spyOn } from 'bun:test'
import type { Redis } from 'ioredis'
import type { Logger } from 'pino'
import * as redisStorageModule from '@better-auth/redis-storage'
import * as authInstanceModule from '../../../src/auth/infrastructure/better-auth/auth-instance'
import { createAuthModule } from '../../../src/auth/auth.module'

describe('AuthModule', () => {
  const mockDb = {} as any
  const mockLogger = { info: mock(), error: mock() } as unknown as Logger
  const mockConfig = {
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3000',
    REDIS_URL: 'redis://localhost:6379',
  }

  let spyCreateAuthInstance: any
  let spyRedisStorage: any

  beforeEach(() => {
    spyCreateAuthInstance = spyOn(authInstanceModule, 'createAuthInstance')
      .mockImplementation(() => ({ handler: () => {}, api: {} } as any))
    
    spyRedisStorage = spyOn(redisStorageModule, 'redisStorage')
      .mockImplementation(() => ({ storage: 'mock-storage' } as any))
  })

  afterEach(() => {
    spyCreateAuthInstance.mockRestore()
    spyRedisStorage.mockRestore()
  })

  it('should pass secondaryStorage to createAuthInstance when redis is present', () => {
    const mockRedis = {
      get: mock(),
      set: mock(),
    } as unknown as Redis

    createAuthModule({
      db: mockDb,
      logger: mockLogger,
      config: mockConfig,
      redis: mockRedis,
    })

    expect(spyRedisStorage).toHaveBeenCalledWith({
      client: mockRedis,
      keyPrefix: 'better-auth:',
    })
    
    expect(spyCreateAuthInstance).toHaveBeenCalledWith(mockDb, expect.objectContaining({
      secondaryStorage: { storage: 'mock-storage' }
    }))
  })

  it('should NOT pass secondaryStorage to createAuthInstance when redis is absent', () => {
    createAuthModule({
      db: mockDb,
      logger: mockLogger,
      config: mockConfig,
      // redis omitted
    })

    expect(spyCreateAuthInstance).toHaveBeenCalledWith(mockDb, expect.objectContaining({
      secondaryStorage: undefined
    }))
  })

  it('should use provided authInstance instead of creating one', () => {
    const customAuth = { handler: () => {}, api: {} } as any
    createAuthModule({
      db: mockDb,
      logger: mockLogger,
      config: mockConfig,
      authInstance: customAuth,
    })

    expect(spyCreateAuthInstance).not.toHaveBeenCalled()
  })
})
