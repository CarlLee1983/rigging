import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { makeTestApp, signUpAndSignIn } from './_helpers'

describe('[Integration AUTH-01/02/03] human happy path', () => {
  const harness = makeTestApp()
  const email = `human-${Date.now()}@example.test`
  const password = 'HumanPassword!123'
  let userId = ''
  let headers = new Headers()

  beforeAll(async () => {
    const signed = await signUpAndSignIn(harness, email, password)
    userId = signed.userId
    headers = signed.headers
  })

  afterAll(async () => {
    await harness.sql`DELETE FROM "apikey" WHERE reference_id = ${userId}`
    await harness.sql`DELETE FROM "account" WHERE user_id = ${userId}`
    await harness.sql`DELETE FROM "session" WHERE user_id = ${userId}`
    await harness.sql`DELETE FROM "verification" WHERE identifier = ${email}`
    await harness.sql`DELETE FROM "user" WHERE id = ${userId}`
    await harness.dispose()
  })

  test('register -> verify -> sign in -> /me -> sign out', async () => {
    expect(harness.emailOutbox.verification.at(-1) ?? '').toContain('📧 CLICK THIS:')

    const meBefore = await harness.app.handle(
      new Request('http://localhost/me', { headers: Object.fromEntries(headers.entries()) }),
    )
    expect(meBefore.status).toBe(200)
    const meBody = (await meBefore.json()) as Record<string, unknown>
    expect(meBody.identityKind).toBe('human')
    expect(meBody.sessionId).toBeTruthy()
    expect('apiKeyId' in meBody).toBe(false)

    await harness.auth.api.signOut({ headers })

    const meAfter = await harness.app.handle(
      new Request('http://localhost/me', { headers: Object.fromEntries(headers.entries()) }),
    )
    expect(meAfter.status).toBe(401)
  })
})
