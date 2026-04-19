import { Elysia } from 'elysia'
import pino, { type Logger } from 'pino'
import type { Config } from '../../../bootstrap/config'

export interface PinoConfig {
  NODE_ENV: Config['NODE_ENV']
  LOG_LEVEL: Config['LOG_LEVEL']
}

/**
 * Build the shared pino logger. Dev uses pino-pretty transport (D-10); other envs emit raw JSON.
 * Redact paths per D-11 — secrets never hit stdout even if headers are logged.
 */
export function createPinoLogger(cfg: PinoConfig): Logger {
  // Build options conditionally so `transport` is omitted (not set to undefined) in non-dev envs —
  // required by tsconfig `exactOptionalPropertyTypes: true`.
  const base = {
    level: cfg.LOG_LEVEL,
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers.authorization',
        'req.headers["x-api-key"]',
        'res.headers["set-cookie"]',
      ],
      censor: '[REDACTED]',
      remove: false,
    },
  }
  if (cfg.NODE_ENV === 'development') {
    return pino({
      ...base,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
      },
    })
  }
  return pino(base)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Global request logger plugin.
 *   - Derives requestId (per-request) from `x-request-id` header OR crypto.randomUUID() fallback (D-08).
 *   - Echoes requestId back via response header.
 *   - Emits one structured log per request with fields from D-09:
 *       requestId / method / path / status / durationMs / userAgent / remoteAddress
 *   - path includes query string; request/response body are NEVER logged (D-09).
 *
 * Elysia 1.4 uses `as: 'global'` for plugin-scope hook broadcast (replaces 1.3's `scope: 'global'`).
 * Without it, `.derive` / `.onAfterResponse` remain local to this plugin and downstream plugins
 * (error-handler, feature modules) don't see `requestId` — see research Pitfall #2.
 */
export function requestLoggerPlugin(logger: Logger) {
  return (
    new Elysia({ name: 'rigging/request-logger' })
      .decorate('log', logger)
      // Elysia 1.4 uses 'as: global' for plugin-scope hook broadcast (replaces 1.3's 'scope: global')
      .derive({ as: 'global' }, ({ request, set }) => {
        const incoming = request.headers.get('x-request-id')
        const requestId =
          incoming && UUID_RE.test(incoming) ? incoming : (incoming ?? crypto.randomUUID())
        set.headers['x-request-id'] = requestId
        return { requestId, startedAt: performance.now() }
      })
      .onAfterResponse({ as: 'global' }, (ctx) => {
        const url = new URL(ctx.request.url)
        const durationMs = Math.round(performance.now() - (ctx.startedAt as number))
        const status =
          typeof ctx.set.status === 'number' ? ctx.set.status : Number(ctx.set.status ?? 200)
        logger.info(
          {
            requestId: ctx.requestId,
            method: ctx.request.method,
            path: `${url.pathname}${url.search}`,
            status,
            durationMs,
            userAgent: ctx.request.headers.get('user-agent') ?? null,
            remoteAddress:
              ctx.request.headers.get('x-forwarded-for') ??
              ctx.request.headers.get('x-real-ip') ??
              null,
          },
          'request',
        )
      })
  )
}
