import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  type AgentsTestHarness,
  cleanupTestUser,
  makeAgentsTestHarness,
  signUpAndSignIn,
} from './_helpers'

describe('[Plan 04-04] Cross-user access returns 404 RESOURCE_NOT_FOUND (D-09)', () => {
  let harness: AgentsTestHarness
  let userAId: string
  let userBId: string
  let userAAgentId: string
  let userBHeaders: Headers
  const emailA = `user-a-${Date.now()}@test.local`
  const emailB = `user-b-${Date.now()}@test.local`

  beforeAll(async () => {
    harness = makeAgentsTestHarness()
    const a = await signUpAndSignIn(harness, emailA, 'Password123!')
    userAId = a.userId
    const b = await signUpAndSignIn(harness, emailB, 'Password123!')
    userBId = b.userId
    userBHeaders = b.headers

    const res = await harness.realApp.handle(
      new Request('http://localhost/agents', {
        method: 'POST',
        headers: { ...Object.fromEntries(a.headers.entries()), 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'user-a-agent' }),
      }),
    )
    userAAgentId = ((await res.json()) as { id: string }).id
  })

  afterAll(async () => {
    await cleanupTestUser(harness.sql, userAId, emailA)
    await cleanupTestUser(harness.sql, userBId, emailB)
    await harness.dispose()
  })

  test('User B GET /agents/:userAAgentId → 404 RESOURCE_NOT_FOUND', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${userAAgentId}`, {
        headers: userBHeaders,
      }),
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('RESOURCE_NOT_FOUND')
  })

  test('User B PATCH /agents/:userAAgentId → 404', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${userAAgentId}`, {
        method: 'PATCH',
        headers: {
          ...Object.fromEntries(userBHeaders.entries()),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'hijack' }),
      }),
    )
    expect(res.status).toBe(404)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'RESOURCE_NOT_FOUND',
    )
  })

  test('User B DELETE /agents/:userAAgentId → 404', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${userAAgentId}`, {
        method: 'DELETE',
        headers: userBHeaders,
      }),
    )
    expect(res.status).toBe(404)
  })

  test('User B POST /agents/:userAAgentId/prompts → 404 (ownership fails before scope would)', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${userAAgentId}/prompts`, {
        method: 'POST',
        headers: {
          ...Object.fromEntries(userBHeaders.entries()),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ content: 'hijack prompt' }),
      }),
    )
    expect(res.status).toBe(404)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'RESOURCE_NOT_FOUND',
    )
  })
})
