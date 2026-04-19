import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { makeTestApp } from './_helpers'

describe('[Regression AUX-04 / D-10] API key timing alignment', () => {
  const harness = makeTestApp()
  const email = `timing-${Date.now()}@example.test`

  beforeAll(async () => {
    await harness.registerUser.execute({
      email,
      password: 'password-123456',
      name: 'Timing User',
    })
  })

  afterAll(async () => {
    const userRows = await harness.sql`
      SELECT id FROM "user" WHERE email = ${email}
    `
    const userId = (userRows[0] as { id: string } | undefined)?.id
    if (userId) {
      await harness.sql`DELETE FROM "apikey" WHERE reference_id = ${userId}`
      await harness.sql`DELETE FROM "account" WHERE user_id = ${userId}`
      await harness.sql`DELETE FROM "session" WHERE user_id = ${userId}`
      await harness.sql`DELETE FROM "verification" WHERE identifier = ${email}`
      await harness.sql`DELETE FROM "user" WHERE id = ${userId}`
    }
    await harness.dispose()
  })

  test('1000-iteration latency: |t_malformed - t_valid_wrong_hash| / t_valid_wrong_hash < 0.2', async () => {
    const N = 1000
    const malformedKey = 'not-rig-format'
    const validFormatWrongKey = `rig_live_${'X'.repeat(64)}`

    for (let i = 0; i < 100; i += 1) {
      await harness.app.handle(
        new Request('http://localhost/me', { headers: { 'x-api-key': malformedKey } }),
      )
      await harness.app.handle(
        new Request('http://localhost/me', { headers: { 'x-api-key': validFormatWrongKey } }),
      )
    }

    let malTotal = 0
    let wrongHashTotal = 0

    for (let i = 0; i < N; i += 1) {
      const t1 = performance.now()
      await harness.app.handle(
        new Request('http://localhost/me', { headers: { 'x-api-key': malformedKey } }),
      )
      malTotal += performance.now() - t1

      const t2 = performance.now()
      await harness.app.handle(
        new Request('http://localhost/me', { headers: { 'x-api-key': validFormatWrongKey } }),
      )
      wrongHashTotal += performance.now() - t2
    }

    const malMean = malTotal / N
    const wrongHashMean = wrongHashTotal / N
    const delta = Math.abs(malMean - wrongHashMean)
    const ratio = delta / wrongHashMean
    console.log(JSON.stringify({ test: 'timing-safe-apikey', malMean, wrongHashMean, ratio }))
    expect(ratio).toBeLessThan(0.2)
  })
})
