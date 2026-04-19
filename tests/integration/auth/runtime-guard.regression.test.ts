import { afterAll, describe, expect, test } from 'bun:test'
import { getApiKeyService } from '../../../src/auth/domain'
import { createApp } from '../../../src/bootstrap/app'
import { makeTestApp, TEST_CONFIG } from './_helpers'

describe('[Regression W-6] runtime guard surfaces AuthContextMissingError', () => {
  const harness = makeTestApp()
  const app = createApp(TEST_CONFIG, { db: harness.db })
    .derive(() => ({ authContext: undefined as never }))
    .get('/guard', ({ authContext }: { authContext?: unknown }) => {
      const svc = getApiKeyService(authContext as never)
      return { userId: svc.ctx.userId }
    })

  afterAll(async () => {
    await harness.dispose()
  })

  test('missing authContext returns 500 AUTH_CONTEXT_MISSING with teaching message', async () => {
    const res = await app.handle(new Request('http://localhost/guard'))
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: { code: string; message: string } }
    expect(body.error.code).toBe('AUTH_CONTEXT_MISSING')
    expect(body.error.message).toMatch(/AuthContext is missing/)
    expect(body.error.message).toMatch(/Reason:/)
    expect(body.error.message).toMatch(/0006-authcontext-boundary/)
    expect(body.error.message).toMatch(/Fix:/)
  })
})
