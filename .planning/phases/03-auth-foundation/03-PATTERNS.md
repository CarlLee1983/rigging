# Phase 3: Auth Foundation — Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 36 new / 2 modified (38 total)
**Analogs found:** 32 with strong matches / 38 total (6 files have no precise analog — documented in §No Analog Found)

> Downstream planner: every "Pattern Assignments" entry cites concrete excerpts with file:line ranges.
> Planner **must** reference analog path + excerpt in each plan's action section.
> Divergence notes mark where the new file must depart from the analog.

---

## File Classification

### Modified files (P3 touches existing code)

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `src/bootstrap/app.ts` | bootstrap / composition root | request-response (Elysia app assembly) | itself (patch, +1 `.use(createAuthModule)` line + `AppDeps.authInstance?`) | self-modification |
| `src/bootstrap/config.ts` | bootstrap / config | startup validation (TypeBox decode) | itself — already has `BETTER_AUTH_SECRET` + `BETTER_AUTH_URL` (§Read result line 17-18 confirms) | already-done (P3 may need `.env.example` touch only) |

### New files — Domain layer

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/auth/domain/auth-context.ts` | domain type + const | pure data shape | `src/health/domain/internal/health-status.ts` + `src/shared/kernel/id.ts` | role-match (type + factory), data-flow differs (no factory — it's a struct + const) |
| `src/auth/domain/errors.ts` | domain errors | throws | `src/shared/kernel/errors.ts` | exact (extend `DomainError`) |
| `src/auth/domain/values/email.ts` | value object | pure normalize+validate | `src/health/domain/internal/health-status.ts` `makeHealthStatus` | role-match (freeze + factory) |
| `src/auth/domain/values/api-key-hash.ts` | branded value | compile-time brand | `src/shared/kernel/brand.ts` + `src/shared/kernel/id.ts` | exact (brand + typed constructor) |
| `src/auth/domain/identity-kind.ts` | union literal type | pure type | `src/health/domain/internal/health-status.ts` `DbState` | exact |
| `src/auth/domain/index.ts` | barrel + runtime-guard factory | re-export + factory guard | `src/health/domain/index.ts` | role-match (barrel is identical; RuntimeGuard factory is novel — see §No Analog) |
| `src/auth/domain/internal/api-key-service.ts` | internal domain service | pure ops | `src/health/domain/internal/health-status.ts` | role-match (internal under barrel protection) |
| `src/auth/domain/internal/authcontext-missing-error.ts` | domain error | throws | `src/shared/kernel/errors.ts` | exact |

### New files — Application layer (ports + use cases)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/auth/application/ports/identity-service.port.ts` | port interface | request-response | `src/health/application/ports/db-health-probe.port.ts` | exact (port declaration pattern) |
| `src/auth/application/ports/user-repository.port.ts` | repository port | CRUD | `src/health/application/ports/db-health-probe.port.ts` | role-match (port shape) |
| `src/auth/application/ports/api-key-repository.port.ts` | repository port | CRUD | same as above | role-match |
| `src/auth/application/ports/email.port.ts` | outbound port | fire-and-forget | same as above | role-match |
| `src/auth/application/usecases/register-user.usecase.ts` | use case (class) | request-response (public, no ctx) | `src/health/application/usecases/check-health.usecase.ts` | role-match (class + `execute`); **divergence**: no AuthContext param (pre-auth flow) |
| `src/auth/application/usecases/verify-email.usecase.ts` | use case | request-response (public) | same as above | role-match |
| `src/auth/application/usecases/request-password-reset.usecase.ts` | use case | fire-and-forget (sends email) | same as above | role-match |
| `src/auth/application/usecases/reset-password.usecase.ts` | use case (wrap-point for AUTH-11) | transactional | same as above | role-match + novel (session-purge wrap) |
| `src/auth/application/usecases/create-api-key.usecase.ts` | use case with AuthContext | request-response + runtime guard | `src/health/application/usecases/check-health.usecase.ts` | role-match + **divergence**: `execute(ctx, input)` signature, runtime guards |
| `src/auth/application/usecases/list-api-keys.usecase.ts` | use case with AuthContext | CRUD-read | same as above | role-match |
| `src/auth/application/usecases/revoke-api-key.usecase.ts` | use case with AuthContext | CRUD-update (soft-delete) | same as above | role-match |

### New files — Infrastructure layer

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/auth/infrastructure/better-auth/auth-instance.ts` | third-party instance factory | config | `src/shared/infrastructure/db/client.ts` `createDbClient` | role-match (factory with typed config) + **hard divergence**: NO `elysia` import allowed (D-15) |
| `src/auth/infrastructure/better-auth/identity-service.adapter.ts` | port adapter | request-response + timing-safe | `src/health/infrastructure/drizzle-db-health-probe.ts` | role-match (port adapter with `try/catch` + error-to-null mapping) |
| `src/auth/infrastructure/repositories/drizzle-user.repository.ts` | repository adapter | CRUD via Drizzle | `src/health/infrastructure/drizzle-db-health-probe.ts` | role-match (Drizzle-typed constructor + port implementation) |
| `src/auth/infrastructure/repositories/drizzle-api-key.repository.ts` | repository adapter | CRUD via Drizzle | same as above | role-match |
| `src/auth/infrastructure/mappers/user.mapper.ts` | mapper | row ↔ domain | no analog (first mapper) | **no analog** — template from ARCHITECTURE.md §Pattern (see §No Analog Found) |
| `src/auth/infrastructure/mappers/api-key.mapper.ts` | mapper | row ↔ domain | same as above | **no analog** |
| `src/auth/infrastructure/email/console-email.adapter.ts` | outbound port adapter | fire-and-forget via logger | `src/health/infrastructure/drizzle-db-health-probe.ts` | role-match (port adapter with logger dep) |
| `src/auth/infrastructure/schema/user.schema.ts` | BetterAuth CLI output | data schema | **NO ANALOG** — first schema file in repo | see §No Analog Found |
| `src/auth/infrastructure/schema/session.schema.ts` | BetterAuth CLI output | data schema | same | see §No Analog Found |
| `src/auth/infrastructure/schema/account.schema.ts` | BetterAuth CLI output | data schema | same | see §No Analog Found |
| `src/auth/infrastructure/schema/verification.schema.ts` | BetterAuth CLI output | data schema | same | see §No Analog Found |
| `src/auth/infrastructure/schema/api-key.schema.ts` | BetterAuth CLI output + D-21 index patch | data schema | same | see §No Analog Found |

### New files — Presentation layer

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/auth/presentation/plugins/auth-context.plugin.ts` | Elysia plugin + macro | request-response derive | `src/shared/presentation/plugins/request-logger.plugin.ts` (`.derive({ as: 'global' })`) | role-match (global-scope plugin) + **divergence**: `.macro()` not `.derive()` (new API surface) |
| `src/auth/presentation/plugins/require-auth.macro.ts` | macro definition (if split) | request-response resolve | same as above | role-match — **may merge into auth-context.plugin.ts** per research Pattern 2 |
| `src/auth/presentation/controllers/auth.controller.ts` | controller | request-response (public routes) | `src/health/presentation/controllers/health.controller.ts` | role-match (Elysia factory + use cases deps) |
| `src/auth/presentation/controllers/api-key.controller.ts` | controller with `{ requireAuth: true }` | CRUD | same as above | role-match + **divergence**: macro opt-in marker on every route |
| `src/auth/presentation/controllers/me.controller.ts` | controller (introspection) | request-response | same as above | role-match (GET returns authContext) |
| `src/auth/presentation/dtos/create-api-key.dto.ts` | TypeBox DTO | input validation | `src/bootstrap/config.ts` (`TypeBox Type.Object({...})`) | role-match (schema definition) |
| `src/auth/presentation/dtos/list-api-keys.dto.ts` | TypeBox DTO | query validation | same as above | role-match |

### New files — Module factory

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/auth/auth.module.ts` | module factory | wiring (DI w/o IoC) | `src/health/health.module.ts` | **exact** — this is THE template (health.module.ts L20-25 comment says so) |

### New files — Tests (regression suite)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `tests/integration/auth/cve-2025-61928.regression.test.ts` | integration regression | app.handle | `tests/integration/app-skeleton-smoke.test.ts` | **exact** (`createApp(TEST_CONFIG, deps)` + `app.handle(new Request(...))`) |
| `tests/integration/auth/authcontext-missing.regression.test.ts` | integration regression | app.handle (missing plugin) | same as above | exact + existing stub `tests/integration/auth-bypass-contract.test.ts` L16-18 to be replaced |
| `tests/integration/auth/resolver-precedence.regression.test.ts` | integration regression (AUX-07) | app.handle | same as above | exact |
| `tests/integration/auth/timing.regression.test.ts` | integration regression (AUX-04) | app.handle + perf measurement | same as above | role-match (latency assertion is novel) |
| `tests/integration/auth/session-fixation.regression.test.ts` | integration regression (AUTH-11) | 2-session flow | same as above | exact |
| `tests/integration/auth/api-key-hashed.regression.test.ts` | integration regression (AUTH-13) | app.handle + DB inspect | same as above | exact (DB grep shape is novel) |
| `tests/integration/auth/register.test.ts`, `signin.test.ts`, `signout.test.ts`, `password-hash.test.ts`, `email-verification.test.ts`, `password-reset.test.ts`, `api-key-crud.test.ts`, `macro-scope.test.ts` | integration tests | app.handle | same as above | exact (same shape, different assertions) |
| `tests/integration/auth/_helpers.ts` | test fixtures (fakeDb, realAuth) | shared | **no analog** — first shared helper | §No Analog Found |
| `tests/unit/auth/domain/*.test.ts` | unit tests | pure assertions | `tests/unit/shared/kernel/errors.test.ts` | exact |
| `tests/unit/auth/application/usecases/create-api-key.usecase.test.ts` | unit test (AUTH-15 / AUTH-16 / D-04) | mocked ports + `execute()` | `tests/unit/health/check-health.usecase.test.ts` | exact |
| `tests/unit/auth/infrastructure/identity-service.adapter.test.ts` | unit test (verifyApiKey path) | mocked deps | `tests/unit/health/drizzle-db-health-probe.test.ts` | exact (fakeDb shape + adapter test style) |
| `tests/contract/drizzle-schema.contract.test.ts` | contract test | CLI invocation + diff | `tests/contract/kernel-framework-free.test.ts` | role-match (file-scanning contract test) |

### New files — Migrations + ADRs

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `drizzle/0001_auth_foundation.sql` | migration | DDL | **NO ANALOG** — first migration (drizzle/ dir currently empty) | §No Analog Found |
| `docs/decisions/0013-api-key-storage-hash-plus-index.md` | ADR | docs | `docs/decisions/0011-resolver-precedence-apikey-over-cookie.md` + `0012-global-plugin-ordering.md` | **exact** (MADR 4.0 format) |
| `docs/decisions/0014-api-key-hashing-sha256.md` | ADR | docs | same as above | exact |
| `docs/decisions/0015-rate-limit-memory-v1-persistent-v2.md` | ADR | docs | same as above | exact |
| `docs/decisions/0016-betterauth-defaults-trust.md` | ADR | docs | same as above | exact |
| `docs/decisions/README.md` (patch) | ADR index update | docs | itself | self-modification (append 4 rows) |

---

## Pattern Assignments

### Pattern A — DomainError subclass for auth errors

**Target files:** `src/auth/domain/errors.ts`, `src/auth/domain/internal/authcontext-missing-error.ts`

**Analog:** `src/shared/kernel/errors.ts`

**Core pattern excerpt** (L5-34):
```typescript
// src/shared/kernel/errors.ts
export abstract class DomainError extends Error {
  abstract readonly code: string
  abstract readonly httpStatus: number

  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message)
    this.name = this.constructor.name
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED'
  readonly httpStatus = 401
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN'
  readonly httpStatus = 403
}
```

**Replicate:**
- Extend `DomainError` from `@/shared/kernel/errors`.
- Readonly `code` (string literal) + `httpStatus` (number).
- No mapping table — `errorHandlerPlugin.onError` reads `err.httpStatus` directly (see `src/shared/presentation/plugins/error-handler.plugin.ts` L25-40).

**Diverge:**
- P3 error codes differ per D-06 / D-09 / D-12: `'UNAUTHENTICATED'` (401), `'INSUFFICIENT_SCOPE'` (403), `'SCOPE_NOT_SUBSET'` (403), `'USER_ID_MISMATCH'` (403), `'EMAIL_NOT_VERIFIED'` (403), `'AUTH_CONTEXT_MISSING'` (500 — internal invariant breach).
- Existing kernel already exports `UnauthorizedError` / `ForbiddenError` with generic codes — **P3 must NOT duplicate**. Either (a) re-export from `src/auth/domain/errors.ts` adding auth-specific subclasses for non-generic codes, or (b) instantiate the kernel classes with custom `code`-like messages. Planner: choose (a) because D-06 requires `code: 'INSUFFICIENT_SCOPE'` (not generic `'FORBIDDEN'`).

**Teaching-message pattern for `AuthContextMissingError`** (novel, Pitfall #11 + D-12 four-section format):
```typescript
// src/auth/domain/internal/authcontext-missing-error.ts — construct message body per Pitfall #11
throw new AuthContextMissingError(
  `AuthContext is missing when calling getApiKeyService(ctx).

Reason: Domain services require AuthContext from \`requireAuth: true\` macro.
See docs/decisions/0006-authcontext-boundary.md.

Fix: Declare \`requireAuth: true\` in your route options. Example:
  new Elysia()
    .use(authContextPlugin(identity))
    .get('/api-keys', ({ authContext }) => ..., { requireAuth: true })`
)
```
(4-section format is a Rigging convention — see Pitfall #9 in RESEARCH.md L708-713. Never `new AuthContextMissingError()` nor one-line messages.)

---

### Pattern B — Branded value types + typed constructor

**Target files:** `src/auth/domain/values/api-key-hash.ts`

**Analog:** `src/shared/kernel/brand.ts` + `src/shared/kernel/id.ts`

**Core pattern excerpt** (`brand.ts` L4-20):
```typescript
// src/shared/kernel/brand.ts
declare const __brand: unique symbol

export type Brand<T, K extends string> = T & { readonly [__brand]: K }

/**
 * Callers should define typed constructors per feature:
 *
 *   export type UserId = Brand<string, 'UserId'>
 *   export const UserId = (value: string): UserId => brand<'UserId'>()(value)
 */
export const brand =
  <K extends string>() =>
  <T>(value: T): Brand<T, K> =>
    value as Brand<T, K>
```

**`id.ts` follow-through** (L1-5):
```typescript
import { type Brand, brand } from './brand'

export type UUID<K extends string> = Brand<string, K>

export const newUUID = <K extends string>(): UUID<K> => brand<K>()(crypto.randomUUID())
```

**Replicate for `ApiKeyHash`:**
```typescript
// src/auth/domain/values/api-key-hash.ts — skeleton
import { type Brand, brand } from '@/shared/kernel/brand'

export type ApiKeyHash = Brand<string, 'ApiKeyHash'>
export const ApiKeyHash = (value: string): ApiKeyHash => {
  if (value.length !== 64) throw new Error('ApiKeyHash must be 64 hex chars (sha256)')
  return brand<'ApiKeyHash'>()(value)
}
```

**Diverge:**
- `ApiKeyHash` has a length invariant (sha256 → 64 hex chars) that `UserId` does not. Kernel `UserId` uses `newUUID()` without runtime check; `ApiKeyHash` must validate before brand cast.
- `UserId` already exists in kernel — P3 **must NOT redefine** it. Use `UUID<'UserId'>` via `import { UUID } from '@/shared/kernel'`.

---

### Pattern C — Domain barrel with runtime-guard factory (AUX-05)

**Target file:** `src/auth/domain/index.ts`

**Analog:** `src/health/domain/index.ts`

**Analog excerpt** (L1-6):
```typescript
// src/health/domain/index.ts
// Public domain barrel for the `health` feature.
// Consumers (application, presentation) MUST import from this file, never from domain/internal/.

export type { DbState, HealthStatus } from './internal/health-status'
export { makeHealthStatus } from './internal/health-status'
```

**Replicate:**
- Barrel comment-header: "Public domain barrel for the `auth` feature."
- Re-export types and factory/helper functions from `./internal/` and sibling files.
- Enforcement: `biome.json` L67-74 `noRestrictedImports.patterns: [{ group: ['**/domain/internal/**'], ... }]` already blocks non-barrel imports — no extra work per Tier 1 rule 2.

**Diverge (novel — no existing analog for runtime-guard factory):**
- Add `getApiKeyService(ctx: AuthContext)` per RESEARCH.md Pattern 5 (L588-614) — factory that throws `AuthContextMissingError` if `ctx.userId` is falsy.
- The factory returns an instance of `ApiKeyService` from `./internal/api-key-service.ts`; the class itself is NOT exported, only accessible via factory.

Planner: Runtime-Guard factory is a novel pattern (no analog in repo). Use the RESEARCH.md excerpt directly; cite ADR 0007 in the factory's doc-comment.

---

### Pattern D — Port (interface) declaration

**Target files:** `src/auth/application/ports/*.port.ts` (4 files)

**Analog:** `src/health/application/ports/db-health-probe.port.ts`

**Full analog excerpt** (L1-12):
```typescript
// src/health/application/ports/db-health-probe.port.ts
// Port (interface) — application layer defines what it needs; infrastructure implements.
// Returns 'up' on success, 'down' if the underlying driver reports an error that the adapter chose to handle.
// The port contract ALLOWS a rejection for unexpected errors — the use case propagates it,
// and the controller (Task 3) catches it to produce 503. The Drizzle adapter (Task 2) never rejects
// in practice — it maps all errors to 'down' — but the port stays permissive so future adapters
// may reject without breaking the contract.

export type DbProbeResult = 'up' | 'down'

export interface IDbHealthProbe {
  probe(): Promise<DbProbeResult>
}
```

**Replicate pattern shape:**
1. Top-of-file contract comment explaining rejection semantics.
2. One exported interface per file; method names verbs (`verifySession`, `findByPrefix`, `send`, etc.).
3. Types co-located with the interface if primitive (no cross-file plumbing).
4. Port **prefixed with `I`** (project convention — `IDbHealthProbe` in analog, `IIdentityService` / `IUserRepository` / `IApiKeyRepository` / `IEmailPort` in P3).

**Diverge:** Port method signatures differ. Use RESEARCH.md Pattern 3 (L415-437) `IIdentityService` verbatim — note `scopes: ReadonlyArray<string>` (not mutable array).

---

### Pattern E — Use case class with `execute()` method

**Target files:** `src/auth/application/usecases/*.usecase.ts` (7 files)

**Analog:** `src/health/application/usecases/check-health.usecase.ts`

**Full analog excerpt** (L1-22):
```typescript
// src/health/application/usecases/check-health.usecase.ts
// Use case: compose HealthStatus by asking the DB probe port for current state.
// NOTE: does NOT catch probe rejections — controller owns 503-on-probe-reject (D-03).
//       This keeps the use case thin; errors propagate up the layer.

import { type HealthStatus, makeHealthStatus } from '../../domain'
import type { IDbHealthProbe } from '../ports/db-health-probe.port'

export interface IClock {
  now(): Date
}

export class CheckHealthUseCase {
  constructor(
    private readonly probe: IDbHealthProbe,
    private readonly clock: IClock,
  ) {}

  async execute(): Promise<HealthStatus> {
    const dbState = await this.probe.probe() // may reject — controller catches
    return makeHealthStatus({ db: dbState, checkedAt: this.clock.now() })
  }
}
```

**Replicate:**
- `IClock` interface co-located with the use case that needs it (pattern already in analog L8-10). P3 use cases that need time → reuse `IClock` (see RESEARCH.md Pattern 4 L525 `private readonly clock: IClock`).
- Class + constructor with `private readonly` port deps.
- Single `execute()` method.
- Use cases **propagate** errors up — don't catch, let controller or global error handler decide.

**Diverge for protected use cases** (create/list/revoke API key):
- Signature: `execute(ctx: AuthContext, input: InputDto): Promise<OutputDto>` (non-optional ctx — ARCHITECTURE Anti-Pattern 3 forbids `ctx | null`).
- First line(s) are runtime guards — see Pattern F below.

**Diverge for public use cases** (register-user, verify-email, reset-password):
- No AuthContext param (they're the pre-auth entry points). Signature stays like `CheckHealthUseCase.execute()` — no first arg.

---

### Pattern F — Runtime guards at top of use case body (AUTH-15 + D-04)

**Target file:** `src/auth/application/usecases/create-api-key.usecase.ts`

**Analog for "throw on domain violation" pattern:** `src/shared/kernel/errors.ts` + usage in RESEARCH.md Pattern 4 (L544-583).

**Pattern excerpt (RESEARCH.md L544-583 — verbatim shape planner should implement):**
```typescript
export class CreateApiKeyUseCase {
  constructor(
    private readonly identity: IIdentityService,
    private readonly clock: IClock,
  ) {}

  async execute(ctx: AuthContext, input: CreateApiKeyInput): Promise<CreatedApiKeyDto> {
    // === LINE 1: AUTH-15 + CVE-2025-61928 defense ===
    if (input.userId && input.userId !== ctx.userId) {
      throw new ForbiddenError('USER_ID_MISMATCH', 'Cannot create API Key for another user')
    }

    // === LINE 2: D-04 subset check ===
    if (!input.scopes.every((s) => ctx.scopes.includes(s) || ctx.scopes.includes('*'))) {
      throw new ForbiddenError('SCOPE_NOT_SUBSET', 'Requested key scopes must be subset of your session scopes')
    }

    // === LINE 3: Delegate to BetterAuth via port ===
    const now = this.clock.now()
    const ninetyDays = 90 * 24 * 60 * 60 * 1000
    const expiresAt = input.expiresAt ?? new Date(now.getTime() + ninetyDays)

    const created = await this.identity.createApiKey({
      userId: ctx.userId,               // NOT input.userId — explicit narrowing after guard
      label: input.label.trim(),        // D-25
      scopes: input.scopes,
      expiresAt,
    })

    return {
      id: created.id,
      key: created.rawKey,              // D-20 raw key leaves backend exactly here
      prefix: created.prefix,
      label: input.label.trim(),
      scopes: input.scopes,
      expiresAt,
      createdAt: created.createdAt,
    }
  }
}
```

**Replicate:** Planner copies this shape verbatim into plan 03-03.

**Diverge per use case:**
- `ListApiKeysUseCase` / `RevokeApiKeyUseCase`: same signature shape `execute(ctx, input)`, no `body.userId` guard (read/revoke own keys), but **D-02 scope check** if the operation is a write: e.g. RevokeApiKey write → `if (!ctx.scopes.includes('*') && !ctx.scopes.includes('write:*')) throw ForbiddenError('INSUFFICIENT_SCOPE', ...)`. Per CONTEXT D-02 the scope-check template is fixed.

---

### Pattern G — Feature module factory (DI without IoC)

**Target file:** `src/auth/auth.module.ts`

**Analog:** `src/health/health.module.ts` — **analog file's docstring explicitly names `createAuthModule` as follow-on** (L17).

**Full analog excerpt** (L1-25):
```typescript
import { Elysia } from 'elysia'
import type { DrizzleDb } from '../shared/infrastructure/db/client'
import type { IDbHealthProbe } from './application/ports/db-health-probe.port'
import { CheckHealthUseCase, type IClock } from './application/usecases/check-health.usecase'
import { DrizzleDbHealthProbe } from './infrastructure/drizzle-db-health-probe'
import { healthController } from './presentation/controllers/health.controller'

export interface HealthModuleDeps {
  db: DrizzleDb
  clock?: IClock // defaults to system clock
  probe?: IDbHealthProbe // override for tests
}

/**
 * createHealthModule — feature module factory (DI without IoC).
 *
 *   Wiring: infra(probe) → application(usecase) → presentation(controller) → Elysia plugin.
 *   This is THE template: Phase 3 createAuthModule / Phase 4 createAgentsModule clone this shape.
 */
export function createHealthModule(deps: HealthModuleDeps) {
  const clock: IClock = deps.clock ?? { now: () => new Date() }
  const probe: IDbHealthProbe = deps.probe ?? new DrizzleDbHealthProbe(deps.db)
  const checkHealth = new CheckHealthUseCase(probe, clock)
  return new Elysia({ name: 'rigging/health' }).use(healthController({ checkHealth }))
}
```

**Replicate:**
- `export interface AuthModuleDeps { ... }` + `createAuthModule(deps)` signature.
- Body instantiates infra adapters → use cases → returns `new Elysia({ name: 'rigging/auth' }).use(...controllers...)`.
- All optional deps have defaults (clock, etc.); required deps are mandatory properties (db, logger, config).
- Elysia name tag convention: `'rigging/<feature>'` (analog L24: `'rigging/health'`).

**Diverge (per RESEARCH.md L725-785, Pattern 5 full example):**
- Add optional `authInstance?: AuthInstance` for test override (CONTEXT code_context L227 — `deps.authInstance?` lets tests bypass BetterAuth CLI flake).
- Add `logger: Logger` (for console-email adapter + rate-limit warn hook).
- Include `.mount('/api/auth', auth.handler)` call at module root (D-14).
- Chain `.use(authContextPlugin(identity))` BEFORE feature controllers (single-root macro mount).
- Wire 7 use cases (not 1 like health).

---

### Pattern H — Controller factory (Elysia plugin with routes)

**Target files:** `src/auth/presentation/controllers/{auth,api-key,me}.controller.ts`

**Analog:** `src/health/presentation/controllers/health.controller.ts`

**Full analog excerpt** (L17-38):
```typescript
export function healthController(deps: HealthControllerDeps) {
  return new Elysia({ name: 'rigging/health-controller' }).get(
    '/health',
    async ({ set }) => {
      try {
        const status = await deps.checkHealth.execute()
        set.status = status.ok ? 200 : 503
        return status
      } catch {
        set.status = 503
        return { ok: false, db: 'down' as const, checkedAt: new Date().toISOString() }
      }
    },
    {
      detail: {
        summary: 'Service health + DB connectivity',
        tags: ['health'],
        // Intentionally no `security` — D-15: P2 operational route is public.
      },
    },
  )
}
```

**Replicate:**
- `export function xxxController(deps: XxxControllerDeps)` factory signature.
- `new Elysia({ name: 'rigging/<name>-controller' })` instance naming.
- Pass `deps` containing use case instances.
- Route handler: `async (ctx) => { ... }` — await `deps.useCase.execute(...)`.
- Per-route `detail: { summary, tags, security }` metadata.

**Diverge:**
- **API-key and me controllers** add `requireAuth: true` to route options — new opt-in marker from macro (RESEARCH.md L409-411). Example:
  ```typescript
  .post('/api-keys', async ({ authContext, body }) => {
    return await deps.createApiKey.execute(authContext, body)
  }, {
    requireAuth: true,           // ← opt-in marker, declared by macro
    body: CreateApiKeyBody,
    detail: { security: [{ cookieAuth: [] }, { apiKeyAuth: [] }], tags: ['api-keys'] },
  })
  ```
- Swagger `security` per D-08: `/me` lists both schemes without scope; `/api-keys` same; `/health` explicitly omits (analog L34 comment).
- Do NOT `try/catch` DomainError — let `errorHandlerPlugin.onError({ as: 'global' })` handle it (see Pattern I). Health controller's try/catch at analog L22-28 is a **special case** because probe failures are infra-operational (503), not domain errors. P3 auth controllers let domain errors bubble.

---

### Pattern I — Global Elysia plugin with `scope: global` hooks

**Target file:** `src/auth/presentation/plugins/auth-context.plugin.ts`

**Analog:** `src/shared/presentation/plugins/request-logger.plugin.ts` — shows the `.derive({ as: 'global' })` + `.onAfterResponse({ as: 'global' })` pattern that P3 macro requires.

**Analog excerpt** (L56-89):
```typescript
export function requestLoggerPlugin(logger: Logger) {
  return (
    new Elysia({ name: 'rigging/request-logger' })
      .decorate('log', logger)
      // Elysia 1.4 uses 'as: global' for plugin-scope hook broadcast (replaces 1.3's 'scope: global')
      .derive({ as: 'global' }, ({ request, set }) => {
        const incoming = request.headers.get('x-request-id')
        const requestId = ...
        set.headers['x-request-id'] = requestId
        return { requestId, startedAt: performance.now() }
      })
      .onAfterResponse({ as: 'global' }, (ctx) => { ... })
  )
}
```

**Replicate:**
- Export `authContextPlugin(identity: IIdentityService)` factory.
- `new Elysia({ name: 'rigging/auth-context' })`.
- **Use `as: 'global'`** (Elysia 1.4 syntax per `request-logger.plugin.ts` L61 comment, replaces 1.3's `scope: 'global'`). The macro itself uses `.macro({ requireAuth: { resolve } })` — see RESEARCH.md Pattern 2 (L380-404).
- Return ctx narrowing: `return { authContext: ... satisfies AuthContext }` — allows TS to type-narrow ctx on `requireAuth: true` routes.
- On error path: `return status(401, 'UNAUTHENTICATED')` (do NOT throw — macro resolver must return status directly per RESEARCH.md Pitfall #1 L658-663).

**Diverge:**
- Macro API (`.macro({ requireAuth: { resolve } })`) is **new to the codebase** — no prior Elysia plugin uses `.macro()`. Use RESEARCH.md Pattern 2 excerpt verbatim.
- Do NOT use `.guard()` wrapping — RESEARCH.md L413 warns: `.guard()` doesn't support derive/resolve (Elysia issue #566).

---

### Pattern J — Infrastructure adapter implementing port

**Target files:**
- `src/auth/infrastructure/better-auth/identity-service.adapter.ts`
- `src/auth/infrastructure/repositories/drizzle-user.repository.ts`
- `src/auth/infrastructure/repositories/drizzle-api-key.repository.ts`
- `src/auth/infrastructure/email/console-email.adapter.ts`

**Analog:** `src/health/infrastructure/drizzle-db-health-probe.ts`

**Full analog excerpt** (L1-41):
```typescript
import { sql } from 'drizzle-orm'
import type { DrizzleDb } from '../../shared/infrastructure/db/client'
import type { DbProbeResult, IDbHealthProbe } from '../application/ports/db-health-probe.port'

/**
 * DrizzleDbHealthProbe — implements IDbHealthProbe by issuing `SELECT 1` via Drizzle's `sql`
 * template on the shared postgres-js client.
 *
 * Why route through Drizzle (D-02): same path as Phase 3 repos will use. Healthcheck validates
 * the *real* DB path, not a side-channel postgres-js ping that could silently diverge.
 *
 * Timeout: 2000ms via AbortController (D-02). ...
 */
export class DrizzleDbHealthProbe implements IDbHealthProbe {
  constructor(
    private readonly db: Pick<DrizzleDb, 'execute'>,
    private readonly timeoutMs = 2000,
  ) {}

  async probe(): Promise<DbProbeResult> {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), this.timeoutMs)
    try {
      await Promise.race([...])
      return 'up'
    } catch {
      return 'down'
    } finally {
      clearTimeout(timer)
    }
  }
}
```

**Replicate:**
- Class `implements IXxxPort` (or `IXxxRepository`).
- `constructor(private readonly db: DrizzleDb, ...)` — pass narrowed `Pick<DrizzleDb, 'execute'>` when the adapter only uses one method (compile-time safety / testability).
- `import type { ... } from 'drizzle-orm'` allowed in `infrastructure/` (Biome allows; `domain/` + `application/` forbid it per `biome.json` L32-52).
- Top-of-file docstring explains driver choice + error-mapping contract.

**Diverge for `BetterAuthIdentityService` (identity-service.adapter.ts):**
- Implements two ports-shaped methods (`verifySession` / `verifyApiKey`) returning `AuthContext | null`.
- **Must implement D-10 timing alignment** via pre-computed `DUMMY_HASH = createHash('sha256').update('dummy').digest()` and dummy `timingSafeEqual` + dummy `apiKeys.findByPrefix('xxxxxxxx')` calls — see RESEARCH.md Pattern 3 L473-510 excerpt.
- **Import from `node:crypto`** (not a third-party lib): `import { timingSafeEqual, createHash } from 'node:crypto'`.
- Buffer length check before `timingSafeEqual` (Pitfall #3 — throws on mismatch) — L493-500 of RESEARCH.md excerpt.

**Diverge for Drizzle repositories:**
- Use **mapper** to convert row ↔ domain (see Pattern K).
- Methods return `Promise<Entity | null>` (findBy*) or `Promise<void>` (save/update/delete).
- Use `eq()` / `and()` from `drizzle-orm` for predicates.

**Diverge for `ConsoleEmailAdapter`:**
- `constructor(private readonly logger: Logger)` — `Logger` imported as `import type { Logger } from 'pino'` (allowed in infrastructure per Biome; forbidden in domain/application).
- `async send({ to, subject, body }) { this.logger.info({ to, subject }, `📧 CLICK THIS: ${body}`) }` per CONTEXT discretion §IEmailPort.

---

### Pattern K — Mapper (row ↔ domain)

**Target files:** `src/auth/infrastructure/mappers/user.mapper.ts`, `api-key.mapper.ts`

**Analog:** No existing mapper in `src/`. Closest reference is ARCHITECTURE.md §Mapper pattern, not executable code. `src/health/infrastructure/drizzle-db-health-probe.ts` uses no mapper because its return type (`'up' | 'down'`) is primitive.

**Pattern to establish (novel):**
```typescript
// src/auth/infrastructure/mappers/api-key.mapper.ts
import type { InferSelectModel } from 'drizzle-orm'
import type { apiKeys } from '../schema/api-key.schema'

type ApiKeyRow = InferSelectModel<typeof apiKeys>

export const ApiKeyMapper = {
  toDomain(row: ApiKeyRow): { id: string; userId: UserId; label: string; ... } {
    return {
      id: row.id,
      userId: row.userId as UserId,
      label: row.label,
      prefix: row.prefix,
      scopes: JSON.parse(row.scopes ?? '[]'),    // or derived from metadata per Q2
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt,
    }
  },
  toPersistence(domain: { ... }): ApiKeyRow { ... },
}
```

**Replicate conventions:**
- Object literal (not class) with `toDomain` + `toPersistence` methods (per CONTEXT discretion §Mapper命名).
- `InferSelectModel<typeof schema>` for row typing.
- Domain → branded types cast (`row.userId as UserId`) at the boundary.

---

### Pattern L — Config/Instance factory (BetterAuth auth-instance)

**Target file:** `src/auth/infrastructure/better-auth/auth-instance.ts`

**Analog:** `src/shared/infrastructure/db/client.ts` — closest analog for "factory that wires an external lib from config".

**Full analog excerpt** (L1-23):
```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import type { Config } from '../../../bootstrap/config'

/**
 * Shared Drizzle DB client factory. Used by BOTH:
 *   - /health probe (Phase 2 via IDbHealthProbe adapter)
 *   - Future BetterAuth drizzle-adapter + feature repositories (Phase 3+)
 *
 * Driver choice: postgres-js (NOT bun:sql) per ADR 0010 (pitfall #5 mitigation).
 */
export function createDbClient(config: Pick<Config, 'DATABASE_URL'>) {
  const sql = postgres(config.DATABASE_URL, {
    onnotice: () => {},
  })
  const db = drizzle(sql)
  return { db, sql }
}

export type DbClient = ReturnType<typeof createDbClient>
export type DrizzleDb = DbClient['db']
```

**Replicate:**
- Factory function `createAuthInstance(db, cfg): AuthInstance`.
- `Pick<Config, 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL'>` narrowed config type.
- `export type AuthInstance = ReturnType<typeof createAuthInstance>` — consumer imports this type.
- Docstring explaining driver/adapter choice + ADR pointer.

**Diverge (D-15 HARD CONSTRAINT):**
- **NO `elysia` import** anywhere in this file or its transitive imports. The BetterAuth CLI (`bunx @better-auth/cli generate`) parses this file to emit Drizzle schema; elysia in the import graph breaks schema-gen per Pitfall #5446.
- Config type includes callback fields: `sendVerificationEmail: (params) => Promise<void>` + `sendResetPassword: (...)`. These are passed via `AuthModuleDeps` → `createAuthInstance(...)`, NOT imported from the email adapter directly (keeps `auth-instance.ts` dependency-free of feature code).
- Use RESEARCH.md Pattern 1 (L317-364) verbatim for the body — `drizzleAdapter(db, { provider: 'pg', schema })` + `apiKey({ hashing: 'sha256' })` + `rateLimit: { ... }`.

---

### Pattern M — TypeBox DTO schema

**Target files:** `src/auth/presentation/dtos/create-api-key.dto.ts`, `list-api-keys.dto.ts`

**Analog:** `src/bootstrap/config.ts` L15-31 — shows TypeBox `Type.Object({...})` pattern.

**Full analog excerpt** (L1-33):
```typescript
import { FormatRegistry, type Static, Type } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

FormatRegistry.Set('uri', (value) => { ... })

export const ConfigSchema = Type.Object({
  DATABASE_URL: Type.String({ pattern: '^postgresql://.+' }),
  BETTER_AUTH_SECRET: Type.String({ minLength: 32 }),
  BETTER_AUTH_URL: Type.String({ format: 'uri' }),
  PORT: Type.Integer({ minimum: 1, maximum: 65535 }),
  NODE_ENV: Type.Union([
    Type.Literal('development'),
    Type.Literal('production'),
    Type.Literal('test'),
  ]),
  LOG_LEVEL: Type.Union([
    Type.Literal('debug'),
    Type.Literal('info'),
    Type.Literal('warn'),
    Type.Literal('error'),
  ]),
})

export type Config = Static<typeof ConfigSchema>
```

**Replicate:**
- `import { Type, type Static } from '@sinclair/typebox'`.
- `export const XxxSchema = Type.Object({...})` + `export type Xxx = Static<typeof XxxSchema>`.
- Per-field constraints (`minLength` / `maxLength` / `pattern` / `format`).
- `Type.Union([Type.Literal(...), ...])` for enum-like fields.

**Elysia controller convention:** In the controller route options, TypeBox schema goes under the `body` / `query` / `params` key (not `Type.Object` — Elysia re-exports TypeBox as `t`). Example from RESEARCH.md §specifics (CONTEXT L267-272):
```typescript
import { t } from 'elysia'                    // elysia's t === @sinclair/typebox Type (re-export)
import { ALLOWED_SCOPES } from '../../domain/auth-context'

export const CreateApiKeyBody = t.Object({
  label: t.String({ minLength: 1, maxLength: 64 }),
  scopes: t.Array(t.Union(ALLOWED_SCOPES.map(s => t.Literal(s))), { default: ['*'] }),
  expiresAt: t.Optional(t.String({ format: 'date-time' })),
})
```

**Diverge (D-05 critical):**
- `scopes` field derived from `ALLOWED_SCOPES` constant — **must NOT hardcode `t.Union([t.Literal('*'), t.Literal('read:*')])`**. Use `t.Union(ALLOWED_SCOPES.map(s => t.Literal(s)))` so v2 scope additions only touch the const.
- Executor will get it wrong if they copy-paste literals — planner to flag this explicitly in plan action.

---

### Pattern N — Integration test using real `createApp` + fake deps

**Target files:** `tests/integration/auth/*.test.ts` (all 14 integration files)

**Analog:** `tests/integration/app-skeleton-smoke.test.ts` — explicitly documents the pattern P3 must follow.

**Analog excerpt** (L1-43):
```typescript
import { describe, expect, test } from 'bun:test'
import { createApp } from '../../src/bootstrap/app'
import type { Config } from '../../src/bootstrap/config'
import type { IDbHealthProbe } from '../../src/health/application/ports/db-health-probe.port'
import { NotFoundError } from '../../src/shared/kernel/errors'

// Minimal test Config — avoids invoking loadConfig() which hits real env.
const TEST_CONFIG: Config = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3000',
  PORT: 3000,
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
}

// We pass a fake `db` through AppDeps — createHealthModule accepts a `probe` override so the
// fakeDb is never actually queried. createDbClient is skipped entirely when deps.db is provided.
const fakeDb = {} as never

function stubProbe(impl: () => Promise<'up' | 'down'>): IDbHealthProbe {
  return { probe: impl }
}

describe('app skeleton smoke (real createApp)', () => {
  test('/health → 200 on DB up + x-request-id UUID v4 echoed', async () => {
    const app = createApp(TEST_CONFIG, {
      db: fakeDb,
      probe: stubProbe(() => Promise.resolve('up')),
    })
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
    ...
  })
  ...
})
```

**Replicate:**
- Test file imports `createApp` from `@/bootstrap/app` (or relative path).
- `TEST_CONFIG: Config` literal — never calls `loadConfig()`.
- `const fakeDb = {} as never` pattern for fake DB when using dependency-override.
- `app.handle(new Request('http://localhost/...'))` — web-standard Request API, not SuperTest / chai.
- Assertions via `bun:test` — `describe` / `test` / `expect`.

**Diverge (P3 adds auth deps):**
- P3 pattern: `createApp(TEST_CONFIG, { db: fakeDb, authInstance: realAuthForTest })` — the `authInstance` override mentioned in CONTEXT L227 lets tests skip BetterAuth CLI and inject a test instance.
- New `tests/integration/auth/_helpers.ts` exports: `loadTestConfig()`, `fakeDb` (PGLite-backed preferred per RESEARCH.md L1062), `realAuthForTest` (test-mode BetterAuth instance), `createTestUser`, `signInAndGetCookie`, `createApiKeyForUser`.
- Regression tests end in `.regression.test.ts` so P5 can `mv tests/integration/auth/*.regression.test.ts tests/regression/auth/` via grep.

**Existing AUX-06 stub to replace:**
`tests/integration/auth-bypass-contract.test.ts` L16-18 holds `test.skip('[AUX-06, Phase 3] ...')` — P3 replaces `.skip` with real test and moves the file into `tests/integration/auth/authcontext-missing.regression.test.ts` (or keeps path but renames — planner decides).

---

### Pattern O — Unit test for use case (mocked ports)

**Target files:** `tests/unit/auth/application/usecases/*.test.ts`, `tests/unit/auth/domain/*.test.ts`, `tests/unit/auth/infrastructure/identity-service.adapter.test.ts`

**Analog for use-case tests:** `tests/unit/health/check-health.usecase.test.ts`

**Full analog excerpt** (L1-37):
```typescript
import { describe, expect, test } from 'bun:test'
import type { IDbHealthProbe } from '../../../src/health/application/ports/db-health-probe.port'
import { CheckHealthUseCase } from '../../../src/health/application/usecases/check-health.usecase'

const fixedClock = { now: () => new Date('2026-04-19T12:00:00.000Z') }

describe('CheckHealthUseCase', () => {
  test('DB up → ok:true, db:"up", checkedAt:ISO', async () => {
    const probe: IDbHealthProbe = { probe: () => Promise.resolve('up') }
    const usecase = new CheckHealthUseCase(probe, fixedClock)
    const result = await usecase.execute()
    expect(result).toEqual({ ok: true, db: 'up', checkedAt: '2026-04-19T12:00:00.000Z' })
  })
  ...
})
```

**Analog for adapter tests:** `tests/unit/health/drizzle-db-health-probe.test.ts` L1-39.

**Full adapter analog excerpt** (L1-25):
```typescript
import { describe, expect, test } from 'bun:test'
import { DrizzleDbHealthProbe } from '../../../src/health/infrastructure/drizzle-db-health-probe'

type FakeDb = { execute: (query: unknown) => Promise<unknown> }

describe('DrizzleDbHealthProbe', () => {
  test('A: probe resolves "up" when db.execute resolves', async () => {
    const fakeDb: FakeDb = { execute: () => Promise.resolve([{ ok: 1 }]) }
    const probe = new DrizzleDbHealthProbe(fakeDb as never)
    const result = await probe.probe()
    expect(result).toBe('up')
  })
  ...
})
```

**Replicate:**
- `import { describe, expect, test } from 'bun:test'`.
- **Fake ports via plain object literal** implementing the interface — no `vi.mock`, no jest-style mock libs. See Pitfall #10 in RESEARCH.md L715-719: don't mock at the port level; inject plain-object fakes.
- Fixed clock: `const fixedClock = { now: () => new Date('2026-04-19T12:00:00.000Z') }`.
- `expect(...).toEqual({...})` for object comparison.
- `expect(...).rejects.toThrow('...')` for error cases — as at `check-health.usecase.test.ts` L35.

**Diverge for `CreateApiKeyUseCase` test:**
- Stub `IIdentityService` with plain-object fake (not a real adapter).
- Test cases per AUTH-15 / AUTH-16 / D-04:
  - `input.userId !== ctx.userId` → throws `ForbiddenError('USER_ID_MISMATCH')`.
  - `input.scopes` not subset of `ctx.scopes` → throws `ForbiddenError('SCOPE_NOT_SUBSET')`.
  - `input.expiresAt` undefined → defaults to `now + 90 days`.
  - Happy path → returns flat DTO with `key: rawKey`.

---

### Pattern P — Contract test (file-system invariant)

**Target file:** `tests/contract/drizzle-schema.contract.test.ts`

**Analog:** `tests/contract/kernel-framework-free.test.ts`

**Full analog excerpt** (L1-27):
```typescript
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const FORBIDDEN_IMPORTS = ['elysia', 'drizzle-orm', 'better-auth', 'postgres', 'pino', '@bogeychan/elysia-logger']

describe('shared/kernel remains framework-free', () => {
  test('no forbidden imports appear in kernel source files', () => {
    const dir = 'src/shared/kernel'
    const files = readdirSync(dir).filter((name) => name.endsWith('.ts'))

    for (const file of files) {
      const text = readFileSync(join(dir, file), 'utf8')
      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(text).not.toMatch(new RegExp(`from ['"]${forbidden}['"]`))
      }
    }
  })
})
```

**Replicate for drizzle-schema contract:**
- Imports from `node:child_process` (for `bunx drizzle-kit generate --name=ci-drift`) instead of `node:fs`.
- Assertion: `drizzle-kit generate` produces no new migration file (means schema in repo matches DB).
- Alternative: scan `src/**/infrastructure/schema/*.ts` files for `index(...).on(...)` presence on `api_keys.prefix` (D-21 invariant).

**Diverge:** Drizzle-kit shell invocation differs from `node:fs` reads. Planner must decide if the contract is (a) "drizzle-kit generate runs clean" or (b) "specific indexes present in schema files" — both are acceptable; research §Wave 0 Gaps (L1063) suggests option (a).

---

### Pattern Q — ADR file (MADR 4.0)

**Target files:** `docs/decisions/0013-api-key-storage-hash-plus-index.md`, `0014-api-key-hashing-sha256.md`, `0015-rate-limit-memory-v1-persistent-v2.md`, `0016-betterauth-defaults-trust.md`

**Analogs (top two most recent):**
- `docs/decisions/0011-resolver-precedence-apikey-over-cookie.md` (L1-59)
- `docs/decisions/0012-global-plugin-ordering.md` (L1-73)

**Front-matter pattern (0011 L1-7):**
```markdown
---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/research/STACK.md, .planning/research/ARCHITECTURE.md, .planning/research/PITFALLS.md
informed: future AI Agents and future maintainers
---
```

**Section structure (both ADRs share):**
1. `# NNNN. Title`
2. `## Context and Problem Statement`
3. `## Decision Drivers`
4. `## Considered Options`
5. `## Decision Outcome` (with "Chosen option: X, because ...")
6. `### Consequences` (Good / Bad / Note bullets)
7. `## Pros and Cons of the Options` (per-option sub-section)
8. `## References` (optional but 0012 uses it)

**Replicate:**
- Same YAML front matter (update `date: 2026-04-19`; add `consulted` pointing to relevant PITFALLS / research sections).
- Traditional Chinese is OK for `Consequences` detail per CLAUDE.md (P1 ADRs are English-neutral — matching style avoids drift).
- Headers 1-7 always present; 8 (References) when linking source issues.

**Also required:** Update `docs/decisions/README.md` table — append 4 rows matching existing L9-21 shape:
```markdown
| [0013](0013-api-key-storage-hash-plus-index.md) | API Key storage: prefix + hash + indexed | accepted | 2026-04-19 | — |
| [0014](0014-api-key-hashing-sha256.md) | API Key hashing: sha256 explicit | accepted | 2026-04-19 | — |
| [0015](0015-rate-limit-memory-v1-persistent-v2.md) | Rate limit: memory store v1 / persistent v2 | accepted | 2026-04-19 | — |
| [0016](0016-betterauth-defaults-trust.md) | Trust BetterAuth session cookie defaults | accepted | 2026-04-19 | — |
```

---

### Pattern R — `createApp` extension (one-line add)

**Target file:** `src/bootstrap/app.ts` (modified)

**Analog:** itself (the current state + ADR 0012 canonical ordering).

**Current relevant excerpt** (L39-55):
```typescript
export function createApp(config: Config, deps: AppDeps = {}) {
  const logger = createPinoLogger({ NODE_ENV: config.NODE_ENV, LOG_LEVEL: config.LOG_LEVEL })
  const db = deps.db ?? createDbClient({ DATABASE_URL: config.DATABASE_URL }).db
  const healthDeps: HealthModuleDeps = deps.probe ? { db, probe: deps.probe } : { db }

  return new Elysia({ name: 'rigging/app' })
    .use(requestLoggerPlugin(logger))
    .use(corsPlugin())
    .use(errorHandlerPlugin(logger))
    .use(swaggerPlugin())
    .use(createHealthModule(healthDeps))
}
```

**P3 patch (per CONTEXT L242 + RESEARCH.md Example 2 L790-818):**
```typescript
// AppDeps gains authInstance?: AuthInstance
export interface AppDeps {
  db?: DrizzleDb
  probe?: IDbHealthProbe
  authInstance?: AuthInstance            // NEW for P3 — test-override for BetterAuth
}

// Body gains authDeps construction + one .use() call
const authDeps = deps.authInstance
  ? { db, logger, config, authInstance: deps.authInstance }
  : { db, logger, config }

return new Elysia({ name: 'rigging/app' })
  .use(requestLoggerPlugin(logger))
  .use(corsPlugin())
  .use(errorHandlerPlugin(logger))
  .use(swaggerPlugin())
  .use(createAuthModule(authDeps))                    // NEW — between swagger and health per ADR 0012
  .use(createHealthModule(healthDeps))
```

**Replicate:** `deps.xxx ? { ..., xxx: deps.xxx } : { ... }` conditional shape — matches existing `deps.probe ? ...` pattern at analog L46 (required by `exactOptionalPropertyTypes: true`).

**Diverge:**
- Import added: `import { createAuthModule } from '../auth/auth.module'` + `import type { AuthInstance } from '../auth/infrastructure/better-auth/auth-instance'`.
- Ordering: auth module goes **before** health (per CONTEXT code_context L242 — "橫切先於 feature modules; auth plugin 掛根以符 D-15 單一根層 macro"). ADR 0012 does not pin relative order of feature modules — append rule is "append at end", so planner must verify the CONTEXT directive (auth before health) is consistent with ADR 0012 §Consequences. It IS consistent: ADR 0012 locks horizontal-before-feature ordering; intra-feature order is convention, and auth macro at root mount is a separate concern covered by Pattern I.

---

## Shared Patterns

### Authentication Layer Registration (apply to all new `src/auth/**` files)

**Source:** ADR 0006 (authcontext-boundary) + ADR 0007 (runtime-guards-via-di) + `biome.json` L29-54 (domain import restrictions).

**Apply to:** every new domain + application file.

**Rule:** The Biome `noRestrictedImports` override (already configured) auto-enforces:
- `src/auth/domain/**` cannot import `drizzle-orm`, `postgres`, `elysia`, `better-auth`, `@bogeychan/elysia-logger`, `pino`.
- `src/auth/application/**` cannot import `drizzle-orm`, `postgres`, or `**/domain/internal/**`.
- `src/auth/presentation/**` cannot import `**/domain/internal/**` (same pattern block).

**Action:** No new code required. Planner notes that if executor writes `import { eq } from 'drizzle-orm'` in a use case, Biome blocks it with the message at `biome.json` L59-60.

### Error Handling (apply to all controllers + use cases)

**Source:** `src/shared/presentation/plugins/error-handler.plugin.ts` L17-60.

**Apply to:** all `src/auth/presentation/controllers/*.ts` — let DomainError propagate.

**Pattern excerpt** (L17-40):
```typescript
export function errorHandlerPlugin(logger: Logger) {
  return new Elysia({ name: 'rigging/error-handler' }).onError({ as: 'global' }, (ctx) => {
    const { error, set, request } = ctx
    const rid = (ctx as { requestId?: unknown }).requestId
    const requestId = typeof rid === 'string' ? rid : 'unknown'
    const url = new URL(request.url)

    if (error instanceof DomainError) {
      set.status = error.httpStatus
      if (error.httpStatus >= 500) {
        logger.error({ err: error, stack: error.stack, cause: error.cause, requestId }, error.message)
      } else {
        logger.warn({ code: error.code, requestId, path: url.pathname }, error.message)
      }
      return toHttpErrorBody({ code: error.code, message: error.message, requestId })
    }
    ...
  })
}
```

**Consequences for P3:**
- Auth controllers **throw** `UnauthorizedError` / `ForbiddenError` / domain errors — **no try/catch**. Global `.onError({ as: 'global' })` catches, maps to status, formats body.
- 401 body for D-12 is automatic once `UnauthorizedError.code = 'UNAUTHENTICATED'` and `httpStatus = 401`. Executor doesn't need to change `error-handler.plugin.ts`.
- The only carve-out is macro `resolve` — it must `return status(401, 'UNAUTHENTICATED')` directly (not throw), because Elysia's macro-resolve error path requires the status return shape, not error propagation (RESEARCH.md Pitfall #1 L658-663).

### Request Logger Integration (apply to all request paths)

**Source:** `src/shared/presentation/plugins/request-logger.plugin.ts` L14-40 — already redacts auth headers:
```typescript
redact: {
  paths: [
    'req.headers.cookie',
    'req.headers.authorization',
    'req.headers["x-api-key"]',
    'res.headers["set-cookie"]',
  ],
  censor: '[REDACTED]',
  remove: false,
},
```

**Apply to:** zero new work — all P3 auth headers are already redacted.

**Consequence:** `log.warn` calls in auth adapter / macro (for D-10 rate-limit, D-12 cause) can safely include full request context; pino will strip sensitive paths.

### Validation (apply to all new DTOs)

**Source:** `src/bootstrap/config.ts` L4-11 (FormatRegistry pattern) + L15-31 (TypeBox schema).

**Apply to:** every P3 DTO file (`create-api-key.dto.ts`, `list-api-keys.dto.ts`).

**Rule:** Use `t.Object({...})` from Elysia (= TypeBox re-export); use `@sinclair/typebox`'s `Type.Object` from `config.ts` for non-Elysia boundaries (e.g., env config). Both are the same underlying TypeBox — consistent validation across layers.

---

## No Analog Found

Files with no close match in the codebase. Planner should use RESEARCH.md excerpts directly and note "novel to repo" in plan notes:

| File | Role | Why No Analog | Planner Guidance |
|------|------|---------------|------------------|
| `src/auth/infrastructure/schema/*.schema.ts` (5 files) | Drizzle schema (CLI-generated) | `drizzle/` is empty; no existing schema file in repo | D-17 Plan 03-01 spike: `bunx @better-auth/cli generate` produces these. **Do NOT hand-author.** Post-gen: add index on `prefix` per D-21 (manual edit — one line addition on `api-key.schema.ts`). Closest structural analog is empty `src/_template/infrastructure/` placeholder. |
| `src/auth/presentation/plugins/auth-context.plugin.ts` | Elysia `.macro()` plugin | `.macro()` API is new to repo; existing plugins use `.derive()` / `.onError()` | Use RESEARCH.md Pattern 2 (L372-411) verbatim. Closest-shape reference is `request-logger.plugin.ts` L56-89 for the `as: 'global'` syntax. |
| `src/auth/presentation/plugins/require-auth.macro.ts` (may merge into auth-context.plugin.ts) | macro definition (if split) | No existing macro in repo | Per RESEARCH.md Pattern 2, macro can live inside `authContextPlugin` factory. Planner: recommend NOT splitting (single file reduces scope-global pitfall surface). |
| `src/auth/infrastructure/mappers/*.mapper.ts` | row ↔ domain mapper | No mapper in repo yet — health uses primitive returns | Establish the convention: object literal with `toDomain` + `toPersistence` methods. Phase 4 demo mappers will replicate this. |
| `tests/integration/auth/_helpers.ts` | test fixtures | First shared test helper file | Novel. Planner to spec the exports: `loadTestConfig()` / `fakeDb` (PGLite preferred) / `realAuthForTest` / `createTestUser` / `signInAndGetCookie` / `createApiKeyForUser`. RESEARCH.md L1061-1062 notes PGLite for in-memory DB. |
| `drizzle/0001_auth_foundation.sql` | SQL migration | First migration in repo (drizzle/ empty) | D-17 Plan 03-01: `bunx drizzle-kit generate --name=0001_auth_foundation` produces it. Executor may NOT hand-edit — if migration shape unexpected, halt and open Q to user (CONTEXT L303). |

---

## Cross-Reference: CONTEXT Decisions → Patterns

| Decision | Primary Pattern(s) | File(s) |
|----------|--------------------|---------|
| D-01 `ALLOWED_SCOPES = ['*', 'read:*']` | Pattern C (barrel) | `src/auth/domain/auth-context.ts` |
| D-02 Scope check in use case | Pattern F (runtime guards) | `src/auth/application/usecases/*.usecase.ts` |
| D-03 Human scopes=['*'] | Pattern J (adapter mapping) | `src/auth/infrastructure/better-auth/identity-service.adapter.ts` |
| D-04 Key subset check | Pattern F | `create-api-key.usecase.ts` |
| D-05 Shared constant in DTO | Pattern M (TypeBox) | `src/auth/presentation/dtos/create-api-key.dto.ts` |
| D-06 `INSUFFICIENT_SCOPE` body | Pattern A + shared error-handler | `errors.ts` + auto via `error-handler.plugin.ts` |
| D-09 No cookie fallback | Pattern I (macro) | `auth-context.plugin.ts` |
| D-10 Timing alignment | Pattern J (adapter, dummy ops) | `identity-service.adapter.ts` |
| D-11 API Key precedence + no sessionId | Pattern I + J | `auth-context.plugin.ts` + `identity-service.adapter.ts` |
| D-12 Generic 401 body | Pattern A + shared error-handler | auto via `error-handler.plugin.ts` |
| D-13 Only apiKey() plugin | Pattern L (instance factory) | `auth-instance.ts` |
| D-14 basePath `/api/auth` | Pattern G (module factory) | `auth.module.ts` L780 |
| D-15 No elysia in auth-instance | Pattern L (hard divergence) | `auth-instance.ts` |
| D-16 Rate limit config + wrapper | Pattern L (config) + Pattern E (per-email use case) | `auth-instance.ts` + `register-user.usecase.ts` |
| D-17 CLI schema gen | Pattern (no analog) | schema/*.ts + `drizzle/0001_auth_foundation.sql` |
| D-18 Trust defaults | ADR Pattern Q | `docs/decisions/0016-betterauth-defaults-trust.md` |
| D-19 Prefix `rig_live_` | Pattern J (adapter) | `identity-service.adapter.ts` L450 const |
| D-20 Flat response | Pattern F + H | `create-api-key.usecase.ts` + `api-key.controller.ts` |
| D-21 Prefix index + hash column | Pattern (no analog — schema patch) + Pattern Q ADR | `api-key.schema.ts` post-edit + `0013-*.md` |
| D-22 Default 90 days | Pattern F | `create-api-key.usecase.ts` L562-564 |
| D-23 hashing sha256 | Pattern L (config) + Pattern Q ADR | `auth-instance.ts` + `0014-*.md` |
| D-24 Soft delete | Pattern J (repository adapter) | `drizzle-api-key.repository.ts` (WHERE revoked_at IS NULL) |
| D-25 Label required 1-64 UTF-8 | Pattern M (TypeBox) + Pattern F (trim) | `create-api-key.dto.ts` + `create-api-key.usecase.ts` L568 |
| AUTH-11 Session fixation | Pattern E (use case wrap) + ADR Q | `reset-password.usecase.ts` + `0016-*.md` (trust-defaults) |
| AUTH-15 CVE-2025-61928 | Pattern F (runtime guard line 1) | `create-api-key.usecase.ts` L552-554 |
| AUX-02 Macro scope:global | Pattern I | `auth-context.plugin.ts` |
| AUX-04 timingSafeEqual | Pattern J | `identity-service.adapter.ts` L499 |
| AUX-05 Runtime Guard factory | Pattern C (novel part) | `src/auth/domain/index.ts` `getApiKeyService` |
| AUX-06 Missing plugin → 401 | Pattern N (integration test) | `tests/integration/auth/authcontext-missing.regression.test.ts` |
| AUX-07 Precedence test | Pattern N | `tests/integration/auth/resolver-precedence.regression.test.ts` |

---

## Metadata

**Analog search scope:**
- `src/health/**` (7 files scanned)
- `src/shared/**` (11 files scanned)
- `src/bootstrap/**` (3 files scanned)
- `src/_template/**` (4 empty dirs confirmed)
- `src/main.ts` (1 file)
- `docs/decisions/*.md` (13 files scanned)
- `tests/integration/**` (2 files)
- `tests/unit/**` (9 files)
- `tests/contract/**` (1 file)
- `biome.json`, `drizzle.config.ts` (config)

**Files scanned:** 52 files.
**Early-stop trigger:** Strong analogs found for 32 of 38 target files by scan end; remaining 6 documented in §No Analog Found.
**Pattern extraction date:** 2026-04-19.

## PATTERN MAPPING COMPLETE
