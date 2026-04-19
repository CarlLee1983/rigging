import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { insertTestApiKey, makeTestApp, signUpAndSignIn } from './_helpers'

describe('[Integration AUTH-02 / AUX-07] /me endpoint identity routing', () => {
  const harness = makeTestApp()
  const email = `me-${Date.now()}@example.test`
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
    await harness.sql`DELETE FROM "apikey" WHERE reference_id = ${userId}`
    await harness.sql`DELETE FROM "account" WHERE user_id = ${userId}`
    await harness.sql`DELETE FROM "session" WHERE user_id = ${userId}`
    await harness.sql`DELETE FROM "verification" WHERE identifier = ${email}`
    await harness.sql`DELETE FROM "user" WHERE id = ${userId}`
    await harness.dispose()
  })

  test('API-key-only /me returns agent identity; cookie-only /me returns human identity', async () => {
    const agentRes = await harness.app.handle(
      new Request('http://localhost/me', {
        headers: { 'x-api-key': rawKey },
      }),
    )
    expect(agentRes.status).toBe(200)
    const agentBody = (await agentRes.json()) as Record<string, unknown>
    expect(agentBody.identityKind).toBe('agent')
    expect(agentBody.apiKeyId).toBeTruthy()
    expect('sessionId' in agentBody).toBe(false)

    const humanRes = await harness.app.handle(
      new Request('http://localhost/me', {
        headers: Object.fromEntries(headers.entries()),
      }),
    )
    expect(humanRes.status).toBe(200)
    const humanBody = (await humanRes.json()) as Record<string, unknown>
    expect(humanBody.identityKind).toBe('human')
    expect(humanBody.sessionId).toBeTruthy()
    expect('apiKeyId' in humanBody).toBe(false)
  })
})
