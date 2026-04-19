import { randomUUID } from 'node:crypto'
import { createApp } from '../../../src/bootstrap/app'
import type { DbClient } from '../../../src/shared/infrastructure/db/client'
import {
  followLatestVerificationEmail,
  insertTestApiKey,
  makeTestApp,
  serializeSessionCookie,
  signInAndGetHeaders,
  signUpAndSignIn,
  TEST_CONFIG,
  type TestHarness,
} from '../auth/_helpers'

export type { TestHarness }
export {
  followLatestVerificationEmail,
  insertTestApiKey,
  makeTestApp,
  serializeSessionCookie,
  signInAndGetHeaders,
  signUpAndSignIn,
  TEST_CONFIG,
}

export interface AgentsTestHarness extends TestHarness {
  realApp: ReturnType<typeof createApp>
}

export function makeAgentsTestHarness(): AgentsTestHarness {
  const base = makeTestApp()
  const realApp = createApp(TEST_CONFIG, { authInstance: base.auth })
  return { ...base, realApp }
}

export async function insertTestAgent(
  sql: DbClient['sql'],
  ownerId: string,
  name: string,
  opts: { createdAt?: Date } = {},
): Promise<{ id: string; ownerId: string; name: string; createdAt: Date; updatedAt: Date }> {
  const id = randomUUID()
  const now = opts.createdAt ?? new Date()
  const nowIso = now.toISOString()
  await sql`
    INSERT INTO "agent" (id, owner_id, name, created_at, updated_at)
    VALUES (${id}, ${ownerId}, ${name}, ${nowIso}, ${nowIso})
  `
  return { id, ownerId, name, createdAt: now, updatedAt: now }
}

export async function insertTestPromptVersion(
  sql: DbClient['sql'],
  agentId: string,
  version: number,
  content: string,
  opts: { createdAt?: Date } = {},
): Promise<{ id: string; agentId: string; version: number; content: string; createdAt: Date }> {
  const id = randomUUID()
  const now = opts.createdAt ?? new Date()
  await sql`
    INSERT INTO "prompt_version" (id, agent_id, version, content, created_at)
    VALUES (${id}, ${agentId}, ${version}, ${content}, ${now.toISOString()})
  `
  return { id, agentId, version, content, createdAt: now }
}

export async function cleanupTestUser(
  sql: DbClient['sql'],
  userId: string,
  email: string,
): Promise<void> {
  await sql`DELETE FROM "agent" WHERE owner_id = ${userId}`
  await sql`DELETE FROM "apikey" WHERE reference_id = ${userId}`
  await sql`DELETE FROM "account" WHERE user_id = ${userId}`
  await sql`DELETE FROM "session" WHERE user_id = ${userId}`
  await sql`DELETE FROM "verification" WHERE identifier = ${email}`
  await sql`DELETE FROM "user" WHERE id = ${userId}`
}
