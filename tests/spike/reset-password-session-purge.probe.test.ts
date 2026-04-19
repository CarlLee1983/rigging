import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { apiKey } from '@better-auth/api-key'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { account } from '../../src/auth/infrastructure/schema/account.schema'
import { apikey } from '../../src/auth/infrastructure/schema/api-key.schema'
import { session } from '../../src/auth/infrastructure/schema/session.schema'
import { user } from '../../src/auth/infrastructure/schema/user.schema'
import { verification } from '../../src/auth/infrastructure/schema/verification.schema'
import { createDbClient } from '../../src/shared/infrastructure/db/client'

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://rigging:rigging_dev_password@localhost:5432/rigging'

function extractResetToken(url: string) {
  const parsed = new URL(url)
  const [, token] = parsed.pathname.split('/reset-password/')
  if (!token) throw new Error(`missing reset token in ${url}`)
  return token
}

async function resetSchema(sql: ReturnType<typeof createDbClient>['sql']) {
  await sql.unsafe('DROP SCHEMA IF EXISTS public CASCADE')
  await sql.unsafe('CREATE SCHEMA public')

  const migration = readFileSync('drizzle/0001_auth_foundation.sql', 'utf8')
  const statements = migration
    .split(/-->\s*statement-breakpoint\s*/g)
    .map((statement) => statement.trim())
    .filter(Boolean)

  for (const statement of statements) {
    await sql.unsafe(statement)
  }
}

// Drops and recreates `public` — must never run against a shared dev DB during `bun test`.
// Opt in: RIGGING_RUN_DESTRUCTIVE_SPIKE=1 bun test tests/spike/reset-password-session-purge.probe.test.ts
const runDestructiveProbe = process.env.RIGGING_RUN_DESTRUCTIVE_SPIKE === '1'

describe.skipIf(!runDestructiveProbe)('AUTH-11 reset-password session purge probe', () => {
  test('records BetterAuth 1.6.5 reset-password session retention behavior', async () => {
    const { db, sql } = createDbClient({ DATABASE_URL })

    try {
      await resetSchema(sql)

      const email = `probe-${crypto.randomUUID()}@example.com`
      const password = 'ProbePassword!123'
      const nextPassword = 'ProbePassword!456'
      let capturedResetUrl = ''

      const auth = betterAuth({
        database: drizzleAdapter(db, {
          provider: 'pg',
          schema: { account, apikey, session, user, verification },
        }),
        secret: 'abcdefghijklmnopqrstuvwxyzABCDEF123456',
        baseURL: 'http://localhost:3000',
        basePath: '/api/auth',
        emailAndPassword: {
          enabled: true,
          requireEmailVerification: false,
          sendResetPassword: async ({ url }) => {
            capturedResetUrl = url
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

      const signedUp = await auth.api.signUpEmail({
        body: {
          name: 'Probe User',
          email,
          password,
        },
      })

      await auth.api.signInEmail({
        body: {
          email,
          password,
        },
      })

      const before = (await sql`
        select count(*)::int as count
        from "session"
        where "user_id" = ${signedUp.user.id}
      `) as Array<{ count: number }>
      expect(before[0]?.count).toBe(2)

      await auth.api.requestPasswordReset({
        body: {
          email,
        },
      })

      const resetToken = extractResetToken(capturedResetUrl)
      await auth.api.resetPassword({
        body: {
          token: resetToken,
          newPassword: nextPassword,
        },
      })

      const after = (await sql`
        select count(*)::int as count
        from "session"
        where "user_id" = ${signedUp.user.id}
      `) as Array<{ count: number }>
      const sessionsAfterReset = after[0]?.count ?? 0

      const probeResult = {
        sessionsAfterReset,
        wrap_required: sessionsAfterReset > 0,
      }

      expect(probeResult).toEqual({
        sessionsAfterReset: 2,
        wrap_required: true,
      })
    } finally {
      await sql.end({ timeout: 5 })
    }
  })
})
