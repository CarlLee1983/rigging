import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  type AgentsTestHarness,
  cleanupTestUser,
  makeAgentsTestHarness,
  signUpAndSignIn,
} from './_helpers'

describe('[Plan 04-04] PromptVersion CRUD + monotonic (DEMO-02)', () => {
  let harness: AgentsTestHarness
  let headers: Headers
  let userId: string
  let agentId: string
  const email = `pv-crud-${Date.now()}@test.local`
  const password = 'Password123!'

  beforeAll(async () => {
    harness = makeAgentsTestHarness()
    const signed = await signUpAndSignIn(harness, email, password)
    headers = signed.headers
    userId = signed.userId
    const res = await harness.realApp.handle(
      new Request('http://localhost/agents', {
        method: 'POST',
        headers: { ...Object.fromEntries(headers.entries()), 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'prompts-test-agent' }),
      }),
    )
    const body = (await res.json()) as { id: string }
    agentId = body.id
  })

  afterAll(async () => {
    await cleanupTestUser(harness.sql, userId, email)
    await harness.dispose()
  })

  async function post(content: string) {
    return harness.realApp.handle(
      new Request(`http://localhost/agents/${agentId}/prompts`, {
        method: 'POST',
        headers: { ...Object.fromEntries(headers.entries()), 'content-type': 'application/json' },
        body: JSON.stringify({ content }),
      }),
    )
  }

  test('latest on agent with no prompts → 404', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentId}/prompts/latest`, { headers }),
    )
    expect(res.status).toBe(404)
  })

  test('sequential POST creates version 1, 2, 3', async () => {
    const r1 = await post('v1 content')
    expect(r1.status).toBe(201)
    expect(((await r1.json()) as { version: number }).version).toBe(1)
    const r2 = await post('v2 content')
    expect(((await r2.json()) as { version: number }).version).toBe(2)
    const r3 = await post('v3 content')
    expect(((await r3.json()) as { version: number }).version).toBe(3)
  })

  test('GET /prompts/latest returns newest', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentId}/prompts/latest`, { headers }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { version: number; content: string }
    expect(body.version).toBe(3)
    expect(body.content).toBe('v3 content')
  })

  test('GET /prompts/:version returns specific version', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentId}/prompts/1`, { headers }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { version: number; content: string }
    expect(body.version).toBe(1)
    expect(body.content).toBe('v1 content')
  })

  test('GET /prompts/99 (non-existent) → 404', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentId}/prompts/99`, { headers }),
    )
    expect(res.status).toBe(404)
  })

  test('GET /prompts lists newest-first', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentId}/prompts`, { headers }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as Array<{ version: number }>
    expect(body.map((p) => p.version)).toEqual([3, 2, 1])
  })
})
