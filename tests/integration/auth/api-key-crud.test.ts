import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { makeTestApp, signUpAndSignIn } from './_helpers'

describe('[Integration AUTH-12/14] API key CRUD flow', () => {
  const harness = makeTestApp()
  const email = `crud-${Date.now()}@example.test`
  let headers = new Headers()
  let userId = ''
  let createdId = ''

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

  test('POST returns flat DTO, GET lists without raw key, DELETE revokes', async () => {
    const postRes = await harness.app.handle(
      new Request('http://localhost/api-keys', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...Object.fromEntries(headers.entries()),
        },
        body: JSON.stringify({ label: 'primary', scopes: ['*'] }),
      }),
    )

    expect(postRes.status).toBe(201)
    const postBody = (await postRes.json()) as {
      id: string
      key: string
      prefix: string
      label: string
      scopes: ReadonlyArray<string>
      expiresAt: string | Date
      createdAt: string | Date
    }
    createdId = postBody.id
    expect(postBody.key).toContain('rig_live_')
    expect(postBody.prefix).toBeTruthy()
    expect(postBody.label).toBe('primary')
    expect(postBody.scopes).toEqual(['*'])
    expect(postBody.expiresAt).toBeTruthy()
    expect(postBody.createdAt).toBeTruthy()

    const listRes = await harness.app.handle(
      new Request('http://localhost/api-keys', {
        headers: Object.fromEntries(headers.entries()),
      }),
    )
    expect(listRes.status).toBe(200)
    const listBody = (await listRes.json()) as Array<Record<string, unknown>>
    const listed = listBody.find((row) => row.id === createdId)
    expect(listed).toBeTruthy()
    expect('key' in (listed as Record<string, unknown>)).toBe(false)

    const deleteRes = await harness.app.handle(
      new Request(`http://localhost/api-keys/${createdId}`, {
        method: 'DELETE',
        headers: Object.fromEntries(headers.entries()),
      }),
    )
    expect(deleteRes.status).toBe(200)
    expect(((await deleteRes.json()) as { revoked: boolean }).revoked).toBe(true)

    const afterRes = await harness.app.handle(
      new Request('http://localhost/api-keys', {
        headers: Object.fromEntries(headers.entries()),
      }),
    )
    expect(afterRes.status).toBe(200)
    const afterBody = (await afterRes.json()) as Array<Record<string, unknown>>
    const revoked = afterBody.find((row) => row.id === createdId)
    expect(revoked).toBeTruthy()
    expect(revoked?.revokedAt).toBeTruthy()
  })
})
