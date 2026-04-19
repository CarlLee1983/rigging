import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
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
  const db = drizzle(sql)
  return { db, sql }
}

export type DbClient = ReturnType<typeof createDbClient>
export type DrizzleDb = DbClient['db']
