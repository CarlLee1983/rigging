// HealthStatus — value object for operational health.
// Framework-free. Consumed by application + presentation; constructed only via the domain barrel factory.

export type DbState = 'up' | 'down' | 'unknown'

export interface HealthStatus {
  readonly ok: boolean
  readonly db: DbState
  readonly checkedAt: string // ISO-8601 string (CONTEXT discretion: ISO over Unix ms for consistency with pino timestamps)
}

export function makeHealthStatus(args: { db: DbState; checkedAt: Date }): HealthStatus {
  return Object.freeze({
    ok: args.db === 'up',
    db: args.db,
    checkedAt: args.checkedAt.toISOString(),
  })
}
