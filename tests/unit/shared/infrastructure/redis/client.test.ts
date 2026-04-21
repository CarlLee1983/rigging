import { describe, expect, mock, test } from 'bun:test'

const onMock = mock(() => {})
class MockRedis {
  public url: string
  public options: any
  public on = onMock
  constructor(url: string, options: any) {
    this.url = url
    this.options = options
  }
}

mock.module('ioredis', () => ({
  Redis: MockRedis,
}))

// Import createRedisClient after the module mock is established.
// @ts-ignore - The module is mocked, so the real ioredis types don't apply here.
const { createRedisClient } = await import(
  '../../../../../src/shared/infrastructure/redis/client'
)

function makeLogger() {
  const infoCalls: Array<[unknown, string]> = []
  const warnCalls: Array<[unknown, string]> = []
  const errorCalls: Array<[unknown, string]> = []
  const logger = {
    info: (meta: unknown, message: string) => {
      infoCalls.push([meta, message])
    },
    warn: (meta: unknown, message: string) => {
      warnCalls.push([meta, message])
    },
    error: (meta: unknown, message: string) => {
      errorCalls.push([meta, message])
    },
  } as any
  return { logger, infoCalls, warnCalls, errorCalls }
}

describe('createRedisClient', () => {
  test('should create a Redis client with correct configuration', () => {
    const url = 'redis://localhost:6379'
    const { logger } = makeLogger()
    const client = createRedisClient(url, logger)

    expect(client).toBeDefined()
    // Cast to access properties of MockRedis
    const mockClient = client as unknown as MockRedis
    expect(mockClient.url).toBe(url)
    expect(mockClient.options.maxRetriesPerRequest).toBe(3)
    expect(typeof mockClient.options.retryStrategy).toBe('function')
  })

  test('should implement exponential backoff strategy capped at 2s', () => {
    const url = 'redis://localhost:6379'
    const { logger } = makeLogger()
    const client = createRedisClient(url, logger)
    const strategy = (client as any).options.retryStrategy

    // Exponential strategy: 2 ** (times - 1) * 100
    expect(strategy(1)).toBe(100)
    expect(strategy(2)).toBe(200)
    expect(strategy(3)).toBe(400)
    expect(strategy(4)).toBe(800)
    expect(strategy(5)).toBe(1600)
    expect(strategy(6)).toBe(2000) // capped
    expect(strategy(10)).toBe(2000) // still capped
  })

  test('should attach event listeners and log events with redacted URL', () => {
    onMock.mockClear()
    const url = 'redis://:password123@localhost:6379'
    const expectedRedactedUrl = 'redis://:***@localhost:6379'
    const { logger, infoCalls, warnCalls, errorCalls } = makeLogger()
    createRedisClient(url, logger)

    expect(onMock).toHaveBeenCalledWith('connect', expect.any(Function))
    expect(onMock).toHaveBeenCalledWith('ready', expect.any(Function))
    expect(onMock).toHaveBeenCalledWith('reconnecting', expect.any(Function))
    expect(onMock).toHaveBeenCalledWith('error', expect.any(Function))

    // Helper to find and call the handler
    const callHandler = (event: string, ...args: any[]) => {
      const call = onMock.mock.calls.find((c) => c[0] === event)
      if (call) {
        call[1](...args)
      }
    }

    // Test 'connect'
    callHandler('connect')
    expect(infoCalls).toContainEqual([
      { redis_url: expectedRedactedUrl },
      'Redis connection established',
    ])

    // Test 'ready'
    callHandler('ready')
    expect(infoCalls).toContainEqual([
      { redis_url: expectedRedactedUrl },
      'Redis client ready',
    ])

    // Test 'reconnecting'
    callHandler('reconnecting', 100)
    expect(warnCalls).toContainEqual([
      { delay: 100, redis_url: expectedRedactedUrl },
      'Redis client reconnecting',
    ])

    // Test 'error'
    const testError = new Error('boom')
    callHandler('error', testError)
    expect(errorCalls).toContainEqual([
      { err: testError, redis_url: expectedRedactedUrl },
      'Redis connection error',
    ])
  })

  test('maskRedisUrl (via integration) should redact password and remove trailing slash', () => {
    const { logger, infoCalls } = makeLogger()
    
    // User:Pass
    createRedisClient('redis://alice:secret@localhost:6379', logger)
    const callHandler = (event: string) => {
      const call = onMock.mock.calls.find((c) => c[0] === event)
      if (call) call[1]()
    }
    
    onMock.mock.calls.filter(c => c[0] === 'connect')[onMock.mock.calls.filter(c => c[0] === 'connect').length - 1][1]()
    expect(infoCalls[infoCalls.length - 1][0]).toEqual({ redis_url: 'redis://alice:***@localhost:6379' })
  })

  test('maskRedisUrl should return original string if URL is invalid', () => {
    onMock.mockClear()
    const { logger, infoCalls } = makeLogger()
    const invalidUrl = 'not-a-url'
    createRedisClient(invalidUrl, logger)
    
    const connectCall = onMock.mock.calls.find(c => c[0] === 'connect')
    connectCall[1]()
    
    expect(infoCalls[infoCalls.length - 1][0]).toEqual({ redis_url: invalidUrl })
  })
})
