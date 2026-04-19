import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  type AgentsTestHarness,
  cleanupTestUser,
  insertTestApiKey,
  makeAgentsTestHarness,
  signUpAndSignIn,
} from './_helpers'

describe('[Plan 04-04] DEMO-04: Agent reads own latest prompt via API Key (4 variants)', () => {
  let harness: AgentsTestHarness
  let userAId: string
  let userBId: string
  let agentAId: string
  let userAFullKey: string
  let userAReadOnlyKey: string
  let userBFullKey: string
  const emailA = `dogfood-a-${Date.now()}@test.local`
  const emailB = `dogfood-b-${Date.now()}@test.local`

  beforeAll(async () => {
    harness = makeAgentsTestHarness()
    const a = await signUpAndSignIn(harness, emailA, 'Password123!')
    const b = await signUpAndSignIn(harness, emailB, 'Password123!')
    userAId = a.userId
    userBId = b.userId

    const agentRes = await harness.realApp.handle(
      new Request('http://localhost/agents', {
        method: 'POST',
        headers: { ...Object.fromEntries(a.headers.entries()), 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'dogfood-agent' }),
      }),
    )
    agentAId = ((await agentRes.json()) as { id: string }).id
    await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentAId}/prompts`, {
        method: 'POST',
        headers: { ...Object.fromEntries(a.headers.entries()), 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'system: you are helpful' }),
      }),
    )

    userAFullKey = (await insertTestApiKey(harness.sql, userAId, { scopes: ['*'] })).rawKey
    userAReadOnlyKey = (await insertTestApiKey(harness.sql, userAId, { scopes: ['read:*'] })).rawKey
    userBFullKey = (await insertTestApiKey(harness.sql, userBId, { scopes: ['*'] })).rawKey
  })

  afterAll(async () => {
    await cleanupTestUser(harness.sql, userAId, emailA)
    await cleanupTestUser(harness.sql, userBId, emailB)
    await harness.dispose()
  })

  test('Variant 1: full-scope API Key reads own latest prompt → 200 + content', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentAId}/prompts/latest`, {
        headers: { 'x-api-key': userAFullKey },
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { version: number; content: string }
    expect(body.version).toBe(1)
    expect(body.content).toBe('system: you are helpful')
  })

  test('Variant 2: read-only API Key reads own latest prompt → 200 (read needs no *)', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentAId}/prompts/latest`, {
        headers: { 'x-api-key': userAReadOnlyKey },
      }),
    )
    expect(res.status).toBe(200)
  })

  test('Variant 3: User B full-scope API Key reads User A agent → 404 RESOURCE_NOT_FOUND (D-09)', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentAId}/prompts/latest`, {
        headers: { 'x-api-key': userBFullKey },
      }),
    )
    expect(res.status).toBe(404)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'RESOURCE_NOT_FOUND',
    )
  })

  test('Variant 4: read-only API Key POSTs to own agent → 403 INSUFFICIENT_SCOPE (DEMO-05)', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentAId}/prompts`, {
        method: 'POST',
        headers: { 'x-api-key': userAReadOnlyKey, 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'attempt write with read-only' }),
      }),
    )
    expect(res.status).toBe(403)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'INSUFFICIENT_SCOPE',
    )
  })
})
