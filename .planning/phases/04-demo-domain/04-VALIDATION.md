---
phase: 4
slug: demo-domain
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
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
| 04-01-XX | 04-01 | 1 | DEMO-01/02/03 | 1 behavioral | unit | `bun test tests/unit/shared/errors.test.ts` | ❌ Wave 0 | ⬜ pending |
| 04-01-XX | 04-01 | 1 | DEMO-01/02/03 | 6 operational | contract | `bun test:contract` (no drizzle-orm import in `src/agents/domain/**`) | ✅ P1 | ⬜ pending |
| 04-02-XX | 04-02 | 2 | DEMO-02 latest | 1 behavioral | unit | `bun test tests/unit/agents/get-latest-prompt-version.usecase.test.ts` | ❌ Wave 0 | ⬜ pending |
| 04-02-XX | 04-02 | 2 | DEMO-01 ownership | 2 adversarial | unit | `bun test tests/unit/agents/*.usecase.test.ts` (cross-user throws) | ❌ Wave 0 | ⬜ pending |
| 04-03-XX | 04-03 | 3 | DEMO-06 composition | 7 composability | smoke | `bun test tests/integration/agents/module-smoke.test.ts` | ❌ Wave 0 | ⬜ pending |
| 04-04-XX | 04-04 | 4 | DEMO-01 CRUD | 1 behavioral | integration | `bun test tests/integration/agents/agent-crud.test.ts` | ❌ Wave 0 | ⬜ pending |
| 04-04-XX | 04-04 | 4 | D-09 cross-user 404 | 2 adversarial | integration | `bun test tests/integration/agents/cross-user-404.test.ts` | ❌ Wave 0 | ⬜ pending |
| 04-04-XX | 04-04 | 4 | D-12 cascade | 5 resilience | integration | `bun test tests/integration/agents/cascade-delete.test.ts` | ❌ Wave 0 | ⬜ pending |
| 04-04-XX | 04-04 | 4 | DEMO-02 monotonic | 2 adversarial | integration | `bun test tests/integration/agents/prompt-version-monotonic.test.ts` | ❌ Wave 0 | ⬜ pending |
| 04-04-XX | 04-04 | 4 | DEMO-02 CRUD | 1 behavioral | integration | `bun test tests/integration/agents/prompt-version-crud.test.ts` | ❌ Wave 0 | ⬜ pending |
| 04-04-XX | 04-04 | 4 | DEMO-03 CRUD + malformed | 1+2 | integration | `bun test tests/integration/agents/eval-dataset-crud.test.ts` | ❌ Wave 0 | ⬜ pending |
| 04-04-XX | 04-04 | 4 | DEMO-04 dogfood | 1 behavioral | integration | `bun test tests/integration/agents/dogfood-self-prompt-read.test.ts` | ❌ Wave 0 | ⬜ pending |
| 04-04-XX | 04-04 | 4 | DEMO-05 scope reject | 2 adversarial | integration | `bun test tests/integration/agents/scope-check-read-only-key.test.ts` | ❌ Wave 0 | ⬜ pending |
| 04-04-XX | 04-04 | 4 | DEMO-03 ADR 0017 | 6 operational | verifier | `test -f docs/decisions/0017-*.md` | ❌ Wave 0 | ⬜ pending |
| 04-04-XX | 04-04 | 4 | DEMO-06 friction tally | 8 harness | verifier | `bash .planning/phases/04-demo-domain/verify-friction-tally.sh` | ❌ Wave 0 | ⬜ pending |
| 04-04-XX | 04-04 | 4 | drift check | 6 operational | drift | `bunx drizzle-kit generate --name=ci-drift` (expect no output) | ✅ P1 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/integration/agents/_helpers.ts` — reuse `tests/integration/auth/_helpers.ts` harness, add `createAgentsModule` wire + `insertTestAgent` / `insertTestPromptVersion` helpers
- [ ] `tests/integration/agents/agent-crud.test.ts` — DEMO-01 CRUD happy path
- [ ] `tests/integration/agents/cross-user-404.test.ts` — D-09 across GET/PATCH/DELETE/POST prompts
- [ ] `tests/integration/agents/cascade-delete.test.ts` — D-12 FK cascade prompt_version + eval_dataset
- [ ] `tests/integration/agents/prompt-version-monotonic.test.ts` — D-06 concurrent race (Promise.all × N)
- [ ] `tests/integration/agents/prompt-version-crud.test.ts` — D-08 latest / :version / list DESC
- [ ] `tests/integration/agents/eval-dataset-crud.test.ts` — D-03/D-04/D-05 + malformed jsonb → 400
- [ ] `tests/integration/agents/dogfood-self-prompt-read.test.ts` — DEMO-04 4 variants (full-scope / read-only / cross-user 404 / write rejects)
- [ ] `tests/integration/agents/scope-check-read-only-key.test.ts` — DEMO-05 INSUFFICIENT_SCOPE
- [ ] `tests/integration/agents/module-smoke.test.ts` — DEMO-06 `createAgentsModule` composes cleanly with `createApp`
- [ ] `tests/unit/agents/*.usecase.test.ts` — use case unit tests (ports mocked): scope check + ownership check invariants
- [ ] `.planning/phases/04-demo-domain/verify-friction-tally.sh` — bash verifier: grep `- [` count + structural grep + ADR 0018 existence check
- [ ] Framework install: **none** — `bun:test` built-in

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `docs/decisions/0017-eval-dataset-shape-jsonb-immutable.md` present and MADR 4.0 formatted | DEMO-03 / D-17 | ADR content quality requires human read for MADR consistency; existence check is auto | `cat docs/decisions/0017-*.md` — inspect Context / Decision / Consequences / Supersedes fields |
| Swagger UI at `/swagger` shows 3 new tag groups (agents / prompt-versions / eval-datasets) with valid OpenAPI 3.x spec | DEMO-06 composability | Visual inspection; auto smoke test ensures routes exist but not Swagger rendering quality | `bun run dev` → curl `http://localhost:3000/swagger/json` → inspect `paths[/agents/*]` |
| 04-HARNESS-FRICTION.md narrative is coherent (events readable, not boilerplate) | DEMO-06 / D-15 | Tally count is auto; narrative quality is subjective | Human read of `.planning/phases/04-demo-domain/04-HARNESS-FRICTION.md` |

---

## Validation Sign-Off

- [ ] All tasks have automated verify command or Wave 0 dependency listed
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING test files
- [ ] No watch-mode flags (`bun test --watch`) in any `<automated>` command
- [ ] Feedback latency < 12s for quick commands
- [ ] Friction-tally verifier script committed and executable
- [ ] `nyquist_compliant: true` set in frontmatter after gsd-planner populates Per-Task Verification Map

**Approval:** pending — gsd-planner populates per-task rows in step 8; gsd-plan-checker enforces coverage in step 10.
