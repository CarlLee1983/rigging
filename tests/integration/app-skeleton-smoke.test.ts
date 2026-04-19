import { describe, expect, test } from 'bun:test'
import { createApp } from '../../src/bootstrap/app'
import type { Config } from '../../src/bootstrap/config'
import type { IDbHealthProbe } from '../../src/health/application/ports/db-health-probe.port'
import { NotFoundError } from '../../src/shared/kernel/errors'

// Minimal test Config — avoids invoking loadConfig() which hits real env.
// LOG_LEVEL uses the real 'error' enum value per the config schema; no type-system escape hatch needed.
const TEST_CONFIG: Config = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3000',
  PORT: 3000,
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
}

// We pass a fake `db` through AppDeps — createHealthModule accepts a `probe` override so the
// fakeDb is never actually queried. createDbClient is skipped entirely when deps.db is provided.
const fakeDb = {} as never

function stubProbe(impl: () => Promise<'up' | 'down'>): IDbHealthProbe {
  return { probe: impl }
}

describe('app skeleton smoke (real createApp)', () => {
  test('/health → 200 on DB up + x-request-id UUID v4 echoed', async () => {
    const app = createApp(TEST_CONFIG, {
      db: fakeDb,
      probe: stubProbe(() => Promise.resolve('up')),
    })
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; db: string; checkedAt: string }
    expect(body.ok).toBe(true)
    expect(body.db).toBe('up')
    expect(typeof body.checkedAt).toBe('string')
    const rid = res.headers.get('x-request-id')
    expect(rid).toBeTruthy()
    expect(rid as string).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  test('/health → 503 on DB probe returning "down"', async () => {
    const app = createApp(TEST_CONFIG, {
      db: fakeDb,
      probe: stubProbe(() => Promise.resolve('down')),
    })
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(503)
    const body = (await res.json()) as { ok: boolean; db: string }
    expect(body.ok).toBe(false)
    expect(body.db).toBe('down')
  })

  test('/health → 503 on DB probe rejection (controller catches, NOT global 500)', async () => {
    const app = createApp(TEST_CONFIG, {
      db: fakeDb,
      probe: stubProbe(() => Promise.reject(new Error('conn refused'))),
    })
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(503)
    const body = (await res.json()) as { ok: boolean; db: string }
    expect(body.ok).toBe(false)
    expect(body.db).toBe('down')
  })

  test('/swagger → 200 with non-trivial body (OpenAPI served)', async () => {
    const app = createApp(TEST_CONFIG, {
      db: fakeDb,
      probe: stubProbe(() => Promise.resolve('up')),
    })
    const res = await app.handle(new Request('http://localhost/swagger'))
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text.length).toBeGreaterThan(100)
  })

  test('DomainError → mapped HTTP status + uniform body with requestId echoed (proves requestLogger ran before errorHandler onError)', async () => {
    // Build a real app then *append* a throwing route. This preserves the canonical plugin order
    // inside createApp and adds one extra route — the same way Phase 3 / Phase 4 will extend the app.
    const app = createApp(TEST_CONFIG, {
      db: fakeDb,
      probe: stubProbe(() => Promise.resolve('up')),
    }).get('/demo-404', () => {
      throw new NotFoundError('user X missing')
    })

    const res = await app.handle(new Request('http://localhost/demo-404'))
    expect(res.status).toBe(404)
    const body = (await res.json()) as {
      error: { code: string; message: string; requestId: string }
    }
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message).toBe('user X missing')
    expect(body.error.requestId).toBeTruthy()
    // requestId header must match body.error.requestId — proves requestLoggerPlugin.derive
    // executed BEFORE errorHandlerPlugin.onError (D-06 canonical ordering).
    expect(res.headers.get('x-request-id')).toBe(body.error.requestId)
  })

  test('client-supplied x-request-id is echoed in response header', async () => {
    const app = createApp(TEST_CONFIG, {
      db: fakeDb,
      probe: stubProbe(() => Promise.resolve('up')),
    })
    const res = await app.handle(
      new Request('http://localhost/health', {
        headers: { 'x-request-id': 'trace-42' },
      }),
    )
    expect(res.headers.get('x-request-id')).toBe('trace-42')
  })

  test('createApp(config, deps) — factory is synchronous (no thenable)', () => {
    // Guard: createApp must NOT be async. We check that the returned value is not a Promise by
    // probing for a .then property at runtime. Elysia instances have no .then at the type level,
    // so `'then' in maybeApp` is the type-system-safe assertion (no @ts-expect-error needed).
    const maybeApp = createApp(TEST_CONFIG, {
      db: fakeDb,
      probe: stubProbe(() => Promise.resolve('up')),
    })
    expect('then' in maybeApp).toBe(false)
    expect(typeof maybeApp.handle).toBe('function')
  })
})
