import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  type AgentsTestHarness,
  cleanupTestUser,
  makeAgentsTestHarness,
  signUpAndSignIn,
} from './_helpers'

describe('[Plan 04-04] PromptVersion monotonic under concurrent writes (D-06)', () => {
  let harness: AgentsTestHarness
  let headers: Headers
  let userId: string
  let agentId: string
  const email = `pv-mono-${Date.now()}@test.local`

  beforeAll(async () => {
    harness = makeAgentsTestHarness()
    const signed = await signUpAndSignIn(harness, email, 'Password123!')
    headers = signed.headers
    userId = signed.userId
    const res = await harness.realApp.handle(
      new Request('http://localhost/agents', {
        method: 'POST',
        headers: { ...Object.fromEntries(headers.entries()), 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'race-test' }),
      }),
    )
    agentId = ((await res.json()) as { id: string }).id
  })

  afterAll(async () => {
    await cleanupTestUser(harness.sql, userId, email)
    await harness.dispose()
  })

  test('10 concurrent POSTs yield 10 distinct versions 1..10 with no holes', async () => {
    const N = 10
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        harness.realApp.handle(
          new Request(`http://localhost/agents/${agentId}/prompts`, {
            method: 'POST',
            headers: {
              ...Object.fromEntries(headers.entries()),
              'content-type': 'application/json',
            },
            body: JSON.stringify({ content: `concurrent-${i}` }),
          }),
        ),
      ),
    )

    const versions: number[] = []
    for (const res of results) {
      expect([201, 500]).toContain(res.status)
      if (res.status === 201) {
        versions.push(((await res.json()) as { version: number }).version)
      }
    }

    expect(versions.length).toBe(N)

    const sorted = [...versions].sort((a, b) => a - b)
    expect(new Set(sorted).size).toBe(sorted.length)
    expect(sorted[0]).toBe(1)
    expect(sorted[sorted.length - 1]).toBe(N)
    for (let i = 1; i < sorted.length; i++) {
      const hi = sorted[i]
      const lo = sorted[i - 1]
      if (hi === undefined || lo === undefined) throw new Error('unreachable')
      expect(hi - lo).toBe(1)
    }
  })
})
