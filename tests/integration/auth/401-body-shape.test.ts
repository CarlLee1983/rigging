import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { insertTestApiKey, makeTestApp } from './_helpers'

describe('[Regression T-03-401-BODY] uniform 401 body shape', () => {
  const harness = makeTestApp()
  const email = `bodyshape-${Date.now()}@example.test`
  let userId = ''
  let revokedRawKey = ''
  let expiredRawKey = ''

  beforeAll(async () => {
    const result = await harness.registerUser.execute({
      email,
      password: 'password-123456',
      name: 'Body Shape User',
    })
    userId = result.userId

    const revoked = await insertTestApiKey(harness.sql, userId, { scopes: ['*'] })
    revokedRawKey = revoked.rawKey
    await harness.sql`UPDATE "apikey" SET enabled = false WHERE reference_id = ${userId} AND id = ${revoked.id}`

    const expired = await insertTestApiKey(harness.sql, userId, {
      scopes: ['*'],
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
    })
    expiredRawKey = expired.rawKey
  })

  afterAll(async () => {
    await harness.sql`DELETE FROM "apikey" WHERE reference_id = ${userId}`
    await harness.sql`DELETE FROM "account" WHERE user_id = ${userId}`
    await harness.sql`DELETE FROM "session" WHERE user_id = ${userId}`
    await harness.sql`DELETE FROM "verification" WHERE identifier = ${email}`
    await harness.sql`DELETE FROM "user" WHERE id = ${userId}`
    await harness.dispose()
  })

  async function get401Body(init: RequestInit) {
    const res = await harness.app.handle(new Request('http://localhost/me', init))
    expect(res.status).toBe(401)
    return (await res.json()) as { error: { code: string; message: string; requestId: string } }
  }

  test('all reject paths return identical 401 error body shape', async () => {
    const bodies = [
      await get401Body({}),
      await get401Body({ headers: { 'x-api-key': 'not-a-rig-key' } }),
      await get401Body({ headers: { 'x-api-key': `rig_live_${'X'.repeat(64)}` } }),
      await get401Body({ headers: { 'x-api-key': revokedRawKey } }),
      await get401Body({ headers: { 'x-api-key': expiredRawKey } }),
      await get401Body({ headers: { cookie: 'better-auth.session_token=bogus' } }),
    ]

    for (const body of bodies) {
      expect(body.error.code).toBe('UNAUTHENTICATED')
      expect(body.error.message).toBe('Authentication required')
      expect(body.error.requestId).toBeTruthy()
    }

    const first = bodies[0]
    expect(first).toBeTruthy()
    if (!first) return
    for (const body of bodies.slice(1)) {
      expect({ code: body.error.code, message: body.error.message }).toEqual({
        code: first.error.code,
        message: first.error.message,
      })
    }
  })
})
