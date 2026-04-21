import { Redis } from 'ioredis'
import type { Logger } from 'pino'

/**
 * Creates a configured Redis client with robust defaults for infrastructure use.
 *
 * Pattern: Infrastructure Adapter (ioredis)
 *
 * @param url - Redis connection string (redis://...)
 * @param logger - Pino logger instance for infrastructure status reporting
 */
export function createRedisClient(url: string, logger: Logger): Redis {
  const redactedUrl = maskRedisUrl(url)

  const client = new Redis(url, {
    // Fail fast for commands to prevent blocking the event loop
    maxRetriesPerRequest: 3,
    // Exponential backoff strategy capped at 2s
    retryStrategy(times) {
      const delay = Math.min(2 ** (times - 1) * 100, 2000)
      return delay
    },
  })

  client.on('connect', () => {
    logger.info({ redis_url: redactedUrl }, 'Redis connection established')
  })

  client.on('ready', () => {
    logger.info({ redis_url: redactedUrl }, 'Redis client ready')
  })

  client.on('reconnecting', (delay: number) => {
    logger.warn({ delay, redis_url: redactedUrl }, 'Redis client reconnecting')
  })

  client.on('error', (err) => {
    logger.error({ err, redis_url: redactedUrl }, 'Redis connection error')
  })

  return client
}

/**
 * Redacts sensitive credentials from a Redis connection URL.
 * Example: redis://user:password@host:port -> redis://user:***@host:port
 */
function maskRedisUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.password) {
      parsed.password = '***'
    }
    return parsed.toString().replace(/\/$/, '') // Remove trailing slash added by URL
  } catch {
    return url
  }
}
