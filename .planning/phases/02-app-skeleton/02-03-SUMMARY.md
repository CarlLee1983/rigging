---
phase: 02-app-skeleton
plan: 03
subsystem: bootstrap-assembly + adr + integration-test
tags: [bootstrap, assembly, adr, integration-test, createApp, plugin-ordering]
requirements_completed: [WEB-01, WEB-02, WEB-03, WEB-04]
dependency_graph:
  requires:
    - "src/shared/infrastructure/db/client.ts (createDbClient + DrizzleDb type from plan 02-01)"
    - "src/shared/presentation/plugins/*.plugin.ts (4 plugins from plan 02-01)"
    - "src/health/health.module.ts (createHealthModule from plan 02-02 with { db, probe?, clock? })"
    - "src/bootstrap/config.ts (loadConfig + Config type from Phase 1)"
    - "docs/decisions/0011-resolver-precedence-apikey-over-cookie.md (MADR 4.0 format reference)"
  provides:
    - "createApp(config: Config, deps?: AppDeps): Elysia — synchronous factory, canonical ordering"
    - "AppDeps { db?: DrizzleDb; probe?: IDbHealthProbe } — optional overrides for integration tests"
    - "App = ReturnType<typeof createApp> — exported type alias for downstream consumers"
    - "docs/decisions/0012-global-plugin-ordering.md — MADR 4.0 ADR locking canonical plugin ordering"
    - "tests/integration/app-skeleton-smoke.test.ts — 7 tests exercising real createApp (no hand-rewired chain)"
  affects:
    - "Phase 3 createAuthModule — appended to createApp chain after createHealthModule via same AppDeps pattern"
    - "Phase 4 createAgentsModule — same append pattern"
    - "Rigidity Map Tier 2 plugin-ordering clause — ADR 0012 is the concrete escape-hatch reference"
tech_stack:
  added: []
  patterns:
    - "Synchronous factory DI: createApp(config, deps) returns Elysia directly (no Promise), main.ts runs straight-line with .listen(port, cb)"
    - "Test injection via AppDeps.probe override — integration tests exercise REAL plugin chain, not hand-rewired copies"
    - "exactOptionalPropertyTypes-safe conditional deps construction: { db, probe } vs { db } spread, never passing probe: undefined"
    - "Runtime synchronous invariant check: 'then' in maybeApp — type-system-safe, no @ts-expect-error directive"
    - "Canonical ordering proof via requestId body-vs-header cross-check — if errorHandler ran before requestLogger.derive, test 5 would fail"
key_files:
  created:
    - "src/bootstrap/app.ts"
    - "docs/decisions/0012-global-plugin-ordering.md"
    - "tests/integration/app-skeleton-smoke.test.ts"
  modified:
    - "src/main.ts"
    - "docs/decisions/README.md"
decisions:
  - "createApp(config, deps?): Elysia is synchronous (not async) — D-05 reconciled; no DB pre-warm; /health validates at request time; main.ts can run straight-line"
  - "AppDeps threading: { db?, probe? } with conditional spread for exactOptionalPropertyTypes compliance — omit key rather than pass undefined"
  - "Integration tests call real createApp (not hand-rewired) — ordering regressions in src/bootstrap/app.ts fail CI; test 5 (requestId body===header) is the canonical ordering proof"
  - "Test 7 uses runtime 'then' in maybeApp probe for the synchronous invariant — no @ts-expect-error directive (Elysia has no .then so the suppression would itself be unused)"
metrics:
  tasks_completed: 3
  tests_added: 7
  files_created: 3
  files_modified: 2
  duration_minutes: ~4
  completed_date: "2026-04-19"
---

# Phase 2 Plan 03: createApp Assembly + ADR 0012 + Integration Smoke Summary

## One-liner

createApp(config, deps) synchronous factory assembles Plan 01 global plugins + Plan 02 health module in ADR 0012's canonical order; 7 integration tests prove all 4 WEB-* requirements end-to-end against the REAL factory (no hand-rewired chain).

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-19T01:19:23Z
- **Completed:** 2026-04-19T01:23:38Z
- **Tasks:** 3
- **Files created:** 3 (src/bootstrap/app.ts, docs/decisions/0012-*.md, tests/integration/app-skeleton-smoke.test.ts)
- **Files modified:** 2 (src/main.ts, docs/decisions/README.md)

## Task Commits

Each task committed atomically after typecheck + lint + test passed:

1. **Task 1 — createApp + main.ts wire** — `60d4b01` (feat)
2. **Task 2 — ADR 0012 + README index** — `53023a2` (docs)
3. **Task 3 — Integration smoke test (7 tests)** — `51fd66f` (test)

## What Was Built

### Task 1 — createApp assembly factory + main.ts wire (commit `60d4b01`)

- `src/bootstrap/app.ts` — Synchronous factory `createApp(config: Config, deps: AppDeps = {}): Elysia`. AppDeps interface exposes `db?: DrizzleDb` and `probe?: IDbHealthProbe` for test injection. Plugin chain registered in EXACTLY ADR 0012's canonical order via `.use()`:
  1. `requestLoggerPlugin(logger)` — derives requestId first so errorHandler + feature modules can reference it
  2. `corsPlugin()` — preflight handling before any route handler
  3. `errorHandlerPlugin(logger)` — `{ as: 'global' }` onError catches all downstream throws
  4. `swaggerPlugin()` — OpenAPI introspection (leaf concern, placed before features for visual consistency)
  5. `createHealthModule({ db[, probe] })` — feature module; Phase 3 appends createAuthModule, Phase 4 appends createAgentsModule
- `src/bootstrap/app.ts` also exports `type App = ReturnType<typeof createApp>` for downstream consumers (Phase 3 test helpers may want a named reference).
- `src/main.ts` — replaced the P1 stub with the real wire: `loadConfig()` → `createApp(config)` → `app.listen(config.PORT, ({ hostname, port }) => { console.log([rigging] listening on http://${hostname}:${port}) ... })`. Startup log emits `/health` and `/swagger` URLs explicitly for 10-second onboarding.

### Task 2 — ADR 0012 global plugin ordering + README index (commit `53023a2`)

- `docs/decisions/0012-global-plugin-ordering.md` — MADR 4.0 format, Status: accepted, Date: 2026-04-19. Context ties ordering to Pitfall #2 (elysiajs/elysia#1366 scoped-plugin undefined cascade). Decision Drivers explicitly list all three required rationale items:
  - avoid Pitfall #2 scoped-plugin undefined cascade
  - canonical position for Phase 3 authModule / Phase 4 agentsModule
  - ordering change = lifecycle change = requires superseding ADR (not PR-only)
- Three options analysed (canonical / errorHandler-first / feature-modules-first); Option A chosen with four-point rationale tied to requestId propagation, CORS preflight timing, global-scope onError semantics, and leaf-vs-horizontal ordering.
- Consequences section explicitly documents synchronous `createApp` reconciliation — the D-05 "no async lazy init" specific — so that future maintainers see the coupling between ordering decision and process-entrypoint shape.
- `docs/decisions/README.md` — appended row 13: `| [0012](0012-global-plugin-ordering.md) | Global plugin ordering for the Elysia root app | accepted | 2026-04-19 | — |` between the existing 0011 row and the `## Workflow` heading. Existing 12 rows untouched.

### Task 3 — Integration smoke test: 7 tests via real createApp (commit `51fd66f`)

- `tests/integration/app-skeleton-smoke.test.ts` — `bun:test` suite. All 7 tests import `createApp` directly from `src/bootstrap/app.ts` and call it with `TEST_CONFIG` + `{ db: fakeDb, probe: stubProbe(...) }`. No hand-rewired `new Elysia()` chain anywhere — if ADR 0012 ordering is violated, tests 1/5/6 fail immediately.
- Test coverage:
  1. `/health` → 200 on probe 'up' — body shape `{ ok, db, checkedAt }`, response header `x-request-id` matches UUID v4 regex (WEB-02, WEB-04)
  2. `/health` → 503 on probe 'down' — body `{ ok: false, db: 'down' }` (WEB-02)
  3. `/health` → 503 on probe REJECTION — controller try/catch produces 503, global error handler does NOT return 500 (WEB-02)
  4. `/swagger` → 200 with body.length > 100 (WEB-03)
  5. `NotFoundError` thrown from appended `.get('/demo-404', …)` → 404 + body `{ error: { code: 'NOT_FOUND', message: 'user X missing', requestId: <id> } }` + response header `x-request-id` === `body.error.requestId` — this cross-check PROVES `requestLoggerPlugin.derive` ran BEFORE `errorHandlerPlugin.onError` (W-5 canonical ordering evidence) (WEB-01)
  6. Client-supplied `X-Request-Id: trace-42` → response header echoes `trace-42` verbatim (D-08 distributed trace passthrough) (WEB-04)
  7. `createApp(config, deps)` synchronous invariant — `expect('then' in maybeApp).toBe(false)` runtime probe; no `@ts-expect-error` directive (Elysia has no `.then` at the type level, so suppression would itself be unused)
- `TEST_CONFIG` uses `LOG_LEVEL: 'error'` — a legal config-schema value; no `as never` cast; no type-system escape hatch.

## WEB-* Requirement Coverage

| Requirement | Coverage | Tests |
|-------------|----------|-------|
| WEB-01 (Elysia + global plugins) | Tests 1, 4, 5, 7 (plugin chain assembled; DomainError→body shape; sync invariant) | 4 |
| WEB-02 (/health 200/503) | Tests 1, 2, 3 (up/down/reject → 200/503/503, NEVER 500) | 3 |
| WEB-03 (/swagger OpenAPI) | Test 4 (/swagger → 200 + body > 100 bytes) | 1 |
| WEB-04 (requestId) | Tests 1, 5, 6 (UUID v4 generation + body-header match + client-supplied passthrough) | 3 |

All 4 WEB-* requirements are exercised by at least one integration test, in addition to any unit-level coverage from Plans 02-01 / 02-02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Type error] HealthModuleDeps probe under exactOptionalPropertyTypes**
- **Found during:** Task 1 typecheck
- **Issue:** Plan action block showed `createHealthModule({ db, probe: deps.probe })`. tsconfig `exactOptionalPropertyTypes: true` rejects `probe: undefined` on an optional prop whose type is `IDbHealthProbe` (not `IDbHealthProbe | undefined`). Error: `Type 'IDbHealthProbe | undefined' is not assignable to type 'IDbHealthProbe'`.
- **Fix:** Built `HealthModuleDeps` conditionally: `const healthDeps: HealthModuleDeps = deps.probe ? { db, probe: deps.probe } : { db }` — the `probe` key is OMITTED (not passed as `undefined`) when the caller didn't supply one. Same trick as 02-01's pino `transport` handling. Imported `HealthModuleDeps` type alongside `createHealthModule` for the explicit annotation.
- **Files modified:** `src/bootstrap/app.ts`
- **Verification:** `bun run typecheck` clean; createHealthModule still falls through to default `DrizzleDbHealthProbe(deps.db)` when probe absent.
- **Commit:** `60d4b01`

**2. [Rule 1 — Style/tooling] Biome organize-imports reorder in src/bootstrap/app.ts**
- **Found during:** Task 1 lint
- **Issue:** Biome's organize-imports rule sorts `import type` before value imports from the same directory tree. Initial write placed `import { createHealthModule }` before `import type { IDbHealthProbe }`.
- **Fix:** Reordered so `import type { IDbHealthProbe }` precedes `import { createHealthModule, type HealthModuleDeps }`. Zero runtime change.
- **Files modified:** `src/bootstrap/app.ts`
- **Commit:** `60d4b01`

**3. [Rule 1 — Cosmetic] Removed the literal `'as never'` substring from a comment**
- **Found during:** Task 3 acceptance-criteria audit
- **Issue:** Initial test file had a comment `// LOG_LEVEL: 'error' is a legal value per the config schema (no 'as never' cast needed).` The literal substring `LOG_LEVEL.*as never` would match that comment in `grep -r "LOG_LEVEL.*as never" tests/`, causing the acceptance-criterion "grep returns empty" to fail even though no cast existed in code.
- **Fix:** Reworded comment to: `// LOG_LEVEL uses the real 'error' enum value per the config schema; no type-system escape hatch needed.` — same intent, no literal match. Verified with `grep -r "LOG_LEVEL.*as never" tests/` → empty.
- **Files modified:** `tests/integration/app-skeleton-smoke.test.ts`
- **Commit:** `51fd66f`

**Total deviations:** 3 auto-fixed (2 type/style during Task 1, 1 cosmetic comment during Task 3). All Rule 1/Rule 3 auto-fixes per GSD deviation protocol; no architectural changes needed.

## Threat Model Compliance (from PLAN threat_model)

| Threat ID | Mitigation Status | Evidence |
|-----------|-------------------|----------|
| T-02-13 (Elevation / plugin ordering drift) | **mitigated** | ADR 0012 documents canonical ordering + Pitfall #2 rationale; `src/bootstrap/app.ts` orders `.use()` calls explicitly; integration test 5 cross-checks `body.error.requestId === response.headers['x-request-id']` — if ordering drifts so requestLogger.derive runs AFTER errorHandler.onError, the requestId would be `'unknown'` and the assertion fails |
| T-02-14 (Info disclosure via startup log) | **mitigated** | `main.ts` logs only `hostname`, `port`, and the static paths `/health` + `/swagger` — never touches `DATABASE_URL` or `BETTER_AUTH_SECRET` from Config |
| T-02-15 (DoS via async pre-warm) | **mitigated** | `createApp` is synchronous (no `async`, no `Promise<Elysia>`); integration test 7 runtime-asserts `'then' in maybeApp === false`; no DB connection attempted at boot; `/health` validates at request time |
| T-02-16 (Repudiation / client-forged requestId) | **accept** (per D-08) | Client-supplied `x-request-id` is echoed verbatim (integration test 6 proves this is a feature for distributed trace propagation); log field tagging keeps server-generated vs client-supplied distinguishable in observability pipeline; if a v2 security posture requires server-only IDs, that's a new ADR |
| T-02-17 (ADR drift / undocumented ordering change) | **mitigated** | ADR 0012 Decision Drivers + Consequences both state "ordering change requires superseding ADR not PR-only"; Rigidity Map Tier 2 (ADR-escapable) now has concrete 0012 reference; integration tests exercise the REAL createApp so silent ordering drift in `src/bootstrap/app.ts` breaks CI |

## Verification Results

| Check | Status | Notes |
|-------|--------|-------|
| `bun run typecheck` | PASS | `tsc --noEmit` clean |
| `bun run lint` | PASS | Biome: 37 files, 0 errors |
| `bun test` (full suite) | PASS | 66 pass, 1 skip, 0 fail (59 baseline + 7 new integration = 66) |
| `bun run test:contract` | PASS | 10 biome-contract + contract tests still green — Rigidity Tier 1 intact |
| ADR 0012 file exists | PASS | `docs/decisions/0012-global-plugin-ordering.md` with Status: accepted |
| ADR index row 0012 | PASS | 13 rows total (12 prior + 0012), `## Workflow` heading intact |
| createApp synchronous | PASS | integration test 7 runtime assertion passes; `grep -qE "export async function createApp\|Promise<.*Elysia>" src/bootstrap/app.ts` returns empty |
| No DB pre-warm in createApp | PASS | `grep -q "await createDbClient\|\\.then(\|Promise.all" src/bootstrap/app.ts` returns empty |
| Plugin order in .use() calls | PASS | sequence in source: requestLoggerPlugin → corsPlugin → errorHandlerPlugin → swaggerPlugin → createHealthModule (canonical D-06) |
| No hand-rewired plugin chain in tests | PASS | `grep -qE "buildAppWithStubbedProbe\|new Elysia\(" tests/integration/app-skeleton-smoke.test.ts` returns empty |
| No `@ts-expect-error` in test file | PASS | grep returns 0 matches |
| No `LOG_LEVEL.*as never` anywhere in tests | PASS | `grep -r "LOG_LEVEL.*as never" tests/` returns empty |

## Phase 2 Success Criteria (from ROADMAP)

All four Phase 2 success criteria from `.planning/ROADMAP.md` are now satisfied end-to-end:

1. **`/health` returns 200 (DB up) / 503 (DB down), NEVER 500** — Integration tests 1, 2, 3 prove all three paths (up → 200, down → 503, probe reject → 503; test 3 explicitly verifies the controller's try/catch swallows rejection before the global error handler can produce 500)
2. **`/swagger` serves OpenAPI 3.x** — Integration test 4 (+ Plan 02-01 swagger plugin)
3. **Structured JSON logs with requestId/method/path/status/durationMs** — Plan 02-01's request-logger real-request structured-log test + Plan 02-03 integration tests 1 & 5 & 6 confirming requestId plumbing (same log path produces the 7-field line)
4. **DomainError → mapped HTTP status + uniform body** — Integration test 5 explicitly throws `NotFoundError('user X missing')` from an appended route and asserts 404 + `{ error: { code: 'NOT_FOUND', message: 'user X missing', requestId } }`, plus the requestId body-vs-header cross-check

## Key Decisions

- **createApp is synchronous, not async** — `deps: AppDeps = {}` default param + direct `.use(...)` chain returning the Elysia instance. No DB pre-warm; the `/health` probe validates DB at request time per D-02. `main.ts` boots with zero `await`.
- **AppDeps threading uses exactOptionalPropertyTypes-safe conditional spread** — `{ db, probe: deps.probe }` vs `{ db }` based on `deps.probe` truthiness; never `{ db, probe: undefined }`. Same pattern Plan 02-01 used for pino transport. Keeps the HealthModuleDeps interface permissive of the strictest tsconfig posture.
- **Integration tests call real createApp (not a hand-rewired plugin chain)** — this is the structural commitment that makes ADR 0012 self-enforcing. If anyone rearranges `.use()` calls in `src/bootstrap/app.ts`, integration test 5 (requestId body-vs-header match) breaks immediately — no way to silently regress the ordering.
- **Test 7 uses runtime `'then' in x` probe** — Elysia's instance type has no `.then` property, so a `@ts-expect-error` directive would itself be flagged as "unused suppression". Runtime duck-typing is both type-safe and semantically accurate ("not a Promise").

## Integration Points for Phase 3

Phase 3 (Auth Foundation) will:
1. Add `createAuthModule({ db, auth, ... })` after `createHealthModule(...)` in the `.use(...)` chain inside `src/bootstrap/app.ts` — no reorder of existing plugins required.
2. Add `auth?: BetterAuthInstance` to `AppDeps` (same pattern as `probe`) so integration tests can inject a stub auth instance.
3. Appended feature modules can rely on `requestId` being present via `ctx.requestId` — Plan 02-03 test 5 proves the derive fires before any appended `.get()` handler executes.
4. Any change to plugin ordering needs a superseding ADR (e.g., `0012a-*.md` or a new number). The current ordering is the concrete Rigidity Map Tier 2 reference.

## Completion Status

- [x] All 3 tasks in `02-03-PLAN.md` executed and committed atomically (60d4b01, 53023a2, 51fd66f)
- [x] `src/bootstrap/app.ts` exports `createApp(config, deps): Elysia` (synchronous) — verified by test 7 runtime probe
- [x] `src/main.ts` rewired with `loadConfig + createApp + .listen` — no more P1 stub console.log
- [x] `docs/decisions/0012-global-plugin-ordering.md` with Status: accepted, MADR 4.0 format, all 3 required rationale items present
- [x] `docs/decisions/README.md` index row 13 added between 0011 and `## Workflow`
- [x] 7 integration tests green via real createApp(config, { probe }) — no hand-rewired plugin chain
- [x] All 4 WEB-* requirements exercised end-to-end across at least one test each
- [x] No `@ts-expect-error`, no `as never` cast, no `buildAppWithStubbedProbe` helper in the test file
- [x] `bun run typecheck && bun run lint && bun test && bun run test:contract` all green; 66 tests pass + 10 contract tests pass
- [x] Phase 2 ROADMAP success criteria 1/2/3/4 all satisfied end-to-end
- [x] Rigidity Tier 1 intact — no new domain/framework coupling introduced (app.ts is bootstrap, not domain)
- [x] SUMMARY.md created (this file)

## Self-Check: PASSED

**Files verified on disk (absolute paths):**

- `/Users/carl/Dev/CMG/Rigging/src/bootstrap/app.ts` — FOUND
- `/Users/carl/Dev/CMG/Rigging/src/main.ts` — FOUND (modified)
- `/Users/carl/Dev/CMG/Rigging/docs/decisions/0012-global-plugin-ordering.md` — FOUND
- `/Users/carl/Dev/CMG/Rigging/docs/decisions/README.md` — FOUND (modified)
- `/Users/carl/Dev/CMG/Rigging/tests/integration/app-skeleton-smoke.test.ts` — FOUND

**Commits verified in git history:**

- `60d4b01` — feat(02-03): createApp(config, deps) assembly + main.ts wire
- `53023a2` — docs(02-03): ADR 0012 global plugin ordering + README index update
- `51fd66f` — test(02-03): integration smoke suite via real createApp(config, { probe })

---
*Phase: 02-app-skeleton*
*Completed: 2026-04-19*
