import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  type AgentsTestHarness,
  cleanupTestUser,
  insertTestPromptVersion,
  makeAgentsTestHarness,
  signUpAndSignIn,
} from './_helpers'

describe('[Plan 04-04] Cascade delete: agent removal cleans prompt_version + eval_dataset (D-12)', () => {
  let harness: AgentsTestHarness
  let userId: string
  let headers: Headers
  const email = `cascade-${Date.now()}@test.local`

  beforeAll(async () => {
    harness = makeAgentsTestHarness()
    const signed = await signUpAndSignIn(harness, email, 'Password123!')
    userId = signed.userId
    headers = signed.headers
  })

  afterAll(async () => {
    await cleanupTestUser(harness.sql, userId, email)
    await harness.dispose()
  })

  test('DELETE /agents/:id removes all prompt_version + eval_dataset rows', async () => {
    const createRes = await harness.realApp.handle(
      new Request('http://localhost/agents', {
        method: 'POST',
        headers: { ...Object.fromEntries(headers.entries()), 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'cascade-parent' }),
      }),
    )
    const { id: agentId } = (await createRes.json()) as { id: string }

    await insertTestPromptVersion(harness.sql, agentId, 1, 'v1')
    await insertTestPromptVersion(harness.sql, agentId, 2, 'v2')
    await insertTestPromptVersion(harness.sql, agentId, 3, 'v3')

    await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentId}/eval-datasets`, {
        method: 'POST',
        headers: { ...Object.fromEntries(headers.entries()), 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'ds', cases: [{ input: 'a', expectedOutput: 'b' }] }),
      }),
    )

    const preP =
      (await harness.sql`SELECT COUNT(*)::int AS c FROM "prompt_version" WHERE agent_id = ${agentId}`) as Array<{
        c: number
      }>
    const preD =
      (await harness.sql`SELECT COUNT(*)::int AS c FROM "eval_dataset" WHERE agent_id = ${agentId}`) as Array<{
        c: number
      }>
    expect(preP[0]?.c).toBe(3)
    expect(preD[0]?.c).toBe(1)

    const delRes = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentId}`, {
        method: 'DELETE',
        headers,
      }),
    )
    expect(delRes.status).toBe(204)

    const postP =
      (await harness.sql`SELECT COUNT(*)::int AS c FROM "prompt_version" WHERE agent_id = ${agentId}`) as Array<{
        c: number
      }>
    const postD =
      (await harness.sql`SELECT COUNT(*)::int AS c FROM "eval_dataset" WHERE agent_id = ${agentId}`) as Array<{
        c: number
      }>
    expect(postP[0]?.c).toBe(0)
    expect(postD[0]?.c).toBe(0)
  })
})
