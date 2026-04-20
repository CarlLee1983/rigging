# Phase 8: ADR Process Self-Check - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `08-CONTEXT.md`.

**Date:** 2026-04-20
**Phase:** 8 — ADR Process Self-Check
**Areas discussed:** Fail-mode PR pattern, Plan split

---

## Gray area selection

| Option | Description | Selected |
|--------|-------------|----------|
| adr-check vs MADR | Extend CI/script for malformed ADR vs adjust ADR-06 satisfaction | |
| Fail-mode PR | Sacrificial branch/PR, evidence URLs, close not merge | ✓ |
| Status + README audit | Manual vs scripted verification | |
| ADR 0019+ threshold | New ADRs vs milestone “no new ADR” | |

**User's choice:** Discuss **Fail-mode PR** only.

---

## Fail-mode PR

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror 06-02 | Same sacrificial PR contract as Phase 6 Plan 2 | ✓ |
| Draft PR only | Less formal | |
| Other | User describes in chat | |

**User's choice:** Mirror `06-02-SUMMARY.md` structure (evidence table, close not merge, branch cleanup).

---

## Plan split

| Option | Description | Selected |
|--------|-------------|----------|
| Two plans (audit then fail-mode) | (1) status/README audit + fixes, (2) sacrificial PR fail-mode | ✓ |
| One atomic plan | All in one plan | |
| Fail-mode first | (1) PR, (2) audit | |
| Planner decides | Only lock PR evidence style | |

**User's choice:** Two plans — audit + README first; sacrificial PR second.

**Notes:** Discuss-phase agent recommends **audit before fail-mode** so any `adr-check` changes needed for MADR validation exist before collecting red-CI evidence; not explicitly confirmed by user (planner may override with rationale).

---

## the agent's Discretion

- Malformed ADR definition and `adr-check.yml` extension work — left to planner (not discussed).

## Deferred Ideas

- MADR validation gap vs current `adr-check` workflow behavior.
- Status audit mechanics and ADR 0019 policy — surfaced in CONTEXT deferred section for planner.
