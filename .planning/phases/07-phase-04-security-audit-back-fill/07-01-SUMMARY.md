---
phase: 07-phase-04-security-audit-back-fill
plan: 01
subsystem: testing
tags: [security, SEC-01, CVE-2025-61928, timing-safe, cross-user-404, bun-test]

requires:
  - phase: 04-demo-domain
    provides: Phase 04 routes + threat register baseline in 04-SECURITY.md
provides:
  - SEC-01 compliance evidence block in 04-SECURITY.md (CVE + timing-safe + cross-user matrix)
  - Third Security Audit Trail row with evidence SHA and test attestation
affects:
  - phase-8-adr-process-self-check

tech-stack:
  added: []
  patterns:
    - "D-07 Branch B: list-verb cross-user coverage via list-prompt-versions.usecase.ts:17–21 code citation"

key-files:
  created: []
  modified:
    - ".planning/phases/04-demo-domain/04-SECURITY.md"

key-decisions:
  - "Evidence tests run against Docker Postgres (rigging user) when localhost:5432 targets non-container Postgres"

patterns-established:
  - "SECURITY.md SEC-01 block references exact regression files + HEAD SHA + timing ratio"

requirements-completed:
  - SEC-01

duration: 25min
completed: 2026-04-20
---

# Phase 7: Phase 04 Security Audit Back-fill — Plan 01 Summary

**04-SECURITY.md now carries self-verified SEC-01 evidence: CVE regression, timing-safe API Key path, and full cross-user verb matrix (list verb via D-07 Branch B code proof).**

## Performance

- **Duration:** ~25 min (inline execution; gsd-sdk not available in PATH on this runner)
- **Tasks:** 3 (tests → doc → commit)
- **Files modified:** 1 (`04-SECURITY.md`)

## Accomplishments

- Ran `bun run test:regression` and agents cross-user suites with green results against Docker Postgres.
- Inserted `## SEC-01 Compliance Evidence` with three subsections per plan template; preserved threat register, accepted risks, prior audit rows, and Sign-Off.
- Added third `## Security Audit Trail` table row with HEAD SHA and command attestation.
- Single docs commit: `e2941a6` — docs: [07-01] Phase 04 SECURITY.md SEC-01 compliance evidence — CVE-2025-61928 + timing-safe + cross-user matrix (D-07 Branch B).

## Task Commits

1. **Task 1: 執行佐證測試套件並記錄結果** — evidence captured in Task 2/SUMMARY (no separate code commit).
2. **Task 2: 在 04-SECURITY.md 新增 SEC-01 合規佐證區段** — included in `e2941a6`.
3. **Task 3: Commit SEC-01 佐證更新** — `e2941a6`.

## Evidence numbers

| Item | Value |
|------|--------|
| HEAD SHA (tests + doc evidence baseline) | `d15fecc623608abadef5025d95dffb0fe2e29085` |
| timing-safe ratio (logged at evidence run) | `0.01585070945657452` |
| D-07 Branch B | Code-level proof for list verb — no new integration test |

## Self-Check: PASSED

- Plan Task 2 grep acceptance criteria satisfied.
- `git log --oneline -5 | grep 07-01` finds `e2941a6`.
- Re-run `bun run test:regression` with `DATABASE_URL` pointing at Docker Postgres: PASS.

## Deviations from Plan

**Environment — localhost:5432 vs Docker Postgres**

- **Found during:** Task 1 (`bun run test:regression`).
- **Issue:** Host `127.0.0.1:5432` was served by a local Postgres instance, not the `rigging-postgres` container — connection failed with `role "rigging" does not exist`.
- **Fix:** Set `DATABASE_URL` to the container IP from `docker inspect rigging-postgres` (e.g. `192.168.158.2:5432`) for the evidence run. No application code change.

## Issues Encountered

- Dual listener on port 5432 (local Postgres vs Docker publish) — resolved by targeting Docker bridge IP for integration tests in this session.

## User Setup Required

- For integration tests: ensure `DATABASE_URL` reaches the Docker `rigging` database (see `docker-compose.yml` and `.env.example`). If `localhost:5432` is owned by another Postgres, use the container IP or adjust local services.

## Next Phase Readiness

- Phase 7 plan scope satisfied. Next: Phase 8 (ADR-06) per v1.1 roadmap.

---
*Phase: 07-phase-04-security-audit-back-fill*
*Completed: 2026-04-20*
