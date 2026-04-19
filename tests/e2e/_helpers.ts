import { createApp } from '../../src/bootstrap/app'
import {
  followLatestVerificationEmail,
  insertTestApiKey,
  makeTestApp,
  serializeSessionCookie,
  signInAndGetHeaders,
  signUpAndSignIn,
  TEST_CONFIG,
  type TestHarness,
} from '../integration/auth/_helpers'

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

export interface E2eHarness extends TestHarness {
  /**
   * realApp = createApp(TEST_CONFIG, { authInstance: base.auth })
   *
   * E2E tests MUST use this (NOT TestHarness.app, which is the P3 hand-wired auth-only Elysia).
   * This exercises the FULL createApp plugin chain — auth + agents modules + global plugins —
   * so any plugin-ordering regression (ADR 0012) shows up here.
   */
  realApp: ReturnType<typeof createApp>
}

export function makeE2eHarness(): E2eHarness {
  const base = makeTestApp()
  const realApp = createApp(TEST_CONFIG, { authInstance: base.auth })
  return { ...base, realApp } as E2eHarness
}

export async function setupUser(
  harness: TestHarness,
  prefix: string,
): Promise<{
  userId: string
  email: string
  password: string
  headers: Headers
  cookie: string
}> {
  const email = `e2e-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@example.test`
  const password = 'Password123!'
  const signed = await signUpAndSignIn(harness, email, password)
  return {
    userId: signed.userId,
    email,
    password,
    headers: signed.headers,
    cookie: signed.cookie,
  }
}

export async function cleanupUser(
  harness: TestHarness,
  userId: string,
  email: string,
): Promise<void> {
  await harness.sql`DELETE FROM "agent" WHERE owner_id = ${userId}`
  await harness.sql`DELETE FROM "apikey" WHERE reference_id = ${userId}`
  await harness.sql`DELETE FROM "account" WHERE user_id = ${userId}`
  await harness.sql`DELETE FROM "session" WHERE user_id = ${userId}`
  await harness.sql`DELETE FROM "verification" WHERE identifier = ${email}`
  await harness.sql`DELETE FROM "user" WHERE id = ${userId}`
}
