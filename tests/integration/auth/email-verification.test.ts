import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { followLatestVerificationEmail, makeTestApp, signUpAndSignIn } from './_helpers'

describe('[Integration AUTH-06/07] email verification flow', () => {
  const harness = makeTestApp()
  const email = `verify-${Date.now()}@example.test`
  const password = 'VerifyPassword!123'
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

  test('register logs verification link and the token verifies the account', async () => {
    const line = harness.emailOutbox.verification.at(-1) ?? ''
    expect(line).toContain('📧 CLICK THIS:')
    expect(line).toContain('http')

    await followLatestVerificationEmail(harness)
    const me = await harness.app.handle(
      new Request('http://localhost/me', { headers: Object.fromEntries(headers.entries()) }),
    )
    expect(me.status).toBe(200)
    const body = (await me.json()) as Record<string, unknown>
    expect(body.identityKind).toBe('human')
  })
})
