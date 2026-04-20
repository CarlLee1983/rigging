# Phase 7: Phase 04 Security Audit Back-fill - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `07-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 7 — Phase 04 Security Audit Back-fill
**Areas discussed:** Deliverable strategy, CVE-2025-61928, timing-safe API Key verify, cross-user 404 matrix (incl. list verb)

---

## Deliverable strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Replace SECURITY.md | Full rewrite | |
| Delta on existing file | Extend `04-SECURITY.md` with SEC-01 gaps | ✓ |
| Mandatory full `$gsd-secure-phase 04` re-run | Only if drift found | (conditional) |

**User's choice:** Delta update + conditional secure-phase re-run if needed.

**Notes:** `04-SECURITY.md` already verified 2026-04-20; ROADMAP still lists Phase 7 incomplete because CVE/timing/list evidence sections are missing from that file relative to SEC-01.

---

## CVE-2025-61928

| Option | Description | Selected |
|--------|-------------|----------|
| New Phase 04-only CVE test | Duplicate integration test in agents suite | |
| Cross-reference Phase 3 regression + summarize in SECURITY.md | Single source of truth for attack pattern | ✓ |

**User's choice:** Document + cite `cve-2025-61928.regression.test.ts`, note v1.1 head verification.

---

## Timing-safe API Key verify

| Option | Description | Selected |
|--------|-------------|----------|
| New micro-benchmark | Only if existing test removed | |
| Cite `timing-safe-apikey.regression.test.ts` + identity adapter | Align with existing 1000-iter ratio gate | ✓ |

**User's choice:** Cite existing regression test + implementation path; re-run when auth code changes.

---

## Cross-user 404 matrix (read / update / delete / list)

| Option | Description | Selected |
|--------|-------------|----------|
| Document only existing tests | GET/PATCH/DELETE + POST + latest read | Partial ✓ |
| Add explicit list-route test | `GET .../prompts` as other user if gap confirmed | Locked for planner |

**User's choice:** Map verbs to `cross-user-404.test.ts` + `dogfood-self-prompt-read.test.ts`; **list** verb may require new test or use-case proof — planner/executor resolves (see D-07 in CONTEXT).

---

## the agent's Discretion

- Subsection layout in `04-SECURITY.md`
- Amount of cross-link vs inline paste from Phase 3 docs

## Deferred Ideas

None.
