import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { makeTestApp, signUpAndSignIn } from './_helpers'

describe('[Regression AUX-02] requireAuth scope is global only for protected routes', () => {
  const harness = makeTestApp()
  const email = `scope-${Date.now()}@example.test`
  let headers = new Headers()
  let userId = ''

  beforeAll(async () => {
    const signed = await signUpAndSignIn(harness, email, 'password-123456')
    headers = signed.headers
    userId = signed.userId
  })

  afterAll(async () => {
    await harness.sql`DELETE FROM "apikey" WHERE reference_id = ${userId}`
    await harness.sql`DELETE FROM "account" WHERE user_id = ${userId}`
    await harness.sql`DELETE FROM "session" WHERE user_id = ${userId}`
    await harness.sql`DELETE FROM "verification" WHERE identifier = ${email}`
    await harness.sql`DELETE FROM "user" WHERE id = ${userId}`
    await harness.dispose()
  })

  test('protected route exposes authContext while public route does not', async () => {
    const protectedRes = await harness.app.handle(
      new Request('http://localhost/scope-check/protected', {
        headers: Object.fromEntries(headers.entries()),
      }),
    )
    expect(protectedRes.status).toBe(200)
    const protectedBody = (await protectedRes.json()) as { authContext: Record<string, unknown> }
    expect(protectedBody.authContext).toBeTruthy()
    expect(protectedBody.authContext.identityKind).toBe('human')
    expect(protectedBody.authContext.userId).toBeTruthy()

    const publicRes = await harness.app.handle(new Request('http://localhost/scope-check/public'))
    expect(publicRes.status).toBe(200)
    const publicBody = (await publicRes.json()) as Record<string, unknown>
    expect(publicBody.ok).toBe(true)
    expect('authContext' in publicBody).toBe(false)
  })
})
