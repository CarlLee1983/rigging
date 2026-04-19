# 03-05 Wave 4b Summary

Wave 4b landed 4 Phase 3 ADRs, updated the index, and confirmed the exit gate green.

## What Changed

**ADRs written (MADR 4.0 format, `status: accepted`):**

| ADR | Title | Decision |
|-----|-------|----------|
| 0013 | API Key storage: prefix + hash + indexed | prefix column (8 chars) + SHA-256 hash column + `api_keys_prefix_idx` on prefix (D-21) — O(log n) lookup, timing-uniform paths |
| 0014 | API Key hashing: SHA-256 explicit | SHA-256 via BetterAuth default; pinned via ADR to block `disableKeyHashing: true` path (D-23) |
| 0015 | Rate limit: memory store v1 / persistent v2 | `storage: 'memory'` zero-ops v1; v2 database store deferred to PROD-02 (D-16) |
| 0016 | Trust BetterAuth session cookie defaults + AUTH-11 | Cookie defaults trusted (HttpOnly + Secure[prod] + SameSite=Lax); **AUTH-11 Scenario B**: BetterAuth does NOT purge sessions on reset-password — Rigging's `ResetPasswordUseCase` wraps with `revokeSessions` (D-18) |

**ADR index:** `docs/decisions/README.md` updated with 4 new rows (0013-0016).

**VALIDATION.md:** `nyquist_compliant: false → true`, `status: draft → approved`, `approval: approved 2026-04-19`.

## AUTH-11 Scenario Resolution (ADR 0016)

Spike result: Scenario B — `wrap_required: true`.
- BetterAuth 1.6.5 leaves all sessions alive after `resetPassword`.
- `ResetPasswordUseCase.execute` calls `auth.api.resetPassword` then `auth.api.revokeSessions`.
- `session-fixation.regression.test.ts` reads `03-01-spike-result.json` and asserts stale session /me → 401. ✓

## Phase 3 Exit Gate

| Gate | Result |
|------|--------|
| `bun run lint` | ✓ Clean (103 files) |
| `bun run typecheck` | ✓ No errors |
| `bun test` | ✓ 122 pass, 0 fail, 41 files |
| `bun run test:contract` | ✓ 11 pass (kernel-framework-free + drizzle-schema) |
| Integration test files | 15 (≥ 14 required) |
| Unit test files (auth) | 8 |
| Spike probe files | 1 |

## Timing Measurement (D-10 / AUX-04)

From `timing-safe-apikey.regression.test.ts` (1000-iter run):
- `malMean ≈ 0.345 ms`, `wrongHashMean ≈ 0.347 ms`, `ratio ≈ 0.006` — well below 0.2 threshold ✓

## Phase 3 Atomic Commitment

All atomic promises provable via:
```bash
bun test tests/integration/auth/*.regression.test.ts
```

- CVE-2025-61928 blocked ✓
- No-plugin-401 invariant (AUX-06) ✓
- Resolver precedence D-09/D-11 ✓
- Timing alignment AUX-04 (ratio: 0.006) ✓
- Key hash storage AUTH-13 ✓
- Session fixation AUTH-11 Scenario B ✓
- Password hash storage ✓
- Runtime Guard W-6 ✓
