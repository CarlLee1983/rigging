import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createApp } from '../../../src/bootstrap/app'
import { createFakeAuthInstance, TEST_CONFIG } from '../auth/_helpers'

describe('[Plan 04-03] createAgentsModule composability smoke (DEMO-06)', () => {
  let app: ReturnType<typeof createApp>

  beforeAll(() => {
    app = createApp(TEST_CONFIG, { authInstance: createFakeAuthInstance() })
  })

  afterAll(async () => {
    // createApp returns Elysia synchronously; nothing to dispose here (no DB connection made)
  })

  test('POST /agents without auth → 401 (global macro fires on new routes)', async () => {
    const res = await app.handle(
      new Request('http://localhost/agents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'smoke' }),
      }),
    )
    expect(res.status).toBe(401)
  })

  test('GET /agents/xyz/prompts/latest without auth → 401 (nested prefix macro fires)', async () => {
    const res = await app.handle(new Request('http://localhost/agents/xyz/prompts/latest'))
    expect(res.status).toBe(401)
  })

  test('GET /agents/xyz/eval-datasets without auth → 401 (second nested prefix)', async () => {
    const res = await app.handle(new Request('http://localhost/agents/xyz/eval-datasets'))
    expect(res.status).toBe(401)
  })

  test('Swagger JSON exposes /agents routes', async () => {
    const res = await app.handle(new Request('http://localhost/swagger/json'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { paths?: Record<string, unknown> }
    expect(body.paths).toBeDefined()
    const paths = Object.keys(body.paths ?? {})
    expect(paths.some((p) => p === '/agents' || p.startsWith('/agents'))).toBe(true)
    expect(paths.some((p) => p.includes('/prompts'))).toBe(true)
    expect(paths.some((p) => p.includes('/eval-datasets'))).toBe(true)
  })
})
