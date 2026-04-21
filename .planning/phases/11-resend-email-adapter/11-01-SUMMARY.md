---
phase: 11-resend-email-adapter
plan: "01"
subsystem: auth/email
tags: [resend, email-adapter, config, ioc]
dependency_graph:
  requires: []
  provides:
    - ResendEmailAdapter (IEmailPort implementation)
    - ConfigSchema RESEND_API_KEY + RESEND_FROM_ADDRESS fields
    - Conditional adapter selection in createAuthModule
  affects:
    - src/auth/auth.module.ts
    - src/bootstrap/config.ts
tech_stack:
  added:
    - resend@6.12.2
  patterns:
    - Adapter pattern (IEmailPort swap)
    - Fail-fast guard for partial env config
    - TypeBox Optional fields with custom format validator
key_files:
  created:
    - src/auth/infrastructure/email/resend-email.adapter.ts
    - .env.example
  modified:
    - src/bootstrap/config.ts
    - src/auth/auth.module.ts
    - package.json
    - bun.lock
    - tests/unit/bootstrap/config.test.ts
decisions:
  - "resend@6.12.2 pinned to exact version (no caret) consistent with better-auth exact pin style"
  - "RESEND_FROM_ADDRESS validated with custom /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/ regex via FormatRegistry (TypeBox has no built-in email format)"
  - "Fail-fast guard triggers when exactly one of the two RESEND vars is set — partial config is an operator error, not a runtime fallback"
metrics:
  duration: "~3 minutes"
  completed: "2026-04-21"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 7
---

# Phase 11 Plan 01: Install resend + Wire ResendEmailAdapter Summary

**One-liner:** Resend email adapter swap via IEmailPort — RESEND_API_KEY + RESEND_FROM_ADDRESS enable real delivery; ConsoleEmailAdapter remains default when both unset; fail-fast guard on partial config.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install resend@6.12.2 + extend ConfigSchema | 3552cb1 | package.json, src/bootstrap/config.ts, .env.example |
| 2 | Implement ResendEmailAdapter | 7b48076 | src/auth/infrastructure/email/resend-email.adapter.ts |
| 3 | Wire conditional adapter selection in createAuthModule | daa9e01 | src/auth/auth.module.ts, tests/unit/bootstrap/config.test.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated config drift guard test schemaKeys to include RESEND fields**

- **Found during:** Task 3 verification (`bun test tests/unit/auth tests/unit/bootstrap`)
- **Issue:** The drift guard test in `tests/unit/bootstrap/config.test.ts` uses a hardcoded `schemaKeys` Set. Adding `RESEND_API_KEY` and `RESEND_FROM_ADDRESS` to ConfigSchema caused `.env.example` to contain those keys, which the test then verified against the hardcoded set — failing because the set was out of date.
- **Fix:** Added `RESEND_API_KEY` and `RESEND_FROM_ADDRESS` to the `schemaKeys` Set in `tests/unit/bootstrap/config.test.ts`. Also applied the same update to `packages/create-rigging/template/tests/unit/bootstrap/config.test.ts` (in-place, not committed — template dir is gitignored; will be rebuilt from source on next scaffold build).
- **Files modified:** `tests/unit/bootstrap/config.test.ts`
- **Commit:** daa9e01 (bundled with Task 3 commit)

## Threat Mitigations Applied (from threat_model)

| Threat ID | Mitigation |
|-----------|------------|
| T-11-01 | RESEND_API_KEY passed as constructor arg to Resend SDK — never logged. Logger calls in ResendEmailAdapter only log to/subject/id. |
| T-11-03 | Resend SDK errors caught, logged at error level, re-thrown as Error objects — process does not crash. |

## Known Stubs

None — all three tasks deliver complete, wired functionality. The adapter is fully connected to the createAuthModule DI chain.

## Verification Results

- `bun run typecheck`: 3 pre-existing scaffold TS7016 errors (unrelated to this plan — `packages/create-rigging/lib/helpers.js` missing type declarations, present before this plan). Zero new errors introduced.
- `bun test tests/unit/auth tests/unit/bootstrap`: **100 pass, 0 fail** (100 tests across 30 files).

## Self-Check: PASSED

- `src/auth/infrastructure/email/resend-email.adapter.ts`: exists ✓
- `src/bootstrap/config.ts` contains `RESEND_API_KEY`: ✓
- `src/bootstrap/config.ts` contains `RESEND_FROM_ADDRESS`: ✓
- `src/bootstrap/config.ts` contains `FormatRegistry.Set('email', ...)`: ✓
- `.env.example` contains `RESEND_API_KEY=`: ✓
- `.env.example` contains `RESEND_FROM_ADDRESS=`: ✓
- `src/auth/auth.module.ts` imports `ResendEmailAdapter`: ✓
- `src/auth/auth.module.ts` contains fail-fast guard `hasApiKey !== hasFromAddress`: ✓
- `src/auth/auth.module.ts` contains `ResendEmailAdapter` ternary: ✓
- `package.json` contains `"resend": "6.12.2"` (exact, no caret): ✓
- Commits 3552cb1, 7b48076, daa9e01: all exist in git log ✓
