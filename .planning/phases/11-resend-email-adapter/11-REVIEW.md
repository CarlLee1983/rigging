---
phase: 11-resend-email-adapter
reviewed: 2026-04-21T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/auth/infrastructure/email/resend-email.adapter.ts
  - src/bootstrap/config.ts
  - src/auth/auth.module.ts
  - package.json
  - tests/unit/bootstrap/config.test.ts
  - tests/unit/auth/infrastructure/resend-email.adapter.test.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-04-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

This phase introduces the Resend email adapter, wires it into the auth module behind optional environment variables, and extends `config.ts` with two new optional fields. The core implementation is clean and well-structured: the adapter correctly implements `IEmailPort`, error handling follows the project pattern (log then rethrow), and the partial-config guard in `auth.module.ts` is a good defensive touch.

Three warnings were found — none are crashes, but each represents a correctness gap worth fixing before production. Four info items cover code style, test completeness, and the missing `.env.example` file.

## Warnings

### WR-01: `RESEND_API_KEY` accepts any string — empty string bypasses guard

**File:** `src/bootstrap/config.ts:35`
**Issue:** `RESEND_API_KEY` is declared as `Type.Optional(Type.String())` with no `minLength` constraint. An empty string (`RESEND_API_KEY=`) passes schema validation and also passes `Boolean(deps.config.RESEND_API_KEY)` in `auth.module.ts` as `false`, silently falling back to `ConsoleEmailAdapter` even when the operator intended to enable Resend. In production this is a silent misconfiguration with no warning emitted.
**Fix:**
```typescript
// src/bootstrap/config.ts
RESEND_API_KEY: Type.Optional(Type.String({ minLength: 1 })),
RESEND_FROM_ADDRESS: Type.Optional(Type.String({ format: 'email', minLength: 1 })),
```
This makes the intent explicit and prevents empty-string configs from slipping through unnoticed.

---

### WR-02: Email body is plain text — verification/reset URLs are delivered as raw text with no fallback or HTML

**File:** `src/auth/auth.module.ts:56-69`
**Issue:** Both `sendVerificationEmail` and `sendResetPassword` pass `url` directly as `body`, which maps to the Resend `text` field. `ResendEmailAdapter.send()` only populates the `text` property, never `html`. Many email clients display plain-text URLs as unclickable, and some spam filters flag messages that contain only a bare URL as the entire body. There is no HTML alternative.

This is a correctness issue at the product level: a verification email whose link cannot be clicked will cause user-facing failures without any error surfacing to the application.
**Fix:**
```typescript
// src/auth/auth.module.ts — sendVerificationEmail callback
await emailPort.send({
  to: email,
  subject: 'Verify your email',
  body: `Please verify your email by clicking the link below:\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
})
```
Or, extend `IEmailPort` and `ResendEmailAdapter` to accept an optional `html` field and pass both `text` and `html` to Resend. At minimum, the plain-text body should contain more than just the raw URL so it is deliverable.

---

### WR-03: Unhandled network-level exceptions are not wrapped — raw Resend SDK errors propagate

**File:** `src/auth/infrastructure/email/resend-email.adapter.ts:17`
**Issue:** The `await this.client.emails.send(...)` call is not wrapped in a `try/catch`. The adapter only handles the `{ data, error }` result pattern from the Resend SDK. However, if the SDK itself throws (network timeout, DNS failure, unexpected SDK version behavior, etc.), the exception propagates as an unhandled rejection with the raw Resend error type rather than the normalized `Error` the callers expect. This breaks the adapter's encapsulation contract.
**Fix:**
```typescript
async send(params: { to: string; subject: string; body: string }): Promise<void> {
  let data: { id?: string } | null = null
  let error: { message: string } | null = null

  try {
    const result = await this.client.emails.send({
      from: this.from,
      to: params.to,
      subject: params.subject,
      text: params.body,
    })
    data = result.data
    error = result.error
  } catch (thrown) {
    const message = thrown instanceof Error ? thrown.message : String(thrown)
    this.logger.error({ to: params.to, subject: params.subject, error: thrown }, 'ResendEmailAdapter: send threw')
    throw new Error(`Failed to send email via Resend: ${message}`)
  }

  if (error) {
    this.logger.error({ to: params.to, subject: params.subject, error }, 'ResendEmailAdapter: send failed')
    throw new Error(`Failed to send email via Resend: ${error.message}`)
  }

  this.logger.info({ to: params.to, subject: params.subject, id: data?.id }, 'ResendEmailAdapter: email sent')
}
```

---

## Info

### IN-01: `RESEND_API_KEY` format not validated — any arbitrary string is accepted

**File:** `src/bootstrap/config.ts:35`
**Issue:** Resend API keys always start with `re_`. Accepting arbitrary strings means typos (e.g., pasting the wrong value) fail silently at send time rather than at startup. A pattern constraint would catch misconfiguration immediately.
**Fix:**
```typescript
RESEND_API_KEY: Type.Optional(Type.String({ pattern: '^re_', minLength: 10 })),
```

---

### IN-02: Test suite does not cover the network-throw path

**File:** `tests/unit/auth/infrastructure/resend-email.adapter.test.ts`
**Issue:** Three test cases exist: success, argument forwarding, and SDK-returning-error. There is no test for the case where `this.client.emails.send` itself throws (network failure, SDK throws synchronously). Once WR-03 is fixed this path should be covered.
**Fix:** Add a fourth test:
```typescript
test('throws Error when Resend SDK itself throws', async () => {
  mockEmailsSend.mockImplementation(async () => {
    throw new Error('Network timeout')
  })

  const { logger } = makeLogger()
  const adapter = new ResendEmailAdapter(API_KEY, FROM, logger)

  await expect(
    adapter.send({ to: 'alice@example.com', subject: 'Test', body: 'body' }),
  ).rejects.toThrow('Failed to send email via Resend')
})
```

---

### IN-03: `auth.module.ts` partial-config guard is not tested

**File:** `src/auth/auth.module.ts:37-45`
**Issue:** The guard that throws when exactly one of `RESEND_API_KEY` / `RESEND_FROM_ADDRESS` is set has no unit test. It is a meaningful correctness guard and should be verified to prevent regression.
**Fix:** Add tests in a `createAuthModule` unit test file:
```typescript
test('throws when only RESEND_API_KEY is set', () => {
  expect(() =>
    createAuthModule({ ...baseDeps, config: { ...baseConfig, RESEND_API_KEY: 're_test', RESEND_FROM_ADDRESS: undefined } })
  ).toThrow(/RESEND_FROM_ADDRESS/)
})

test('throws when only RESEND_FROM_ADDRESS is set', () => {
  expect(() =>
    createAuthModule({ ...baseDeps, config: { ...baseConfig, RESEND_API_KEY: undefined, RESEND_FROM_ADDRESS: 'from@example.com' } })
  ).toThrow(/RESEND_API_KEY/)
})
```

---

### IN-04: `.env.example` file was listed in scope but could not be read

**File:** `.env.example`
**Issue:** The file was listed in the review scope but could not be accessed (the file may not be committed or may be excluded by permissions). The contract-drift test in `config.test.ts` (`'Config contract drift guard'`) reads `.env.example` at test time using `readFileSync('.env.example', 'utf8')` with a relative path, which means the test will fail if run from a directory other than the project root. Verify the file exists and is committed.
**Fix:** Ensure `.env.example` is tracked in git and contains entries for `RESEND_API_KEY` and `RESEND_FROM_ADDRESS`. The existing drift-guard test will then enforce parity automatically.

---

_Reviewed: 2026-04-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
