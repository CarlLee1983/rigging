---
phase: 11-resend-email-adapter
verified: 2026-04-21T00:00:00Z
status: human_needed
score: 3/5 must-haves verified (SCs 3-4 require human testing; SC TS typecheck error is a warning)
re_verification: false
human_verification:
  - test: "Email verification delivers to a real inbox"
    expected: "POST /api/auth/sign-up with RESEND_API_KEY and RESEND_FROM_ADDRESS set causes a Verify your email message to arrive at the recipient's inbox, visible via Resend dashboard or inbox"
    why_human: "Real network delivery cannot be verified programmatically without a live Resend API key and outbound SMTP access"
  - test: "Password reset delivers to a real inbox"
    expected: "POST /api/auth/forget-password with RESEND_API_KEY and RESEND_FROM_ADDRESS set causes a Reset your password message to arrive at the recipient's inbox, visible via Resend dashboard or inbox"
    why_human: "Real network delivery cannot be verified programmatically without a live Resend API key and outbound SMTP access"
---

# Phase 11: Resend Email Adapter Verification Report

**Phase Goal:** A developer deploying to production can configure real email delivery by setting two environment variables, and email verification and password reset flows immediately deliver to real inboxes
**Verified:** 2026-04-21
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Setting RESEND_API_KEY + RESEND_FROM_ADDRESS causes ResendEmailAdapter to be used at startup | VERIFIED | `auth.module.ts:47-50` — ternary selects ResendEmailAdapter when both vars are truthy; `auth.module.ts:26` — Pick type includes both keys |
| 2 | Leaving either env var unset falls back to ConsoleEmailAdapter (no crash) | VERIFIED | `auth.module.ts:49-50` — ternary else branch uses `new ConsoleEmailAdapter(deps.logger)`; both RESEND_* fields are Type.Optional in ConfigSchema so undefined is valid |
| 3 | Setting only one of the two vars produces a clear startup error (fail-fast guard) | VERIFIED | `auth.module.ts:37-45` — `hasApiKey !== hasFromAddress` guard throws Error naming the missing var with a clear message |
| 4 | ConfigSchema validates RESEND_API_KEY as optional string and RESEND_FROM_ADDRESS as optional email-format string | VERIFIED | `config.ts:35-36` — `Type.Optional(Type.String())` and `Type.Optional(Type.String({ format: 'email' }))`; FormatRegistry.Set('email', ...) present at line 13-15 |
| 5 | ResendEmailAdapter builds Resend client in constructor, sends plain-text email with params.body | VERIFIED | `resend-email.adapter.ts:13` — `this.client = new Resend(apiKey)`; line 17-22 — `this.client.emails.send({ text: params.body, ... })` |
| 6 | Email verification flow is wired to emailPort.send | VERIFIED | `auth.module.ts:56-62` — `sendVerificationEmail` callback calls `await emailPort.send(...)` |
| 7 | Password reset flow is wired to emailPort.send | VERIFIED | `auth.module.ts:63-68` — `sendResetPassword` callback calls `await emailPort.send(...)` |
| 8 | Real email delivery arrives at inbox for sign-up (SC-3) | HUMAN NEEDED | Cannot verify without live Resend key and real network access |
| 9 | Real email delivery arrives at inbox for password reset (SC-4) | HUMAN NEEDED | Cannot verify without live Resend key and real network access |
| 10 | Existing test suite passes without a real Resend API key | VERIFIED | `bun test tests/unit/` — 334 pass, 0 fail across 88 files |

**Score:** 8/10 truths verified (2 require human testing)

### Roadmap Success Criteria

| SC | Description | Status | Evidence |
|----|-------------|--------|----------|
| SC-1 | Setting RESEND_API_KEY and RESEND_FROM_ADDRESS causes ResendEmailAdapter at startup — no code change required | VERIFIED | Conditional wiring in auth.module.ts lines 34-50; config schema extension in config.ts lines 35-36 |
| SC-2 | Developer who leaves either variable unset receives a clear startup error | VERIFIED | Fail-fast guard at auth.module.ts lines 37-45 with descriptive error message naming both the present and missing var |
| SC-3 | Email verification results in a real email at recipient inbox | HUMAN NEEDED | Requires live credentials and inbox access |
| SC-4 | Password reset results in a real reset-link email at recipient inbox | HUMAN NEEDED | Requires live credentials and inbox access |
| SC-5 | Existing test suite passes without a real Resend API key | VERIFIED | 334 pass, 0 fail — ConsoleEmailAdapter is the default when RESEND_* vars absent |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/auth/infrastructure/email/resend-email.adapter.ts` | ResendEmailAdapter implementing IEmailPort | VERIFIED | Exists, 31 lines, exports ResendEmailAdapter; implements send() with Resend SDK call, error handling, and logging |
| `src/bootstrap/config.ts` | Extended ConfigSchema with RESEND_API_KEY and RESEND_FROM_ADDRESS | VERIFIED | Both fields present at lines 35-36; FormatRegistry email validator at lines 13-15 |
| `src/auth/auth.module.ts` | Conditional adapter selection + fail-fast guard | VERIFIED | ResendEmailAdapter imported at line 16; Pick type extended at line 26; guard at lines 37-45; ternary selection at lines 47-50 |
| `.env.example` | RESEND_API_KEY and RESEND_FROM_ADDRESS entries | VERIFIED | Config drift guard test (`config.test.ts:129-162`) reads .env.example and verifies both keys present — test passes (21 pass, 0 fail) |
| `tests/unit/auth/infrastructure/resend-email.adapter.test.ts` | Unit tests for ResendEmailAdapter | VERIFIED | Exists, 102 lines, 3 test cases (happy path, arg shape, error path) — all 3 pass |
| `tests/unit/bootstrap/config.test.ts` | Updated drift guard + optional field tests | VERIFIED | schemaKeys Set includes RESEND_API_KEY and RESEND_FROM_ADDRESS (lines 148-149); 'loadConfig optional Resend fields' block with 3 tests (lines 104-126) |
| `package.json` | resend@6.12.2 exact pin | VERIFIED | `"resend": "6.12.2"` present (no caret) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/auth/auth.module.ts` | `src/auth/infrastructure/email/resend-email.adapter.ts` | import + conditional instantiation | WIRED | Line 16: `import { ResendEmailAdapter }...`; lines 47-50: ternary instantiation |
| `src/bootstrap/config.ts` | `src/auth/auth.module.ts` | AuthModuleDeps.config Pick extended with RESEND_* keys | WIRED | Line 26: `Pick<Config, '...' \| 'RESEND_API_KEY' \| 'RESEND_FROM_ADDRESS'>` |
| `tests/unit/auth/infrastructure/resend-email.adapter.test.ts` | `src/auth/infrastructure/email/resend-email.adapter.ts` | import + mock.module('resend') | WIRED | Lines 8-16: mock.module replaces resend package; dynamic import of ResendEmailAdapter |
| `tests/unit/bootstrap/config.test.ts` | `src/bootstrap/config.ts` | loadConfig() + schemaKeys Set | WIRED | Line 3: imports loadConfig; lines 143-152: schemaKeys includes RESEND_* keys |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `src/auth/auth.module.ts` emailPort | emailPort | ResendEmailAdapter (when RESEND_* set) or ConsoleEmailAdapter (default) | Yes — adapter receives apiKey from Config, calls Resend SDK | FLOWING |
| `src/auth/auth.module.ts` sendVerificationEmail | url, email from BetterAuth | BetterAuth internal; URL generated by framework | Yes — wired as callback to createAuthInstance | FLOWING |
| `src/auth/auth.module.ts` sendResetPassword | url, email from BetterAuth | BetterAuth internal; URL generated by framework | Yes — wired as callback to createAuthInstance | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| ResendEmailAdapter unit tests (3 cases) | `bun test tests/unit/auth/infrastructure/resend-email.adapter.test.ts` | 3 pass, 0 fail | PASS |
| Config optional Resend fields (3 cases) | `bun test tests/unit/bootstrap/config.test.ts` | 21 pass, 0 fail | PASS |
| Full unit test suite (no regressions) | `bun test tests/unit/` | 334 pass, 0 fail, 88 files | PASS |
| TypeScript typecheck | `bun run typecheck` | 1 new error (TS2322 in test file line 84) + 3 pre-existing TS7016 errors | WARN |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PROD-01 | 11-01-PLAN.md, 11-02-PLAN.md | Developer can configure Resend API key and sender address via environment variables so that email verification and password reset emails are delivered to real inboxes | PARTIAL — SCs 1-2, 5 satisfied; SCs 3-4 need human verification | ResendEmailAdapter implemented and wired; real delivery unverifiable programmatically |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/unit/auth/infrastructure/resend-email.adapter.test.ts` | 84 | `mockImplementation` return type `{ data: null; error: {...} }` incompatible with mock's declared return type `{ data: { id: string }; error: null }` — TypeScript TS2322 | Warning | Test still runs and passes at runtime; TypeScript strict checking flags the type mismatch. This is a test-file-only issue with no runtime impact. Does not affect adapter behavior. |

No blocker anti-patterns found. No placeholder implementations. No `TODO`/`FIXME` comments in production code. No empty return stubs.

### Human Verification Required

#### 1. Email Verification Delivers to Real Inbox (SC-3)

**Test:** With `RESEND_API_KEY` set to a valid Resend API key and `RESEND_FROM_ADDRESS` set to a verified sender domain, POST to `POST /api/auth/sign-up` with a real recipient email address.

**Expected:** A "Verify your email" message arrives in the recipient's inbox with a verification link URL in the plain-text body. The Resend dashboard (resend.com/emails) shows the message as "Delivered".

**Why human:** Real email delivery requires a live Resend API key with a verified domain, outbound HTTPS to api.resend.com, and an actual inbox to check. Cannot be verified programmatically in this environment.

#### 2. Password Reset Delivers to Real Inbox (SC-4)

**Test:** With the same RESEND_* vars set, POST to `POST /api/auth/forget-password` with a registered user's email address.

**Expected:** A "Reset your password" message arrives in the recipient's inbox with a password reset link URL in the plain-text body. The Resend dashboard shows the message as "Delivered".

**Why human:** Same constraints as SC-3 — requires live credentials and inbox access.

### Gaps Summary

No blocking gaps. The automated implementation is complete and correct:

- ResendEmailAdapter exists, is substantive, is wired into createAuthModule, and the data flows from Config through to BetterAuth's email callbacks.
- The fail-fast guard correctly handles partial configuration.
- ConsoleEmailAdapter fallback is correctly preserved when RESEND_* vars are absent.
- Unit tests cover all three behavioral paths (happy, arg shape, error) without real network calls.
- The config drift guard is updated and passing.

The `status: human_needed` reflects that roadmap SCs 3 and 4 (real inbox delivery) require a live environment test with actual Resend credentials. This is expected for an email delivery phase — the infrastructure is complete and correct.

**Note on TypeScript warning:** `bun run typecheck` reports one new TS2322 error in the test file at line 84. This is a type-narrowing issue with `mockImplementation` in bun:test — the mock's declared return type is the first call's shape, but the error-path test overrides it with an incompatible shape. The test runs and passes. The pre-existing TS7016 errors on `packages/create-rigging/lib/helpers.js` are unchanged from before this phase.

---

_Verified: 2026-04-21_
_Verifier: Claude (gsd-verifier)_
