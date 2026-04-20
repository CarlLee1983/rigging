---
phase: 4
slug: demo-domain
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-19
validated: 2026-04-20
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `04-RESEARCH.md` §Validation Architecture (Nyquist dimensions 1-8).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `bun:test` (built-in to Bun 1.3.12 — no install needed) |
| **Config file** | None — Bun test discovers via filename convention `*.test.ts` |
| **Quick run command** | `bun test tests/unit/agents tests/integration/agents` |
| **Full suite command** | `bun test` |
| **Contract tests** | `bun test:contract` (DDD framework-free enforcement) |
| **Estimated runtime** | ~8–12 seconds (agents slice) / ~25–35 seconds (full suite with 122 P3 tests) |

---

## Sampling Rate

- **After every task commit:** Run `bun test tests/unit/agents tests/integration/agents/<affected>.test.ts` (quick)
- **After every plan wave:** Run `bun test tests/integration/agents` + `bun test:contract`
- **Before `$gsd-verify-work`:** `bun test` (full suite) + `bun run lint` + `bun run typecheck` + `bunx drizzle-kit generate --name=ci-drift` (no drift)
- **Max feedback latency:** 12 seconds (unit+integration quick)

---

## Per-Task Verification Map

> Populated by planner in step 8 as tasks are created. Each row maps a task to its test file and Nyquist dimension.
> Plan IDs are placeholders (04-01..04-04) — confirm after `gsd-planner` emits PLAN.md frontmatter.

| Task ID | Plan | Wave | Requirement | Nyquist Dim | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 04-01 | 1 | D-09 ResourceNotFoundError | 1 behavioral | unit | `bun test tests/unit/shared/kernel/errors.test.ts` | ✅ | ✅ green |
| 04-01-02 | 04-01 | 1 | DEMO-01/02/03 framework-free | 6 operational | contract | `bun test:contract` (no drizzle-orm import in `src/agents/domain/**`) | ✅ | ✅ green |
| 04-02-01 | 04-02 | 2 | DEMO-02 latest | 1 behavioral | unit | `bun test tests/unit/agents/get-latest-prompt-version.usecase.test.ts` | ✅ | ✅ green |
| 04-02-02 | 04-02 | 2 | DEMO-01/02 ownership + scope + retry | 2 adversarial | unit | `bun test tests/unit/agents/*.usecase.test.ts` (cross-user throws, retry exhaustion) | ✅ | ✅ green |
| 04-03-01 | 04-03 | 3 | DEMO-06 composition | 7 composability | smoke | `bun test tests/integration/agents/module-smoke.test.ts` | ✅ | ✅ green |
| 04-04-01 | 04-04 | 4 | DEMO-01 CRUD | 1 behavioral | integration | `bun test tests/integration/agents/agent-crud.test.ts` | ✅ | ✅ green |
| 04-04-02 | 04-04 | 4 | D-09 cross-user 404 | 2 adversarial | integration | `bun test tests/integration/agents/cross-user-404.test.ts` | ✅ | ✅ green |
| 04-04-03 | 04-04 | 4 | D-12 cascade | 5 resilience | integration | `bun test tests/integration/agents/cascade-delete.test.ts` | ✅ | ✅ green |
| 04-04-04 | 04-04 | 4 | D-06 monotonic under concurrency | 2 adversarial | integration | `bun test tests/integration/agents/prompt-version-monotonic.test.ts` | ✅ | ✅ green |
| 04-04-05 | 04-04 | 4 | DEMO-02 CRUD | 1 behavioral | integration | `bun test tests/integration/agents/prompt-version-crud.test.ts` | ✅ | ✅ green |
| 04-04-06 | 04-04 | 4 | DEMO-03 CRUD + malformed | 1+2 | integration | `bun test tests/integration/agents/eval-dataset-crud.test.ts` | ✅ | ✅ green |
| 04-04-07 | 04-04 | 4 | DEMO-04 dogfood | 1 behavioral | integration | `bun test tests/integration/agents/dogfood-self-prompt-read.test.ts` | ✅ | ✅ green |
| 04-04-08 | 04-04 | 4 | DEMO-05 scope reject | 2 adversarial | integration | `bun test tests/integration/agents/scope-check-read-only-key.test.ts` | ✅ | ✅ green |
| 04-04-09 | 04-04 | 4 | DEMO-03 ADR 0017 | 6 operational | verifier | `test -f docs/decisions/0017-eval-dataset-shape-jsonb-immutable.md` | ✅ | ✅ green |
| 04-04-10 | 04-04 | 4 | DEMO-06 friction tally | 8 harness | verifier | `bash .planning/phases/04-demo-domain/verify-friction-tally.sh` | ✅ | ✅ green |
| 04-04-11 | 04-04 | 4 | drift check | 6 operational | drift | `bunx drizzle-kit generate --name=ci-drift` (expect no new file) | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/integration/agents/_helpers.ts` — reuse `tests/integration/auth/_helpers.ts` harness, add `createAgentsModule` wire + `insertTestAgent` / `insertTestPromptVersion` helpers
- [x] `tests/integration/agents/agent-crud.test.ts` — DEMO-01 CRUD happy path
- [x] `tests/integration/agents/cross-user-404.test.ts` — D-09 across GET/PATCH/DELETE/POST prompts
- [x] `tests/integration/agents/cascade-delete.test.ts` — D-12 FK cascade prompt_version + eval_dataset
- [x] `tests/integration/agents/prompt-version-monotonic.test.ts` — D-06 concurrent race (Promise.all × N)
- [x] `tests/integration/agents/prompt-version-crud.test.ts` — D-08 latest / :version / list DESC
- [x] `tests/integration/agents/eval-dataset-crud.test.ts` — D-03/D-04/D-05 + malformed jsonb → 400
- [x] `tests/integration/agents/dogfood-self-prompt-read.test.ts` — DEMO-04 4 variants (full-scope / read-only / cross-user 404 / write rejects)
- [x] `tests/integration/agents/scope-check-read-only-key.test.ts` — DEMO-05 INSUFFICIENT_SCOPE
- [x] `tests/integration/agents/module-smoke.test.ts` — DEMO-06 `createAgentsModule` composes cleanly with `createApp`
- [x] `tests/unit/agents/*.usecase.test.ts` — 13 use case unit tests (ports mocked): scope check + ownership check + retry invariants
- [x] `.planning/phases/04-demo-domain/verify-friction-tally.sh` — bash verifier: grep `- [` count + structural grep + ADR 0018 existence check
- [x] Framework install: **none** — `bun:test` built-in

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `docs/decisions/0017-eval-dataset-shape-jsonb-immutable.md` present and MADR 4.0 formatted | DEMO-03 / D-17 | ADR content quality requires human read for MADR consistency; existence check is auto | `cat docs/decisions/0017-*.md` — inspect Context / Decision / Consequences / Supersedes fields |
| Swagger UI at `/swagger` shows 3 new tag groups (agents / prompt-versions / eval-datasets) with valid OpenAPI 3.x spec | DEMO-06 composability | Visual inspection; auto smoke test ensures routes exist but not Swagger rendering quality | `bun run dev` → curl `http://localhost:3000/swagger/json` → inspect `paths[/agents/*]` |
| 04-HARNESS-FRICTION.md narrative is coherent (events readable, not boilerplate) | DEMO-06 / D-15 | Tally count is auto; narrative quality is subjective | Human read of `.planning/phases/04-demo-domain/04-HARNESS-FRICTION.md` |

---

## Validation Sign-Off

- [x] All tasks have automated verify command or Wave 0 dependency listed
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING test files
- [x] No watch-mode flags (`bun test --watch`) in any `<automated>` command
- [x] Feedback latency < 12s for quick commands (agents slice runs ~1.8s)
- [x] Friction-tally verifier script committed and executable
- [x] `nyquist_compliant: true` set in frontmatter after audit green on all 16 rows

**Approval:** ✅ validated 2026-04-20 — all 16 Per-Task Map rows automated and green.

---

## Validation Audit 2026-04-20

| Metric | Count |
|--------|-------|
| Per-Task rows audited | 16 |
| COVERED (green) | 16 |
| PARTIAL | 0 |
| MISSING | 0 |
| Gaps resolved this audit | 0 |
| Escalated to manual-only | 0 |

**Evidence captured:**
- `bun test tests/unit/agents tests/integration/agents` → 82 pass / 0 fail / 172 expect() calls / 26 files / 1.84s
- `bun test:contract` → 11 pass / 0 fail / 50 expect() calls / 3 files / 0.69s
- `bash .planning/phases/04-demo-domain/verify-friction-tally.sh` → Total events 0, Structural 0, ADR threshold NO, exit 0
- `bunx drizzle-kit generate --name=ci-drift` → "No schema changes, nothing to migrate" (no new migration file)
- `test -f docs/decisions/0017-eval-dataset-shape-jsonb-immutable.md` → exit 0

**Corrections applied:**
- Row 1 command path: `tests/unit/shared/errors.test.ts` → `tests/unit/shared/kernel/errors.test.ts` (file was correctly at `kernel/` subpath; verified covers `ResourceNotFoundError` via grep: 2 hits on class, 1 hit on code `RESOURCE_NOT_FOUND`).
- Task IDs updated from `04-0X-XX` placeholders to concrete `04-0X-0N` identifiers.
- Wave 0 checklist flipped to `[x]` — all listed files landed in plan 04-04 atomic commit `91eed76`.

**No gaps → skipped auditor spawn (Step 5) per workflow rule "No gaps → skip to Step 6, set nyquist_compliant: true".**
