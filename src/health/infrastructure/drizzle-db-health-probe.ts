import { sql } from 'drizzle-orm'
import type { DrizzleDb } from '../../shared/infrastructure/db/client'
import type { DbProbeResult, IDbHealthProbe } from '../application/ports/db-health-probe.port'

/**
 * DrizzleDbHealthProbe — implements IDbHealthProbe by issuing `SELECT 1` via Drizzle's `sql`
 * template on the shared postgres-js client.
 *
 * Why route through Drizzle (D-02): same path as Phase 3 repos will use. Healthcheck validates
 * the *real* DB path, not a side-channel postgres-js ping that could silently diverge.
 *
 * Timeout: 2000ms via AbortController (D-02). Beyond the timeout, returns 'down'.
 * Any other error is also mapped to 'down' so /health never 500s on infra flakiness — the
 * controller decides the HTTP status (200/503) based on this bool.
 */
export class DrizzleDbHealthProbe implements IDbHealthProbe {
  constructor(
    private readonly db: Pick<DrizzleDb, 'execute'>,
    private readonly timeoutMs = 2000,
  ) {}

  async probe(): Promise<DbProbeResult> {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), this.timeoutMs)
    try {
      await Promise.race([
        this.db.execute(sql`SELECT 1`),
        new Promise((_, reject) => {
          ac.signal.addEventListener('abort', () => reject(new Error('db-probe-timeout')), {
            once: true,
          })
        }),
      ])
      return 'up'
    } catch {
      return 'down'
    } finally {
      clearTimeout(timer)
    }
  }
}
