import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { account } from '../../../auth/infrastructure/schema/account.schema'
import { apikey } from '../../../auth/infrastructure/schema/api-key.schema'
import { session } from '../../../auth/infrastructure/schema/session.schema'
import { user } from '../../../auth/infrastructure/schema/user.schema'
import { verification } from '../../../auth/infrastructure/schema/verification.schema'
import type { Config } from '../../../bootstrap/config'

/**
 * Shared Drizzle DB client factory. Used by BOTH:
 *   - /health probe (Phase 2 via IDbHealthProbe adapter)
 *   - Future BetterAuth drizzle-adapter + feature repositories (Phase 3+)
 *
 * Driver choice: postgres-js (NOT bun:sql) per ADR 0010 (pitfall #5 mitigation).
 */
export function createDbClient(config: Pick<Config, 'DATABASE_URL'>) {
  const sql = postgres(config.DATABASE_URL, {
    // postgres-js defaults are sufficient for Phase 2; tuning deferred per CONTEXT discretion.
    // max defaults to 10 concurrent connections.
    onnotice: () => {}, // suppress NOTICE log spam
  })
  const db = drizzle(sql, {
    schema: { account, apikey, session, user, verification },
  })
  return { db, sql }
}

export type DbClient = ReturnType<typeof createDbClient>
export type DrizzleDb = DbClient['db']
