# 03-01 Wave 1 Summary

Wave 1 closed the schema-generation spike and Drizzle migration.

## What Changed

- Added `src/auth/infrastructure/better-auth/auth-instance.ts` — elysia-free BetterAuth instance factory (D-15 hard constraint: no `elysia`, `@elysiajs/*`, or `pino` import).
- Generated 5 BetterAuth Drizzle schema files via `bunx @better-auth/cli generate`:
  - `user.schema.ts`, `session.schema.ts`, `account.schema.ts`, `verification.schema.ts`, `api-key.schema.ts`
- Hand-patched `api-key.schema.ts` with D-21 prefix index: `index('api_keys_prefix_idx').on(apiKey.prefix)`.
- Generated and applied `drizzle/0001_auth_foundation.sql` — 5 CREATE TABLE statements.
- Added `tests/spike/reset-password-session-purge.probe.test.ts` — AUTH-11 spike probe.
- Added `tests/contract/drizzle-schema.contract.test.ts` — drift-lock contract.
- Added `.planning/phases/03-auth-foundation/03-01-spike-result.json` — W-2 machine-readable spike output.

## Spike Result: AUTH-11 — Scenario B

**BetterAuth 1.6.5 does NOT purge sessions on `resetPassword`.**

```json
{
  "scenario": "B",
  "sessionsAfterReset": 2,
  "wrap_required": true
}
```

- `sessionsAfterReset: 2` — both sessions persist after reset-password token flow.
- `wrap_required: true` — Plan 03-03 `ResetPasswordUseCase` must call `auth.api.revokeSessions` after `auth.api.resetPassword`.
- Plan 03-04 `session-fixation.regression.test.ts` branches on `wrap_required: true` and asserts the Rigging wrap purges other sessions.

## Schema Column Notes

- `apiKey` table uses columns: `id`, `name`, `start` (key prefix), `prefix`, `key` (hashed), `userId`, `enabled`, `expiresAt`, `createdAt`, `updatedAt`, `metadata`.
- The `prefix` column carries the `rig_live_` prefix portion; `key` stores the SHA-256 hash.
- D-21 index on `prefix` applied post-generation.

## Verification

- `bun run lint` — green
- `bun run typecheck` — green
- `bun test tests/contract/drizzle-schema.contract.test.ts` — green
- `grep -c "from 'elysia'" src/auth/infrastructure/better-auth/auth-instance.ts` — 0
- `bunx drizzle-kit check` — no drift (migration applied to dev DB)

## Human Checkpoint

Approved: `approved — scenario B`
