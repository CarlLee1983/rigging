# 03-03 Wave Summary

Wave 3 closed the auth domain-to-infrastructure bridge.

## What Changed

- Added `BetterAuthIdentityService` with D-10 timing-aligned API key verification.
- Added Drizzle repositories for users and API keys.
- Added the user and API key mappers needed to translate BetterAuth rows into Rigging ports.
- Added `ConsoleEmailAdapter` with the canonical `📧 CLICK THIS:` teaching output.
- Added the core auth use cases:
  - `RegisterUserUseCase`
  - `VerifyEmailUseCase`
  - `RequestPasswordResetUseCase`
  - `ResetPasswordUseCase`
  - `CreateApiKeyUseCase`
  - `ListApiKeysUseCase`
  - `RevokeApiKeyUseCase`

## Decisions Preserved

- AUTH-15 remains the first statement in `CreateApiKeyUseCase.execute`.
- D-04 subset checking happens before the BetterAuth call.
- D-22 default API key expiry remains 90 days from `clock.now()`.
- AUTH-11 is wrapped in `ResetPasswordUseCase` because the spike result is Scenario B.
- D-10 malformed and wrong-hash paths both perform dummy constant-time work before returning `null`.

## Verification

- `bun test tests/unit/auth/infrastructure/identity-service.adapter.test.ts`
- `bun test tests/unit/auth/application/usecases/create-api-key.usecase.test.ts`
- `bun test tests/unit/auth/application/usecases/register-user.usecase.test.ts`
- `bun test tests/unit/auth/application/usecases/reset-password.usecase.test.ts`
- `bun test tests/unit/auth/infrastructure/console-email.adapter.test.ts`
- `bun run lint`
- `bun run typecheck`

## Notes

- The generated BetterAuth API key schema uses `start`, `prefix`, `key`, `enabled`, and `metadata` rather than a dedicated `revoked_at` column. The repository layer currently treats `enabled = false` as revoked.
- The raw key prefix is fixed to `rig_live_` and the helper test data follows the 52-character total key format used in the plan.

