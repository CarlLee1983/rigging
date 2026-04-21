import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { RedisRateLimitContext } from '../../../../../src/shared/infrastructure/redis/rate-limit-context'

describe('RedisRateLimitContext', () => {
  let redis: any
  let context: RedisRateLimitContext

  beforeEach(() => {
    const pipeline = {
      incr: mock().mockReturnThis(),
      pttl: mock().mockReturnThis(),
      exec: mock(() => Promise.resolve([
        [null, 1], // count
        [null, -1] // pttl
      ]))
    }

    redis = {
      pipeline: mock(() => pipeline),
      pexpire: mock(() => Promise.resolve()),
      decr: mock(() => Promise.resolve()),
      del: mock(() => Promise.resolve()),
      keys: mock(() => Promise.resolve([]))
    }
    context = new RedisRateLimitContext(redis)
  })

  it('should initialize with duration', () => {
    // Should not throw
    context.init({ duration: 5000 } as any)
  })

  it('should increment and set expiry if pttl is -1', async () => {
    context.init({ duration: 5000 } as any)
    const result = await context.increment('test')

    expect(result.count).toBe(1)
    expect(redis.pipeline).toHaveBeenCalled()
    expect(redis.pexpire).toHaveBeenCalledWith('rate-limit:test', 5000)
  })

  it('should increment and return nextReset based on pttl', async () => {
    const pipeline = {
      incr: mock().mockReturnThis(),
      pttl: mock().mockReturnThis(),
      exec: mock(() => Promise.resolve([
        [null, 2],
        [null, 1000]
      ]))
    }
    redis.pipeline = mock(() => pipeline)
    
    const result = await context.increment('test')
    expect(result.count).toBe(2)
    expect(redis.pexpire).not.toHaveBeenCalled()
    
    // 1000ms from now
    const now = Date.now()
    expect(result.nextReset.getTime()).toBeGreaterThanOrEqual(now + 900)
    expect(result.nextReset.getTime()).toBeLessThanOrEqual(now + 1100)
  })

  it('should decrement', async () => {
    await context.decrement('test')
    expect(redis.decr).toHaveBeenCalledWith('rate-limit:test')
  })

  it('should reset specific key', async () => {
    await context.reset('test')
    expect(redis.del).toHaveBeenCalledWith('rate-limit:test')
  })

  it('should reset all keys with prefix', async () => {
    redis.keys = mock(() => Promise.resolve(['rate-limit:a', 'rate-limit:b']))
    await context.reset()
    expect(redis.keys).toHaveBeenCalledWith('rate-limit:*')
    expect(redis.del).toHaveBeenCalledWith(['rate-limit:a', 'rate-limit:b'])
  })

  it('should handle kill', async () => {
    // Should not throw
    await context.kill()
  })
})
