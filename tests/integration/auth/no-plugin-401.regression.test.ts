import { afterAll, describe, expect, test } from 'bun:test'
import { createApp } from '../../../src/bootstrap/app'
import { makeTestApp, TEST_CONFIG } from './_helpers'

describe('[Regression AUX-06] app without auth module - protected routes do not 500', () => {
  const harness = makeTestApp()
  const appWithoutAuth = createApp(TEST_CONFIG, { db: harness.db })

  test('GET /api-keys without auth module -> NOT 500 AND body does not leak userId/email/rig_live_', async () => {
    const res = await appWithoutAuth.handle(
      new Request('http://localhost/api-keys', { method: 'GET' }),
    )

    expect([401, 404, 501]).toContain(res.status)
    expect(res.status).not.toBe(500)

    const txt = await res.text()
    expect(txt).not.toMatch(/userId|email|rig_live_/)
  })

  afterAll(async () => {
    await harness.dispose()
  })
})
