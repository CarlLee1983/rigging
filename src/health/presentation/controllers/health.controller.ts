import { Elysia } from 'elysia'
import type { CheckHealthUseCase } from '../../application/usecases/check-health.usecase'

export interface HealthControllerDeps {
  checkHealth: CheckHealthUseCase
}

/**
 * Health controller — the ONE allowed operational (AuthContext-less) route in Phase 2.
 *
 * DB down → 503 via explicit try/catch (D-03). We deliberately DO NOT throw a DomainError here
 * because `/health` reports infrastructure availability, not a business rule violation. Global
 * error handler's DomainError→http mapping does not apply — operational state is its own idiom.
 *
 * Swagger: deliberately no `security` applied (D-15) — this route is public.
 */
export function healthController(deps: HealthControllerDeps) {
  return new Elysia({ name: 'rigging/health-controller' }).get(
    '/health',
    async ({ set }) => {
      try {
        const status = await deps.checkHealth.execute()
        set.status = status.ok ? 200 : 503
        return status
      } catch {
        set.status = 503
        return { ok: false, db: 'down' as const, checkedAt: new Date().toISOString() }
      }
    },
    {
      detail: {
        summary: 'Service health + DB connectivity',
        tags: ['health'],
        // Intentionally no `security` — D-15: P2 operational route is public.
      },
    },
  )
}
