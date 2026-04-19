import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { followLatestResetEmail } from '../integration/auth/_helpers'
import { cleanupUser, type E2eHarness, makeE2eHarness, setupUser } from './_helpers'

describe('e2e: password-reset session isolation + apiKey lifecycle independence (AUTH-11)', () => {
  let harness: E2eHarness
  let user: Awaited<ReturnType<typeof setupUser>>
  let apiKeyRaw: string

  beforeAll(async () => {
    harness = makeE2eHarness()
    user = await setupUser(harness, 'reset-iso')
  })

  afterAll(async () => {
    await cleanupUser(harness, user.userId, user.email)
    await harness.dispose()
  })

  test('1. user mints apiKey K via cookie — 201 + rig_live_ prefix', async () => {
    const res = await harness.realApp.handle(
      new Request('http://localhost/api-keys', {
        method: 'POST',
        headers: {
          ...Object.fromEntries(user.headers.entries()),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ label: 'reset-iso-key', scopes: ['*'] }),
      }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { key: string }
    expect(body.key).toMatch(/^rig_live_/)
    apiKeyRaw = body.key
  })

  test('2. apiKey K works on /me before any reset — baseline 200', async () => {
    const res = await harness.realApp.handle(
      new Request('http://localhost/me', { headers: { 'x-api-key': apiKeyRaw } }),
    )
    expect(res.status).toBe(200)
  })

  test('3. user requests password reset; follow reset link from outbox', async () => {
    await harness.auth.api.requestPasswordReset({
      body: { email: user.email },
    })
    expect(harness.emailOutbox.reset.length).toBeGreaterThan(0)
    await followLatestResetEmail(harness, 'NewPassword456!')
  })

  test('4. session A returns 401 after reset (AUTH-11 session fixation mitigation)', async () => {
    const res = await harness.realApp.handle(
      new Request('http://localhost/me', { headers: user.headers }),
    )
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('UNAUTHENTICATED')
  })

  test('5. apiKey K still returns 200 after reset — apiKey lifecycle is independent of session', async () => {
    const res = await harness.realApp.handle(
      new Request('http://localhost/me', { headers: { 'x-api-key': apiKeyRaw } }),
    )
    expect(res.status).toBe(200)
  })
})
