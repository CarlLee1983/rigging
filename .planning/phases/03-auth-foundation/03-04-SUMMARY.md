# 03-04 Wave 4a Summary

Wave 4a wired the auth infrastructure into Elysia and shipped the full regression suite.

## What Changed

**Presentation Layer:**
- `auth-context.plugin.ts` — `.macro({ requireAuth: { resolve } })` single-root mount. Resolver precedence (D-09/D-11): x-api-key header checked first with no cookie fallback; throws `UnauthenticatedError` on any failure.
- `api-key.controller.ts` — POST/GET/DELETE `/api-keys` all with `requireAuth: true`. CVE-2025-61928 blocked: `userId` not in DTO schema, use case enforces `authContext.userId` equality (AUTH-15).
- `me.controller.ts` — GET `/me` with D-11 conditional spread: `sessionId`/`apiKeyId` absent (not null/undefined) on cross-identity paths.
- `auth.controller.ts` — POST `/rigging-reset-password` (Scenario B: Rigging wrap over BetterAuth's non-purging reset endpoint).
- `create-api-key.dto.ts` — TypeBox schema with `scopes: t.Union(ALLOWED_SCOPES.map(t.Literal))` (D-05) and D-25 label 1-64 chars.
- `list-api-keys.dto.ts` — Empty query schema for v1.

**Module + Bootstrap:**
- `auth.module.ts` — `createAuthModule(deps)` mounts BetterAuth at `/api/auth` (D-14), registers macro, wires 3 controllers.
- `src/bootstrap/app.ts` — patched to insert `createAuthModule(authDeps)` between swagger and health per ADR 0012. Added `authInstance?: AuthInstance` to `AppDeps` for test override.

**Integration Test Suite (15 files, 122 tests total passing):**

| Test | Threat | Status |
|------|--------|--------|
| `cve-2025-61928.regression.test.ts` | CVE-2025-61928 (AUTH-15) | ✓ |
| `no-plugin-401.regression.test.ts` | AUX-06 no-plugin invariant | ✓ |
| `resolver-precedence.regression.test.ts` | D-09 no-fallback + D-11 agent precedence | ✓ |
| `timing-safe-apikey.regression.test.ts` | D-10/AUX-04 timing alignment | ✓ |
| `session-fixation.regression.test.ts` | AUTH-11 Scenario B session purge | ✓ |
| `key-hash-storage.regression.test.ts` | AUTH-13 raw key never in DB | ✓ |
| `password-hash-storage.regression.test.ts` | AUTH-13 password never plaintext | ✓ |
| `401-body-shape.test.ts` | D-12 uniform 401 body | ✓ |
| `macro-scope-global.test.ts` | AUX-02 TS narrowing | ✓ |
| `human-happy-path.test.ts` | Full register → verify → login → logout | ✓ |
| `me-endpoint.test.ts` | Human + agent identity introspection | ✓ |
| `api-key-crud.test.ts` | POST/GET/DELETE API key lifecycle | ✓ |
| `email-verification.test.ts` | ConsoleEmailAdapter + URL consumption | ✓ |
| `password-reset-happy.test.ts` | Request reset → follow link → sign in | ✓ |
| `runtime-guard.regression.test.ts` | W-6 AuthContext-stripping plugin → 500 | ✓ |

**Deleted:** `tests/integration/auth-bypass-contract.test.ts` (test.skip stub → replaced by `no-plugin-401.regression.test.ts`).

## Timing Measurement (AUX-04 / D-10)

From `timing-safe-apikey.regression.test.ts` (1000-iter sample):
- Malformed key mean latency vs. valid-format-wrong-hash mean latency ratio: < 0.2 ✓

## Scenario B Confirmation

`session-fixation.regression.test.ts` reads `.planning/phases/03-auth-foundation/03-01-spike-result.json` and asserts `wrap_required === true`. The Rigging `ResetPasswordUseCase` wrap correctly purges other sessions before reset — stale session /me returns 401 post-reset.

## Verification

- `bun test` — 122 pass, 0 fail
- `bun run typecheck` — clean
- `bun run lint` — clean
