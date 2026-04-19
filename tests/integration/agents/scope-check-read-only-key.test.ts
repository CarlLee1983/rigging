import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  type AgentsTestHarness,
  cleanupTestUser,
  insertTestApiKey,
  makeAgentsTestHarness,
  signUpAndSignIn,
} from './_helpers'

describe('[Plan 04-04] DEMO-05: Read-only API Key rejected from every write endpoint', () => {
  let harness: AgentsTestHarness
  let userId: string
  let agentId: string
  let readOnlyKey: string
  const email = `scope-readonly-${Date.now()}@test.local`

  beforeAll(async () => {
    harness = makeAgentsTestHarness()
    const signed = await signUpAndSignIn(harness, email, 'Password123!')
    userId = signed.userId

    const res = await harness.realApp.handle(
      new Request('http://localhost/agents', {
        method: 'POST',
        headers: {
          ...Object.fromEntries(signed.headers.entries()),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'scope-test' }),
      }),
    )
    agentId = ((await res.json()) as { id: string }).id

    readOnlyKey = (await insertTestApiKey(harness.sql, userId, { scopes: ['read:*'] })).rawKey
  })

  afterAll(async () => {
    await cleanupTestUser(harness.sql, userId, email)
    await harness.dispose()
  })

  function withReadOnly(init: RequestInit = {}): RequestInit {
    const h = init.headers
    const base =
      h instanceof Headers
        ? Object.fromEntries(h.entries())
        : { ...(h as Record<string, string> | undefined) }
    return {
      ...init,
      headers: { ...base, 'x-api-key': readOnlyKey, 'content-type': 'application/json' },
    }
  }

  async function assertInsufficientScope(res: Response) {
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('INSUFFICIENT_SCOPE')
  }

  test('POST /agents → 403', async () => {
    const res = await harness.realApp.handle(
      new Request(
        'http://localhost/agents',
        withReadOnly({
          method: 'POST',
          body: JSON.stringify({ name: 'nope' }),
        }),
      ),
    )
    await assertInsufficientScope(res)
  })

  test('PATCH /agents/:id → 403', async () => {
    const res = await harness.realApp.handle(
      new Request(
        `http://localhost/agents/${agentId}`,
        withReadOnly({
          method: 'PATCH',
          body: JSON.stringify({ name: 'nope' }),
        }),
      ),
    )
    await assertInsufficientScope(res)
  })

  test('DELETE /agents/:id → 403', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentId}`, withReadOnly({ method: 'DELETE' })),
    )
    await assertInsufficientScope(res)
  })

  test('POST /agents/:id/prompts → 403', async () => {
    const res = await harness.realApp.handle(
      new Request(
        `http://localhost/agents/${agentId}/prompts`,
        withReadOnly({
          method: 'POST',
          body: JSON.stringify({ content: 'nope' }),
        }),
      ),
    )
    await assertInsufficientScope(res)
  })

  test('POST /agents/:id/eval-datasets → 403', async () => {
    const res = await harness.realApp.handle(
      new Request(
        `http://localhost/agents/${agentId}/eval-datasets`,
        withReadOnly({
          method: 'POST',
          body: JSON.stringify({ name: 'ds', cases: [{ input: 'a', expectedOutput: 'b' }] }),
        }),
      ),
    )
    await assertInsufficientScope(res)
  })

  test('GET /agents with read-only key → 200 (reads are allowed)', async () => {
    const res = await harness.realApp.handle(
      new Request('http://localhost/agents', {
        headers: { 'x-api-key': readOnlyKey },
      }),
    )
    expect(res.status).toBe(200)
  })
})
