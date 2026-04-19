import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  type AgentsTestHarness,
  cleanupTestUser,
  makeAgentsTestHarness,
  signUpAndSignIn,
} from './_helpers'

describe('[Plan 04-04] Agent CRUD (DEMO-01)', () => {
  let harness: AgentsTestHarness
  let headers: Headers
  let userId: string
  const email = `agent-crud-${Date.now()}@test.local`
  const password = 'Password123!'

  beforeAll(async () => {
    harness = makeAgentsTestHarness()
    const signed = await signUpAndSignIn(harness, email, password)
    headers = signed.headers
    userId = signed.userId
  })

  afterAll(async () => {
    await cleanupTestUser(harness.sql, userId, email)
    await harness.dispose()
  })

  test('POST /agents returns 201 with ownerId === caller', async () => {
    const res = await harness.realApp.handle(
      new Request('http://localhost/agents', {
        method: 'POST',
        headers: { ...Object.fromEntries(headers.entries()), 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'my-first-agent' }),
      }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string; ownerId: string; name: string }
    expect(body.ownerId).toBe(userId)
    expect(body.name).toBe('my-first-agent')
  })

  test('GET /agents lists created agents', async () => {
    const res = await harness.realApp.handle(new Request('http://localhost/agents', { headers }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as Array<{ name: string }>
    expect(body.some((a) => a.name === 'my-first-agent')).toBe(true)
  })

  test('GET /agents/:id → PATCH → DELETE flow', async () => {
    const createRes = await harness.realApp.handle(
      new Request('http://localhost/agents', {
        method: 'POST',
        headers: { ...Object.fromEntries(headers.entries()), 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'to-be-modified' }),
      }),
    )
    const { id } = (await createRes.json()) as { id: string }

    const getRes = await harness.realApp.handle(
      new Request(`http://localhost/agents/${id}`, { headers }),
    )
    expect(getRes.status).toBe(200)

    const patchRes = await harness.realApp.handle(
      new Request(`http://localhost/agents/${id}`, {
        method: 'PATCH',
        headers: { ...Object.fromEntries(headers.entries()), 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'renamed' }),
      }),
    )
    expect(patchRes.status).toBe(200)
    const patched = (await patchRes.json()) as { name: string }
    expect(patched.name).toBe('renamed')

    const delRes = await harness.realApp.handle(
      new Request(`http://localhost/agents/${id}`, {
        method: 'DELETE',
        headers,
      }),
    )
    expect(delRes.status).toBe(204)

    const getAgainRes = await harness.realApp.handle(
      new Request(`http://localhost/agents/${id}`, { headers }),
    )
    expect(getAgainRes.status).toBe(404)
  })
})
