import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
  followLatestResetEmail,
  makeTestApp,
  serializeSessionCookie,
  signUpAndSignIn,
} from './_helpers'

describe('[Regression AUTH-11] password reset session fixation', () => {
  const harness = makeTestApp()
  const spike = JSON.parse(
    readFileSync('.planning/phases/03-auth-foundation/03-01-spike-result.json', 'utf8'),
  ) as { scenario: 'A' | 'B'; wrap_required: boolean }
  const email = `fixation-${Date.now()}@example.test`
  let sessionA = new Headers()
  let sessionB = new Headers()
  let userId = ''

  beforeAll(async () => {
    expect(spike.scenario === 'B').toBe(spike.wrap_required)
    const signed = await signUpAndSignIn(harness, email, 'FixationPassword!123')
    userId = signed.userId
    sessionA = signed.headers
    const secondSignIn = await harness.auth.api.signInEmail({
      body: {
        email,
        password: 'FixationPassword!123',
      },
    })
    sessionB = new Headers({ cookie: await serializeSessionCookie(harness, secondSignIn.token) })
  })

  afterAll(async () => {
    await harness.sql`DELETE FROM "apikey" WHERE reference_id = ${userId}`
    await harness.sql`DELETE FROM "account" WHERE user_id = ${userId}`
    await harness.sql`DELETE FROM "session" WHERE user_id = ${userId}`
    await harness.sql`DELETE FROM "verification" WHERE identifier = ${email}`
    await harness.sql`DELETE FROM "user" WHERE id = ${userId}`
    await harness.dispose()
  })

  test('resetPassword invalidates the stale session cookie after reset', async () => {
    await harness.auth.api.requestPasswordReset({
      body: { email },
    })
    await followLatestResetEmail(harness, 'FixationPassword!456')

    const resA = await harness.app.handle(new Request('http://localhost/me', { headers: sessionA }))
    const resB = await harness.app.handle(new Request('http://localhost/me', { headers: sessionB }))

    expect(resA.status).toBe(401)
    expect(resB.status).toBe(401)
  })
})
