---
phase: 02-app-skeleton
plan: 01
subsystem: shared-presentation + shared-infrastructure
tags: [elysia, pino, cors, swagger, plugins, drizzle, postgres-js]
requirements_completed: [WEB-01, WEB-03, WEB-04]
dependency_graph:
  requires:
    - "src/shared/kernel/errors.ts (DomainError + 5 subclasses)"
    - "src/bootstrap/config.ts (Config type)"
    - "docs/decisions/0010-postgres-driver-postgres-js.md (driver lock)"
  provides:
    - "createDbClient(config) → { db, sql } — Drizzle+postgres-js client factory"
    - "DrizzleDb — type alias for Plan 02-02 IDbHealthProbe and future repositories"
    - "requestLoggerPlugin(logger) — pino-backed requestId derive + 7-field structured request log (D-09) + redact (D-11)"
    - "createPinoLogger(cfg) — dev vs prod transport switch (D-10)"
    - "errorHandlerPlugin(logger) — global onError reading DomainError.httpStatus, uniform error body (D-12), 4xx warn / 5xx error log split (D-13)"
    - "corsPlugin() — @elysiajs/cors echo-origin + credentials + explicit methods/allowedHeaders (D-16)"
    - "swaggerPlugin() — /swagger always-on with cookieAuth + apiKeyAuth pre-wired (D-14/D-15)"
    - "HttpErrorBody + INTERNAL_ERROR_CODE/MESSAGE + toHttpErrorBody helper (D-12)"
  affects:
    - "Plan 02-02 /health controller (uses DrizzleDb + http-error shape for 503 body)"
    - "Plan 02-03 createApp assembly (wires all 4 plugins per D-06 canonical ordering)"
    - "Phase 3 authModule (builds on requestLoggerPlugin.derive requestId for auditing)"
tech_stack:
  added: []
  patterns:
    - "Elysia 1.4 `{ as: 'global' }` on .derive/.onAfterResponse/.onError for plugin-scope hook broadcast (Pitfall #2 mitigation)"
    - "pino `redact.paths` + `censor: '[REDACTED]'` for structured log secret masking"
    - "factory function plugin pattern: createXxxPlugin(deps) → Elysia instance with named plugin identity"
    - "condition-first pino options assembly to satisfy exactOptionalPropertyTypes + avoid `undefined` on optional fields"
key_files:
  created:
    - "src/shared/infrastructure/db/client.ts"
    - "src/shared/presentation/http-error.ts"
    - "src/shared/presentation/plugins/request-logger.plugin.ts"
    - "src/shared/presentation/plugins/error-handler.plugin.ts"
    - "src/shared/presentation/plugins/cors.plugin.ts"
    - "src/shared/presentation/plugins/swagger.plugin.ts"
    - "tests/unit/shared/plugins/request-logger.plugin.test.ts"
    - "tests/unit/shared/plugins/error-handler.plugin.test.ts"
    - "tests/unit/shared/plugins/cors.plugin.test.ts"
  modified: []
decisions:
  - "Switched CORS `origin: true` (plan wrote callback-returning-string) — @elysiajs/cors@1.4.1 `Origin` type is `(context) => boolean | void`; `origin: true` delivers identical echo-origin + credentials behaviour per dist/index.mjs L58-65"
  - "onError handler reads `requestId` via `ctx as { requestId?: unknown }` defensive read rather than destructuring — Elysia onError ctx type does not surface cross-plugin `.derive` decorations"
  - "pino options assembled conditionally (not via `transport: isDev ? {...} : undefined`) to satisfy tsconfig `exactOptionalPropertyTypes: true`"
metrics:
  tasks_completed: 3
  tests_added: 8
  files_created: 9
  duration_minutes: ~20
  completed_date: "2026-04-19"
---

# Phase 2 Plan 01: Global Cross-Cutting Plugins + DB Client Summary

Four Elysia global plugins (requestLogger / errorHandler / cors / swagger) + shared Drizzle+postgres-js DB client factory + HTTP error body contract shipped as free-standing files with 8 unit tests proving structured log, secret redact, DomainError→HTTP mapping, and CORS preflight behaviour.

## One-liner

Reusable rails for Phase 3 (auth) / Phase 4 (demo domain) — assembly into `createApp` is deferred to Plan 02-03 by design.

## What Was Built

### Task 1 — DB client factory + HTTP error body shape (commit `a5981c6`)

- `src/shared/infrastructure/db/client.ts` — `createDbClient(config)` builds `postgres-js` handle + Drizzle instance. Exports `DrizzleDb` type for downstream consumers (Plan 02-02 health probe, Phase 3 BetterAuth adapter). No global singleton — factory called explicitly by `createApp` in Plan 02-03. Driver locked to `postgres-js` per ADR 0010 — `grep -r "bun-sql" src/` returns nothing.
- `src/shared/presentation/http-error.ts` — `HttpErrorBody` interface (`{ error: { code, message, requestId } }`) + `INTERNAL_ERROR_CODE`/`INTERNAL_ERROR_MESSAGE` constants + `toHttpErrorBody(args)` helper. Stable, extensible shape (future `details?` can be added without breaking clients).

### Task 2 — requestLogger + errorHandler plugins + 7 unit tests (commit `59d3bb4`)

- `src/shared/presentation/plugins/request-logger.plugin.ts` — `createPinoLogger(cfg)` builds pino instance with dev-only `pino-pretty` transport (D-10) + D-11 redact paths (`req.headers.cookie`, `req.headers.authorization`, `req.headers["x-api-key"]`, `res.headers["set-cookie"]`) with `censor: '[REDACTED]'`. `requestLoggerPlugin(logger)` derives `requestId` per-request (D-08: client `x-request-id` header OR `crypto.randomUUID()` fallback), echoes via response header, and emits one `logger.info(..., 'request')` in `onAfterResponse` carrying all 7 D-09 fields (`requestId` / `method` / `path` with query / `status` / `durationMs` / `userAgent` / `remoteAddress`). All hooks use `{ as: 'global' }` (Elysia 1.4 API) so `requestId` is visible to downstream plugins.
- `src/shared/presentation/plugins/error-handler.plugin.ts` — `errorHandlerPlugin(logger)` registers global `.onError` reading `err.httpStatus` directly (no mapping table). Branches: DomainError 5xx → `log.error({ err, stack, cause, requestId }, msg)`; DomainError 4xx → `log.warn({ code, requestId, path }, msg)` **with no stack** (D-13); non-DomainError → status 500 + body `{ error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } }`, original `err.message` logged but never returned (T-02-02 threat mitigation).
- 7 unit tests — 4 logger (UUID v4 gen, client header echo, redact, real-request 7-field structured log parsed from capturing destination) + 3 error-handler (ValidationError → 400 + code + no stack in warn payload; NotFoundError → 404 + `NOT_FOUND`; plain `Error` → 500 + `INTERNAL_ERROR` + masked message + `log.error` called with stack).

### Task 3 — CORS + Swagger plugins + CORS preflight test (commit `8447384`)

- `src/shared/presentation/plugins/cors.plugin.ts` — `corsPlugin()` wraps `@elysiajs/cors` with `origin: true` (echoes request Origin when set — see Deviations), `credentials: true`, explicit `allowedHeaders: ['content-type', 'authorization', 'x-api-key', 'x-request-id']`, `methods` array covering all six, `maxAge: 86400` (D-16).
- `src/shared/presentation/plugins/swagger.plugin.ts` — `swaggerPlugin()` wraps `@elysiajs/swagger` at `/swagger` (D-14 always-on, no NODE_ENV gate) with `info.version` read from `package.json` via Bun import attributes, and `components.securitySchemes` pre-declaring `cookieAuth` (cookie: `session`) + `apiKeyAuth` (header: `x-api-key`) — no route applies `security: [...]` yet (D-15, Phase 3 concern).
- 1 preflight behaviour test — OPTIONS request with `origin: https://example.com` + preflight headers → asserts echoed Allow-Origin, `Allow-Credentials: true`, and case-insensitive presence of all four required headers in `Access-Control-Allow-Headers`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 – Blocking type error] CORS plugin `origin` callback shape**
- **Found during:** Task 3 typecheck
- **Issue:** Plan specified `origin: (request: Request) => request.headers.get('origin') ?? '*'`. `@elysiajs/cors@1.4.1` types `Origin` as `(context: Context) => boolean | void`, rejecting a `string`-returning callback.
- **Fix:** Switched to `origin: true`. Per `dist/index.mjs` L58-65, when `origin === true` the plugin sets `Access-Control-Allow-Origin` to `request.headers.get("Origin") || "*"` — identical behaviour to the plan's intent, just via the library's built-in fast path rather than a callback.
- **Side effect:** Plan acceptance-criterion `grep -q "request.headers.get('origin')" src/shared/presentation/plugins/cors.plugin.ts` no longer matches. The D-16 behaviour required by `must_haves.truths` (preflight echo + credentials + headers) is still proven by the CORS preflight behaviour test — the grep was a proxy for that behaviour, and the behaviour test is the stronger signal.
- **Files modified:** `src/shared/presentation/plugins/cors.plugin.ts`
- **Commit:** `8447384`

**2. [Rule 3 – Blocking type error] pino options assembly with exactOptionalPropertyTypes**
- **Found during:** Task 2 typecheck
- **Issue:** Plan wrote `transport: cfg.NODE_ENV === 'development' ? { ... } : undefined`. tsconfig `exactOptionalPropertyTypes: true` forbids assigning `undefined` to an optional prop whose type does not explicitly include `undefined` (pino's `LoggerOptions.transport`).
- **Fix:** Split into `if (cfg.NODE_ENV === 'development') return pino({ ...base, transport: {...} })` else `return pino(base)` — `transport` is simply omitted (not `undefined`) in non-dev envs.
- **Files modified:** `src/shared/presentation/plugins/request-logger.plugin.ts`
- **Commit:** `59d3bb4`

**3. [Rule 3 – Blocking type error] onError ctx requestId access**
- **Found during:** Task 2 typecheck
- **Issue:** Plan destructured `({ error, set, request, requestId })` inside `onError`. Elysia 1.4 `.onError` ctx type does not reflect cross-plugin `.derive({ as: 'global' }, ...)` decorations, so `requestId` is not on the inferred type even though it is present at runtime when `requestLoggerPlugin` is upstream.
- **Fix:** Changed to `(ctx) => { ... const rid = (ctx as { requestId?: unknown }).requestId; const requestId = typeof rid === 'string' ? rid : 'unknown'; ... }` — defensive read, falls back to `'unknown'` if the plugin is used standalone. This matches the plan's own `<threat_model>` T-02-07 mitigation note: "error-handler onError does NOT rely on TS narrowing for ctx.requestId — treats undefined as 'unknown'".
- **Files modified:** `src/shared/presentation/plugins/error-handler.plugin.ts`
- **Commit:** `59d3bb4`

**4. [Rule 3 – Test infra] onAfterResponse timing in structured-log test**
- **Found during:** Task 2 test execution (RED→GREEN transition)
- **Issue:** `app.handle()` returns before `onAfterResponse` fires; a synchronous post-call assertion on the capturing buffer saw an empty buffer.
- **Fix:** Added `await new Promise((r) => setTimeout(r, 10))` after `app.handle(...)` in the 7-field structured-log test to yield the event loop so the hook + pino synchronous write complete before assertion.
- **Files modified:** `tests/unit/shared/plugins/request-logger.plugin.test.ts`
- **Commit:** `59d3bb4`

## Authentication Gates

None — this plan shipped pure in-process unit tests against free-standing plugins.

## Verification Results

| Check | Status | Notes |
|-------|--------|-------|
| `bun run typecheck` | PASS | `tsc --noEmit` clean |
| `bun run lint` | PASS | Biome: 25 files, 0 errors |
| `bun test tests/unit/shared/plugins/` | PASS | 8 tests, 43 expectations |
| `bun test` (full suite) | PASS | 50 pass, 1 skip, 0 fail (was 42 baseline → +8 new) |
| `bun run test:contract` | PASS | 10 biome-contract + contract tests still green (no domain boundary violations) |
| Driver lock (`grep -r "bun-sql" src/`) | PASS | No matches — postgres-js exclusive per ADR 0010 |
| Domain framework-free (`grep -r "drizzle-orm\|pino\|elysia" src/shared/kernel src/shared/application`) | PASS | No matches — Rigidity Tier 1 intact |

## Key Decisions

- **Plugins are free-standing factories, not pre-composed** — `requestLoggerPlugin(logger)` / `errorHandlerPlugin(logger)` / `corsPlugin()` / `swaggerPlugin()` each return a named Elysia plugin. Assembly into `createApp` per D-06 canonical ordering is Plan 02-03's responsibility. This keeps each plugin unit-testable in isolation.
- **`{ as: 'global' }` on every cross-cutting hook** — applied to `.derive` (requestId), `.onAfterResponse` (request log), `.onError` (error handler). Without this, Elysia 1.4 scopes the hook to the plugin instance and downstream consumers (error-handler, feature modules) see `requestId: undefined` (Pitfall #2 cascade).
- **Error-handler reads `err.httpStatus` directly** — no switch/mapping table. `DomainError` subclasses each carry their own HTTP status. Adding a new DomainError subclass requires zero changes to the error handler.
- **Swagger security schemes pre-declared, not applied** — Phase 2 ships `cookieAuth` + `apiKeyAuth` in `components.securitySchemes` but zero routes mark themselves `security: [...]`. Phase 3 routes will simply add the `security` marker — no reopening this file.

## Integration Points for Plan 02-03

`createApp(config, deps)` in Plan 02-03 must:

1. Call `createDbClient(config)` → pass `db` / `sql` into `createHealthModule(shared)` and future auth module
2. Call `createPinoLogger({ NODE_ENV, LOG_LEVEL })` once at boot → pass the logger instance to both `requestLoggerPlugin(logger)` AND `errorHandlerPlugin(logger)`
3. Wire plugins in D-06 canonical order: `requestLogger → cors → errorHandler → swagger → feature modules`
4. ADR 0012 (plugin ordering) should note: "order change = lifecycle change = new ADR"

## Completion Status

- [x] All 3 tasks in `02-01-PLAN.md` executed and committed atomically
- [x] SUMMARY.md created (this file)
- [x] 8 new unit tests green — proves WEB-04 (7-field structured log) independently at this plan's boundary
- [x] No regressions — 50/50 pre-existing tests still pass
- [x] Rigidity Tier 1 (domain framework-free) intact per grep audit

## Self-Check: PASSED

**Files verified on disk (absolute paths):**

- `/Users/carl/Dev/CMG/Rigging/src/shared/infrastructure/db/client.ts` — FOUND
- `/Users/carl/Dev/CMG/Rigging/src/shared/presentation/http-error.ts` — FOUND
- `/Users/carl/Dev/CMG/Rigging/src/shared/presentation/plugins/request-logger.plugin.ts` — FOUND
- `/Users/carl/Dev/CMG/Rigging/src/shared/presentation/plugins/error-handler.plugin.ts` — FOUND
- `/Users/carl/Dev/CMG/Rigging/src/shared/presentation/plugins/cors.plugin.ts` — FOUND
- `/Users/carl/Dev/CMG/Rigging/src/shared/presentation/plugins/swagger.plugin.ts` — FOUND
- `/Users/carl/Dev/CMG/Rigging/tests/unit/shared/plugins/request-logger.plugin.test.ts` — FOUND
- `/Users/carl/Dev/CMG/Rigging/tests/unit/shared/plugins/error-handler.plugin.test.ts` — FOUND
- `/Users/carl/Dev/CMG/Rigging/tests/unit/shared/plugins/cors.plugin.test.ts` — FOUND

**Commits verified in git history:**

- `a5981c6` — feat: [02-app-skeleton] Drizzle+postgres-js client factory + HTTP error body shape
- `59d3bb4` — feat: [02-app-skeleton] requestLogger + errorHandler plugins + 7 unit tests
- `8447384` — feat: [02-app-skeleton] CORS + Swagger plugins + CORS preflight test
