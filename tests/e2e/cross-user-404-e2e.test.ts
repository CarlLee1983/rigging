import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { cleanupUser, type E2eHarness, makeE2eHarness, setupUser } from './_helpers'

describe('e2e: cross-user 404 across cookie AND api-key tracks (D-09 × resolver precedence)', () => {
  let harness: E2eHarness
  let userA: Awaited<ReturnType<typeof setupUser>>
  let userB: Awaited<ReturnType<typeof setupUser>>
  let userAAgentId: string
  let userBApiKey: string

  beforeAll(async () => {
    harness = makeE2eHarness()
    userA = await setupUser(harness, 'a')
    userB = await setupUser(harness, 'b')

    const agentRes = await harness.realApp.handle(
      new Request('http://localhost/agents', {
        method: 'POST',
        headers: {
          ...Object.fromEntries(userA.headers.entries()),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'a-private-agent' }),
      }),
    )
    userAAgentId = ((await agentRes.json()) as { id: string }).id

    const keyRes = await harness.realApp.handle(
      new Request('http://localhost/api-keys', {
        method: 'POST',
        headers: {
          ...Object.fromEntries(userB.headers.entries()),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ label: 'b-key', scopes: ['*'] }),
      }),
    )
    userBApiKey = ((await keyRes.json()) as { key: string }).key
  })

  afterAll(async () => {
    await cleanupUser(harness, userA.userId, userA.email)
    await cleanupUser(harness, userB.userId, userB.email)
    await harness.dispose()
  })

  test('user B (cookie) GET /agents/:userAAgentId → 404 RESOURCE_NOT_FOUND', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${userAAgentId}`, { headers: userB.headers }),
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('RESOURCE_NOT_FOUND')
  })

  test('user B (x-api-key, no cookie) GET /agents/:userAAgentId → 404 RESOURCE_NOT_FOUND', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${userAAgentId}`, {
        headers: { 'x-api-key': userBApiKey },
      }),
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('RESOURCE_NOT_FOUND')
  })
})
