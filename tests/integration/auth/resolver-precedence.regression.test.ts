import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { insertTestApiKey, makeTestApp, signUpAndSignIn } from './_helpers'

describe('[Regression AUX-07 / D-09 / D-11] resolver precedence', () => {
  const harness = makeTestApp()
  const email = `dual-${Date.now()}@example.test`
  let headers = new Headers()
  let userId = ''
  let rawKey = ''

  beforeAll(async () => {
    const signed = await signUpAndSignIn(harness, email, 'password-123456')
    headers = signed.headers
    userId = signed.userId
    const inserted = await insertTestApiKey(harness.sql, userId, { scopes: ['*'] })
    rawKey = inserted.rawKey
  })

  afterAll(async () => {
    await harness.sql`
      DELETE FROM "apikey" WHERE reference_id = ${userId}
    `
    await harness.sql`
      DELETE FROM "account" WHERE user_id = ${userId}
    `
    await harness.sql`
      DELETE FROM "session" WHERE user_id = ${userId}
    `
    await harness.sql`
      DELETE FROM "verification" WHERE identifier = ${email}
    `
    await harness.sql`
      DELETE FROM "user" WHERE id = ${userId}
    `
    await harness.dispose()
  })

  test('valid API Key + valid cookie -> /me identityKind=agent (D-11 precedence)', async () => {
    const res = await harness.app.handle(
      new Request('http://localhost/me', {
        headers: {
          ...Object.fromEntries(headers.entries()),
          'x-api-key': rawKey,
        },
      }),
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.identityKind).toBe('agent')
    expect(body.apiKeyId).toBeTruthy()
    expect('sessionId' in body).toBe(false)
  })

  test('cookie-only (human path) -> /me body has NO apiKeyId key', async () => {
    const res = await harness.app.handle(
      new Request('http://localhost/me', {
        headers: Object.fromEntries(headers.entries()),
      }),
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.identityKind).toBe('human')
    expect('apiKeyId' in body).toBe(false)
    expect(body.sessionId).toBeTruthy()
  })

  test('INVALID API Key + valid cookie -> hard 401 (D-09 no fallback)', async () => {
    const res = await harness.app.handle(
      new Request('http://localhost/me', {
        headers: {
          ...Object.fromEntries(headers.entries()),
          'x-api-key': 'rig_live_tampered-totally-invalid-key-value-zzz',
        },
      }),
    )

    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('UNAUTHENTICATED')
  })

  test('MALFORMED API Key + valid cookie -> hard 401 (D-10 fast-reject)', async () => {
    const res = await harness.app.handle(
      new Request('http://localhost/me', {
        headers: {
          ...Object.fromEntries(headers.entries()),
          'x-api-key': 'not-a-rig-key',
        },
      }),
    )

    expect(res.status).toBe(401)
  })
})
