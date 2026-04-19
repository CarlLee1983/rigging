import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  type AgentsTestHarness,
  cleanupTestUser,
  makeAgentsTestHarness,
  signUpAndSignIn,
} from './_helpers'

describe('[Plan 04-04] EvalDataset CRUD (DEMO-03 + D-04 + D-05)', () => {
  let harness: AgentsTestHarness
  let headers: Headers
  let userId: string
  let agentId: string
  const email = `eds-crud-${Date.now()}@test.local`

  beforeAll(async () => {
    harness = makeAgentsTestHarness()
    const signed = await signUpAndSignIn(harness, email, 'Password123!')
    headers = signed.headers
    userId = signed.userId
    const res = await harness.realApp.handle(
      new Request('http://localhost/agents', {
        method: 'POST',
        headers: { ...Object.fromEntries(headers.entries()), 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'eds-agent' }),
      }),
    )
    agentId = ((await res.json()) as { id: string }).id
  })

  afterAll(async () => {
    await cleanupTestUser(harness.sql, userId, email)
    await harness.dispose()
  })

  test('POST /eval-datasets with valid cases → 201', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentId}/eval-datasets`, {
        method: 'POST',
        headers: { ...Object.fromEntries(headers.entries()), 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'dataset-1',
          cases: [
            { input: 'hello', expectedOutput: 'world' },
            { input: 'foo', expectedOutput: 'bar' },
          ],
        }),
      }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string; cases: Array<{ input: string }> }
    expect(body.cases.length).toBe(2)
  })

  test('POST with malformed case (missing expectedOutput) → 422 (TypeBox / Elysia validation)', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentId}/eval-datasets`, {
        method: 'POST',
        headers: { ...Object.fromEntries(headers.entries()), 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'bad',
          cases: [{ input: 'only-input' }],
        }),
      }),
    )
    expect(res.status).toBe(422)
  })

  test('POST with zero cases → 422 (minItems: 1)', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentId}/eval-datasets`, {
        method: 'POST',
        headers: { ...Object.fromEntries(headers.entries()), 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'empty', cases: [] }),
      }),
    )
    expect(res.status).toBe(422)
  })

  test('GET /eval-datasets → GET by id → DELETE → 404 flow', async () => {
    const createRes = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentId}/eval-datasets`, {
        method: 'POST',
        headers: { ...Object.fromEntries(headers.entries()), 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'to-delete', cases: [{ input: 'a', expectedOutput: 'b' }] }),
      }),
    )
    const { id: datasetId } = (await createRes.json()) as { id: string }
    const listRes = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentId}/eval-datasets`, { headers }),
    )
    expect(listRes.status).toBe(200)
    const getRes = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentId}/eval-datasets/${datasetId}`, { headers }),
    )
    expect(getRes.status).toBe(200)
    const delRes = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentId}/eval-datasets/${datasetId}`, {
        method: 'DELETE',
        headers,
      }),
    )
    expect(delRes.status).toBe(204)
    const getAfterRes = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentId}/eval-datasets/${datasetId}`, { headers }),
    )
    expect(getAfterRes.status).toBe(404)
  })
})
