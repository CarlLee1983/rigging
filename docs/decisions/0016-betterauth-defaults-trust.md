---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/phases/03-auth-foundation/03-CONTEXT.md D-18, .planning/phases/03-auth-foundation/03-01-SUMMARY.md, .planning/research/PITFALLS.md
informed: future AI Agents and future maintainers
---

# 0016. Trust BetterAuth session cookie defaults + AUTH-11 session-fixation resolution

## Context and Problem Statement

BetterAuth 1.6.5 ships strong session cookie defaults: HttpOnly + Secure (in production NODE_ENV) + SameSite=Lax. Two risks arise if Rigging overrides these explicitly:

1. **Override drift**: Rigging's explicit override becomes the ceiling. If BetterAuth improves defaults in a future release (e.g. adds Partitioned / CHIPS attribute), Rigging must manually update its override — creating an audit-invisible staleness path.
2. **Agent misconfiguration**: an Agent debugging a cookie issue could "try relaxing SameSite" without understanding the CSRF implications.

Separately, Pitfall #6 and AUTH-11 required resolving: does BetterAuth 1.6.5's `POST /reset-password` token flow auto-revoke other sessions for the same userId? Context7 research confirmed the `revokeOtherSessions` option is exposed ONLY on `/change-password`, NOT `/reset-password`. Plan 03-01 ran a live spike probe (`tests/spike/reset-password-session-purge.probe.test.ts`) to measure the actual runtime behavior.

## Decision Drivers

- D-18: pin "trust BetterAuth session cookie defaults" as Tier 2 decision — future override requires new ADR supersede.
- AUTH-11: session-fixation attack vector requires all-other-session revocation on password reset. Rigging must either rely on BetterAuth or wrap the reset call.
- `tests/integration/auth/session-fixation.regression.test.ts` (Plan 03-04): reads `.planning/phases/03-auth-foundation/03-01-spike-result.json` and asserts the post-reset stale session returns 401 — regardless of whether BetterAuth or Rigging performs the purge.

## Considered Options

- **Option A — Trust BetterAuth defaults + pin via ADR; AUTH-11 resolved per spike outcome**
- Option B — Override all cookie attributes explicitly in `auth-instance.ts`
- Option C — No cookie-attribute decision; rely on whatever BetterAuth ships

## Decision Outcome

Chosen option: **A — Trust BetterAuth 1.6.5 defaults; pin via ADR; AUTH-11 wrapped per spike result.**

**Cookie attributes**: BetterAuth 1.6.5 ships HttpOnly + Secure[prod] + SameSite=Lax. These defaults are trusted as-is. Any future override requires a new superseding ADR (Tier 2).

**AUTH-11 resolution — Scenario B**:

Plan 03-01 spike (`03-01-spike-result.json`) recorded:
- `scenario: "B"` — BetterAuth 1.6.5 does **NOT** auto-purge sessions on `resetPassword` token flow.
- `sessionsAfterReset: 2` — all sessions persist after the password reset completes.
- `wrap_required: true`

Therefore `ResetPasswordUseCase.execute` calls `auth.api.resetPassword(...)` then immediately calls `auth.api.revokeSessions(...)` to purge other sessions for the userId. AUTH-11 is satisfied by Rigging's wrap, not by BetterAuth's built-in behavior.

`tests/integration/auth/session-fixation.regression.test.ts` verifies: create 2 sessions → reset password → the non-current session's `/me` returns 401. This test branches on `wrap_required` from `03-01-spike-result.json` — if BetterAuth ever changes behavior and ships Scenario A in a future version, the test catches the mismatch.

### Consequences

Good
- No manual cookie-attribute maintenance; BetterAuth improvements propagate automatically.
- AUTH-11 resolution documented in exactly one place: this ADR + the spike JSON + the integration test.
- ADR supersede requirement (Tier 2) prevents silent cookie attribute regression.
- Regression test `session-fixation.regression.test.ts` re-checks AUTH-11 on every CI run.

Bad
- Trust boundary shifts to BetterAuth for cookie security. If BetterAuth 1.6.5 defaults are ever found to be insufficient (unlikely given project's track record), Rigging inherits the gap until a new ADR is merged.
- Future BetterAuth upgrade to 2.x must re-verify cookie defaults before trusting; AGENTS.md should prompt this check at upgrade time.

## Pros and Cons of the Options

### Option A (chosen) — Trust defaults + ADR pin
- Good: minimal maintenance; portable across BetterAuth versions; Tier 2 audit trail.
- Bad: one layer of indirection for forensics; trust depends on BetterAuth staying well-maintained.

### Option B — Explicit override
- Good: all attributes visible in Rigging's codebase.
- Bad: stale override when BetterAuth improves; Agent-drift risk (relaxing SameSite during debugging); maintenance burden.

### Option C — No decision
- Good: nothing to document.
- Bad: Tier 2 rigidity not established; agent-driven attribute change has no ADR barrier; AUTH-11 resolution undocumented.

## References

- `.planning/phases/03-auth-foundation/03-CONTEXT.md` D-18
- `.planning/research/PITFALLS.md` #6 (session fixation on reset-password token flow)
- `.planning/phases/03-auth-foundation/03-01-SUMMARY.md` (AUTH-11 spike scenario B outcome)
- ADR 0009 (Rigidity Map — Tier 2 supersede requirement)
- OWASP Session Fixation https://owasp.org/www-community/attacks/Session_fixation
- BetterAuth session management docs https://better-auth.com/docs/concepts/session-management
