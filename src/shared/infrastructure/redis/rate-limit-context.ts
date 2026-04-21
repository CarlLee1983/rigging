import type { MaybePromise } from 'elysia'
import type { Context, Options } from 'elysia-rate-limit'
import type { Redis } from 'ioredis'

/**
 * Custom Redis-backed context for elysia-rate-limit.
 *
 * Pattern: Infrastructure Adapter (Redis)
 *
 * Implements the Context interface from elysia-rate-limit to provide
 * distributed rate limiting across multiple app instances.
 */
export class RedisRateLimitContext implements Context {
  private redis: Redis
  private duration = 60000 // default duration in ms
  private prefix: string

  constructor(redis: Redis, config?: { prefix?: string }) {
    this.redis = redis
    this.prefix = config?.prefix ?? 'rate-limit:'
  }

  /**
   * Initializes the context with plugin options.
   */
  init(options: Omit<Options, 'context'>): void {
    this.duration = options.duration
  }

  /**
   * Increments the count for a key and returns the current state.
   * Uses INCR and PTTL in a pipeline to minimize round-trips.
   */
  async increment(key: string): Promise<{ count: number; nextReset: Date }> {
    const fullKey = `${this.prefix}${key}`

    // Use pipeline for atomic-ish increment and ttl check
    const results = await this.redis.pipeline().incr(fullKey).pttl(fullKey).exec()

    if (!results || results.length < 2) {
      throw new Error('Redis pipeline failed')
    }

    const incrRes = results[0]
    const pttlRes = results[1]

    if (!incrRes || !pttlRes) {
      throw new Error('Redis pipeline returned incomplete results')
    }

    const [incrErr, count] = incrRes
    const [pttlErr, pttl] = pttlRes

    if (incrErr) throw incrErr
    if (pttlErr) throw pttlErr

    // If PTTL is -1, the key was just created by INCR and has no expiry
    if ((pttl as number) < 0) {
      await this.redis.pexpire(fullKey, this.duration)
      return {
        count: count as number,
        nextReset: new Date(Date.now() + this.duration),
      }
    }

    return {
      count: count as number,
      nextReset: new Date(Date.now() + (pttl as number)),
    }
  }

  /**
   * Decrements the count for a key.
   */
  async decrement(key: string): Promise<void> {
    const fullKey = `${this.prefix}${key}`
    await this.redis.decr(fullKey)
  }

  /**
   * Resets the count for a specific key or all keys if none provided.
   */
  async reset(key?: string): Promise<void> {
    if (key) {
      const fullKey = `${this.prefix}${key}`
      await this.redis.del(fullKey)
    } else {
      // For global reset, we find all keys with our prefix.
      // NOTE: In production with many keys, this might be slow.
      // However, for rate-limiting purposes, it is acceptable for infrastructure-level resets.
      const keys = await this.redis.keys(`${this.prefix}*`)
      if (keys.length > 0) {
        await this.redis.del(keys)
      }
    }
  }

  /**
   * Cleanup method called when the plugin is removed or app closes.
   */
  kill(): MaybePromise<void> {
    // No specific cleanup needed for Redis connection here as it is managed by AppDeps
  }
}
