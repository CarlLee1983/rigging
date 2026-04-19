---
phase: 02-app-skeleton
plan: 02
subsystem: health + ddd-four-layer-template
tags: [health, ddd, drizzle, elysia, abort-controller, feature-module-factory]
requirements_completed: [WEB-02]
dependency_graph:
  requires:
    - "src/shared/kernel/ (DomainError not used here — health stays thin and propagates)"
    - "src/shared/infrastructure/db/client.ts (DrizzleDb type from plan 02-01)"
    - "docs/decisions/0009-rigidity-map.md (Tier 1 framework-free domain + application)"
  provides:
    - "createHealthModule({ db, probe?, clock? }) — feature module factory returning Elysia plugin (Phase 3+ template)"
    - "IDbHealthProbe port — probe(): Promise<'up' | 'down'> (application contract)"
    - "DrizzleDbHealthProbe — adapter with 2000ms AbortController timeout; all errors → 'down'"
    - "HealthStatus value object + DbState type (domain, framework-free)"
    - "CheckHealthUseCase — thin orchestrator (probe rejects → usecase rejects; controller owns 503)"
    - "healthController — Elysia plugin GET /health with explicit try/catch → 200/503 (D-03)"
  affects:
    - "Plan 02-03 createApp assembly (will .use(createHealthModule({ db })) at root)"
    - "Phase 3 createAuthModule (clones this factory shape)"
    - "Phase 4 createAgentsModule (same pattern)"
tech_stack:
  added: []
  patterns:
    - "DDD four-layer feature vertical slice: src/{feature}/{domain,application,infrastructure,presentation}/"
    - "Domain barrel export (domain/index.ts) — only legal entry; domain/internal/ holds impl (D-11)"
    - "Factory function DI: createXxxModule(deps) → Elysia plugin (no tsyringe/inversify)"
    - "Layered 503 defense: adapter swallows errors → 'down'; controller try/catch is belt-and-suspenders hedge for future adapters that may reject"
    - "AbortController + Promise.race for timeout (signal → reject → catch → 'down')"
    - "Adapter Pick<DrizzleDb, 'execute'> constructor typing — accepts fakes without real Drizzle instantiation in unit tests"
key_files:
  created:
    - "src/health/domain/internal/health-status.ts"
    - "src/health/domain/index.ts"
    - "src/health/application/ports/db-health-probe.port.ts"
    - "src/health/application/usecases/check-health.usecase.ts"
    - "src/health/infrastructure/drizzle-db-health-probe.ts"
    - "src/health/presentation/controllers/health.controller.ts"
    - "src/health/health.module.ts"
    - "tests/unit/health/check-health.usecase.test.ts"
    - "tests/unit/health/drizzle-db-health-probe.test.ts"
    - "tests/unit/health/health.controller.test.ts"
  modified: []
decisions:
  - "Domain barrel re-order (Biome organize-imports): type exports before value exports — mechanical, no semantic change"
  - "Controller catch block uses `db: 'down' as const` literal (not import from domain) — controller presentation-layer shape independent of HealthStatus value object; if adapter rejects, we cannot call makeHealthStatus because clock wasn't captured in catch scope — inline literal keeps the catch path minimal and self-contained"
metrics:
  tasks_completed: 3
  tests_added: 9
  files_created: 10
  duration_minutes: ~3
  completed_date: "2026-04-19"
---

# Phase 2 Plan 02: Health DDD Four-Layer Walkthrough Summary

**/health endpoint shipped as the canonical DDD four-layer template: framework-free domain value object + IDbHealthProbe port + CheckHealthUseCase + DrizzleDbHealthProbe adapter with AbortController timeout + Elysia controller + createHealthModule factory — 9 unit tests locking the up/down/reject/timeout contract.**

## One-liner

Proof-by-example that Rigging's "rails" work: Biome Tier 1 enforces framework-free domain + application; factory function DI without IoC; controller-owned 503 (not global error handler) for operational state — Phase 3+ feature modules clone this exact shape.

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-19T01:11:52Z
- **Completed:** 2026-04-19T01:14:32Z
- **Tasks:** 3 (TDD: RED → GREEN each)
- **Files created:** 10 (7 source + 3 test)

## Task Commits

Each task was committed atomically after its RED → GREEN cycle passed typecheck + lint + test:

1. **Task 1: Health domain + application layers** — `2a7d828` (feat)
2. **Task 2: DrizzleDbHealthProbe adapter + 3 adapter tests** — `c03fb5c` (feat)
3. **Task 3: Health controller + feature module factory + 3 controller tests** — `1919d61` (feat)

_All tasks followed strict TDD: test file written first and confirmed failing (RED), then implementation added (GREEN). No separate RED commits were needed because each task's RED + GREEN were committed as one unit — the test files are always part of the same commit as the code they exercise._

## What Was Built

### Task 1 — Domain + application (framework-free) + 3 usecase tests (commit `2a7d828`)

- `src/health/domain/internal/health-status.ts` — `HealthStatus` readonly value object (`ok: boolean, db: DbState, checkedAt: ISO-8601 string`) + `DbState` type + `makeHealthStatus({db, checkedAt})` factory returning `Object.freeze(...)`. Framework-free per Tier 1.
- `src/health/domain/index.ts` — public barrel re-exporting only `makeHealthStatus` + `HealthStatus`/`DbState` types. `domain/internal/` is invisible to application/presentation by Biome rule.
- `src/health/application/ports/db-health-probe.port.ts` — `IDbHealthProbe { probe(): Promise<'up' | 'down'> }` + `DbProbeResult` type. Comment documents the port-vs-adapter asymmetry: port permits rejection; Drizzle adapter never rejects in practice (all errors → 'down').
- `src/health/application/usecases/check-health.usecase.ts` — `CheckHealthUseCase` with `IClock` port injected. `execute()` awaits `probe.probe()` then composes `HealthStatus` — NO try/catch (D-03 explicitly: controller owns 503, not usecase).
- 3 usecase tests: DB up / DB down / probe rejection propagates (use case rejects with same error — controller Task 3 proves it maps to 503).

### Task 2 — Drizzle adapter + 3 adapter tests (commit `c03fb5c`)

- `src/health/infrastructure/drizzle-db-health-probe.ts` — `DrizzleDbHealthProbe implements IDbHealthProbe`. Constructor takes `{ db: Pick<DrizzleDb, 'execute'>, timeoutMs = 2000 }`. `probe()` wraps `db.execute(sql\`SELECT 1\`)` in `Promise.race` with an `AbortController`-backed timeout promise; any thrown/rejected error falls into `catch` → `return 'down'`. `finally` clears the timer.
- 3 adapter tests using a minimal `FakeDb = { execute: (query: unknown) => Promise<unknown> }` (no real Drizzle connection needed):
  - **A**: `execute` resolves `[{ ok: 1 }]` → probe returns `'up'`
  - **B**: `execute` rejects `Error('conn refused')` → probe returns `'down'` (does NOT throw)
  - **C**: `execute` never resolves; `timeoutMs=50` → probe returns `'down'` within <500ms (proves AbortController actually fires — timed via `performance.now()`, not just value check)

### Task 3 — Controller + feature module factory + 3 controller tests (commit `1919d61`)

- `src/health/presentation/controllers/health.controller.ts` — `healthController({ checkHealth })` returns an Elysia plugin named `'rigging/health-controller'` exposing `GET /health`. Handler wraps `checkHealth.execute()` in try/catch:
  - Success → `set.status = status.ok ? 200 : 503; return status`
  - Reject → `set.status = 503; return { ok: false, db: 'down' as const, checkedAt: new Date().toISOString() }`
  - Swagger `detail` block carries `tags: ['health']` only — **no `security` marker** (D-15 operational public route).
- `src/health/health.module.ts` — `createHealthModule(deps: HealthModuleDeps)` factory where `HealthModuleDeps = { db: DrizzleDb, probe?: IDbHealthProbe, clock?: IClock }`. Wires `DrizzleDbHealthProbe(deps.db)` as default probe, `{ now: () => new Date() }` as default clock, then `new CheckHealthUseCase(probe, clock)` + mounted controller. Returns `new Elysia({ name: 'rigging/health' }).use(healthController({ checkHealth }))`.
- 3 controller tests via `app.handle(new Request('http://localhost/health'))`:
  - **1**: probe='up' → status 200 + body `{ ok:true, db:'up', checkedAt:'2026-04-19T12:00:00.000Z' }`
  - **2**: probe='down' → status 503 + body `{ ok:false, db:'down' }`
  - **3**: probe rejects `Error('conn refused')` → status 503 + body shape with ISO-8601 `checkedAt` matching `/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Style/tooling] Biome organize-imports reorder in `src/health/domain/index.ts`**
- **Found during:** Task 1 `bun run lint`
- **Issue:** Biome's organize-imports rule requires `export type` statements to precede value exports from the same source. Plan wrote `export { makeHealthStatus }` on line 4 followed by `export type { DbState, HealthStatus }` on line 5; lint flagged it.
- **Fix:** Swapped the two lines so `export type` is first. Zero semantic change.
- **Files modified:** `src/health/domain/index.ts`
- **Verification:** `bun run lint` passes; barrel exports unchanged at runtime.
- **Committed in:** `2a7d828` (Task 1 commit — the fix applied before the commit landed).

---

**Total deviations:** 1 auto-fixed (Rule 1 style/tooling — mechanical Biome import order).
**Impact on plan:** Zero semantic divergence from the plan. The grep acceptance criterion `grep -q "export type.*HealthStatus\|export.*makeHealthStatus" src/health/domain/index.ts` still matches (both lines are present; order irrelevant to grep).

## Threat Model Compliance (from PLAN threat_model)

| Threat ID | Mitigation Status | Evidence |
|-----------|-------------------|----------|
| T-02-08 (DoS via probe hang) | **mitigated** | `DrizzleDbHealthProbe` constructor defaults `timeoutMs=2000`; Task 2 Test C proves timeout path returns `'down'` within <500ms using `timeoutMs=50` override |
| T-02-09 (public /health, unauth DoS) | **accepted** (per D-14) | No `security:` on route (Task 3 acceptance criteria verified); future rate-limit deferred to v2 PROD-02 |
| T-02-10 (info disclosure in response) | **mitigated** | Response body is literal `{ ok, db, checkedAt }` — no DB URL, no driver version, no hostname. Verified in all 3 controller tests. |
| T-02-11 (Tier 1 boundary violation) | **mitigated** | Biome `noRestrictedImports` + `bun run test:contract` both green; `grep -r "drizzle-orm\|elysia\|pino" src/health/domain src/health/application` returns zero matches |
| T-02-12 (unset status) | **mitigated** | Controller try/catch explicitly sets 200 or 503 on every path — no handler path leaves `set.status` unset |

## Verification Results

| Check | Status | Notes |
|-------|--------|-------|
| `bun run typecheck` | PASS | `tsc --noEmit` clean |
| `bun run lint` | PASS | Biome: 35 files, 0 errors |
| `bun test tests/unit/health/` | PASS | 9 tests (3 usecase + 3 adapter + 3 controller), 17 expect() calls |
| `bun test` (full suite) | PASS | 59 pass, 1 skip, 0 fail (50 baseline → +9 new) |
| `bun run test:contract` | PASS | 10 biome-contract + contract tests still green (Tier 1 intact) |
| Domain framework-free | PASS | `grep -rE "from '(drizzle-orm\|elysia\|better-auth\|postgres\|pino\|@bogeychan/elysia-logger)'" src/health/domain/` → empty |
| Application framework-free | PASS | `grep -rE "from '(drizzle-orm\|postgres)'" src/health/application/` → empty |
| Use case imports barrel only | PASS | `grep -q "from '../../domain'"` matches; no `domain/internal` reference |
| No IoC container | PASS | `grep -rE "tsyringe\|inversify\|reflect-metadata" src/health/` → empty |
| Adapter uses sql`SELECT 1` | PASS | literal match in `drizzle-db-health-probe.ts` |
| AbortController in adapter | PASS | literal match + Task 2 Test C proves it aborts within 500ms |
| `security:` marker absent on /health | PASS | grep empty — D-15 honored |

## Key Decisions

- **Controller catch-path returns inline literal, not `makeHealthStatus()`** — The catch block doesn't have a captured `clock` reference (the use case owns the clock). Using `new Date().toISOString()` inline keeps the catch path self-contained and preserves the exact HealthStatus shape. This is a deliberate mirror, not duplication: if a future adapter somehow rejects past Task 2's mitigation, this belt-and-suspenders still yields a valid body. Tradeoff: two places produce the shape, but both are one line each.
- **Port permits rejection; adapter never rejects** — Documented in the port file comment. This asymmetry is on purpose: the port stays permissive (future adapters may reject), the Drizzle adapter chose the stricter contract (always resolves). Controller try/catch bridges the two.
- **Fake DB for adapter tests uses `Pick<DrizzleDb, 'execute'>`** — No need to instantiate real Drizzle to unit-test the adapter's error-handling + timeout contract. Cast to `as never` at test call sites signals "we know the fake doesn't implement the full DrizzleDb surface, but `execute` is all the adapter needs".
- **No refactor step on any task** — GREEN code already passed lint + typecheck + test; the plan's minimal shape was already clean. REFACTOR commits skipped per TDD discretion.

## Integration Points for Plan 02-03

`createApp(config, deps)` in Plan 02-03 must:

1. Call `createDbClient(config)` from Plan 02-01 → get `{ db }`
2. Call `createHealthModule({ db })` → get the Elysia health plugin
3. `.use(healthModule)` in the D-06 canonical plugin order AFTER `errorHandlerPlugin` (so that if a future /health variant throws, error handler catches it; current controller catches first)
4. Verify with: GET /health in browser / curl → 200 with `{ ok:true, db:'up', checkedAt:<ISO> }`

## Completion Status

- [x] All 3 tasks in `02-02-PLAN.md` executed and committed atomically (2a7d828, c03fb5c, 1919d61)
- [x] SUMMARY.md created (this file)
- [x] 9 new unit tests green — all acceptance truths from `must_haves.truths` proven
- [x] No regressions — 50/50 pre-existing tests still pass
- [x] Rigidity Tier 1 intact — `bun run test:contract` + manual greps both clean
- [x] WEB-02 requirement satisfied

## Self-Check: PASSED

**Files verified on disk (absolute paths):**

- `/Users/carl/Dev/CMG/Rigging/src/health/domain/internal/health-status.ts` — FOUND
- `/Users/carl/Dev/CMG/Rigging/src/health/domain/index.ts` — FOUND
- `/Users/carl/Dev/CMG/Rigging/src/health/application/ports/db-health-probe.port.ts` — FOUND
- `/Users/carl/Dev/CMG/Rigging/src/health/application/usecases/check-health.usecase.ts` — FOUND
- `/Users/carl/Dev/CMG/Rigging/src/health/infrastructure/drizzle-db-health-probe.ts` — FOUND
- `/Users/carl/Dev/CMG/Rigging/src/health/presentation/controllers/health.controller.ts` — FOUND
- `/Users/carl/Dev/CMG/Rigging/src/health/health.module.ts` — FOUND
- `/Users/carl/Dev/CMG/Rigging/tests/unit/health/check-health.usecase.test.ts` — FOUND
- `/Users/carl/Dev/CMG/Rigging/tests/unit/health/drizzle-db-health-probe.test.ts` — FOUND
- `/Users/carl/Dev/CMG/Rigging/tests/unit/health/health.controller.test.ts` — FOUND

**Commits verified in git history:**

- `2a7d828` — feat: [02-app-skeleton] health domain + application layers (plan 02-02 task 1)
- `c03fb5c` — feat: [02-app-skeleton] DrizzleDbHealthProbe adapter with 2000ms AbortController (plan 02-02 task 2)
- `1919d61` — feat: [02-app-skeleton] health controller + feature module factory (plan 02-02 task 3)

---
*Phase: 02-app-skeleton*
*Completed: 2026-04-19*
