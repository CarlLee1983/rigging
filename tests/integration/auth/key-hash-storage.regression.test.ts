import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { makeTestApp, signUpAndSignIn } from './_helpers'

describe('[Regression AUTH-13] API key stored as hash - DB contains no raw substring', () => {
  const harness = makeTestApp()
  const email = `keyhash-${Date.now()}@example.test`
  let headers = new Headers()
  let userId = ''
  let rawKey = ''

  beforeAll(async () => {
    const signed = await signUpAndSignIn(harness, email, 'password-123456')
    headers = signed.headers
    userId = signed.userId
    const res = await harness.app.handle(
      new Request('http://localhost/api-keys', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...Object.fromEntries(headers.entries()),
        },
        body: JSON.stringify({ label: 'hash-check', scopes: ['*'] }),
      }),
    )
    rawKey = ((await res.json()) as { key: string }).key
  })

  afterAll(async () => {
    await harness.sql`DELETE FROM "apikey" WHERE reference_id = ${userId}`
    await harness.sql`DELETE FROM "account" WHERE user_id = ${userId}`
    await harness.sql`DELETE FROM "session" WHERE user_id = ${userId}`
    await harness.sql`DELETE FROM "verification" WHERE identifier = ${email}`
    await harness.sql`DELETE FROM "user" WHERE id = ${userId}`
    await harness.dispose()
  })

  test('raw key substring absent from any apikey row column', async () => {
    const rows = await harness.sql`
      SELECT * FROM "apikey" WHERE reference_id = ${userId}
    `
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows as unknown as Array<Record<string, unknown>>) {
      for (const value of Object.values(row)) {
        if (typeof value === 'string') {
          expect(value).not.toContain(rawKey)
        }
      }
    }
  })
})
