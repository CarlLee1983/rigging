# Phase 3: Auth Foundation — Research

**Researched:** 2026-04-19
**Domain:** BetterAuth 1.6.5 integration on Elysia 1.4.28 + Drizzle 0.45.2; dual-rail AuthContext (cookie session + API Key, API Key precedence); Runtime Guards; CVE-2025-61928 regression layer
**Confidence:** HIGH (stack / BetterAuth integration surface / CVE / Elysia macro — verified via Context7 + installed `node_modules` + prior P1/P2 implementation); MEDIUM (session-fixation-on-reset exact 1.6.5 behavior — requires spike per D-17); MEDIUM (Pitfall #5446 BetterAuth CLI × Elysia 1.4.28 schema-gen current state — requires spike)

## Summary

Phase 3 is Rigging's **論述核心**: turn the AuthContext boundary from abstract discipline (P1 rules, P2 template) into a physically enforceable constraint. The phase is atomic by structural necessity — BetterAuth schema generation, Drizzle migration, auth domain + ports, dual-rail resolver, Runtime Guard, and CVE-2025-61928 regression test **cannot be split** without either breaking the dual-rail narrative or shipping a CVE-class gap.

The technical surface is narrow and mostly well-documented: BetterAuth 1.6.5 ships `drizzleAdapter(db, { provider: 'pg' })` as a first-party sibling package, `apiKey({ hashing: 'sha256' })` as a built-in plugin, and `auth.api.getSession({ headers })` / `auth.api.createApiKey({ body })` as first-class server-side APIs. Elysia 1.4's `.mount(auth.handler)` preserves Set-Cookie (this was the pre-1.4 blocker). The `.macro({ requireAuth: { resolve } })` pattern at `scope: 'global'` single-root mount is the canonical shape for AuthContext injection.

The non-obvious work sits in three places:
1. **CVE-2025-61928 defense-in-depth** — Rigging MUST NOT trust BetterAuth's internal session-check alone; `CreateApiKeyUseCase.execute` first line compares `input.userId` against `ctx.userId` (D-04, AUTH-15).
2. **Resolver precedence per D-09/D-10/D-11** — API Key failure never falls back to cookie; malformed-header timing-aligned to valid-format-wrong-hash baseline via dummy `timingSafeEqual` + dummy DB SELECT, not `setTimeout`.
3. **Session fixation on reset (AUTH-11, Pitfall #6)** — BetterAuth's `POST /reset-password` (token flow) does NOT expose `revokeOtherSessions` in its public surface (confirmed via Context7); only `/change-password` does. P3 spike must verify 1.6.5 actual runtime behavior and, if sessions are not purged, wrap via BetterAuth hook or wrap `reset-password` through a Rigging use-case that calls `auth.api.revokeSessions({ headers: { ... }})` post-reset.

**Primary recommendation:** Plan the phase as 5 plans with 03-01 as a rollback-safe spike (BetterAuth CLI schema-gen + migration + session-fixation behavior probe), 03-02 auth domain + ports + schema + repositories (mechanical, post-spike), 03-03 BetterAuth infra adapter + use cases + email adapter, 03-04 presentation plugins + controllers + `createAuthModule` wiring + CVE regression, 03-05 hardening pass (timing alignment, Runtime Guard factory message quality, 4 new ADRs). Every plan must land green on unit + integration tests before next plan starts — no mid-phase debt.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scope Design (AuthContext.scopes ∩ apiKey.scopes)**
- **D-01** — Scope v1 vocabulary = **two values**: `'*'` (full access / sudo) and `'read:*'` (read-only). Landed as `export const ALLOWED_SCOPES = ['*', 'read:*'] as const` in `src/auth/domain/auth-context.ts`.
- **D-02** — Scope check **in the use-case body**, not in the macro and not double-defense. Template: `if (!ctx.scopes.includes('*') && !ctx.scopes.includes('write:*')) throw new ForbiddenError('INSUFFICIENT_SCOPE', ...)`.
- **D-03** — Human cookie session defaults to `scopes: ['*']` (sudo). Mapper lives in `src/auth/infrastructure/better-auth/identity-service.adapter.ts` `verifySession` body.
- **D-04** — API Key invariant: `key.scopes ⊆ session.scopes` (subset check at creation, second step of `CreateApiKeyUseCase.execute`; first step is AUTH-15 `body.userId === session.userId`). Violation → `ForbiddenError('SCOPE_NOT_SUBSET', ...)`.
- **D-05** — `POST /api-keys` body `scopes` validated via **shared constant + TypeBox literal union** (no string literals duplicated in schema). DTO derives from `ALLOWED_SCOPES`: `t.Array(t.Union(ALLOWED_SCOPES.map(s => t.Literal(s))), { default: ['*'] })`.
- **D-06** — 403 body on missing scope = `{ error: { code: 'INSUFFICIENT_SCOPE', message: 'This operation requires scope write:*', requestId } }`.
- **D-07** — `'*'` semantics = **永等 catch-all** (v2-added scopes auto-grant to existing `['*']` keys). Consequence: before any v2 scope expansion, must evaluate whether new scope is safe to auto-grant, otherwise issue force-rotate migration.
- **D-08** — `/me` checks `requireAuth` only, no scope check. Swagger `security: [{ cookieAuth: [] }, { apiKeyAuth: [] }]` without per-scope annotation.

**Resolver Precedence Boundary**
- **D-09** — API Key invalid (bad hash / revoked / expired) + cookie session valid → **hard 401, no fallback to cookie**. `identity.verifyApiKey(raw) === null` → immediate `return status(401)`.
- **D-10** — Malformed API Key header (prefix wrong / length wrong / non-ASCII) → fast-reject 401 **but** with timing alignment to valid-format-wrong-hash path. Implementation: run a dummy `timingSafeEqual(zeroBuf, zeroBuf)` + dummy DB SELECT to match the real-path latency distribution. **Not** `setTimeout(n ms)` (statistically trivial to bypass).
- **D-11** — API Key + cookie both valid → API Key wins. Final AuthContext shape: `{ userId: apiKey.userId, identityKind: 'agent', scopes: apiKey.scopes, apiKeyId: apiKey.id }` — **no `sessionId`**. Response does NOT strip Set-Cookie (cookie still exists on client but this request never used it).
- **D-12** — All 401 responses share identical body: `{ error: { code: 'UNAUTHENTICATED', message: 'Authentication required', requestId } }`. Server-side log distinguishes cause via `log.warn`.

**BetterAuth Integration Surface**
- **D-13** — BetterAuth plugins = **only `apiKey()`** (+ built-in `emailAndPassword`). No `bearer()` plugin.
- **D-14** — BetterAuth handler basePath = `/api/auth` (mounted via `new Elysia().mount('/api/auth', auth.handler)` — Elysia 1.4.28 Set-Cookie fix required).
- **D-15** — BetterAuth instance file = `src/auth/infrastructure/better-auth/auth-instance.ts`, **pure `better-auth` + `drizzle-adapter` + db schema imports, NO `elysia` import**. This decouples config from Elysia bootstrap so `bunx @better-auth/cli generate` can read it (Pitfall #5446 mitigation).
- **D-16** — BetterAuth rate-limit enabled in P3 minimally: `{ enabled: true, window: 60, max: 100, storage: 'memory' }` + `log.warn({ event: 'rate_limit_hit', ip, path }, ...)` hook + **per-email wrapper** for `/send-verification-email` (use-case-layer record-last-sent-at; 10s re-send → 429). Persistent store + per-email observability deferred to v2 PROD-02.
- **D-17** — BetterAuth schema generation + migration commit lives in **Plan 03-01 spike** (rollback-safe, isolated). If CLI fails with #5446, spike rollback does not waste auth-domain code.
- **D-18** — Session cookie attributes trust BetterAuth 1.6.5 defaults (HttpOnly + Secure[prod] + SameSite=Lax); ADR 0016 pins this dependency. Future BetterAuth default changes require new ADR.

**API Key Lifecycle + Storage**
- **D-19** — Key prefix **single format `rig_live_` + 32 bytes base64url** (~43 chars). Human/agent not distinguished by prefix; `identityKind='agent'` is a function of "was validated via API Key path", not prefix.
- **D-20** — `POST /api-keys` success response = **flat shape**: `{ id, key, prefix, label, scopes, expiresAt, createdAt }`. Raw key field name = `key` (not `plaintext` / `secret` / `token`).
- **D-21** — API Key DB schema: `prefix: text('prefix').notNull()` + `index('api_keys_prefix_idx').on(table.prefix)` + `hash: text('hash').notNull().unique()`. ADR 0014 (storage: prefix + hash + index) pins this.
- **D-22** — `POST /api-keys` body `expiresAt` optional; default 90 days. Schema: `expiresAt: t.Optional(t.String({ format: 'date-time' }))`; use case: `input.expiresAt ?? clock.now() + 90 days`.
- **D-23** — BetterAuth `apiKey({ hashing: 'sha256' })` explicitly set. ADR 0014 pins non-reversible at-rest hashing, algorithm hard-locked, no agent-driven flip to `hashing: false`.
- **D-24** — `DELETE /api-keys/:id` = **soft delete** via `revokedAt: timestamp`. Resolver query: `WHERE prefix = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`.
- **D-25** — `POST /api-keys` body `label` = **required**, 1-64 chars, trim, UTF-8. Schema: `t.String({ minLength: 1, maxLength: 64 })`; use case: `label.trim()` before min/max assertion.

### Claude's Discretion

- BetterAuth `apiKey` plugin fields not locked: auto-prefix behavior, `start` length, `length` setting — derive from BetterAuth docs + D-19 `rig_live_` prefix.
- Drizzle migration filename — `drizzle-kit generate --name=0001_auth_foundation` (executor decides).
- `createAuthModule(shared: SharedDeps): Elysia` concrete shape — follow ARCHITECTURE Pattern 5.
- `IEmailPort` + `ConsoleEmailAdapter` output format — research recommendation: `📧 CLICK THIS: <url>` banner-style UX log.
- `IPasswordHasher` port — NOT required (BetterAuth handles user password; API Key hashing lives in `apiKey` plugin). Executor may skip.
- `IUserRepository` / `IApiKeyRepository` location — `src/auth/application/ports/` (feature-owned).
- Mapper naming — `UserMapper.toDomain` / `UserMapper.toPersistence`.
- Regression test organization — `tests/integration/auth/*.regression.test.ts` for P3; P5 integration will `mv` to `tests/regression/auth/`.
- `/me` controller location — `src/auth/presentation/controllers/me.controller.ts`; response shape `{ userId, identityKind, scopes, apiKeyId?, sessionId? }` transparent.
- Auth feature module single-directory vs sub-directory — single `src/auth/` (no split).
- ADR numbering — P3 adds 0013 (API Key storage: hash + index + prefix), 0014 (API Key hashing: sha256), 0015 (Rate limit: memory v1 / persistent v2), 0016 (BetterAuth defaults trust).
- Session fixation wrap location (if spike finds 1.6.5 doesn't purge) — either BetterAuth `emailAndPassword.onPasswordReset` hook OR use-case-layer `auth.api.revokeSessions({ headers: { authorization: ... } })` post-reset.

### Deferred Ideas (OUT OF SCOPE)

- BetterAuth rate-limit persistent store (Postgres/Redis) + per-email dashboard → v2 PROD-02
- API Key TTL auto-purge cron → v2 PROD hardening
- API Key prefix namespace per env (`rig_test_` / `rig_prod_`) → v2 SCAF-* / PROD-*
- OAuth / 2FA / Magic Link / Passkey → v2 IDN-* (PROJECT.md locked Out of Scope)
- Scope extension to resource-action granularity (`read:agents` / `write:agents`) → v2 TEN-02 RBAC
- Session table expired cleanup / session count cap → v2 PROD
- Dev `/debug/whoami` endpoint → v2 (only if P3 `/me` UX insufficient)
- API Key rotation endpoint (`PATCH /api-keys/:id`) → v2 convenience
- BetterAuth webhook (user.created / session.revoked) → v2 event-bus / AGT-03
- Audit log table → v2 observability / compliance
- Per-user API Key count cap → v2
- Swagger `bearerAuth` type → not applicable (D-13 no bearer plugin)
- Eden Treaty type regression test → v2 / P5 QA
- Admin routes / sudo scope → v2 TEN-*
- AUTH-08 concrete endpoint list — P3 ships interface hook only, v2 / demo domain wires it

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Register via email + password | BetterAuth `emailAndPassword.enabled: true` (built-in, no plugin); ships `POST /sign-up/email-password` at basePath. RegisterUserUseCase wraps `auth.api.signUpEmail({ body })`. |
| AUTH-02 | Login via email + password; cookie session maintained across refresh | BetterAuth `POST /sign-in/email-password` issues HttpOnly session cookie; Elysia 1.4 `.mount()` preserves Set-Cookie header. |
| AUTH-03 | Logout invalidates session cookie immediately | BetterAuth `POST /sign-out` clears cookie + drops session row. |
| AUTH-04 | Password stored via BetterAuth default hashing; never plaintext / bcrypt | BetterAuth uses scrypt (Node `node:crypto` built-in, Bun compat confirmed); documented default. |
| AUTH-05 | BetterAuth schema (user / session / account / verification / apiKey) generated via `bunx @better-auth/cli generate` + committed to `src/auth/infrastructure/schema/` + Drizzle migration in `drizzle/` | Context7 confirmed: `npx auth generate --adapter drizzle` outputs Drizzle schema. `drizzle.config.ts` already scans `./src/**/infrastructure/schema/*.ts`. D-17 Plan 03-01 spike. |
| AUTH-06 | Registration sends verification link via `IEmailPort`; v1 `ConsoleEmailAdapter` logs to stdout | BetterAuth `emailVerification.sendVerificationEmail` hook; Rigging injects `(params) => emailPort.send({ to, subject, body: params.url })`. |
| AUTH-07 | User clicking verification link → email status → verified | BetterAuth verification-token flow writes `user.emailVerified = true`. |
| AUTH-08 | Unverified email + protected operation → 403 (extension point preserved) | P3 ships use-case factory hook `if (!user.emailVerified) throw new ForbiddenError('EMAIL_NOT_VERIFIED')` but does NOT wire it into any specific route (per CONTEXT deferred list). |
| AUTH-09 | Password reset request sends link via `IEmailPort` (v1 console log) | BetterAuth `POST /request-password-reset` + `sendResetPassword` hook; same email adapter. |
| AUTH-10 | User sets new password via link → can log in | BetterAuth `POST /reset-password { token, newPassword }`. |
| AUTH-11 | Password reset invalidates all other sessions (session fixation, Pitfall #6) | **Context7 search confirmed**: `POST /reset-password` (token flow) does NOT expose `revokeOtherSessions` option; only `/change-password` does. Plan 03-01 spike MUST verify 1.6.5 runtime behavior; if sessions not purged, wrap via BetterAuth hook or use-case-layer `auth.api.revokeSessions` post-reset. |
| AUTH-12 | Logged-in user `POST /api-keys` → one-time plaintext key + metadata (never plaintext again) | BetterAuth `auth.api.createApiKey({ body })` returns `{ key: '<raw>', ApiKey: {...} }` once. Rigging wraps per D-20 flat response + AUTH-15 enforcement. |
| AUTH-13 | API Key stored as hash; DB contains no raw-key substring (integration test) | BetterAuth `apiKey({ hashing: 'sha256' })` + D-21 prefix + hash schema. Regression test: `SELECT * FROM api_keys; for row: expect(row.hash !== rawKey && !rawKey.includes(row.hash.slice(0,10)))`. |
| AUTH-14 | `GET /api-keys` lists own keys; `DELETE /api-keys/:id` revokes | ListApiKeysUseCase + RevokeApiKeyUseCase; DELETE = soft-delete (D-24). |
| AUTH-15 | `POST /api-keys` enforces `body.userId === session.userId` (CVE-2025-61928 class defense) | **HIGH priority**: first line of `CreateApiKeyUseCase.execute`: `if (input.userId && input.userId !== ctx.userId) throw new ForbiddenError('USER_ID_MISMATCH')`. Confirmed via Context7: BetterAuth `createApiKey` body accepts server-only `userId` param (exactly the CVE vector). |
| AUTH-16 | API Key supports optional `scopes: string[]` (default `['*']`) + optional `expiresAt` (30/60/90d selectable, default 90d per D-22) | D-05 TypeBox schema + D-22 default-90-days. |
| AUX-01 | `AuthContext = { userId: UUID, identityKind: 'human' \| 'agent', scopes: string[], apiKeyId?: UUID, sessionId?: UUID }` at `src/auth/domain/auth-context.ts` | Direct domain type; P1 `UserId` brand used for `userId`. |
| AUX-02 | Elysia `.macro({ requireAuth: { resolve } })` mounted single-root, `scope: 'global'`; unmarked handlers cannot access `ctx.authContext` at the type level | Confirmed via ARCHITECTURE Pattern 1 + Context7 BetterAuth × Elysia integration example (`auth: true` opt-in marker pattern). |
| AUX-03 | Resolver: `x-api-key` header → cookie session; API Key wins; both fail → 401 | D-09/D-10/D-11 encode. |
| AUX-04 | Resolver compares API Key via `crypto.timingSafeEqual` | Node built-in `crypto.timingSafeEqual(Buffer, Buffer)` — throws on length mismatch, normalize lengths first. Bun compat: `crypto` built-in works in 1.3.12. |
| AUX-05 | Domain service factory asserts `ctx.authContext` exists; missing → `AuthContextMissingError` | Pitfall #1 defense. `getApiKeyService(ctx: AuthContext)` in `src/auth/domain/index.ts` barrel. |
| AUX-06 | Integration test: app mounted without auth plugin → all protected routes return 401 (never 500, never silent success) | Pitfall #3 defense. `createApp(config, { authInstance: null })` or separate test-only app builder. |
| AUX-07 | Integration test: API Key + cookie simultaneous → `identityKind === 'agent'` | D-11 precedence verification. |
| AUX-01-07 | All AUX-* collectively deliver the AuthContext boundary as *physical enforcement*, not convention | P3 atomic commit — any AUX-* missing = phase not complete. |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| User registration (email + password form handling) | API / Backend | — | BetterAuth handler mounted at `/api/auth/*`; API-first Rigging v1 has no client. |
| Session cookie issuance + verification | API / Backend | — | HTTP-only cookie set server-side; `auth.api.getSession({ headers })` reads it. |
| API Key generation (random bytes + prefix + hash) | API / Backend | Database (storage) | Crypto + hashing is server-side only; plaintext returned once, never stored. |
| API Key verification | API / Backend | Database (prefix index lookup) | Resolver runs per request, uses `timingSafeEqual` + indexed DB lookup. |
| AuthContext derivation (from cookie OR API key header) | API / Backend (Elysia `.macro.resolve`) | — | Runs exactly once per request at plugin layer. |
| Runtime Guard (Domain factory assertion) | Domain (factory) | API / Backend (macro wires ctx in) | Last line of defense — even if macro misorders, factory throws. |
| Password reset token flow | API / Backend (BetterAuth) | Database (session table, verification table) | Token generation + email + consumption + session-purge all server-side. |
| Email verification link | API / Backend (BetterAuth) | External service (deferred to v2 PROD-01; v1 ConsoleEmailAdapter = stdout) | `IEmailPort` abstraction isolates the effect. |
| Rate-limiting (BetterAuth built-in + per-email wrapper) | API / Backend | Memory store (v1) | D-16 in-process memory; v2 persistent store. |
| Scope enforcement (use-case layer per D-02) | Application (use case) | — | Runtime guard in use-case body; checks `ctx.scopes` against required scope string. |
| CVE-2025-61928 defense (`body.userId === ctx.userId`) | Application (CreateApiKeyUseCase) | — | Belt-and-suspenders check on top of BetterAuth internal validation. |
| ADR + schema artifacts | Repository / Git | — | `docs/decisions/0013-0016*.md`, `src/auth/infrastructure/schema/*.ts`, `drizzle/0001_auth_foundation.sql` all version-controlled. |

## Standard Stack

### Core (verified installed in `node_modules` 2026-04-19)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-auth | 1.6.5 | Auth framework (email+password, session, apiKey plugin) | `[VERIFIED: node_modules/better-auth/package.json]`. Pin exact per P1 D-01; CVE-2025-61928 patched in 1.3.26. Rigging on 1.6.5 = safe + current. |
| @better-auth/drizzle-adapter | 1.6.5 | Drizzle adapter for BetterAuth (versions locked to core) | `[VERIFIED: node_modules/@better-auth/drizzle-adapter/package.json]`. Sibling package, released in lockstep with core. |
| elysia | 1.4.28 | Web framework with `.macro()` / `.mount()` | `[VERIFIED: node_modules/elysia/package.json]`. ≥ 1.4 mandatory for `.mount(auth.handler)` Set-Cookie preservation. |
| drizzle-orm | 0.45.2 | Query builder + schema (postgres-js path) | `[VERIFIED: bun pm ls]`. BetterAuth CLI emits Drizzle schema targeting this version. |
| drizzle-kit | 0.31.10 | Migration generation | `[VERIFIED: bun pm ls]`. `drizzle-kit generate --name=0001_auth_foundation` produces SQL migration from scanned `src/**/infrastructure/schema/*.ts`. |
| postgres | 3.4.9 | Postgres driver (postgres-js) | `[VERIFIED: bun pm ls]`. ADR 0010; BetterAuth drizzle-adapter consumes the same `db` instance. |
| @sinclair/typebox | 0.34.49 | TypeBox (Elysia peerDep) for DTO schemas | `[VERIFIED: package.json]`. `t.Object({...})` = TypeBox; DTOs for `POST /api-keys` body, `GET /api-keys` query. |

### Supporting (already in P1/P2)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pino | 10.3.1 | Logger | D-10 (rate-limit hit), D-12 (auth cause on 401) log.warn |
| @elysiajs/cors | 1.4.1 | CORS (credentials:true already configured P2) | Auth cookie requires CORS credentials pass-through already done |
| @elysiajs/swagger | 1.3.1 | OpenAPI spec (security schemes pre-wired in P2 D-15) | Tag protected routes with `security: [{ cookieAuth: [] }, { apiKeyAuth: [] }]` |
| Bun built-in `node:crypto` | Bun 1.3.12 | `crypto.randomUUID()`, `crypto.timingSafeEqual`, `crypto.randomBytes` | API Key random bytes, timing-safe compare, UUID generation |
| Bun built-in `Bun.password` | Bun 1.3.12 | Argon2id for any non-BetterAuth password hashing (unlikely needed in P3) | `[VERIFIED: Bun.password docs via bun.com]`. P3 may skip — BetterAuth handles its own user password hashing. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `better-auth/adapters/drizzle` import | `@better-auth/drizzle-adapter` standalone package | Both are supported (Context7 confirms both patterns). `@better-auth/drizzle-adapter` is the bundle-size-optimized path; `better-auth/adapters/drizzle` is the built-in. Use `@better-auth/drizzle-adapter` — it's already installed; matches "minimal BetterAuth bundle" advice from 1.5 docs. |
| BetterAuth CLI `npx @better-auth/cli generate` | Hand-write Drizzle schema | Hand-writing = ANTI-PATTERN 5 (ARCHITECTURE.md) — BetterAuth schema evolves with plugin/version updates; drift → silent runtime crashes. ALWAYS use the CLI. |
| `bearer()` plugin | `apiKey()` plugin only (D-13) | `bearer()` adds a third auth path (cookie / apikey / bearer). D-13 locked `apiKey()` only — three paths means three resolver branches means three places to get precedence wrong. |
| Custom API key generator | BetterAuth `apiKey({ hashing: 'sha256' })` | BetterAuth handles key generation + hashing + prefix. Rigging only wraps the create endpoint to enforce AUTH-15 (`body.userId === ctx.userId`) + D-04 (subset check) + D-20 (flat response shape). |

**Installation:**
```bash
# All required packages already installed per bun pm ls; no new bun add required.
# Verify before Plan 03-01:
bun pm ls | grep -E "(better-auth|drizzle|elysia|postgres)"
```

**Version verification command:**
```bash
npm view better-auth version       # expect 1.6.5 or later on registry
npm view @better-auth/drizzle-adapter version  # must track core
# Executor MUST confirm installed versions match package.json pins on fresh checkout.
```

**Context7 / CLI verification results (2026-04-19):**
- `better-auth@1.6.5` is the installed version `[VERIFIED: node_modules]`.
- `@better-auth/drizzle-adapter@1.6.5` matches core `[VERIFIED: node_modules]`.
- `elysia@1.4.28` supports `.mount()` Set-Cookie preservation `[CITED: https://better-auth.com/docs/integrations/elysia]`.
- Drizzle adapter canonical pattern: `drizzleAdapter(db, { provider: "pg" })` `[CITED: Context7 /better-auth/better-auth docs/content/blogs/1-5.mdx]`.

## Architecture Patterns

### System Architecture Diagram (P3 additions only)

```
 HTTP request (POST /api-keys, GET /me, etc.)
    │
    ▼
 Elysia 1.4.28 root app  (createApp from P2)
    ├─ requestLoggerPlugin   → derive requestId
    ├─ corsPlugin            → preflight / credentials
    ├─ errorHandlerPlugin    → onError(global)   ← maps DomainError.httpStatus per P1 D-08
    ├─ swaggerPlugin         → OpenAPI collector
    └─ createAuthModule(shared)   ← THIS PHASE
         │
         ├─ .mount('/api/auth', auth.handler)   ← BetterAuth REST endpoints (sign-up / sign-in / etc.)
         │       └─ auth = betterAuth({
         │             database: drizzleAdapter(db, { provider: 'pg' }),
         │             emailAndPassword: { enabled: true, sendResetPassword, sendVerificationEmail },
         │             plugins: [apiKey({ hashing: 'sha256', rateLimit: { ... } })],
         │             rateLimit: { enabled: true, window: 60, max: 100, storage: 'memory' },
         │          })
         │
         ├─ .use(authContextPlugin(identity))   ← macro `requireAuth` single-root mount
         │       └─ .macro({ requireAuth: { resolve:
         │             1. read 'x-api-key' header
         │                ├─ present + valid   → return { ctx: { userId, identityKind:'agent', scopes, apiKeyId } }  (D-11 no sessionId)
         │                ├─ present + invalid → status(401) (D-09 NO fallback to cookie)
         │                └─ absent or malformed-fast-reject → dummy timingSafeEqual + dummy DB SELECT (D-10 timing-align)
         │             2. fallback: auth.api.getSession({ headers })
         │                ├─ session found     → return { ctx: { userId, identityKind:'human', scopes:['*'], sessionId } }  (D-03)
         │                └─ session missing   → status(401)
         │        } })
         │
         ├─ .use(apiKeyController)   ← POST /api-keys / GET /api-keys / DELETE /api-keys/:id
         │       └─ { requireAuth: true } on every route
         │             ├─ POST → CreateApiKeyUseCase.execute(ctx, dto)
         │             │       ├─ line 1: if (input.userId && input.userId !== ctx.userId) throw ForbiddenError('USER_ID_MISMATCH')  ← AUTH-15
         │             │       ├─ line 2: if (!requestedScopes.every(s => ctx.scopes.includes(s))) throw ForbiddenError('SCOPE_NOT_SUBSET')  ← D-04
         │             │       └─ line 3: auth.api.createApiKey({ body: { userId: ctx.userId, prefix: 'rig_live_', expiresIn, ... } })
         │             ├─ GET  → ListApiKeysUseCase (domain scope + revokedAt filter)
         │             └─ DEL  → RevokeApiKeyUseCase (soft delete; set revoked_at)
         │
         ├─ .use(meController)   ← GET /me with { requireAuth: true } (D-08 no scope check)
         │
         └─ .use(authController)  ← optional extra routes for Rigging-wrapped reset / verify flows
                 └─ (if spike shows BetterAuth 1.6.5 doesn't purge sessions on reset, wrap here
                     calling `auth.api.revokeSessions` post-reset per AUTH-11 / Pitfall #6)
```

### Recommended Project Structure

```
src/auth/
├── auth.module.ts                         # createAuthModule(shared: SharedDeps): Elysia
│
├── domain/
│   ├── index.ts                           # PUBLIC barrel: ALLOWED_SCOPES, AuthContext, errors, getApiKeyService factory
│   ├── internal/                          # Class impls — forbidden import for application/presentation (Biome rule)
│   │   ├── api-key-service.ts
│   │   └── authcontext-missing-error.ts
│   ├── auth-context.ts                    # AuthContext type + ALLOWED_SCOPES const + isAgent/isHuman helpers
│   ├── identity-kind.ts                   # 'human' | 'agent' union
│   ├── errors.ts                          # AuthContextMissingError, UserIdMismatchError, etc. (extends DomainError)
│   └── values/
│       ├── email.ts                       # Email value object (normalize + basic validation)
│       └── api-key-hash.ts                # ApiKeyHash branded type (never leaks raw)
│
├── application/
│   ├── ports/
│   │   ├── identity-service.port.ts       # IIdentityService: verifySession / verifyApiKey / createApiKey / revokeApiKey
│   │   ├── user-repository.port.ts        # IUserRepository (findByEmail, save, findById)
│   │   ├── api-key-repository.port.ts     # IApiKeyRepository (findByPrefix, listByUserId, markRevoked)
│   │   └── email.port.ts                  # IEmailPort (send({ to, subject, body }))
│   ├── usecases/
│   │   ├── register-user.usecase.ts
│   │   ├── verify-email.usecase.ts
│   │   ├── request-password-reset.usecase.ts
│   │   ├── reset-password.usecase.ts           # THIS is the AUTH-11 wrap point (if spike shows it's needed)
│   │   ├── create-api-key.usecase.ts           # THIS is AUTH-15 line 1 + D-04 line 2
│   │   ├── list-api-keys.usecase.ts
│   │   └── revoke-api-key.usecase.ts
│   └── dtos/                              # Input/Output DTOs (NOT TypeBox — that's presentation)
│
├── infrastructure/
│   ├── schema/                            # *** GENERATED BY BETTER-AUTH CLI *** (Plan 03-01)
│   │   ├── user.schema.ts
│   │   ├── session.schema.ts
│   │   ├── account.schema.ts
│   │   ├── verification.schema.ts
│   │   └── api-key.schema.ts              # Post-process: add ADR 0014 index on prefix (D-21)
│   ├── better-auth/
│   │   ├── auth-instance.ts               # D-15: PURE better-auth + drizzle-adapter + schema imports (NO elysia)
│   │   └── identity-service.adapter.ts    # Implements IIdentityService; wraps auth.api.*; maps to AuthContext per D-03/D-11
│   ├── repositories/
│   │   ├── drizzle-user.repository.ts
│   │   └── drizzle-api-key.repository.ts
│   ├── mappers/
│   │   ├── user.mapper.ts
│   │   └── api-key.mapper.ts
│   └── email/
│       └── console-email.adapter.ts       # v1: stdout via ILogger; format: `📧 CLICK THIS: <url>` banner
│
└── presentation/
    ├── plugins/
    │   └── auth-context.plugin.ts         # Elysia plugin; .macro({ requireAuth }) at scope:'global'
    ├── controllers/
    │   ├── api-key.controller.ts          # POST / GET / DELETE /api-keys
    │   ├── me.controller.ts               # GET /me (identity introspection)
    │   └── auth.controller.ts             # optional Rigging-wrapped reset-password if spike needs it
    └── dtos/
        ├── create-api-key.dto.ts          # TypeBox; scopes derives from ALLOWED_SCOPES constant (D-05)
        └── list-api-keys.dto.ts
```

### Pattern 1: BetterAuth Instance (D-15 strict decoupling)

**What:** A pure config file that imports only `better-auth` + `@better-auth/drizzle-adapter` + local schema. NO `elysia` import. This is what the BetterAuth CLI reads to generate the schema.

**When to use:** Exactly one file, at `src/auth/infrastructure/better-auth/auth-instance.ts`.

**Example:**
```typescript
// src/auth/infrastructure/better-auth/auth-instance.ts
// Source: [CITED: https://better-auth.com/docs/integrations/elysia + Context7 /better-auth/better-auth]
// IMPORTANT per D-15: NO elysia import here. BetterAuth CLI (`bunx @better-auth/cli generate`)
// parses this file; Elysia imports would break schema-gen per Pitfall #5446.
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { apiKey } from 'better-auth/plugins'
import type { DrizzleDb } from '@/shared/infrastructure/db/client'
import * as schema from '../schema'  // generated by CLI in Plan 03-01

export interface AuthInstanceConfig {
  secret: string        // BETTER_AUTH_SECRET (min 32 chars enforced in config.ts)
  baseURL: string       // BETTER_AUTH_URL (format: uri)
  sendVerificationEmail: (params: { url: string; email: string }) => Promise<void>
  sendResetPassword: (params: { url: string; email: string }) => Promise<void>
}

export function createAuthInstance(db: DrizzleDb, cfg: AuthInstanceConfig) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    secret: cfg.secret,
    baseURL: cfg.baseURL,
    basePath: '/api/auth',                  // D-14
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,       // AUTH-08 extension point; not strict-required in v1
      sendVerificationEmail: cfg.sendVerificationEmail,
      sendResetPassword: cfg.sendResetPassword,
    },
    plugins: [
      apiKey({
        hashing: 'sha256',                   // D-23, explicit per ADR 0014
        // Note: exact BetterAuth apiKey field names verified via Context7
        // https://better-auth.com/docs/plugins/api-key/reference.mdx
      }),
    ],
    rateLimit: {                             // D-16
      enabled: true,
      window: 60,
      max: 100,
      storage: 'memory',
    },
  })
}

export type AuthInstance = ReturnType<typeof createAuthInstance>
```

### Pattern 2: AuthContext Macro (single-root mount, scope global)

**What:** One Elysia plugin, mounted exactly once at the auth module root. `requireAuth` is the opt-in marker. Routes without `{ requireAuth: true }` cannot destructure `ctx.authContext` (it doesn't exist on the type).

**When to use:** Every route touching domain state. Public routes (health, Swagger, BetterAuth handler itself) don't use the macro.

**Example:**
```typescript
// src/auth/presentation/plugins/auth-context.plugin.ts
// Source: [CITED: https://better-auth.com/docs/integrations/elysia Context7 pattern]
import { Elysia, status } from 'elysia'
import type { IIdentityService } from '../../application/ports/identity-service.port'
import type { AuthContext } from '../../domain/auth-context'

export function authContextPlugin(identity: IIdentityService) {
  return new Elysia({ name: 'rigging/auth-context' })
    .macro({
      requireAuth: {
        async resolve({ request: { headers }, status }) {
          // Step 1 — Try x-api-key header (API Key precedence, D-11)
          const rawApiKey = headers.get('x-api-key')
          if (rawApiKey !== null) {
            // D-10: Timing-align malformed-header fast-reject to valid-format path.
            // Implementation detail in IIdentityService.verifyApiKey — it internally:
            //   (a) checks prefix format; if wrong, runs dummy timingSafeEqual + dummy DB SELECT + returns null
            //   (b) if format OK, prefix lookup (indexed) + real timingSafeEqual + revoked/expired check
            const ctx = await identity.verifyApiKey(rawApiKey)
            if (!ctx) return status(401, 'UNAUTHENTICATED')  // D-09 NO fallback to cookie
            return { authContext: ctx satisfies AuthContext }
          }

          // Step 2 — Fallback: cookie session (D-03 human default scopes=['*'])
          const sessionCtx = await identity.verifySession(headers)
          if (!sessionCtx) return status(401, 'UNAUTHENTICATED')
          return { authContext: sessionCtx satisfies AuthContext }
        },
      },
    })
}

// Usage in a controller:
// new Elysia().use(authContextPlugin(identity))
//   .get('/me', ({ authContext }) => authContext, { requireAuth: true })
//                  ↑
//        Without `requireAuth: true`, `authContext` is NOT in scope. TS error.
```

**Scope note:** Elysia 1.4 uses `as: 'global'` for hook broadcast (see `request-logger.plugin.ts` for existing pattern). The macro itself needs to be reachable to feature routes but resolution is per-route; Elysia does this correctly via plugin merge. Do NOT wrap it in `.guard()` — see Pitfall #2 (guard doesn't support derive/resolve — issue #566).

### Pattern 3: IIdentityService Port + BetterAuth Adapter

**What:** Port declares `verifySession` / `verifyApiKey` / `createApiKey` / `revokeApiKey` / `listApiKeys`. Adapter wraps BetterAuth's `auth.api.*` calls and does D-10 timing-alignment internally.

**Port:**
```typescript
// src/auth/application/ports/identity-service.port.ts
import type { AuthContext } from '../../domain/auth-context'
import type { UserId } from '@/shared/kernel/id'

export interface IIdentityService {
  verifySession(headers: Headers): Promise<AuthContext | null>
  verifyApiKey(rawKey: string): Promise<AuthContext | null>
  createApiKey(params: {
    userId: UserId
    label: string
    scopes: ReadonlyArray<string>
    expiresAt: Date
  }): Promise<{ id: string; rawKey: string; prefix: string; createdAt: Date }>
  listApiKeysByUser(userId: UserId): Promise<Array<{ id: string; label: string; prefix: string; scopes: string[]; expiresAt: Date; createdAt: Date; revokedAt: Date | null }>>
  revokeApiKey(id: string, userId: UserId): Promise<void>
}
```

**Adapter:**
```typescript
// src/auth/infrastructure/better-auth/identity-service.adapter.ts
// Source: [CITED: BetterAuth server API docs auth.api.getSession / auth.api.createApiKey / auth.api.listApiKeys]
import { timingSafeEqual, createHash } from 'node:crypto'
import type { IIdentityService } from '../../application/ports/identity-service.port'
import type { AuthContext } from '../../domain/auth-context'
import type { AuthInstance } from './auth-instance'
import type { IApiKeyRepository } from '../../application/ports/api-key-repository.port'
import type { UserId } from '@/shared/kernel/id'

const API_KEY_PREFIX = 'rig_live_'
const PREFIX_INDEX_LEN = 8              // D-21: first 8 chars of prefix are indexed

// Pre-computed dummy buffer for timing-align malformed path (D-10)
const DUMMY_HASH = createHash('sha256').update('dummy').digest()

export class BetterAuthIdentityService implements IIdentityService {
  constructor(
    private readonly auth: AuthInstance,
    private readonly apiKeys: IApiKeyRepository,
  ) {}

  async verifySession(headers: Headers): Promise<AuthContext | null> {
    const result = await this.auth.api.getSession({ headers })
    if (!result) return null
    return {
      userId: result.user.id as UserId,
      identityKind: 'human',
      scopes: ['*'],                     // D-03 human defaults to sudo
      sessionId: result.session.id,
    }
  }

  async verifyApiKey(rawKey: string): Promise<AuthContext | null> {
    // D-10 timing alignment — malformed-path runs ACTUAL dummy ops, not setTimeout
    if (!rawKey.startsWith(API_KEY_PREFIX) || rawKey.length < API_KEY_PREFIX.length + 20) {
      // Dummy timingSafeEqual to match latency profile
      timingSafeEqual(DUMMY_HASH, DUMMY_HASH)
      // Dummy DB SELECT to match I/O profile  — query a prefix that won't match anything
      await this.apiKeys.findByPrefix('xxxxxxxx')
      return null
    }

    const prefix = rawKey.slice(0, PREFIX_INDEX_LEN)
    const row = await this.apiKeys.findByPrefix(prefix)

    if (!row || row.revokedAt !== null || (row.expiresAt && row.expiresAt.getTime() <= Date.now())) {
      // Run dummy timingSafeEqual anyway to keep latency aligned
      timingSafeEqual(DUMMY_HASH, DUMMY_HASH)
      return null
    }

    const computedHash = createHash('sha256').update(rawKey).digest()
    const storedHash = Buffer.from(row.hash, 'hex')
    // CRITICAL: timingSafeEqual throws if lengths differ. Normalize:
    if (computedHash.length !== storedHash.length) {
      timingSafeEqual(DUMMY_HASH, DUMMY_HASH)
      return null
    }
    if (!timingSafeEqual(computedHash, storedHash)) {
      return null
    }

    return {
      userId: row.userId as UserId,
      identityKind: 'agent',
      scopes: row.scopes,
      apiKeyId: row.id,
      // NO sessionId per D-11 — API Key path must not leak cookie into AuthContext
    }
  }

  async createApiKey(params) { /* delegates to auth.api.createApiKey per Context7 */ }
  async listApiKeysByUser(userId) { /* ... */ }
  async revokeApiKey(id, userId) { /* ... */ }
}
```

### Pattern 4: Use Case with Runtime Guards (AUTH-15 + D-04 defense-in-depth)

```typescript
// src/auth/application/usecases/create-api-key.usecase.ts
import type { AuthContext } from '../../domain/auth-context'
import { ForbiddenError } from '../../domain/errors'
import type { IIdentityService } from '../ports/identity-service.port'
import type { IClock } from '@/shared/application/ports/clock.port'

export interface CreateApiKeyInput {
  userId?: string              // optional in body — CVE vector; if present MUST equal ctx.userId
  label: string
  scopes: ReadonlyArray<string>
  expiresAt?: Date
}

export interface CreatedApiKeyDto {
  id: string
  key: string                  // D-20 raw key returned ONCE; never leaked again
  prefix: string
  label: string
  scopes: ReadonlyArray<string>
  expiresAt: Date
  createdAt: Date
}

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

### Pattern 5: Runtime Guard Factory (AUX-05)

```typescript
// src/auth/domain/index.ts
import type { AuthContext } from './auth-context'
import { ApiKeyService } from './internal/api-key-service'
import { AuthContextMissingError } from './internal/authcontext-missing-error'

export { ALLOWED_SCOPES, type Scope, type AuthContext, isAgent, isHuman } from './auth-context'
export { AuthContextMissingError, UserIdMismatchError } from './errors'

// Protected factory — callers MUST supply AuthContext; undefined → throws with teaching message.
// Per Pitfall #1: this is the runtime guard that compensates for Elysia scoped-plugin undefined cascade.
export const getApiKeyService = (ctx: AuthContext) => {
  if (!ctx?.userId) {
    throw new AuthContextMissingError(
      `AuthContext is missing when calling getApiKeyService(ctx).

Reason: Domain services require AuthContext from \`requireAuth: true\` macro.
See docs/decisions/0006-authcontext-boundary.md.

Fix: Declare \`requireAuth: true\` in your route options. Example:
  new Elysia()
    .use(authContextPlugin(identity))
    .get('/api-keys', ({ authContext }) => ..., { requireAuth: true })`
    )
  }
  return new ApiKeyService(ctx)
}

// ApiKeyService class is INTERNAL-ONLY — exported only via the factory.
// Biome rule (P1 D-11) forbids application/presentation layers from importing domain/internal/**.
```

### Anti-Patterns to Avoid

- **Optional AuthContext in use-case signatures** — `execute(ctx: AuthContext | null, ...)` is Anti-Pattern 3 (ARCHITECTURE.md). Always non-optional.
- **Reaching into `auth-instance.ts` from non-auth features** — Phase 4 demo must go through Rigging ports, never `import { auth } from '@/auth/infrastructure/better-auth/auth-instance'` from `src/agents/`.
- **Literal scope strings in DTO schema** — `t.Union([t.Literal('*'), t.Literal('read:*')])` hardcoded is wrong; must `ALLOWED_SCOPES.map(s => t.Literal(s))` per D-05.
- **Fast-rejecting malformed API Key without dummy ops** — violates D-10 timing alignment. Even `return null` before running `timingSafeEqual` / DB SELECT leaks via latency.
- **Falling back to cookie when API Key fails** — violates D-09 `identityKind` must not silently switch.
- **`timingSafeEqual` with different-length buffers** — throws at runtime. ALWAYS normalize to same length first, or return null early with a dummy equal-length compare.
- **Hand-writing BetterAuth schema** — Anti-Pattern 5. Use CLI.
- **Domain `/internal/` reachable outside the barrel** — Biome rule already enforces this from P1 D-11; P3 must not add escape hatches.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| User + session + account + verification table schemas | Hand-written Drizzle schema | `bunx @better-auth/cli generate` per D-17 | BetterAuth schema evolves with plugins/versions; drift → silent crashes (ARCHITECTURE Anti-Pattern 5). |
| Password hashing (sign-up / sign-in) | `bcrypt` / `argon2` npm package | BetterAuth built-in (scrypt) OR Bun.password argon2id if ever needed elsewhere | `bcrypt` native-build pain on Bun/Alpine (Pitfall #14); BetterAuth already covers it. |
| Session cookie issue / read / invalidate | Custom cookie handler | BetterAuth session module | BetterAuth handles HttpOnly + Secure + SameSite + signing; D-18 pins defaults trust. |
| API Key generation + hash | Custom random + hash pipeline | BetterAuth `apiKey({ hashing: 'sha256' })` plugin | Plugin handles `prefix / start / length / hashing` correctly; exposes `auth.api.createApiKey` / `auth.api.verifyApiKey`. Rigging only wraps `POST /api-keys` to enforce AUTH-15 / D-04 / D-20. |
| Rate limiting | Hand-rolled sliding window | BetterAuth built-in `rateLimit` + per-email wrapper use case (D-16) | Covers most surfaces; Pitfall #7 warns /send-verification-email is not covered → per-email wrapper in application layer. |
| Reset-password token issue + validate | Custom token + email + consume | BetterAuth `POST /request-password-reset` + `POST /reset-password` | Token generation + expiry + one-time-use all handled. Only wrap if AUTH-11 session-purge is missing (Plan 03-01 spike). |
| Email verification flow | Custom | BetterAuth `emailVerification` config + `sendVerificationEmail` hook | Token + link + state transition handled; Rigging only provides `IEmailPort` adapter. |
| Session fixation mitigation | Hand-rolled | **(pending spike)** — if 1.6.5 auto-purges, nothing; if not, wrap via `auth.api.revokeSessions` post-reset | BetterAuth's `auth.api.revokeSessions` exists (Context7 verified); simpler than hand-rolled DB DELETE. |
| TypeBox DTO validation | Zod / custom | TypeBox (`t.Object({...})`) | Already Elysia peerDep; validator per project (P1 convention). |

**Key insight:** P3's "don't hand-roll" list is long because BetterAuth is doing 80% of the auth work. Rigging's value-add is **(a) CVE defense-in-depth (AUTH-15 wrap on createApiKey), (b) resolver precedence + timing alignment (D-09/D-10/D-11 encoded in adapter + macro), (c) session-fixation wrap if the spike shows it's needed, and (d) the mandatory AuthContext boundary (macro + Runtime Guard).** Everything else wraps BetterAuth cleanly behind ports.

## Runtime State Inventory

Not applicable — Phase 3 is **greenfield** for the auth feature (no existing auth code to rename/migrate). The `src/auth/` directory will be newly created. No existing data, no existing tasks, no existing secrets to rename.

- **Stored data:** None — no existing auth records; Phase 3 creates first migration.
- **Live service config:** None — BetterAuth is new to the project.
- **OS-registered state:** None — no cron / Task Scheduler entries exist.
- **Secrets / env vars:** `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` already declared in `src/bootstrap/config.ts` (verified, see existing file). `.env.example` may need to add them if not already present — planner should verify and add if missing.
- **Build artifacts:** None — no stale egg-info / `.d.ts` / dist artifacts to rebuild.

## Common Pitfalls

### Pitfall 1: Macro `resolve` returns on wrong path, handler still fires with undefined AuthContext
**What goes wrong:** Elysia's macro `resolve` documentation pattern in some sources shows `if (!session) return status(401)` then `return { user, session }` — but if the resolver forgets to return on the error path, the handler fires and destructures `undefined`.
**Why it happens:** Two-line `if/return` → developer adds debug log → forgets the `return`.
**How to avoid:** Always wrap error paths in explicit `return status(401, 'UNAUTHENTICATED')`. `bun test` integration test `AUX-06` (unmounted auth plugin → 401 everywhere) catches this in CI.
**Warning signs:** Handler signature `({ authContext }: { authContext: AuthContext | undefined })` — if TS narrows to `undefined`, macro is broken. Should always narrow to `AuthContext`.

### Pitfall 2: Running `bunx @better-auth/cli generate` while `auth-instance.ts` imports elysia (#5446)
**What goes wrong:** CLI tries to load the config file; because `elysia` is imported transitively, the CLI bootstrap fails with "Couldn't read your auth config" or a stack dump.
**Why it happens:** Historically `src/auth/infrastructure/better-auth/index.ts` was co-located with the Elysia mount code.
**How to avoid:** D-15 hard rule — `auth-instance.ts` must ONLY import `better-auth`, `@better-auth/drizzle-adapter`, and local `./schema`. Pitfall #5446 mitigation.
**Warning signs:** `bunx @better-auth/cli generate` exits non-zero in CI. Fallback (Plan 03-01): pin BetterAuth 1.5.x or hand-author minimal schema (last-resort, open an upstream issue + new ADR).

### Pitfall 3: Hitting `timingSafeEqual(a, b)` with mismatched-length buffers
**What goes wrong:** Node's `crypto.timingSafeEqual` throws `RangeError` if `a.byteLength !== b.byteLength`. This can accidentally leak "length difference exists" via the exception path.
**Why it happens:** Computed SHA-256 hash is 32 bytes; a corrupted row in DB is 30 bytes; compare throws.
**How to avoid:** Pre-check `computedHash.length === storedHash.length`; if not, run a dummy equal-length `timingSafeEqual(DUMMY_HASH, DUMMY_HASH)` and return null. See Pattern 3 adapter code.
**Warning signs:** Any `timingSafeEqual` call without a preceding length check.

### Pitfall 4: D-09 fallback-to-cookie slip
**What goes wrong:** Developer writes `if (apiKey && await verifyApiKey(apiKey)) { ... } else { fallbackToCookie }` — exactly what D-09 forbids. An invalid API Key now silently promotes to human cookie identity.
**Why it happens:** "Try everything" is the path of least resistance. `else` feels natural.
**How to avoid:** Macro resolver Step 1 MUST `return status(401)` on API Key failure; only absent (`headers.get('x-api-key') === null`) falls through. Integration test: valid cookie + invalid API Key → 401 (not 200).
**Warning signs:** Any `else` branch in the API Key check path. Should be strict `if present: verify-or-401; if absent: check cookie`.

### Pitfall 5: CVE-2025-61928 — trusting BetterAuth internal session check alone
**What goes wrong:** Rigging's `CreateApiKeyUseCase` passes `input.userId` straight through to `auth.api.createApiKey({ body: { userId: input.userId } })`. A past BetterAuth bug (patched in 1.3.26 but class remains) allowed this without session match.
**Why it happens:** "BetterAuth validates the session — I don't need to check again." Defense-in-depth rejected by the "one check is enough" fallacy.
**How to avoid:** FIRST line of `execute`: `if (input.userId && input.userId !== ctx.userId) throw new ForbiddenError('USER_ID_MISMATCH')`. Never pass `input.userId` to BetterAuth — use `ctx.userId` (the resolver-derived value) directly.
**Warning signs:** Any use case body where `input.userId` flows to infrastructure without explicit compare to `ctx.userId`. CVE regression test must fail if this line is removed.

### Pitfall 6: Session fixation on reset-password (token flow)
**What goes wrong:** Attacker steals session → victim requests password reset → victim sets new password → attacker's session still valid.
**Why it happens:** Context7-verified: BetterAuth `POST /reset-password` (token flow) does NOT expose `revokeOtherSessions` option. Only the authenticated `/change-password` endpoint does. If 1.6.5 internally does it, not explicitly documented.
**How to avoid:** Plan 03-01 SPIKE verifies behavior. Two scenarios:
- Scenario A (BetterAuth 1.6.5 auto-purges on reset): Ship `AUTH-11` integration test; no additional code needed.
- Scenario B (BetterAuth 1.6.5 does NOT purge): Rigging adds `ResetPasswordUseCase` that calls `auth.api.resetPassword(...)` then `auth.api.revokeSessions({ headers: ... })` OR uses BetterAuth hook (`emailAndPassword.onAfterResetPassword` if supported — verify in spike).
**Warning signs:** AUTH-11 integration test red. Two-session test (sessions A + B, reset on B, A expected 401) is the canonical check.

### Pitfall 7: `/send-verification-email` rate-limit gap (#2112)
**What goes wrong:** BetterAuth's built-in rate-limit doesn't cover `/send-verification-email` (GitHub #2112 — still open as of research date). An attacker can spam a user's inbox unboundedly.
**Why it happens:** Built-in `rateLimit.enabled: true` feels "done".
**How to avoid:** Per-email wrapper in application layer (D-16). Wrap `RegisterUserUseCase` + `RequestVerificationEmailUseCase` in use case that records last-send-at per email; within 10s → 429. Memory store acceptable for v1.
**Warning signs:** Integration test: 10 POSTs to verification endpoint in 1 minute → all 200 (should be some 429).

### Pitfall 8: BetterAuth version caret-pinned
**What goes wrong:** `package.json` has `"better-auth": "^1.6.5"` — auto-upgrades across minors. CVE-class bugs can arrive. Rigging's wrapper code might also break on unexpected API changes.
**Why it happens:** `bun add` default.
**How to avoid:** P1 already pinned exact `1.6.5` (verified in `package.json`). P3 must not change to caret. If upgrade is desired, ADR documents the version bump explicitly.
**Warning signs:** `grep '"better-auth":' package.json` shows `^` prefix.

### Pitfall 9: Harness-teaching error messages missing
**What goes wrong:** `AuthContextMissingError` thrown with message "AuthContext is missing" — agent sees stack trace, can't fix.
**Why it happens:** Error class constructor takes `message: string` default, developer passes minimal value.
**How to avoid:** Per Pitfall #11 + P1 D-12 four-section format (what / why / ADR link / minimal fix example). See Pattern 5 code.
**Warning signs:** Any `new AuthContextMissingError()` or `new AuthContextMissingError('missing ctx')` — must be the full teaching message.

### Pitfall 10: Integration test mocks `IIdentityService` instead of injecting real adapter with fake DB
**What goes wrong:** `AUX-06` test mocks the port → doesn't actually test the plugin wiring. If macro is misordered or resolver is broken, mock passes and bug ships.
**Why it happens:** Mocking is faster than setting up a fake DB.
**How to avoid:** Integration tests use `createApp(testConfig, { db: fakeDb, authInstance: realAuth })` — same pattern as existing P2 Plan 02-03 (real createApp + fake probe). See **Specific Ideas** §CVE regression test in CONTEXT.md — tests hit real Elysia chain.
**Warning signs:** Test file imports `vi.mock('...ports/identity-service.port')` — wrong level. Should construct a real adapter + fake DB + real BetterAuth instance against test Postgres or in-memory stub.

## Code Examples

### Example 1: `createAuthModule` factory (ARCHITECTURE Pattern 5)

```typescript
// src/auth/auth.module.ts
// Source: [CITED: ARCHITECTURE.md Pattern 5 + P2 createHealthModule template]
import { Elysia } from 'elysia'
import { createAuthInstance, type AuthInstance } from './infrastructure/better-auth/auth-instance'
import { BetterAuthIdentityService } from './infrastructure/better-auth/identity-service.adapter'
import { DrizzleApiKeyRepository } from './infrastructure/repositories/drizzle-api-key.repository'
import { DrizzleUserRepository } from './infrastructure/repositories/drizzle-user.repository'
import { ConsoleEmailAdapter } from './infrastructure/email/console-email.adapter'
import { CreateApiKeyUseCase } from './application/usecases/create-api-key.usecase'
import { ListApiKeysUseCase } from './application/usecases/list-api-keys.usecase'
import { RevokeApiKeyUseCase } from './application/usecases/revoke-api-key.usecase'
import { authContextPlugin } from './presentation/plugins/auth-context.plugin'
import { apiKeyController } from './presentation/controllers/api-key.controller'
import { meController } from './presentation/controllers/me.controller'
import type { DrizzleDb } from '@/shared/infrastructure/db/client'
import type { Logger } from 'pino'
import type { Config } from '@/bootstrap/config'

export interface AuthModuleDeps {
  db: DrizzleDb
  logger: Logger
  config: Pick<Config, 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL'>
  clock?: { now: () => Date }
  authInstance?: AuthInstance           // test override (#5446 mitigation + atomicity verification)
}

export function createAuthModule(deps: AuthModuleDeps) {
  const clock = deps.clock ?? { now: () => new Date() }
  const emailPort = new ConsoleEmailAdapter(deps.logger)

  const auth = deps.authInstance ?? createAuthInstance(deps.db, {
    secret: deps.config.BETTER_AUTH_SECRET,
    baseURL: deps.config.BETTER_AUTH_URL,
    sendVerificationEmail: (params) => emailPort.send({
      to: params.email,
      subject: 'Verify your email',
      body: `📧 CLICK THIS: ${params.url}`,
    }),
    sendResetPassword: (params) => emailPort.send({
      to: params.email,
      subject: 'Reset your password',
      body: `📧 CLICK THIS: ${params.url}`,
    }),
  })

  const userRepo = new DrizzleUserRepository(deps.db)
  const apiKeyRepo = new DrizzleApiKeyRepository(deps.db)
  const identity = new BetterAuthIdentityService(auth, apiKeyRepo)

  const createApiKey = new CreateApiKeyUseCase(identity, clock)
  const listApiKeys = new ListApiKeysUseCase(identity)
  const revokeApiKey = new RevokeApiKeyUseCase(identity)

  return new Elysia({ name: 'rigging/auth' })
    .mount('/api/auth', auth.handler)                   // D-14
    .use(authContextPlugin(identity))                   // macro scope:global — AUX-02
    .use(apiKeyController({ createApiKey, listApiKeys, revokeApiKey }))
    .use(meController())
}
```

### Example 2: `createApp` integration point

```typescript
// src/bootstrap/app.ts — P3 patch
// ... P2 existing imports ...
import { createAuthModule } from '../auth/auth.module'
import type { AuthInstance } from '../auth/infrastructure/better-auth/auth-instance'

export interface AppDeps {
  db?: DrizzleDb
  probe?: IDbHealthProbe
  authInstance?: AuthInstance            // NEW for P3 per CONTEXT code_context
}

export function createApp(config: Config, deps: AppDeps = {}) {
  const logger = createPinoLogger({ ... })
  const db = deps.db ?? createDbClient({ DATABASE_URL: config.DATABASE_URL }).db
  const healthDeps: HealthModuleDeps = deps.probe ? { db, probe: deps.probe } : { db }

  const authDeps = deps.authInstance
    ? { db, logger, config, authInstance: deps.authInstance }
    : { db, logger, config }

  return new Elysia({ name: 'rigging/app' })
    .use(requestLoggerPlugin(logger))
    .use(corsPlugin())
    .use(errorHandlerPlugin(logger))
    .use(swaggerPlugin())
    .use(createAuthModule(authDeps))                    // NEW: before health per CONTEXT code_context
    .use(createHealthModule(healthDeps))
}
```

### Example 3: CVE-2025-61928 regression test (verbatim shape per CONTEXT specifics)

```typescript
// tests/integration/auth/cve-2025-61928.regression.test.ts
import { describe, it, expect } from 'bun:test'
import { createApp } from '@/bootstrap/app'
import { loadTestConfig, fakeDb, realAuthForTest, createTestUser } from '../_helpers'

describe('CVE-2025-61928 regression (Pitfall #3)', () => {
  it('unauthenticated POST /api-keys with body.userId returns 401 and creates no key', async () => {
    const app = createApp(loadTestConfig(), { db: fakeDb, authInstance: realAuthForTest })
    const victim = await createTestUser(fakeDb, 'victim@example.com')

    const res = await app.handle(
      new Request('http://localhost/api-keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },   // NO Authorization / cookie / x-api-key
        body: JSON.stringify({ userId: victim.id, label: 'attacker-key' }),
      })
    )

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
        requestId: expect.any(String),
      },
    })

    // Critical: verify no key was created
    const keys = await fakeDb.select().from(apiKeys).where(eq(apiKeys.userId, victim.id))
    expect(keys).toHaveLength(0)
  })

  it('authenticated user cannot create API key for another user via body.userId', async () => {
    const app = createApp(loadTestConfig(), { db: fakeDb, authInstance: realAuthForTest })
    const attacker = await createTestUser(fakeDb, 'attacker@example.com')
    const victim = await createTestUser(fakeDb, 'victim@example.com')
    const attackerCookie = await signInAndGetCookie(app, attacker)

    const res = await app.handle(
      new Request('http://localhost/api-keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: attackerCookie },
        body: JSON.stringify({ userId: victim.id, label: 'lateral-movement' }),
      })
    )

    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: { code: 'USER_ID_MISMATCH' } })

    const victimKeys = await fakeDb.select().from(apiKeys).where(eq(apiKeys.userId, victim.id))
    expect(victimKeys).toHaveLength(0)
  })
})
```

### Example 4: AUX-06 — unmounted-auth-plugin regression

```typescript
// tests/integration/auth/authcontext-missing.regression.test.ts
import { describe, it, expect } from 'bun:test'
import { Elysia } from 'elysia'
import { createHealthModule } from '@/health/health.module'
// Deliberately do NOT import createAuthModule

describe('Pitfall #3: app without auth plugin returns 401 on protected routes, not 500', () => {
  it('POST /api-keys returns 401 (macro unregistered ⇒ route unregistered ⇒ 404/501 accepted)', async () => {
    // When authModule is NOT mounted, the /api-keys routes literally don't exist.
    // The assertion is "NOT 500, NOT unauthorized data leak". 404 is acceptable.
    const appWithoutAuth = new Elysia().use(createHealthModule({ db: fakeDb }))
    const res = await appWithoutAuth.handle(
      new Request('http://localhost/api-keys', { method: 'GET' })
    )
    expect([401, 404, 501]).toContain(res.status)
    expect(res.status).not.toBe(500)
    const body = await res.json().catch(() => null)
    // Must not contain any user data / key data
    expect(JSON.stringify(body ?? {})).not.toMatch(/userId|email|rig_live_/)
  })

  it('runtime Runtime Guard: getApiKeyService(undefined) throws with teaching message', () => {
    const { getApiKeyService } = require('@/auth/domain')
    expect(() => getApiKeyService(undefined)).toThrow(/AuthContext is missing/)
    expect(() => getApiKeyService(undefined)).toThrow(/Fix: Declare `requireAuth: true`/)
  })
})
```

### Example 5: AUX-07 — precedence verification

```typescript
// tests/integration/auth/resolver-precedence.regression.test.ts
it('API Key + cookie simultaneous ⇒ identityKind === "agent", no sessionId', async () => {
  const app = createApp(testConfig, { db: fakeDb, authInstance: realAuthForTest })
  const user = await createTestUser(fakeDb, 'dual@example.com')
  const cookie = await signInAndGetCookie(app, user)
  const rawKey = await createApiKeyForUser(fakeDb, user, { scopes: ['*'] })

  const res = await app.handle(
    new Request('http://localhost/me', {
      headers: { cookie, 'x-api-key': rawKey },
    })
  )

  expect(res.status).toBe(200)
  const ctx = await res.json()
  expect(ctx.identityKind).toBe('agent')              // D-11 precedence
  expect(ctx.apiKeyId).toBeDefined()
  expect(ctx.sessionId).toBeUndefined()               // D-11: no sessionId on API Key path
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Lucia Auth | BetterAuth | Late 2024 (Lucia entered maintenance) | Rigging chose BetterAuth in ADR 0004. |
| `bcrypt` npm | `Bun.password` (argon2id) OR BetterAuth built-in scrypt | Bun 0.6.8+ | `bcrypt` native-build pain on Bun/Alpine (Pitfall #14) avoided entirely. |
| JWT for session | HttpOnly + Signed cookie (BetterAuth) | 2024+ industry shift | BetterAuth manages session state server-side; JWT only where stateless required. |
| `.derive({ as: 'global' })` for auth | `.macro({ requireAuth: { resolve } })` | Elysia 1.0+ | Macro gives opt-in type-level signal; `.derive` forces ctx on every route. |
| Elysia < 1.4 `.mount()` | Elysia 1.4+ `.mount()` with Set-Cookie preservation | Elysia 1.4.0 | Enables BetterAuth session cookie flow via `.mount(auth.handler)`. |
| `db.execute(sql\`SELECT 1 WHERE hash = ...\`)` for API key lookup | Prefix-indexed lookup + `timingSafeEqual(hash)` | Google Cloud API Key best practices | O(log n) prefix index; constant-time hash compare. D-21 encodes. |

**Deprecated / outdated:**
- Lucia Auth: maintenance mode. Do not reach for it even in a comparative discussion.
- `bcrypt` / `bcryptjs`: Pitfall #14. Use Bun built-ins or BetterAuth defaults.
- `drizzle-orm/bun-sql`: Pitfall #5. Use `drizzle-orm/postgres-js` (already ADR 0010).
- `@elysiajs/jwt` as auth primary: Not needed — BetterAuth sessions cover v1 (D-13 no bearer plugin).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | BetterAuth 1.6.5 `POST /reset-password` (token flow) does NOT auto-revoke other sessions | Pitfall 6 / AUTH-11 | Plan 03-01 spike must confirm. If wrong (it DOES auto-revoke), the wrap code is unnecessary — delete it and ship the integration test only. Low risk (strictly additive safety). |
| A2 | Plan 03-01 spike will succeed with BetterAuth CLI schema-gen (#5446 either resolved or D-15 decoupling is sufficient workaround) | Pitfall 2 / D-17 | If CLI fails outright, fallback is pin BetterAuth 1.5.x minor OR hand-author minimal schema. Medium risk. Documented as spike exit path. |
| A3 | Node `crypto.timingSafeEqual` works as expected on Bun 1.3.12 | Pattern 3 | Bun 1.3 claims full `node:crypto` compat; verified by Context7. Low risk. |
| A4 | Drizzle `0.45.2` + `drizzle-kit 0.31.10` correctly scan `./src/**/infrastructure/schema/*.ts` and generate migration for BetterAuth-generated schema files | D-17 | Already verified P2 config (`drizzle.config.ts` glob works for `src/health/infrastructure/schema/*.ts` — no schema files there yet but glob compiles). Low risk. |
| A5 | BetterAuth `apiKey` plugin accepts `hashing: 'sha256'` as documented (D-23) | Pattern 1 | Context7 confirms `disableKeyHashing` exists; `hashing: 'sha256'` is the documented non-disable path. Low risk. |
| A6 | The `postgres-js` driver shares single `db` instance between BetterAuth drizzle-adapter + feature repositories without transaction-boundary issues | Architecture diagram | Standard Drizzle + postgres-js pattern; both consume same underlying client. Low risk but integration test confirms. |
| A7 | `identityKind` can be distinguished purely by "was validated via API Key path" (not by prefix string inspection) — per D-19 | Pattern 3 | This is a Rigging architectural choice, not a BetterAuth fact. Low risk but locked by D-19. |
| A8 | Scope `['*']` auto-grants any future scope (D-07 "永等 catch-all" semantics) | Scope design | This is a v1 Rigging decision; v2 may need force-rotate migration. Locked per D-07; consequence documented. |

**Net:** Most HIGH-confidence claims cite Context7 / official docs or existing P1/P2 code. Two MEDIUM-risk items (A1, A2) are explicitly the targets of the Plan 03-01 spike.

## Open Questions

### Q1: Should BetterAuth `apiKey` plugin's `prefix` config be set, or do we generate prefix manually?
- What we know: BetterAuth `apiKey()` plugin accepts `prefix` config; D-19 locks `rig_live_` as the required format.
- What's unclear: Does setting `apiKey({ prefix: 'rig_live_' })` make BetterAuth generate `rig_live_<43-chars>` natively, or must Rigging generate the raw key and pass it in?
- Recommendation: Plan 03-01 spike verifies via one-shot `auth.api.createApiKey({ body: { prefix: 'rig_live_' } })` call; if generated key starts with `rig_live_`, done. If not, Rigging wraps the create endpoint to prepend prefix manually. Low-risk either way.

### Q2: Will BetterAuth `apiKey` plugin's built-in `permissions: {...}` conflict with Rigging's `scopes: string[]` shape (D-01/D-04)?
- What we know: Context7 shows `auth.api.verifyApiKey({ body: { key, permissions: { ... } } })` takes object-shaped permissions; Rigging wants flat string array.
- What's unclear: Does BetterAuth store `permissions` in its own schema field, or can Rigging store `scopes` in a sibling column via schema extension?
- Recommendation: Plan 03-01 spike. Easiest path: use BetterAuth's metadata field (verified in Context7 `enableMetadata: true`) to store `{ scopes: ['*'] }`. Rigging's port `findByPrefix` reads from metadata. Rigging doesn't use BetterAuth's built-in `permissions` verify — Rigging's resolver does its own check per D-02 (use-case-layer scope check).

### Q3: When exactly does `auth.api.createApiKey` return the raw key plaintext?
- What we know: Context7 confirms response contains `{ key: '<raw>', ApiKey: {...} }` (see Reference docs).
- What's unclear: Is `key` the full `rig_live_<suffix>` or just the suffix? Is it returned once only (server does not log/persist raw)?
- Recommendation: Plan 03-01 spike. Test: create key; inspect response; query DB to verify only hash stored.

### Q4: Rate-limit hit log format — does BetterAuth expose a hook for rate-limit events, or must we sample DB table?
- What we know: BetterAuth `rateLimit.storage: 'memory'` documented; in-process Map.
- What's unclear: Is there an `onRateLimit` hook or do we attach via Elysia `.onError` catching 429?
- Recommendation: Defer to planner — executor checks BetterAuth config surface; if hook exists, use it; otherwise `.onError` catching the 429 response and emitting `log.warn({ event: 'rate_limit_hit', ... })` in the error-handler plugin works as a fallback (D-16 acceptable).

### Q5: AUTH-08 "未驗證 email 之使用者嘗試特定受保護操作時回 403" — concrete endpoint list for v1?
- What we know: CONTEXT deferred this to v1 extension point only — interface hook exists but no wire-up.
- What's unclear: Which exact routes should enforce `requireEmailVerified` check in v1? None? `/api-keys`? `/me`?
- Recommendation: None in v1 — ship the use-case-layer hook pattern (`if (!user.emailVerified) throw ForbiddenError('EMAIL_NOT_VERIFIED')`) but don't wire it to any route. P4 demo domain or v2 decides concrete routes.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun runtime | All plans | ✓ | 1.3.12 (per ADR 0001 pin) | — |
| PostgreSQL 16 | D-17 migration + integration tests | ✓ (via docker-compose, provisioned P1) | 16-alpine | testcontainers in P5; P3 uses running docker-compose DB |
| better-auth | Plans 03-02, 03-03, 03-04 | ✓ | 1.6.5 `[VERIFIED: node_modules]` | — |
| @better-auth/drizzle-adapter | 03-01, 03-02 | ✓ | 1.6.5 `[VERIFIED: node_modules]` | — |
| @better-auth/cli | 03-01 (schema generation) | Via `bunx @better-auth/cli generate` (auto-fetched by bunx; no install required) | CLI version tracks better-auth core | If bunx fails (Pitfall #5446), pin to specific BetterAuth minor and retry; last-resort: manual schema + new ADR |
| drizzle-kit | 03-01 (migration generation) | ✓ | 0.31.10 | — |
| node:crypto (timingSafeEqual, randomBytes, createHash) | Pattern 3 adapter | ✓ (Bun built-in via `node:crypto` compat layer) | Bun 1.3 compat | — |
| Drizzle schema scan glob | 03-01 (`drizzle.config.ts`) | ✓ (already configured: `./src/**/infrastructure/schema/*.ts`) | — | — |

**Missing dependencies with no fallback:** None — all P3 runtime dependencies installed or available via bunx.

**Missing dependencies with fallback:** BetterAuth CLI — `bunx` fetches on demand; if unavailable (offline CI), executor must `bun add -D @better-auth/cli` as an ephemeral workaround.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `bun:test` (built-in, `@types/bun` 1.2+) |
| Config file | None (convention-only — Bun picks up `tests/**/*.test.ts`) |
| Quick run command | `bun test tests/unit/auth` (unit only — <10s) |
| Full suite command | `bun test` (unit + contract + integration — full phase gate) |
| Regression subset | `bun test tests/integration/auth/*.regression.test.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Register via email + password | integration | `bun test tests/integration/auth/register.test.ts` | ❌ Plan 03-03/04 |
| AUTH-02 | Sign in + cookie persistence | integration | `bun test tests/integration/auth/signin.test.ts` | ❌ Plan 03-04 |
| AUTH-03 | Sign out invalidates session | integration | `bun test tests/integration/auth/signout.test.ts` | ❌ Plan 03-04 |
| AUTH-04 | Password hashed (not plaintext) | integration | `bun test tests/integration/auth/password-hash.test.ts` | ❌ Plan 03-04 |
| AUTH-05 | BetterAuth schema committed + migration green | contract | `bun test:contract tests/contract/drizzle-schema.contract.test.ts` | ❌ Plan 03-01 |
| AUTH-06/07 | Email verification flow | integration | `bun test tests/integration/auth/email-verification.test.ts` | ❌ Plan 03-04 |
| AUTH-08 | Unverified-email protected op → 403 | unit + integration | `bun test tests/unit/auth/application/usecases/*email-verified*` | ❌ Plan 03-03 (hook only) |
| AUTH-09/10 | Password reset flow | integration | `bun test tests/integration/auth/password-reset.test.ts` | ❌ Plan 03-04 |
| AUTH-11 | Password reset invalidates other sessions | regression | `bun test tests/integration/auth/session-fixation.regression.test.ts` | ❌ Plan 03-04 (spike 03-01 decides impl path) |
| AUTH-12 | Create API Key returns one-time plaintext | integration | `bun test tests/integration/auth/api-key-crud.test.ts` | ❌ Plan 03-04 |
| AUTH-13 | API Key stored as hash (DB grep) | regression | `bun test tests/integration/auth/api-key-hashed.regression.test.ts` | ❌ Plan 03-04 |
| AUTH-14 | List + revoke API Key | integration | `bun test tests/integration/auth/api-key-crud.test.ts` | ❌ Plan 03-04 |
| AUTH-15 | CVE-2025-61928: body.userId mismatch → 403 | regression | `bun test tests/integration/auth/cve-2025-61928.regression.test.ts` | ❌ Plan 03-04 |
| AUTH-16 | Scopes + expiresAt default 90d | unit | `bun test tests/unit/auth/application/usecases/create-api-key.usecase.test.ts` | ❌ Plan 03-03 |
| AUX-01 | AuthContext shape correct | unit | `bun test tests/unit/auth/domain/auth-context.test.ts` | ❌ Plan 03-02 |
| AUX-02 | Macro single-root + scope:global | integration | `bun test tests/integration/auth/macro-scope.test.ts` | ❌ Plan 03-04 |
| AUX-03 | Resolver precedence API Key > cookie | regression | `bun test tests/integration/auth/resolver-precedence.regression.test.ts` | ❌ Plan 03-04 |
| AUX-04 | timingSafeEqual used for API Key | unit + regression | `bun test tests/unit/auth/infrastructure/identity-service.adapter.test.ts` + `tests/integration/auth/timing.regression.test.ts` | ❌ Plan 03-03 / 03-05 |
| AUX-05 | Factory throws AuthContextMissingError with teaching message | unit | `bun test tests/unit/auth/domain/get-api-key-service.test.ts` | ❌ Plan 03-02 |
| AUX-06 | App without auth plugin → 401 everywhere | regression | `bun test tests/integration/auth/authcontext-missing.regression.test.ts` | ❌ Plan 03-04 |
| AUX-07 | API Key + cookie ⇒ identityKind=agent, no sessionId | regression | `bun test tests/integration/auth/resolver-precedence.regression.test.ts` (same file as AUX-03) | ❌ Plan 03-04 |

### Sampling Rate

- **Per task commit:** `bun test tests/unit/auth` (unit for the file(s) touched — <10s)
- **Per plan merge:** `bun test tests/unit/auth tests/integration/auth` (full auth feature — ~30s with fake DB)
- **Phase gate:** `bun test` (all tests, including P1/P2 existing — confirms no regression)

### Wave 0 Gaps

- [ ] `tests/unit/auth/domain/*.test.ts` — AuthContext shape + Runtime Guard factory + ALLOWED_SCOPES; introduced in Plan 03-02
- [ ] `tests/unit/auth/application/usecases/create-api-key.usecase.test.ts` — AUTH-15 guard line; AUTH-16 default expiresAt; D-04 subset check; introduced in Plan 03-03
- [ ] `tests/unit/auth/infrastructure/identity-service.adapter.test.ts` — verifyApiKey timing-align path + hash compare edge cases; introduced in Plan 03-03
- [ ] `tests/integration/auth/` — entire directory; introduced in Plan 03-04
- [ ] `tests/integration/auth/_helpers.ts` — shared fixtures: `fakeDb`, `realAuthForTest`, `createTestUser`, `signInAndGetCookie`, `createApiKeyForUser`; introduced in Plan 03-04
- [ ] Fake DB strategy — BetterAuth drizzle-adapter requires a real Drizzle DB interface. Options: (a) PGLite in-memory; (b) testcontainers Postgres 16-alpine (preferred for parity with CI); (c) docker-compose'd Postgres (local dev). Plan 03-04 decides: **preferred = PGLite (`@electric-sql/pglite`) in-memory for test speed**; if PGLite drizzle-adapter incompat, fall back to testcontainers.
- [ ] `tests/contract/drizzle-schema.contract.test.ts` — verifies `drizzle-kit generate --name=ci-drift` produces no new migration (schema synced); extension of existing Wave 0 contract tests from P1.
- [ ] Framework install: `bun test` already configured in P1; no new install.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | BetterAuth `emailAndPassword` (scrypt hashing); AUTH-01..10 |
| V3 Session Management | yes | BetterAuth session cookie (HttpOnly + Secure[prod] + SameSite=Lax) per D-18; session-on-reset purge (AUTH-11) |
| V4 Access Control | yes | AuthContext.scopes (D-01/D-02/D-04); AUTH-15 `body.userId === ctx.userId`; requireAuth macro (AUX-02) |
| V5 Input Validation | yes | TypeBox on every DTO boundary; `ALLOWED_SCOPES` literal union (D-05); `label` min/max (D-25); `expiresAt` format:'date-time' (D-22) |
| V6 Cryptography | yes | BetterAuth scrypt for password; `apiKey({ hashing: 'sha256' })` for API key at-rest (D-23); `crypto.timingSafeEqual` for verify (AUX-04); never hand-roll |
| V7 Error Handling + Logging | yes | Generic 401 body (D-12); pino redact for authorization / cookie / x-api-key / set-cookie (already P2 D-11); log.warn on rate-limit (D-16); 4xx no stack |
| V8 Data Protection | yes | Raw API Key returned once only (D-20); soft-delete revocation (D-24); prefix index + hash storage (D-21) |
| V9 Communication | partial | HTTPS assumption documented; v1 dev HTTP OK per D-18 (Secure auto-off) |
| V11 Business Logic | yes | Per-email rate-limit wrap for `/send-verification-email` (D-16 / Pitfall #7); 10s re-send cooldown |

### Known Threat Patterns for BetterAuth + Elysia + Drizzle stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CVE-2025-61928 class: unauth POST /api-keys `{ body.userId }` | Elevation of Privilege | Rigging wraps `POST /api-keys`; first line of `CreateApiKeyUseCase.execute` enforces `body.userId === ctx.userId` |
| Session fixation on reset-password (Pitfall #6) | Spoofing | Spike-verified behavior; wrap reset via `auth.api.revokeSessions` if 1.6.5 doesn't auto-purge (AUTH-11) |
| Enumeration via auth error detail | Information Disclosure | All 401 → generic body (D-12); log detail server-side only |
| Timing attack on API Key verify | Information Disclosure | `timingSafeEqual` (AUX-04); D-10 malformed-header timing alignment via dummy ops |
| API Key plaintext leak via logs | Information Disclosure | pino redact paths include `x-api-key` (already P2 D-11); ensure no other log source prints raw |
| Rate-limit bypass via IP rotation on /send-verification-email | DoS / Spam | Per-email wrapper (D-16); 10s cooldown per email address, memory store v1 |
| Mixed cookie+API Key identity confusion | Spoofing | D-11 API Key precedence; AuthContext has NO sessionId when API Key path used |
| Scope escalation via API Key creation | Elevation of Privilege | D-04 subset check at creation (SCOPE_NOT_SUBSET 403); D-02 use-case scope guard at read-time |
| SQL injection via Drizzle | Tampering | Drizzle parameterizes by default; no raw SQL concatenation in repositories |
| Replay attack on reset token | Spoofing | BetterAuth token one-time-use (confirmed via docs); AUTH-10 integration test validates second use → 400/401 |

## Sources

### Primary (HIGH confidence)

- `[VERIFIED: node_modules]` — `better-auth@1.6.5`, `@better-auth/drizzle-adapter@1.6.5`, `elysia@1.4.28`, `drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`, `postgres@3.4.9`, `@sinclair/typebox@0.34.49`
- `[VERIFIED: bun pm ls]` — All P3 runtime dependencies installed
- Context7 `/better-auth/better-auth` — BetterAuth CLI `generate` command, drizzle adapter pattern, apiKey plugin config (hashing/prefix/rateLimit/enableMetadata), `auth.api.getSession` / `auth.api.createApiKey` / `auth.api.verifyApiKey` / `auth.api.changePassword` / `auth.api.revokeSessions`, `POST /reset-password` (token flow — NO revokeOtherSessions option)
- `[CITED: https://better-auth.com/docs/integrations/elysia]` — Canonical `.mount(auth.handler) + .macro({ auth: { resolve } })` pattern
- `[CITED: https://better-auth.com/docs/adapters/drizzle]` — `drizzleAdapter(db, { provider: "pg", schema })`
- `[CITED: https://better-auth.com/docs/plugins/api-key]` — apiKey plugin + `apiKey({ hashing: 'sha256' })` config
- `[CITED: https://zeropath.com/blog/breaking-authentication-unauthenticated-api-key-creation-in-better-auth-cve-2025-61928]` — CVE write-up
- Existing Rigging source (P1/P2) — `src/shared/kernel/errors.ts` (DomainError hierarchy), `src/shared/kernel/id.ts` (UserId brand), `src/bootstrap/app.ts` (createApp shape), `src/shared/infrastructure/db/client.ts` (postgres-js + Drizzle), `biome.json` (Biome DDD overrides), `drizzle.config.ts` (schema scan glob)

### Secondary (MEDIUM confidence)

- `.planning/research/ARCHITECTURE.md` — Pattern 1 (macro), Pattern 2 (AuthContext shape), Pattern 3 (Use Case), Pattern 5 (Feature Module Factory), Anti-Patterns 1-6
- `.planning/research/STACK.md` — Integration pattern section; What NOT to Use; version compat matrix
- `.planning/research/PITFALLS.md` — 15 pitfalls; #1 / #2 / #3 / #4 / #5446 / #6 / #7 / #11 / #13 / #14 directly relevant
- `.planning/research/SUMMARY.md` §Phase 3 — Delivers / Addresses / Avoids
- `.planning/research/FEATURES.md` — must-have vs defer confirmation (OAuth/2FA deferred)

### Tertiary (LOW confidence — requires Plan 03-01 spike verification)

- BetterAuth CLI × Elysia 1.4.28 schema-gen compatibility (`#5446` still open per P1/P2 research) — spike verifies via actual invocation
- BetterAuth 1.6.5 `POST /reset-password` internal session-revoke behavior — spike verifies via 2-session integration test
- BetterAuth `apiKey` plugin's `prefix` config semantics (Q1) — spike verifies via one-shot create + response inspection
- BetterAuth `apiKey` plugin's `permissions: object` vs Rigging's `scopes: string[]` mapping (Q2) — spike decides: use `metadata` field for scopes; don't use built-in permissions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via `node_modules` and `bun pm ls`; Context7 confirms API shapes.
- Architecture patterns: HIGH — ARCHITECTURE.md patterns tested in P2 (Pattern 5 factory already in `createHealthModule`); P3 extends, not invents.
- Don't-hand-roll: HIGH — 80% of auth work delegated to BetterAuth; Rigging's wrapping points (AUTH-15, D-10 timing, AUTH-11 session-purge) explicit.
- Common pitfalls: HIGH for #3 / #4 / #13 (cited sources); MEDIUM for #5446 / #6 (requires spike to confirm current state).
- Validation: HIGH — test framework and sampling pattern match P2 (already green).
- Security domain: HIGH — ASVS mapping is mechanical; threat patterns match known CVE + Pitfalls doc.
- Assumptions: MEDIUM-LOW — only 2 of 8 assumptions (A1, A2) are MEDIUM-risk; both are explicit spike targets.

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (30 days — stack is stable; only BetterAuth minor release could invalidate, which would warrant new ADR regardless)

## Project Constraints (from AGENTS.md)

The project's AGENTS.md enumerates three-tier Rigidity Map directives. Phase 3 implementation MUST honor these:

**Tier 1 (Must Be Rigid — no escape):**
1. AuthContext is the ONLY path to any domain service. `getXxxService(ctx)` factory is the only legal entry (Pattern 5 in this research). Runtime guards throw `AuthContextMissingError` on missing context.
2. Domain layer is framework-free. `src/auth/domain/**` must NOT import `drizzle-orm`, `elysia`, `better-auth`, `postgres`, `@bogeychan/elysia-logger`, `pino`. Biome `noRestrictedImports` (already set in P1) auto-enforces. P3 new code will be auto-blocked if violations attempted.
3. Core stack pins unchanged: `better-auth@1.6.5` (exact) / `@better-auth/drizzle-adapter@1.6.5` / `elysia@^1.4.28` / `drizzle-orm@^0.45.2` / `postgres@^3.4.9`.

**Tier 2 (Rigid by default, ADR to escape):** Validator (TypeBox), driver (postgres-js), logger (pino), migration strategy (generate not push), resolver precedence (API Key > cookie per ADR 0011). Any P3 change to these requires a new ADR.

**Tier 3 (Convention):** Variable/code/log/commit/branch naming.

**Anti-features (DO NOT propose extending during Phase 3):** Frontend UI, CLI generator, real email providers, OAuth/SSO/2FA/magic link/passkeys, MCP/A2A/multi-agent, OpenTelemetry, multi-tenancy/RBAC, NPM package split, WebSocket/SSE/real-time, GraphQL, Docker publishing, zero-downtime migration tooling. If any of these surface in planning discussion, respond per AGENTS.md template.

**Specific Phase 3 compliance reminders:**
- No `import { auth } from '.../auth-instance'` in `src/auth/domain/**` or `src/auth/application/**` — only `src/auth/infrastructure/better-auth/` and `src/auth/auth.module.ts` may import it. Biome catches the first two automatically.
- Feature module factory `createAuthModule(shared: SharedDeps): Elysia` — no tsyringe/inversify.
- ADR 0013/0014/0015/0016 additions must follow MADR 4.0 format, update `docs/decisions/README.md` index, and status `accepted` on merge.
- Git commit format (Tier 3 convention): `feat: [auth] 實現 X 功能` per CLAUDE.md convention, Traditional Chinese preferred for Rigging project history consistency (P1/P2 all used zh-TW).
