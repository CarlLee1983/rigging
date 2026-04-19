import { Elysia } from 'elysia'
import type { DrizzleDb } from '../shared/infrastructure/db/client'
import type { IDbHealthProbe } from './application/ports/db-health-probe.port'
import { CheckHealthUseCase, type IClock } from './application/usecases/check-health.usecase'
import { DrizzleDbHealthProbe } from './infrastructure/drizzle-db-health-probe'
import { healthController } from './presentation/controllers/health.controller'

export interface HealthModuleDeps {
  db: DrizzleDb
  clock?: IClock // defaults to system clock
  probe?: IDbHealthProbe // override for tests
}

/**
 * createHealthModule — feature module factory (DI without IoC).
 *
 *   Wiring: infra(probe) → application(usecase) → presentation(controller) → Elysia plugin.
 *   This is THE template: Phase 3 createAuthModule / Phase 4 createAgentsModule clone this shape.
 */
export function createHealthModule(deps: HealthModuleDeps) {
  const clock: IClock = deps.clock ?? { now: () => new Date() }
  const probe: IDbHealthProbe = deps.probe ?? new DrizzleDbHealthProbe(deps.db)
  const checkHealth = new CheckHealthUseCase(probe, clock)
  return new Elysia({ name: 'rigging/health' }).use(healthController({ checkHealth }))
}
