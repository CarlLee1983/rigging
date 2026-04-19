---
phase: 3
slug: auth-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `bun:test` (Bun 1.2.x built-in; existing P2 integration smoke suite lives in `tests/integration/**/*.test.ts`) |
| **Config file** | `package.json` scripts + `tsconfig.json` (no extra test-runner config; `bun test` auto-discovers) |
| **Quick run command** | `bun test tests/unit/auth/` (unit scope check, error-class httpStatus, timing-safe compare, factory Runtime Guard) |
| **Full suite command** | `bun test` (unit + integration + regression; includes `tests/integration/auth/*.regression.test.ts`) |
| **Estimated runtime** | ~12 seconds (unit); ~40 seconds (full, with integration via `createApp(testConfig, { probe })`) |

---

## Sampling Rate

- **After every task commit:** Run `bun test tests/unit/auth/` + `bun run lint` + `bun run typecheck`
- **After every plan wave:** Run `bun test` (full suite) + `bun run build`
- **Before `$gsd-verify-work`:** Full suite must be green; `drizzle-kit check` shows no drift; `bun:contract` (if set up by Plan 03-01) passes.
- **Max feedback latency:** 60 seconds (full suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | AUX-01 | T-03-SCHEMA | BetterAuth CLI generates user/session/account/verification/apiKey schemas without errors | integration | `bunx @better-auth/cli generate && bun test tests/integration/schema-contract.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | AUX-01 | T-03-MIGRATION | Drizzle migration `0001_auth_foundation.sql` applies cleanly and `drizzle-kit check` shows no drift | integration | `bunx drizzle-kit generate --name=0001_auth_foundation && bunx drizzle-kit check` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | AUTH-11 | T-03-FIXATION-PROBE | Spike documents whether BetterAuth 1.6.5 purges other sessions on `POST /reset-password` | integration-probe | `bun test tests/spike/reset-password-session-purge.probe.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | AUTH-02/AUTH-06/AUX-05 | — | `ALLOWED_SCOPES` constant is the single source of truth for scope literals (DTO + use-case references must import it) | unit | `bun test tests/unit/auth/scope-constant.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | AUX-02/AUX-05 | — | `UnauthorizedError` httpStatus===401 (code UNAUTHENTICATED); `ForbiddenError` httpStatus===403 (codes INSUFFICIENT_SCOPE / SCOPE_NOT_SUBSET / USER_ID_MISMATCH) | unit | `bun test tests/unit/auth/errors.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 2 | AUX-05 (Pitfall #1) | T-03-GUARD | `getApiKeyService(null)` throws `AuthContextMissingError` with 4-section teaching message ("Reason", "See", "Fix", example) | unit | `bun test tests/unit/auth/runtime-guard.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 3 | AUTH-12..14 (key hash) | T-03-KEYHASH | API Key stored as prefix (text, indexed) + hash (text, unique); raw key substring never present in DB | integration | `bun test tests/integration/auth/key-hash-storage.regression.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 3 | AUX-04 / D-10 | T-03-TIMING | Malformed-path latency vs valid-hash-wrong-path latency: `\|t_mal - t_val\| / t_val < 0.2` over 1000 samples | integration | `bun test tests/integration/auth/timing-safe-apikey.regression.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-03 | 03 | 3 | AUTH-09 (password hash) | — | BetterAuth email-password produces non-plaintext password hash; `password === plaintext` never persisted | integration | `bun test tests/integration/auth/password-hash-storage.regression.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-04 | 03 | 3 | AUTH-04/05 (email verification) | — | Registering user triggers `ConsoleEmailAdapter` emission with `📧 CLICK THIS:` marker; verify link applies | unit + integration | `bun test tests/integration/auth/email-verification.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-05 | 03 | 3 | AUTH-06/AUTH-07 (password reset) | — | Password reset success path; verify user can log in with new password | integration | `bun test tests/integration/auth/password-reset-happy.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-06 | 03 | 3 | AUTH-11 (session fixation) | T-03-FIXATION-PROD | After `POST /reset-password`, all other sessions for the userId are invalidated; current session OK | integration | `bun test tests/integration/auth/session-fixation.regression.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-07 | 03 | 3 | AUTH-13/15/16 (API key CRUD) | — | POST creates (returns raw key one-time); GET lists masked metadata; DELETE soft-deletes (revokedAt set); list/get no longer include it | integration | `bun test tests/integration/auth/api-key-crud.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-08 | 03 | 3 | AUTH-15 / CVE-2025-61928 | T-03-CVE | Unauth POST /api-keys with body.userId returns 401; zero keys created in DB for victim | integration | `bun test tests/integration/auth/cve-2025-61928.regression.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 4 | AUX-05 (macro topology) | T-03-MACRO | `authContextPlugin` mounts at single root; `requireAuth: true` route has `ctx.authContext` with branded userId; non-requireAuth route has undefined | integration | `bun test tests/integration/auth/macro-scope-global.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-02 | 04 | 4 | AUX-06 (resolver skip) | T-03-NO-PLUGIN | Boot app without `createAuthModule`; `requireAuth: true` route returns 401 via Runtime Guard (not 500) | integration | `bun test tests/integration/auth/no-plugin-401.regression.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-03 | 04 | 4 | AUX-07 / D-09/D-11 (precedence) | T-03-PRECEDENCE | Valid API Key + valid cookie → AuthContext.identityKind=agent, apiKeyId set, no sessionId; invalid API Key + valid cookie → hard 401 | integration | `bun test tests/integration/auth/resolver-precedence.regression.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-04 | 04 | 4 | AUX-02 / D-12 (401 body) | — | All 401 scenarios return identical body `{ error: { code: 'UNAUTHENTICATED', message, requestId } }` (malformed, invalid hash, revoked, expired, no-auth, invalid-session, expired-session) | integration | `bun test tests/integration/auth/401-body-shape.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-05 | 04 | 4 | AUTH-01/02 (register + login happy) | — | Human can register → verify → login → logout via REST; session cookie flow correct end-to-end | integration | `bun test tests/integration/auth/human-happy-path.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-06 | 04 | 4 | AUX-03 (/me endpoint) | — | `/me` returns `{ userId, identityKind, scopes, apiKeyId?, sessionId? }`; no scope check, both identities allowed | integration | `bun test tests/integration/auth/me-endpoint.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/auth/scope-constant.test.ts` — asserts `ALLOWED_SCOPES` is `['*', 'read:*'] as const` and DTO schema derives from it
- [ ] `tests/unit/auth/errors.test.ts` — stubs for `UnauthorizedError` / `ForbiddenError` / `AuthContextMissingError` httpStatus + code asserts
- [ ] `tests/unit/auth/runtime-guard.test.ts` — `getApiKeyService(ctx)` factory null-check + teaching message shape
- [ ] `tests/integration/auth/cve-2025-61928.regression.test.ts` — attack pattern skeleton (using `createApp(testConfig, { probe })` from P2 pattern)
- [ ] `tests/integration/auth/no-plugin-401.regression.test.ts` — boot without createAuthModule skeleton
- [ ] `tests/integration/auth/resolver-precedence.regression.test.ts` — API Key + cookie test skeleton
- [ ] `tests/integration/auth/timing-safe-apikey.regression.test.ts` — sampling harness using `performance.now()` and 1000 iterations
- [ ] `tests/integration/auth/session-fixation.regression.test.ts` — multi-session create + reset-password skeleton
- [ ] `tests/integration/auth/key-hash-storage.regression.test.ts` — raw key substring scan skeleton
- [ ] `tests/spike/reset-password-session-purge.probe.test.ts` — Plan 03-01 spike (D-17) probe for BetterAuth 1.6.5 behavior
- [ ] Shared test harness extension: `tests/support/auth-helpers.ts` — helpers `createTestUser(db, email)`, `createTestApiKey(db, userId, scopes)`, `seedApp(probe?)`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ConsoleEmailAdapter visual format | AUTH-04 | Stdout rendering is a UX concern (ANSI / formatting) — automatable but low-value vs integration verifying the message dispatch occurred | Run `bun run dev`, register new user, confirm terminal prints `📧 CLICK THIS: http://...` block with clear marker |
| BetterAuth CLI schema-gen on a fresh checkout | AUX-01 | Pitfall #5446 regression only reproduces on fresh install; `bunx @better-auth/cli generate` behavior verifies Plan 03-01 spike outcome | `git clean -fd src/auth/infrastructure/schema/ && bunx @better-auth/cli generate --config src/auth/infrastructure/better-auth/auth-instance.ts --output src/auth/infrastructure/schema/`; confirm 5 files emitted, no errors |
| Rate limit log.warn visibility | D-16 | pino output format / ergonomic — automated check asserts shape but human scan catches `level: 40 event: rate_limit_hit` appearance | Send 101 requests in 60s window, confirm stdout has `{ level: 40, event: 'rate_limit_hit', ip, path, msg: 'Rate limit reached' }` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (test files don't exist yet — all marked ❌ W0)
- [ ] No watch-mode flags (all `bun test` invocations are single-shot)
- [ ] Feedback latency < 60s (full suite estimate ~40s)
- [ ] `nyquist_compliant: true` set in frontmatter after Plan 03-01 spike closes (reset-password probe outcome determines whether AUTH-11 integration test is additive or replacement)

**Approval:** pending
