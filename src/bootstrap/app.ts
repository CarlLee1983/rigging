import { Elysia } from 'elysia'
import { createAuthModule } from '../auth/auth.module'
import type { AuthInstance } from '../auth/infrastructure/better-auth/auth-instance'
import type { IDbHealthProbe } from '../health/application/ports/db-health-probe.port'
import { createHealthModule, type HealthModuleDeps } from '../health/health.module'
import { createDbClient, type DrizzleDb } from '../shared/infrastructure/db/client'
import { corsPlugin } from '../shared/presentation/plugins/cors.plugin'
import { errorHandlerPlugin } from '../shared/presentation/plugins/error-handler.plugin'
import {
  createPinoLogger,
  requestLoggerPlugin,
} from '../shared/presentation/plugins/request-logger.plugin'
import { swaggerPlugin } from '../shared/presentation/plugins/swagger.plugin'
import type { Config } from './config'

/**
 * AppDeps — optional overrides for createApp. Production boot passes `{}` (or omits entirely);
 * tests pass a fake `db` and a stub `probe` so integration tests exercise the REAL plugin
 * chain (not a hand-rewired copy) while skipping Postgres.
 */
export interface AppDeps {
  db?: DrizzleDb // override for tests; defaults to createDbClient(config).db
  probe?: IDbHealthProbe // override for tests; defaults to DrizzleDbHealthProbe(db) inside createHealthModule
  authInstance?: AuthInstance
}

/**
 * createApp(config, deps?) — single assembly point for the root Elysia app.
 *
 * Canonical plugin ordering (ADR 0012):
 *   1. requestLoggerPlugin  — derives requestId first so everything downstream can reference it
 *   2. corsPlugin           — handle preflight before any route handler touches headers
 *   3. errorHandlerPlugin   — .onError with scope:'global' catches throws from all later plugins
 *   4. swaggerPlugin        — introspects routes at request-time; placed before feature modules
 *                              to keep "horizontal plugins first, feature modules last"
 *   5. feature modules      — createHealthModule(...) here; Phase 3 adds createAuthModule;
 *                              Phase 4 adds createAgentsModule.
 *
 * Synchronous return (not Promise) — see CONTEXT D-05 reconciled with `<specifics>`, and ADR 0012
 * consequence section. No DB pre-warm; /health validates DB at request time (D-02, D-03).
 */
export function createApp(config: Config, deps: AppDeps = {}) {
  const logger = createPinoLogger({ NODE_ENV: config.NODE_ENV, LOG_LEVEL: config.LOG_LEVEL })
  const db = deps.db ?? createDbClient({ DATABASE_URL: config.DATABASE_URL }).db

  // Build HealthModuleDeps conditionally: `probe` is an optional property without `| undefined`
  // in its type (tsconfig `exactOptionalPropertyTypes: true`), so we must OMIT it rather than
  // pass `undefined`. createHealthModule defaults to DrizzleDbHealthProbe(db) when probe is absent.
  const healthDeps: HealthModuleDeps = deps.probe ? { db, probe: deps.probe } : { db }
  const authDeps = deps.authInstance
    ? { db, logger, config, authInstance: deps.authInstance }
    : { db, logger, config }

  return new Elysia({ name: 'rigging/app' })
    .use(requestLoggerPlugin(logger))
    .use(corsPlugin())
    .use(errorHandlerPlugin(logger))
    .use(swaggerPlugin())
    .use(createAuthModule(authDeps))
    .use(createHealthModule(healthDeps))
}

export type App = ReturnType<typeof createApp>
