# 03-02 Wave 2 Summary

Wave 2 delivered the auth domain model and application ports.

## What Changed

**Domain:**
- `auth-context.ts` — `AuthContext` value object with `userId`, `identityKind`, `scopes`, optional `sessionId`/`apiKeyId`. `ALLOWED_SCOPES` constant for D-05 DTO derivation.
- `identity-kind.ts` — `IdentityKind` enum: `human` | `agent`.
- `errors.ts` — `UnauthenticatedError` (401), `ForbiddenError` (403), `AuthContextMissingError` (500 runtime guard).
- `domain/index.ts` — exports `getApiKeyService(ctx)` Runtime Guard: throws `AuthContextMissingError` with 4-section teaching message if `ctx` is missing or undefined.
- `domain/internal/api-key-service.ts` — internal domain service for API key operations (accessed only through Runtime Guard).
- `domain/internal/authcontext-missing-error.ts` — `AuthContextMissingError` with `code: 'AUTH_CONTEXT_MISSING'` and diagnostic message referencing ADR 0006.
- `domain/values/email.ts` — branded `Email` value object.
- `domain/values/api-key-hash.ts` — SHA-256 hash wrapper value object.

**Application Ports:**
- `IIdentityService` — `verifySession(headers)`, `verifyApiKey(rawKey)`, `createApiKey(...)`, `listApiKeys(userId)`, `revokeApiKey(userId, id)`.
- `IUserRepository` — `findByEmail(email)`.
- `IApiKeyRepository` — `findByPrefix(prefix)`, `create(...)`, `listByUserId(userId)`, `softDelete(userId, id)`.
- `IEmailPort` — `send({ to, subject, body })`.

**Shared:**
- `src/shared/application/ports/clock.port.ts` — `IClock` interface for time injection.

## Unit Tests

- `auth-context.test.ts` — AuthContext shape and ALLOWED_SCOPES
- `errors.test.ts` — error codes, HTTP statuses, message shape
- `runtime-guard.test.ts` — `getApiKeyService(undefined)` throws `AuthContextMissingError` with correct message
- `domain/values/email.test.ts` — Email validation
- `domain/values/api-key-hash.test.ts` — SHA-256 hash derivation

## Verification

- `bun run lint` — green
- `bun run typecheck` — green
- `bun test tests/unit/auth/domain/` — all green
