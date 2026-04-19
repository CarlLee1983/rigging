import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { cleanupUser, type E2eHarness, makeE2eHarness, setupUser } from './_helpers'

describe('e2e: dogfood happy path (DEMO-04 echoed at e2e + Success Criterion #1)', () => {
  let harness: E2eHarness
  let user: Awaited<ReturnType<typeof setupUser>>
  let agentId: string
  let apiKeyRaw: string

  beforeAll(async () => {
    harness = makeE2eHarness()
    user = await setupUser(harness, 'dogfood')
  })

  afterAll(async () => {
    await cleanupUser(harness, user.userId, user.email)
    await harness.dispose()
  })

  test('1. user creates an Agent via cookie session — 201 + ownerId matches', async () => {
    const res = await harness.realApp.handle(
      new Request('http://localhost/agents', {
        method: 'POST',
        headers: {
          ...Object.fromEntries(user.headers.entries()),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'dogfood-agent' }),
      }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string; ownerId: string; name: string }
    expect(body.ownerId).toBe(user.userId)
    expect(body.name).toBe('dogfood-agent')
    agentId = body.id
  })

  test('2. user creates a PromptVersion v1 (cookie session) — 201 + version=1', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentId}/prompts`, {
        method: 'POST',
        headers: {
          ...Object.fromEntries(user.headers.entries()),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ content: 'You are a helpful assistant.' }),
      }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { version: number; content: string }
    expect(body.version).toBe(1)
    expect(body.content).toBe('You are a helpful assistant.')
  })

  test('3. user mints an API Key (cookie session) — 201 + key starts with rig_live_', async () => {
    const res = await harness.realApp.handle(
      new Request('http://localhost/api-keys', {
        method: 'POST',
        headers: {
          ...Object.fromEntries(user.headers.entries()),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ label: 'dogfood-key', scopes: ['*'] }),
      }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { key: string }
    expect(body.key).toMatch(/^rig_live_/)
    apiKeyRaw = body.key
  })

  test('4. agent uses x-api-key (NO cookie) to read its own latest prompt — 200 + content match', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentId}/prompts/latest`, {
        headers: { 'x-api-key': apiKeyRaw },
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { version: number; content: string }
    expect(body.version).toBe(1)
    expect(body.content).toBe('You are a helpful assistant.')
  })
})
