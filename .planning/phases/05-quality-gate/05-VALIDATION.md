---
phase: 5
slug: quality-gate
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Based on `05-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `bun:test` 1.3.12 (native, existing — no install) |
| **Config file** | `bunfig.toml` (extended this phase with `[test] coverage` block, D-03-A) |
| **Quick run command** | `bun test <path-or-name-filter>` (single file / pattern) |
| **Full suite command** | `bun run db:migrate && bun test` (local) · `bun run test:ci && bun run coverage:gate` (CI-equivalent) |
| **Regression-only** | `bun run test:regression` (new script this phase, D-02-A) |
| **Estimated runtime** | Unit ~5s · Integration+e2e ~60-90s · Coverage gate ~2s · Full local ~100s |

---

## Sampling Rate

- **After every task commit:** Run `bun run typecheck && bun test <affected files>` (quick; < 10s)
- **After every plan wave:** Run `bun run db:migrate && bun test` (full suite — unit + integration + e2e)
- **Before `$gsd-verify-work`:** Full suite + `bun run coverage:gate` + `bun run test:regression` all green; CI workflow confirmed passing on PR
- **Max feedback latency:** 10s per-task, 100s per-wave

---

## Per-Task Verification Map

*Exact task-level map deferred to PLAN.md frontmatter — this table shows phase-level gate anchors aligned to the 5 success criteria + 13 REQ-IDs.*

| Gate | Plan | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|------|------|-------------|-----------------|-----------|-------------------|--------|
| G1: Coverage ≥80% on `src/**/domain/` + `src/**/application/` + `src/shared/kernel/` | 05-01 | QA-01 | Domain + Application + Kernel at or above 80% lines/branches/functions aggregate | per-path rollup | `bun run test:ci && bun run coverage:gate` | ⬜ pending |
| G2: Coverage gate script exists + exits 1 on miss | 05-01 | QA-01, CI-03 | `scripts/coverage-gate.ts` enumerates filesystem for target tiers, parses LCOV, treats absent files as 0%, exits 1 on failure | unit | `bun run scripts/coverage-gate.ts --dry-run` (planner may add) OR `bun run coverage:gate` after coverage/lcov.info exists | ⬜ pending |
| G3: `scripts/ensure-agent-schema.ts` removed + `test` script runs `db:migrate` prefix | 05-01 | QA-02 | `test` script = `bun run db:migrate && bun test`; no `ensure-agent-schema` reference anywhere in package.json or test setup | grep | `! grep -r "ensure-agent-schema" package.json tests/` | ⬜ pending |
| G4: `bunfig.toml` `[test]` has coverage + lcov reporter + ignore patterns | 05-01 | QA-01 | File contains `coverage = true`, `coverageReporter = ["text", "lcov"]`, path ignores for `tests/`, `node_modules/`, `drizzle/`, `src/**/infrastructure/**`, `src/**/presentation/**`, `src/bootstrap/**`, `src/main.ts`, `src/types/**`, `scripts/` | grep | `grep -E 'coverage = true\|coverageReporter\|coveragePathIgnorePatterns' bunfig.toml` | ⬜ pending |
| G5: Unit test backfill — 14-17 files for missing domain/application coverage | 05-01 | QA-01 | All 11 untested agents use cases + 4 untested auth use cases + 3 entities + 3 error classes have `*.test.ts`; each covered ≥80% | unit | `bun test tests/unit --coverage-reporter=text \| grep "^src/"` | ⬜ pending |
| G6: E2E helpers file + 3 journey tests pass | 05-02 | QA-04, QA-05 | `tests/e2e/_helpers.ts` re-exports from `tests/integration/auth/_helpers.ts`; 3 e2e files all run green via `app.handle(Request)` | e2e | `bun test tests/e2e` | ⬜ pending |
| G7: `dogfood-happy-path.test.ts` full path: register → verify → login → agent → prompt → key → key-auth read | 05-02 | QA-04 (+DEMO-04 echo) | Final assertion: GET `/agents/:id/prompts/latest` with `x-api-key` returns `identityKind:'agent'` + matching content | e2e | `bun test tests/e2e/dogfood-happy-path.test.ts` | ⬜ pending |
| G8: `password-reset-session-isolation.test.ts` covers AUTH-11 in e2e layer | 05-02 | QA-04 (+AUTH-11) | After reset, session A 401; API Key K still valid on protected endpoint | e2e | `bun test tests/e2e/password-reset-session-isolation.test.ts` | ⬜ pending |
| G9: `cross-user-404-e2e.test.ts` covers both cookie + API-key auth returning 404 | 05-02 | QA-04 | User B cookie → 404; User B `x-api-key` → 404 on A's agent resource | e2e | `bun test tests/e2e/cross-user-404-e2e.test.ts` | ⬜ pending |
| G10: Regression suite independently runnable | 05-01 | QA-05 | `bun run test:regression` finds all `*.regression.test.ts` files and executes; exit 0 | script | `bun run test:regression` | ⬜ pending |
| G11: CI workflow has 3 parallel jobs (lint/typecheck/test) | 05-03 | CI-01 | `.github/workflows/ci.yml` defines exactly jobs `lint`, `typecheck`, `test`; each has own steps | yaml grep | `grep -c "^  \(lint\|typecheck\|test\):" .github/workflows/ci.yml` == 3 | ⬜ pending |
| G12: CI `test` job uses `services: postgres:16-alpine` + healthcheck | 05-03 | CI-01, CI-02 | postgres service in `test` job with `pg_isready` healthcheck; `DATABASE_URL=postgres://postgres:postgres@localhost:5432/rigging_test` env | yaml grep | `grep -A 5 "services:" .github/workflows/ci.yml \| grep "postgres:16-alpine"` | ⬜ pending |
| G13: Migration drift step uses `git status --porcelain drizzle/` | 05-03 | CI-02 | `test` job has step that runs `bun run db:generate --name=ci-drift` then checks `git status --porcelain drizzle/` is empty; exits 1 on drift | yaml grep | `grep -A 8 "Migration drift" .github/workflows/ci.yml` | ⬜ pending |
| G14: Coverage gate invoked in CI `test` job | 05-03 | CI-03 | `test` job runs `bun run test:ci` then `bun run coverage:gate`; gate failure = CI red | yaml grep | `grep -E "test:ci\|coverage:gate" .github/workflows/ci.yml` | ⬜ pending |
| G15: `concurrency` group cancels previous runs | 05-03 | CI-01 | Workflow has `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }` | yaml grep | `grep -A 2 "^concurrency:" .github/workflows/ci.yml \| grep "cancel-in-progress: true"` | ⬜ pending |
| G16: README.md rewritten — Core Value + Why + Quickstart link above fold | 05-04 | DOC-01 | First 70 lines include `# Rigging`, tagline, Core Value paragraph, `## Why Rigging`, link to `docs/quickstart.md` | grep + line count | `head -70 README.md \| grep -E "^# Rigging\|Why Rigging\|docs/quickstart"` | ⬜ pending |
| G17: `docs/quickstart.md` exists with 2 paths + 10-min estimate | 05-04 | DOC-02 | File exists; contains `## Path A` (session) + `## Path B` (API key); contains `10 minutes` or `10 min` in intro | grep | `test -f docs/quickstart.md && grep -E "Path A\|Path B\|10 min" docs/quickstart.md` | ⬜ pending |
| G18: `docs/architecture.md` exists with 3 mermaid diagrams | 05-04 | DOC-03 | File exists; contains 3+ ` ```mermaid` fences; each chapter references at least one ADR | grep + count | `test -f docs/architecture.md && [ $(grep -c '\`\`\`mermaid' docs/architecture.md) -ge 3 ]` | ⬜ pending |
| G19: ADR 0018 added + index row in `docs/decisions/README.md` | 05-04 | DOC-04 | `docs/decisions/0018-testcontainers-deviation-via-docker-compose.md` exists in MADR 4.0; `README.md` index has row 0018 with substantive status | grep | `test -f docs/decisions/0018-testcontainers-deviation-via-docker-compose.md && grep "0018" docs/decisions/README.md` | ⬜ pending |
| G20: `docs/decisions/README.md` status column polished (no placeholder Draft where Accepted) | 05-04 | DOC-04 | All 18 ADR rows have substantive status (Accepted / Proposed / Superseded) — no `TBD` / placeholder `Draft` for committed decisions | grep | `! grep -E "^\| 00(0[0-9]\|1[0-7]).*TBD" docs/decisions/README.md` | ⬜ pending |
| G21: AGENTS.md top TOC + L197 rename | 05-04 | DOC-05 | Top of AGENTS.md (after `# AGENTS.md` H1, before first `<!-- GSD:* -->`) has `AI Agent Onboarding` TOC with 4-5 bullet links; L197 heading renamed to include "AI Agent 接手本專案前必讀" | grep | `grep -E "AI Agent Onboarding\|AI Agent 接手本專案前必讀" AGENTS.md` | ⬜ pending |
| G22: "Looks Done But Isn't" checklist — all 10 pass | 05-04 | QA-* (#5 SC) | Phase exit: ADR index has substantive status × no placeholder · AGENTS.md onboarding present · regression suite independently runnable · `grep "@ts-ignore" src/**/auth src/**/agents` → 0 hits in auth-critical paths · `bun run typecheck` exit 0 · `bun test` all green · `bun run lint` exit 0 · CI last run green on main · `docs/quickstart.md` `docs/architecture.md` exist · README first 70 lines show Core Value | composite | `scripts/looks-done-checklist.sh` (optional helper) OR manual verifier run through the 10 items | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No Wave 0 test infrastructure install needed — `bun:test` already present + used by 35 existing test files + 26 integration files + 7 regression files. Phase 5 extends infra, does not bootstrap it.

- [x] `bun:test` available (Bun 1.3.12)
- [x] Integration helper pattern established (`tests/integration/auth/_helpers.ts` + `tests/integration/agents/_helpers.ts`)
- [x] `docker-compose.yml` provides postgres for local integration tests
- [x] `scripts/` directory exists (P4 conventions)
- [ ] `bunfig.toml` `[test]` coverage block (created by Plan 05-01 — first task in Wave 1)
- [ ] `scripts/coverage-gate.ts` (created by Plan 05-01)
- [ ] `tests/e2e/_helpers.ts` re-export (created by Plan 05-02)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| External developer finishes full quickstart in ≤10 min (clean machine, first read) | DOC-02, Success Criterion #1 | Timing is human-perceived, not programmatic | Volunteer follows `docs/quickstart.md` on clean environment; stopwatch from `git clone` to `x-api-key` request success. Record actual time + any confusion points. |
| README first-impression delivers Core Value not file-layout-dump | DOC-01, Success Criterion #4 | Subjective narrative quality | 3 reviewers read first 70 lines of `README.md` cold; each answers "what does Rigging do and why?" in one sentence. Pass if answers converge on harness/AuthContext/rails theme. |
| Architecture.md mermaid diagrams render correctly in GitHub web UI | DOC-03 | Visual rendering verification | Push to a branch, open PR, view `docs/architecture.md` in GitHub web UI, confirm all 3 diagrams render (not raw code block) |
| PR opened against main triggers CI with all 3 jobs visible + green | CI-01, Success Criterion #3 | Real GitHub Actions infra in PR context | Open real PR with small diff, observe Actions tab shows lint / typecheck / test jobs in parallel, all green. |

---

## Validation Sign-Off

- [ ] All 22 gates (G1-G22) have concrete automated or defined-manual verification command
- [ ] Sampling continuity: coverage gate runs after unit tests (not after every file change — too noisy)
- [ ] Wave 0 covers all MISSING infra (none — phase 5 extends existing infra)
- [ ] No watch-mode flags (all commands are one-shot)
- [ ] Feedback latency < 10s per task / 100s per wave
- [ ] `nyquist_compliant: true` set in frontmatter when planner + executor confirm all gates are wired

**Approval:** pending (researcher draft 2026-04-19 · planner to update gate mappings to task IDs · executor to flip statuses during Phase 5 execution)
