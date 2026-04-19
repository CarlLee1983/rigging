/**
 * BetterAuth instance factory.
 *
 * [D-15 HARD CONSTRAINT] This file imports ONLY `better-auth`, `@better-auth/drizzle-adapter`,
 * and the local `DrizzleDb` type. NO `elysia` import (direct or transitive). BetterAuth CLI
 * (`bunx @better-auth/cli generate`) parses this file to emit Drizzle schema; an elysia import
 * in the graph breaks schema generation (Pitfall #5446 — better-auth GitHub issue).
 *
 * Config callbacks (sendVerificationEmail / sendResetPassword) are PASSED IN rather than
 * imported from `src/auth/infrastructure/email/**` — keeps this file dependency-light so the
 * CLI bootstrap cannot traverse into feature wiring code.
 *
 * See: .planning/phases/03-auth-foundation/03-CONTEXT.md D-13..D-18, D-23.
 */

import { apiKey } from '@better-auth/api-key'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import type { DrizzleDb } from '../../../shared/infrastructure/db/client'

export interface AuthInstanceConfig {
  secret: string
  baseURL: string
  sendVerificationEmail: (params: { url: string; email: string }) => Promise<void>
  sendResetPassword: (params: { url: string; email: string }) => Promise<void>
}

export function createAuthInstance(db: DrizzleDb, cfg: AuthInstanceConfig) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg' }),
    secret: cfg.secret,
    baseURL: cfg.baseURL,
    basePath: '/api/auth',
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        await cfg.sendVerificationEmail({ url, email: user.email })
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await cfg.sendResetPassword({ url, email: user.email })
      },
    },
    plugins: [
      apiKey({
        enableMetadata: true,
      }),
    ],
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      storage: 'memory',
    },
  })
}

// CLI entrypoint export required by `bunx @better-auth/cli generate`.
// The stub DB keeps module evaluation side-effect free; downstream runtime code should
// use `createAuthInstance(realDb, cfg)` instead of importing this export.
export const auth = createAuthInstance({} as DrizzleDb, {
  secret: process.env.BETTER_AUTH_SECRET ?? 'x'.repeat(32),
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  sendVerificationEmail: async () => {},
  sendResetPassword: async () => {},
})

export type AuthInstance = ReturnType<typeof createAuthInstance>
