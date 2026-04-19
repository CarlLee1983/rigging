import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { makeTestApp } from './_helpers'

describe('[Regression AUTH-04] password stored hashed in account table', () => {
  const harness = makeTestApp()
  const email = `passwordhash-${Date.now()}@example.test`
  const password = 'PlaintextPassword!123'
  let userId = ''

  beforeAll(async () => {
    const result = await harness.registerUser.execute({
      email,
      password,
      name: 'Password Hash User',
    })
    userId = result.userId
  })

  afterAll(async () => {
    await harness.sql`DELETE FROM "apikey" WHERE reference_id = ${userId}`
    await harness.sql`DELETE FROM "account" WHERE user_id = ${userId}`
    await harness.sql`DELETE FROM "session" WHERE user_id = ${userId}`
    await harness.sql`DELETE FROM "verification" WHERE identifier = ${email}`
    await harness.sql`DELETE FROM "user" WHERE id = ${userId}`
    await harness.dispose()
  })

  test('account.password is not plaintext', async () => {
    const rows = await harness.sql`
      SELECT password FROM "account" WHERE user_id = ${userId}
    `
    const stored = (rows[0] as { password: string | null } | undefined)?.password
    expect(stored).toBeTruthy()
    expect(stored).not.toBe(password)
    expect(stored).not.toContain(password)
    expect((stored ?? '').length).toBeGreaterThan(password.length)
  })
})
