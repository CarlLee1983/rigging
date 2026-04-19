import { describe, expect, test } from 'bun:test'
import { Elysia } from 'elysia'
import pino from 'pino'
import {
  createPinoLogger,
  requestLoggerPlugin,
} from '../../../../src/shared/presentation/plugins/request-logger.plugin'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Helper: build a pino logger that writes into a captured-chunks buffer. */
function capturingLogger(level = 'info') {
  const chunks: string[] = []
  const destination = {
    write: (s: string) => {
      chunks.push(s)
      return true
    },
  }
  const logger = pino(
    {
      level,
      redact: {
        paths: [
          'req.headers.cookie',
          'req.headers.authorization',
          'req.headers["x-api-key"]',
          'res.headers["set-cookie"]',
        ],
        censor: '[REDACTED]',
      },
    },
    destination as unknown as NodeJS.WritableStream,
  )
  return { logger, chunks }
}

describe('requestLoggerPlugin', () => {
  test('generates uuid v4 requestId when no header present and echoes via x-request-id', async () => {
    const logger = createPinoLogger({ NODE_ENV: 'test', LOG_LEVEL: 'error' })
    const app = new Elysia()
      .use(requestLoggerPlugin(logger))
      .get('/ping', ({ requestId }) => ({ requestId }))

    const res = await app.handle(new Request('http://localhost/ping'))
    const echoed = res.headers.get('x-request-id')
    expect(echoed).not.toBeNull()
    expect(echoed as string).toMatch(UUID_V4)
    const body = (await res.json()) as { requestId: string }
    expect(body.requestId).toBe(echoed as string)
  })

  test('echoes client-supplied x-request-id header unchanged', async () => {
    const logger = createPinoLogger({ NODE_ENV: 'test', LOG_LEVEL: 'error' })
    const app = new Elysia()
      .use(requestLoggerPlugin(logger))
      .get('/ping', ({ requestId }) => ({ requestId }))

    const res = await app.handle(
      new Request('http://localhost/ping', {
        headers: { 'x-request-id': 'client-supplied-abc' },
      }),
    )
    expect(res.headers.get('x-request-id')).toBe('client-supplied-abc')
    const body = (await res.json()) as { requestId: string }
    expect(body.requestId).toBe('client-supplied-abc')
  })

  test('createPinoLogger redacts sensitive header fields', async () => {
    const { logger, chunks } = capturingLogger('info')
    logger.info(
      {
        req: {
          headers: {
            cookie: 's=abc',
            authorization: 'Bearer xyz',
            'x-api-key': 'rig_live_123',
          },
        },
        res: { headers: { 'set-cookie': 'session=new' } },
      },
      'hit',
    )
    const out = chunks.join('')
    expect(out).toContain('[REDACTED]')
    expect(out).not.toContain('s=abc')
    expect(out).not.toContain('Bearer xyz')
    expect(out).not.toContain('rig_live_123')
    expect(out).not.toContain('session=new')
  })

  test('structured request log emitted on real request with all 7 D-09 fields', async () => {
    const { logger, chunks } = capturingLogger('info')
    const app = new Elysia().use(requestLoggerPlugin(logger)).get('/ping', () => 'ok')

    const res = await app.handle(
      new Request('http://localhost/ping?q=1', {
        headers: { 'user-agent': 'test-agent/1.0' },
      }),
    )
    expect(res.status).toBe(200)
    // onAfterResponse fires after handle() returns — yield so the hook + pino sync write complete.
    await new Promise((r) => setTimeout(r, 10))

    // Find the request-summary log line — onAfterResponse emits one pino.info per request.
    // Each chunk is a single newline-terminated JSON object; parse all and pick the one
    // whose msg === 'request' (our log() call message).
    const lines = chunks
      .flatMap((c) => c.split('\n'))
      .filter((l) => l.trim().length > 0)
      .map((l) => {
        try {
          return JSON.parse(l) as Record<string, unknown>
        } catch {
          return null
        }
      })
      .filter((o): o is Record<string, unknown> => o !== null)

    const reqLog = lines.find((l) => l.msg === 'request')
    expect(reqLog).toBeDefined()
    if (!reqLog) return // satisfies TS

    // D-09 mandatory fields: requestId / method / path / status / durationMs / userAgent / remoteAddress
    expect(typeof reqLog.requestId).toBe('string')
    expect((reqLog.requestId as string).length).toBeGreaterThan(0)
    expect(reqLog.method).toBe('GET')
    // Our plugin emits `path` (pathname + search); accept either 'path' or 'url' defensively.
    const pathField = (reqLog.path ?? reqLog.url) as string | undefined
    expect(typeof pathField).toBe('string')
    expect(pathField as string).toContain('/ping')
    expect(pathField as string).toContain('q=1')
    expect(reqLog.status).toBe(200)
    expect(typeof reqLog.durationMs).toBe('number')
    expect(reqLog.durationMs as number).toBeGreaterThanOrEqual(0)
    expect(reqLog.userAgent).toBe('test-agent/1.0')
    // remoteAddress may be null in an in-process Request (no x-forwarded-for) — key must still be present.
    expect(Object.hasOwn(reqLog, 'remoteAddress')).toBe(true)
  })
})
