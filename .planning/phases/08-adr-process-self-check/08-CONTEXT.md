# Phase 8: ADR Process Self-Check - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate the ADR toolchain in practice for v1.1: prove that the PR `adr-check` gate can block bad ADR submissions, audit ADR 0000..0018 `status` fields and align `docs/decisions/README.md` with file contents, and record whether new ADR 0019+ is required or a milestone close-out can state “no new ADR.”

Scope is process and documentation hygiene — no new product features. Discussion this session focused only on **plan split** and **sacrificial fail-mode PR evidence**; other roadmap items remain for planning/research to resolve against ADR-06 and the live workflow.

</domain>

<decisions>
## Implementation Decisions

### Plan structure

- **D-01: Phase 8 ships as two plans** — (1) Status/README audit and fixes (ADR 0000..0018 + index consistency). (2) Sacrificial PR fail-mode evidence for `adr-check`, documented in a plan SUMMARY with external URLs.
- **D-02: Recommended execution order** — Run the audit plan before the fail-mode PR plan so any `adr-check` / validation hardening needed for “malformed ADR” is landed before collecting red-CI evidence. If the planner inverts order, they must document why (e.g. gate already sufficient on `main`).

### Fail-mode PR (sacrificial)

- **D-03: Mirror Phase 6 Plan 2 (`06-02-SUMMARY.md`)** — Use a dedicated feature branch, open a normal PR to `main`, wait for the relevant workflow run to reach a failing state for the intentional bad ADR, capture **check run URL(s)** in the Phase 8 fail-mode SUMMARY (evidence table style acceptable), **close the PR without merging**, and follow the same hygiene as Phase 6 for branch cleanup and “main not polluted” notes where applicable.

### the agent's Discretion

- **Exact malformed payload** (which MADR fields to strip or invalidate) and whether **`adr-check` must be extended** so that “malformed ADR” fails CI — not locked in this discuss session. Current `.github/workflows/adr-check.yml` only enforces “PR marked as requiring ADR → new `docs/decisions/*.md`”; planner/researcher must reconcile that with ADR-06 (a) and ROADMAP success criterion 1.
- **Branch name**, commit count, and whether to use force-push iterations vs a single push — planner decides; align with evidence clarity and repo hygiene.
- **Spot-check sample size** for README vs file parity (roadmap asks ≥3) — planner picks rows unless a later discussion locks it.

### Folded Todos

無。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase intent & requirements

- `.planning/ROADMAP.md` — §`### Phase 8: ADR Process Self-Check` (goal, depends on Phase 6, success criteria 1–4, requirement ADR-06)
- `.planning/REQUIREMENTS.md` — §`ADR Process Self-Check (ADR-06)`
- `.planning/PROJECT.md` — §`Current Milestone: v1.1 Release Validation` (ADR self-check scope)

### ADR process & CI

- `.github/workflows/adr-check.yml` — Current PR gate behavior (checkbox + new file check)
- `docs/decisions/0000-use-madr-for-adrs.md` — MADR 4.0 “full” variant expectations
- `docs/decisions/README.md` — ADR index table (must stay consistent with files)

### Evidence pattern (mirror)

- `.planning/phases/06-ci-pipeline-green-run-smoke-validation/06-02-SUMMARY.md` — Sacrificial PR #2, fail-mode evidence table, close-not-merge, branch cleanup notes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Phase 6 fail-mode write-up** — Use as the template for PR links, check run URLs, closed-not-merged confirmation, and deviation notes when the first attempted “break” does not behave as expected.

### Established Patterns

- **v1.1 hygiene phases** — Evidence is shippable only with **external** GitHub check URLs and explicit SUMMARY artifacts, not local-only claims.

### Integration Points

- **GitHub Actions** — `adr-check` job runs on `pull_request` to `main`; fail-mode planning must account for how `adr-check` is triggered vs full `ci.yml` jobs.

</code_context>

<specifics>
## Specific Ideas

- User asked to mirror **Phase 6** sacrificial PR discipline (not a lightweight draft-only flow).
- User chose **two plans**: audit + README first class, fail-mode PR second class.

</specifics>

<deferred>
## Deferred Ideas

### Not discussed this session (planner must cover)

- Extending `adr-check` to validate MADR 4.0 required fields vs redefining ADR-06 evidence — **not selected** for discuss; still a likely prerequisite for roadmap SC#1 depending on current workflow behavior.
- Detailed methodology for auditing 0000..0018 status fields and README rows — **not selected**.
- Whether v1.1 warrants **ADR 0019+** for CI/smoke work already merged — **not selected**; roadmap SC#4 still applies at milestone close.

### Reviewed Todos (not folded)

None.

</deferred>

---

*Phase: 08-adr-process-self-check*
*Context gathered: 2026-04-20*
