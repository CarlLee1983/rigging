import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  followLatestResetEmail,
  makeTestApp,
  serializeSessionCookie,
  signUpAndSignIn,
} from './_helpers'

describe('[Integration AUTH-09/10] password reset happy path', () => {
  const harness = makeTestApp()
  const email = `reset-${Date.now()}@example.test`
  const password = 'ResetPassword!123'
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

  test('request reset -> log link -> reset -> sign in with new password succeeds', async () => {
    await harness.auth.api.requestPasswordReset({
      body: { email },
    })
    const line = harness.emailOutbox.reset.at(-1) ?? ''
    expect(line).toContain('📧 CLICK THIS:')

    await followLatestResetEmail(harness, 'ResetPassword!456')

    const signIn = await harness.auth.api.signInEmail({
      body: {
        email,
        password: 'ResetPassword!456',
      },
    })
    expect(signIn.user.id).toBe(userId)
    headers = new Headers({ cookie: await serializeSessionCookie(harness, signIn.token) })
    const me = await harness.app.handle(
      new Request('http://localhost/me', { headers: Object.fromEntries(headers.entries()) }),
    )
    expect(me.status).toBe(200)
  })
})
