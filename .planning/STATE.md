---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Reference App (MVP)
status: milestone_archived
stopped_at: v1.0 milestone closed — 21 plans / 5 phases archived, awaiting $gsd-new-milestone for v1.1 scope
last_updated: "2026-04-20T00:00:00.000Z"
last_activity: 2026-04-20 -- v1.0 milestone archive committed (MILESTONES.md + milestones/v1.0-ROADMAP.md + milestones/v1.0-REQUIREMENTS.md); ROADMAP.md collapsed; PROJECT.md evolved; REQUIREMENTS.md removed
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 21
  completed_plans: 21
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-20 after v1.0 milestone)

**Core value:** AI Agent 寫出來的程式碼必須「自動」具備安全性與結構性——靠的不是提示詞約束，而是框架本身的軌道（type system + runtime guards + DI）讓錯誤的寫法根本跑不起來。
**Current focus:** v1.0 archived — planning v1.1 via `$gsd-new-milestone`

## Current Position

Milestone: v1.0 Reference App — ARCHIVED (2026-04-20)
Phases: 5/5 complete · 21/21 plans complete
Status: Milestone archived — ready for `$gsd-new-milestone` to scope v1.1
Last activity: 2026-04-20 -- v1.0 milestone close: MILESTONES.md + milestones/ archives committed, ROADMAP collapsed, PROJECT evolved, REQUIREMENTS removed via git rm

Progress: v1.0 [██████████] 100%

## v1.0 Retrospective Snapshot

**Shipped:** 2026-04-20
**Timeline:** 2026-04-18 → 2026-04-20 (~2 days, 80 commits)
**Summary:** Harness Engineering reference app with DDD + ADR discipline, dual-track AuthContext (session + API Key), CVE-regression suite, dogfood demo domain, community-ready test/CI/docs.
**Full archives:** `milestones/v1.0-ROADMAP.md` · `milestones/v1.0-REQUIREMENTS.md` · `MILESTONES.md`

Recent plans (final reconcile-in-place + docs):

- Plan 05-04 (b404a1f → 076fa9c): Docs ship — README narrative + `docs/quickstart.md` + `docs/architecture.md` + ADR 0018 + AGENTS.md TOC
- Plan 05-03 (f546f2e): CI rewrite — 3 parallel jobs + postgres service + coverage gate + drift
- Plan 05-02 (efa25e6): 3 E2E user journey — dogfood / password-reset isolation / cross-user 404
- Plan 05-01 (a50ead3): 16 unit tests + API Key hash 格式修正 (hex → base64url, RAW_KEY_LENGTH 52 → 73)
- Full test suite: 221 pass / 1 skip / 0 fail (unit 140 + integration 59 + e2e 11 + contract/regression 11)
- Coverage gate: 100% lines / 100% functions (33 files in domain+application+kernel)

## Deferred Items (acknowledged at v1.0 close)

Items carried forward — candidates for v1.1 Active scope when `$gsd-new-milestone` runs:

| Category | Item | Status |
|----------|------|--------|
| secure-phase | Phase 04 SECURITY audit (`$gsd-secure-phase 04`) | Deferred — threat-mitigation retroactive audit not yet run |
| verification | CI first real run (GitHub Actions after push + PR) | Deferred — G22 checklist item 10, pending manual trigger |
| doc-hygiene | REQUIREMENTS.md traceability table fidelity | Resolved via archive — live file deleted, `milestones/v1.0-REQUIREMENTS.md` is source of truth |
| doc-hygiene | Phase 5 plan-level SUMMARY (05-01/02/03) | Accepted — phase-level `05-SUMMARY.md` Plan Completion Matrix covers |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table (updated 2026-04-20 with outcomes for all 18 v1 entries).

Highlights from v1.0:

- Stack locked and proved: Bun 1.3.12 + Elysia 1.4.28 + Drizzle 0.45.2 + BetterAuth 1.6.5 + postgres-js 3.4.9
- Adopted-scope commit pattern (Phase 4/5 both applied) ✓ Good
- BetterAuth integration ⚠️ Revisit — API Key hash-lookup correction + AUTH-11 wrap revokeSessions (ADR 0016)
- Integration tests shared Postgres (ADR 0018, adopted deviation) ⚠️ Revisit — trade-off on test isolation
- 18 ADRs accepted (0000..0018), MADR 4.0 format 機制 self-enforcing via adr-check PR workflow

### Pending Todos

None at milestone close. Next milestone's Active scope will be defined via `$gsd-new-milestone`.

### Blockers/Concerns

- None blocking v1.0 close. Forward-looking items captured under Deferred Items above.

## Session Continuity

Last session: 2026-04-20T00:00:00.000Z
Stopped at: v1.0 milestone archived (MILESTONES.md + milestones/ 兩份 archive + collapsed ROADMAP + evolved PROJECT.md + git rm REQUIREMENTS.md + tag v1.0)
Resume file: N/A
Next options:
  1. `$gsd-new-milestone` — questioning → research → requirements → roadmap for v1.1
  2. `$gsd-secure-phase 04` — 補做 Phase 4 的 threat-mitigation audit（Deferred #1）
  3. Manual follow-up: push branch + PR → GitHub Actions 首次實跑（Deferred #2）
