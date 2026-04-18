# Architecture Research

**Domain:** Opinionated TypeScript backend scaffold (Bun + Elysia + DDD + mandatory AuthContext boundary)
**Researched:** 2026-04-18
**Confidence:** HIGH (Elysia/BetterAuth/Drizzle/MADR — Context7/official docs); MEDIUM (DDD folder layout — multiple community references agree but no canonical "Elysia-DDD spec")

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────────────┐
│                           Presentation (HTTP / Elysia)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Controllers │  │   Macros     │  │ Route Schema │  │  HTTP DTOs   │  │
│  │   (routes)   │  │ (auth guard) │  │   (TypeBox)  │  │   (input)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘  └──────────────┘  │
│         │                 │                                                │
│         │        [ .derive() / .resolve() inject AuthContext ]             │
│         │                 │                                                │
├─────────┼─────────────────┼────────────────────────────────────────────────┤
│         ▼                 ▼             Application (Use Cases)            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  RegisterUser   LoginUser   CreateApiKey   ListAgents   ...         │  │
│  │  ─────────────────────────────────────────────────────────────────  │  │
│  │  Each use case: takes AuthContext + DTO, calls Ports, returns DTO   │  │
│  │  Ports: IUserRepo, IEmailPort, IPasswordHasher, IIdentityService    │  │
│  └────────────────────────────────┬────────────────────────────────────┘  │
│                                   │ (interface calls)                      │
├───────────────────────────────────┼────────────────────────────────────────┤
│                                   ▼                Domain (Pure)           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  Entities:   User, ApiKey, Agent, PromptVersion                     │  │
│  │  Values:     Email, HashedPassword, ApiKeyHash, Brands              │  │
│  │  Rules:      PasswordPolicy, ApiKeyExpiryPolicy                     │  │
│  │  Errors:     DomainError hierarchy (typed, framework-free)          │  │
│  │  AuthContext:value object — identityKind + userId + scopes          │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                   ▲                                        │
│                                   │ (implements ports)                     │
├───────────────────────────────────┼────────────────────────────────────────┤
│                                   │            Infrastructure              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Drizzle    │  │  BetterAuth  │  │ ConsoleEmail │  │   Logger     │  │
│  │ Repositories │  │   Adapter    │  │   Adapter    │  │ (pino/bun)   │  │
│  │  + mappers   │  │ (identity)   │  │ (v1)         │  │              │  │
│  └──────┬───────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
│         ▼                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                  PostgreSQL  (Drizzle schema + migrations)            │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────┘

             Dependency direction: outer layers depend on inner.
             Domain has ZERO imports from Application/Infra/Presentation.
             Application imports Domain + port interfaces only.
             Infra implements Application ports and imports Drizzle/BetterAuth.
             Presentation wires everything via Elysia plugins.
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Domain entities** | Business invariants, value objects, pure rules | Classes with private constructors + factory `create()`; no framework imports |
| **AuthContext** (domain value) | Carry verified identity into domain operations | `readonly { userId, identityKind: 'human' \| 'agent', scopes, apiKeyId? }` |
| **Application use cases** | Orchestrate one business operation | Class with `execute(ctx: AuthContext, input: DTO): Promise<Result>` |
| **Ports** (application interfaces) | Contract between application & infra | TypeScript interfaces — `IUserRepository`, `IEmailPort`, `IIdentityService` |
| **Drizzle repositories** | Persist/load entities via SQL | Class implementing a Port, uses injected `db: DrizzleDB`, uses mappers |
| **Mappers** | Convert DB row ↔ Domain entity | `UserMapper.toDomain(row)`, `UserMapper.toPersistence(user)` |
| **BetterAuth adapter** | Session + password + API key verification | Infra adapter implementing `IIdentityService` port |
| **Elysia controllers** | HTTP routing + request validation + DTO transport | Elysia instance per feature, mounted via `.use()` |
| **Auth plugin** | Produce `AuthContext` from session cookie OR API key header | Elysia plugin exposing `auth` macro; uses `resolve` after schema validation |
| **Error handler** | Map `DomainError` → HTTP status | Global `.onError()` hook at app root |
| **Logger** | Structured logging injected via `decorate` | `pino` or `bun:console` wrapper as singleton |

## Recommended Project Structure

```
rigging/
├── src/
│   ├── main.ts                              # Process entry: calls bootstrap.start()
│   ├── bootstrap/
│   │   ├── app.ts                           # createApp(): assembles all plugins
│   │   ├── config.ts                        # Zod-validated env config
│   │   └── container.ts                     # Dependency wiring (plain factory fns)
│   │
│   ├── shared/                              # Cross-cutting, framework-agnostic
│   │   ├── kernel/
│   │   │   ├── result.ts                    # Result<T, E> type
│   │   │   ├── brand.ts                     # Branded primitive types
│   │   │   ├── id.ts                        # UUID value object
│   │   │   └── errors.ts                    # DomainError base class
│   │   ├── application/
│   │   │   └── ports/                       # ILogger, IClock, IIdGenerator
│   │   ├── infrastructure/
│   │   │   ├── db/
│   │   │   │   ├── client.ts                # Drizzle client factory
│   │   │   │   └── schema/                  # Shared Drizzle tables
│   │   │   ├── logger/
│   │   │   │   └── pino-logger.ts           # ILogger adapter
│   │   │   └── clock/
│   │   │       └── system-clock.ts          # IClock adapter
│   │   └── presentation/
│   │       ├── plugins/
│   │       │   ├── error-handler.plugin.ts  # Global .onError() mapping
│   │       │   ├── request-logger.plugin.ts # Derive request-id
│   │       │   └── cors.plugin.ts           # @elysiajs/cors wrapper
│   │       └── http-error.ts                # HTTP error response shape
│   │
│   ├── auth/                                # [FOUNDATION FEATURE — built first]
│   │   ├── domain/
│   │   │   ├── auth-context.ts              # THE AuthContext value object
│   │   │   ├── identity-kind.ts             # 'human' | 'agent' union
│   │   │   ├── errors.ts                    # UnauthorizedError, ForbiddenError
│   │   │   └── values/
│   │   │       ├── email.ts
│   │   │       ├── password.ts              # Policy: length, chars
│   │   │       └── api-key-hash.ts
│   │   ├── application/
│   │   │   ├── ports/
│   │   │   │   ├── identity-service.port.ts # IIdentityService interface
│   │   │   │   ├── user-repository.port.ts
│   │   │   │   ├── api-key-repository.port.ts
│   │   │   │   ├── password-hasher.port.ts
│   │   │   │   └── email.port.ts            # IEmailPort (send verification)
│   │   │   ├── usecases/
│   │   │   │   ├── register-user.usecase.ts
│   │   │   │   ├── verify-email.usecase.ts
│   │   │   │   ├── request-password-reset.usecase.ts
│   │   │   │   ├── create-api-key.usecase.ts
│   │   │   │   ├── list-api-keys.usecase.ts
│   │   │   │   └── revoke-api-key.usecase.ts
│   │   │   └── dtos/
│   │   ├── infrastructure/
│   │   │   ├── better-auth/
│   │   │   │   ├── auth-instance.ts         # Configured BetterAuth instance
│   │   │   │   └── identity-service.adapter.ts # Implements IIdentityService
│   │   │   ├── repositories/
│   │   │   │   ├── drizzle-user.repository.ts
│   │   │   │   └── drizzle-api-key.repository.ts
│   │   │   ├── mappers/
│   │   │   ├── password/
│   │   │   │   └── bun-password-hasher.ts   # Uses Bun.password (argon2id)
│   │   │   ├── email/
│   │   │   │   └── console-email.adapter.ts # v1: logs link to stdout
│   │   │   └── schema/
│   │   │       ├── user.schema.ts           # Drizzle table
│   │   │       ├── session.schema.ts
│   │   │       ├── account.schema.ts
│   │   │       ├── verification.schema.ts
│   │   │       └── api-key.schema.ts
│   │   ├── presentation/
│   │   │   ├── plugins/
│   │   │   │   ├── auth-context.plugin.ts   # THE plugin: derives AuthContext
│   │   │   │   └── require-auth.macro.ts    # .macro({ requireAuth: ... })
│   │   │   ├── controllers/
│   │   │   │   ├── auth.controller.ts       # Mounts BetterAuth handler
│   │   │   │   ├── api-key.controller.ts    # /api-keys CRUD
│   │   │   │   └── me.controller.ts         # /me (protected demo)
│   │   │   └── dtos/                        # TypeBox schemas for requests
│   │   └── auth.module.ts                   # Feature bootstrap / wiring
│   │
│   ├── agents/                              # [DEMO DOMAIN — built after auth]
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── agent.ts
│   │   │   │   ├── prompt-version.ts
│   │   │   │   └── evaluation-dataset.ts
│   │   │   ├── values/
│   │   │   └── errors.ts
│   │   ├── application/
│   │   │   ├── ports/
│   │   │   └── usecases/
│   │   ├── infrastructure/
│   │   │   ├── repositories/
│   │   │   ├── mappers/
│   │   │   └── schema/
│   │   ├── presentation/
│   │   │   └── controllers/
│   │   └── agents.module.ts
│   │
│   └── types/                               # Ambient TS types (never runtime)
│
├── tests/
│   ├── unit/                                # Domain + use case tests (mocked ports)
│   ├── integration/                         # Infra adapters against real Postgres
│   └── e2e/                                 # HTTP-level via Bun test + Elysia .handle()
│
├── docs/
│   └── decisions/                           # MADR-format ADRs
│       ├── README.md                        # Index + workflow
│       ├── 0000-use-madr-for-adrs.md
│       ├── 0001-use-bun-runtime.md
│       ├── 0002-use-elysia-web-framework.md
│       ├── 0003-ddd-layering.md
│       ├── 0004-use-better-auth.md
│       ├── 0005-use-drizzle-orm.md
│       ├── 0006-auth-context-boundary.md
│       ├── 0007-runtime-guards-over-type-level.md
│       └── 0008-dual-auth-session-and-api-key.md
│
├── drizzle/                                 # Generated migrations (committed)
├── drizzle.config.ts
├── package.json
├── tsconfig.json
├── bun.lockb
└── .env.example
```

### Structure Rationale

- **`src/{feature}/{layer}/`** (vertical slicing × horizontal layering) — You get both: "everything about auth is in `src/auth/`" (features move as a unit) AND "domain has no framework imports" (layers stay pure). This is the dominant pattern in Elysia-DDD community repos and matches DDD bounded-context thinking.
- **`shared/kernel/`** for Result/Brand/errors — Pure types used by every layer; importable from Domain without breaking purity.
- **`shared/application/ports/` vs feature-level ports** — Put cross-cutting ports (logger, clock) in shared; feature-owned ports (user repository, email for auth) in the feature.
- **`{feature}/presentation/plugins/`** — Elysia plugins ARE the DI mechanism in this stack. Placing them next to controllers keeps wiring co-located with routes.
- **`{feature}.module.ts`** — Single factory function that assembles adapters → use cases → controllers → Elysia plugin. This is the "DI container" without a framework.
- **`docs/decisions/`** — MADR convention; see ADR section.
- **`drizzle/` at repo root** (not under `src/`) — Drizzle's generator expects this; migrations are artifacts, not source.

## Architectural Patterns

### Pattern 1: AuthContext Boundary via Elysia `.macro()` + `.resolve()`

**What:** A single Elysia plugin derives `AuthContext` by probing both the session cookie (BetterAuth) and the `X-API-Key` header. Routes opt in via a macro marker; Elysia's type inference makes `ctx` unavailable to handlers that don't declare the macro, giving a lightweight compile-time signal on top of the runtime guard.

**When to use:** Every route touching Domain. Public routes (health, docs) do not use the macro.

**Trade-offs:**
- (+) Uniform context — use cases never see HTTP concerns
- (+) Dual auth handled in one place
- (+) Failing to opt-in = handler literally cannot destructure `ctx` (the macro didn't inject it)
- (−) Macro + derive is Elysia-specific — you're tied to the framework (acceptable: Elysia is a locked decision)

**Example:**
```typescript
// src/auth/presentation/plugins/auth-context.plugin.ts
import { Elysia, status } from 'elysia'
import type { AuthContext } from '@/auth/domain/auth-context'
import type { IIdentityService } from '@/auth/application/ports/identity-service.port'

export const authContextPlugin = (identity: IIdentityService) =>
  new Elysia({ name: 'rigging/auth-context' })
    .macro({
      requireAuth: {
        async resolve({ request: { headers }, cookie, status }) {
          // 1. Try API Key header first (agent path)
          const apiKey = headers.get('x-api-key')
          if (apiKey) {
            const agentCtx = await identity.verifyApiKey(apiKey)
            if (!agentCtx) return status(401, 'Invalid API key')
            return { ctx: agentCtx satisfies AuthContext }
          }
          // 2. Fall back to session cookie (human path)
          const session = await identity.verifySession(headers)
          if (!session) return status(401, 'Unauthenticated')
          return { ctx: session satisfies AuthContext }
        }
      }
    })

// Usage in a controller:
export const meController = (deps: { auth: ReturnType<typeof authContextPlugin> }) =>
  new Elysia({ prefix: '/me' })
    .use(deps.auth)
    .get('/', ({ ctx }) => ({ userId: ctx.userId, kind: ctx.identityKind }), {
      requireAuth: true // ← without this, `ctx` is not in scope. Type error.
    })
```

### Pattern 2: AuthContext Concrete Shape

**What:** A frozen value object — one type, two identity origins, same contract for downstream code.

**When to use:** Always. Every use case accepts `AuthContext` as its first parameter.

```typescript
// src/auth/domain/auth-context.ts
import type { UserId } from '@/shared/kernel/id'

export type IdentityKind = 'human' | 'agent'

export interface AuthContext {
  readonly userId: UserId
  readonly identityKind: IdentityKind
  readonly scopes: ReadonlyArray<string>
  // Only set when identityKind === 'agent':
  readonly apiKeyId?: string
  // Only set when identityKind === 'human':
  readonly sessionId?: string
}

export function isAgent(ctx: AuthContext): boolean {
  return ctx.identityKind === 'agent'
}
```

Rationale for `scopes` as a string array: API keys have scopes (per BetterAuth API key plugin); humans get a default scope set (`['user']`) that domain policies can check. Avoids premature RBAC — just enough to represent "this API key can only read, not write."

### Pattern 3: Use Case = Class with `execute(ctx, input)`

**What:** Every application service is a class with a single `execute` method; AuthContext is always parameter #1. The runtime guard is trivial: the use case constructor declares its dependencies; its method signature makes AuthContext non-optional.

**Example:**
```typescript
// src/auth/application/usecases/create-api-key.usecase.ts
export class CreateApiKeyUseCase {
  constructor(
    private readonly apiKeys: IApiKeyRepository,
    private readonly hasher: IApiKeyHasher,
    private readonly clock: IClock,
  ) {}

  async execute(ctx: AuthContext, input: CreateApiKeyDTO): Promise<ApiKeyCreatedDTO> {
    if (ctx.identityKind === 'agent') {
      throw new ForbiddenError('Agents may not mint new API keys')
    }
    const rawKey = generateKey()
    const hash = await this.hasher.hash(rawKey)
    const key = ApiKey.create({ userId: ctx.userId, hash, label: input.label, issuedAt: this.clock.now() })
    await this.apiKeys.save(key)
    return { id: key.id, rawKey, label: key.label } // rawKey shown ONCE
  }
}
```

### Pattern 4: Repository with Mapper (Drizzle)

**What:** Repository exposes domain-entity methods; mapper converts Drizzle row ↔ entity. Drizzle types never leak past the infrastructure layer.

```typescript
// src/auth/infrastructure/repositories/drizzle-user.repository.ts
export class DrizzleUserRepository implements IUserRepository {
  constructor(private readonly db: DrizzleDB) {}

  async findByEmail(email: Email): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.email, email.value)).limit(1)
    return rows[0] ? UserMapper.toDomain(rows[0]) : null
  }

  async save(user: User): Promise<void> {
    const row = UserMapper.toPersistence(user)
    await this.db.insert(users).values(row).onConflictDoUpdate({ target: users.id, set: row })
  }
}
```

### Pattern 5: Feature Module as Factory Function (DI without IoC)

**What:** Each feature exports a factory that takes shared dependencies, wires adapters → use cases → controllers, and returns an Elysia plugin. No `tsyringe`, no reflect-metadata — just closures.

```typescript
// src/auth/auth.module.ts
export const createAuthModule = (shared: SharedDeps) => {
  // 1. Infra
  const userRepo = new DrizzleUserRepository(shared.db)
  const apiKeyRepo = new DrizzleApiKeyRepository(shared.db)
  const emailPort = new ConsoleEmailAdapter(shared.logger)
  const passwordHasher = new BunPasswordHasher()
  const apiKeyHasher = new BunApiKeyHasher()
  const identity = new BetterAuthIdentityService(shared.db, apiKeyRepo, apiKeyHasher)

  // 2. Use cases
  const registerUser = new RegisterUserUseCase(userRepo, emailPort, passwordHasher, shared.clock)
  const createApiKey = new CreateApiKeyUseCase(apiKeyRepo, apiKeyHasher, shared.clock)
  // ...

  // 3. Presentation
  const authContext = authContextPlugin(identity)
  return new Elysia({ name: 'rigging/auth' })
    .use(authContext)
    .use(authController({ identity }))
    .use(apiKeyController({ createApiKey, listApiKeys, revokeApiKey }, authContext))
    .use(meController({ auth: authContext }))
}

// bootstrap/app.ts
export const createApp = async () => {
  const config = loadConfig()
  const db = createDb(config.DATABASE_URL)
  const shared = { db, logger, clock }
  return new Elysia()
    .use(errorHandlerPlugin)
    .use(requestLoggerPlugin)
    .use(createAuthModule(shared))
    .use(createAgentsModule(shared))
}
```

## Data Flow

### Request Flow (Protected Route)

```
  POST /api-keys { label: "my-agent" }  + Cookie: session=...
    ↓
  Elysia request pipeline:
    1. parse      → JSON body parsed
    2. transform  → (nothing registered)
    3. derive     → requestId added (request-logger plugin)
    4. macro.resolve (requireAuth: true)
       ├─ read X-API-Key header → none
       ├─ read session cookie → BetterAuth.api.getSession(headers)
       └─ return { ctx: { userId, identityKind: 'human', scopes: ['user'], sessionId } }
    5. validation → TypeBox validates body: { label: string }
    6. beforeHandle → (nothing registered)
    7. handler    → controller.post('/', ({ ctx, body }) =>
                         createApiKey.execute(ctx, body))
    ↓
  Use case:
    - checks ctx.identityKind (guard: only humans mint keys)
    - creates ApiKey entity (domain invariants enforced in factory)
    - hasher.hash(rawKey) → argon2id hash
    - apiKeys.save(entity)
    - returns DTO { id, rawKey, label }
    ↓
  Elysia afterHandle → JSON response with 201
    ↓
  HTTP 201 { id, rawKey: "sk_live_xxx...", label: "my-agent" }
```

### Authentication Flow (Dual)

```
  Human login (session cookie path):
    POST /auth/sign-in (BetterAuth handler mounted at /auth/*)
      → BetterAuth verifies password, issues session cookie
      → subsequent requests: cookie → identity.verifySession → AuthContext(human)

  Agent request (API key path):
    Any protected route + Header: X-API-Key: sk_live_xxx
      → macro.resolve reads header
      → identity.verifyApiKey(raw) → hash compare in DB → lookup user + scopes
      → AuthContext(agent, apiKeyId set)
```

### Error Flow

```
  Domain throws DomainError
    ↓ propagates up
  Use case does not catch
    ↓
  Elysia .onError() (global plugin)
    ↓ maps DomainError subclass to HTTP status
  ValidationError → 400   UnauthorizedError → 401
  ForbiddenError  → 403   NotFoundError     → 404
  ConflictError   → 409   Anything else     → 500 + logged
```

### Key Data Flows

1. **Cold boot:** `main.ts` → `bootstrap.createApp()` → config → db client → shared deps → feature modules → `.listen()`. All wiring synchronous except `db` connection probe.
2. **AuthContext derivation:** Header/cookie → `IIdentityService` (infra adapter) → BetterAuth or API key repo lookup → Domain `AuthContext` value. Fails closed (401).
3. **Domain write:** Use case → Repository.save → Mapper.toPersistence → Drizzle insert/update in a transaction. Domain events (if added later) queued here.

## Suggested Build Order

This is the core deliverable for roadmap sequencing. Dependencies flow strictly:

| Order | Phase | Why Now | Depends On |
|-------|-------|---------|------------|
| 1 | **Foundation & Tooling** — Bun project, TS config, Drizzle config, Postgres, logger, config loader, error base classes, Result type, ADR dir + README | Everything else imports from `shared/kernel` and `shared/infrastructure`. Without Postgres + Drizzle ready, auth schema can't be migrated. | — |
| 2 | **Elysia app skeleton** — `bootstrap/app.ts`, global error handler plugin, request logger plugin, health route | Need an app to mount features into. Proves pipeline works before adding auth complexity. | 1 |
| 3 | **Auth Domain + Ports** — `auth/domain/*`, `AuthContext`, port interfaces (IIdentityService, IUserRepo, IApiKeyRepo, IEmailPort, IPasswordHasher) | Ports must exist before adapters can implement them; domain must exist before use cases can return it. | 1 |
| 4 | **Auth Infrastructure (BetterAuth + Drizzle)** — BetterAuth instance, Drizzle schema (user/session/account/verification/api_key), repositories, mappers, BunPasswordHasher, ConsoleEmailAdapter | Concrete adapters for ports from step 3. BetterAuth drives the schema — run `bunx @better-auth/cli generate` then `drizzle-kit generate`. | 3 |
| 5 | **Auth Application (Use Cases)** — register, verify email, request/confirm password reset, create/list/revoke API key | Orchestration layer. Needs ports (3) and adapters (4). | 3, 4 |
| 6 | **Auth Presentation + AuthContext plugin** — `authContextPlugin` macro, mount BetterAuth handler, API key controller, `/me` demo route, **runtime guard wired** | The mandatory boundary is now enforceable. Runtime guard: `authContextPlugin` throws 401 when neither cookie nor API key resolves. | 5 |
| 7 | **Integration tests for auth** — end-to-end: sign up → verify email (read console log) → sign in → create API key → use key on protected route | Proves the whole track works. This is where "Core Value" gets validated. | 6 |
| 8 | **Demo Domain (Agents meta-project)** — `src/agents/*` following the same four-layer pattern, using `AuthContext` everywhere | Dog-food: does the harness actually make agent-written code safer/faster? | 6 |
| 9 | **Docs + quickstart + README** — clone & run in <5 min | Last because the surface stabilises only after 6. | 8 |

**Critical ordering rules:**
- **Ports before adapters** (3 before 4) — otherwise you shape ports to fit whatever Drizzle returns, losing the point.
- **AuthContext type before any protected route** — all controllers import it; adding it late means rewrites.
- **BetterAuth schema drives migrations** — do not hand-write user/session tables; run the BetterAuth CLI first and commit the Drizzle schema it produces.
- **Global error handler before any feature** — otherwise DomainError leaks as 500 during development and confuses debugging.

## ADR Mechanism

### Format: MADR 4.0.0 (minimal)

**Location:** `docs/decisions/`

**Filename:** `NNNN-title-with-dashes.md` (4-digit sequential number)

**Minimal template (adopt `0000-use-madr-for-adrs.md` to document the choice of MADR itself):**

```markdown
# NNNN — [Short title of solved problem and solution]

- Status: proposed | accepted | superseded by [0005](0005-xxx.md) | deprecated
- Date: YYYY-MM-DD
- Deciders: [list of names or roles]

## Context and Problem Statement

[2-3 sentences describing the context and the problem as a question.]

## Considered Options

- Option A
- Option B
- Option C

## Decision Outcome

Chosen option: "Option B", because [justification — decision driver].

### Consequences

- Good, because [positive outcome]
- Good, because [positive outcome]
- Bad, because [tradeoff or cost]
- Bad, because [tradeoff or cost]

## Pros and Cons of the Options (optional)

### Option A
- Good, because ...
- Bad, because ...
```

**Workflow:**
1. When a decision arises worth recording (any of: tech choice, layering rule, breaking API decision, security posture), open an ADR in `proposed` status via PR.
2. Review in PR — comments become the discussion record.
3. Merge flips status to `accepted`. Commit message: `docs(adr): 0007 runtime guards over type-level`.
4. Never edit an accepted ADR's decision section. If it changes, write a new ADR that supersedes it, and update the old one's Status.
5. Maintain `docs/decisions/README.md` as an index (simple markdown table: number, title, status, date).

**Why MADR over alternatives:**
- **vs. Nygard's original** — MADR is strictly a superset, more structured, and has active tooling (adr-log).
- **vs. raw Notion/Confluence** — ADRs live next to code; AI agents read them with the same `Read` tool they use for code; version-controlled diff shows evolution.
- **vs. e-adr (embedded in code comments)** — poor diff experience and splits documentation from implementation in the wrong direction.

**Tool support:** `adr-log` (Node CLI) can regenerate README index. `log4brains` is a heavier web UI — optional, defer until there are 20+ ADRs.

**Initial ADR seed (commit these in the foundation phase):**
- 0000 Use MADR 4.0 for ADRs (self-referential)
- 0001 Use Bun runtime (rationale: TS-native, speed, Elysia integration)
- 0002 Use Elysia as web framework
- 0003 Adopt DDD four-layer structure
- 0004 Use BetterAuth for auth (Lucia is in maintenance)
- 0005 Use Drizzle ORM + PostgreSQL
- 0006 AuthContext as mandatory domain boundary
- 0007 Runtime guards over type-level enforcement
- 0008 Dual auth: session (human) + API key (agent)

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users / solo dev | Single Bun process, Postgres on same host or Neon serverless. No adjustments — this is the target. |
| 1k-100k users | Move Postgres to managed service with connection pooling (pgBouncer or Neon's pooled endpoint). Add read replica if analytics queries arise. Swap `ConsoleEmailAdapter` for `ResendAdapter` (the port was designed for this). Deploy Bun behind Fly.io or Railway. |
| 100k+ users | Split by bounded context — `auth` service and `agents` service as separate deploys, sharing only AuthContext shape (publish as a tiny types package). Introduce rate limiting per API key (BetterAuth API Key plugin supports this natively). Extract email adapter to a queue (BullMQ or pg-boss). |

### Scaling Priorities (what breaks first)

1. **First bottleneck:** Password hashing CPU cost during sign-up bursts. Argon2id is deliberately slow. Mitigation: queue sign-up emails, return 202, finalize async. Unlikely to hit before 1k concurrent signups/min.
2. **Second bottleneck:** API key verification hits the DB on every agent request. Mitigation: short-lived in-process cache keyed by hashed API key (invalidate on revoke).
3. **Third bottleneck:** Session cookie lookup on every human request. BetterAuth's secondary storage option (Redis) solves this before it matters.

## Anti-Patterns

### Anti-Pattern 1: Passing Elysia `Context` into use cases

**What people do:** `usecase.execute(ctx: Context, body)` where `Context` is Elysia's handler context.
**Why it's wrong:** Couples application logic to HTTP transport. Use case can no longer be called from a background job, test, or CLI. Destroys the point of DDD layering.
**Do this instead:** Derive `AuthContext` in the Elysia plugin and pass only that to the use case. Use cases take `(AuthContext, DTO)`, nothing else from Elysia.

### Anti-Pattern 2: Domain entities with Drizzle types in their shape

**What people do:** `class User { constructor(public row: typeof users.$inferSelect) {} }`.
**Why it's wrong:** The domain now imports infrastructure. Swap Drizzle → rewrite every entity. Also: Drizzle row shape is string-for-all-dates, nullable-for-all-optional — entity invariants can't be enforced.
**Do this instead:** Domain defines its own shape (value objects, branded types); `UserMapper.toDomain(row): User` in infra lifts rows into entities.

### Anti-Pattern 3: Optional AuthContext / per-route auth middleware

**What people do:** `ctx?: AuthContext` parameter; `if (requiresAuth) checkAuth()` in each handler.
**Why it's wrong:** Defeats the "track" metaphor. One forgotten check = domain operation with no identity = exactly the failure Rigging exists to prevent.
**Do this instead:** `AuthContext` is always non-optional in use case signatures. Public routes (health, docs) don't call use cases at all — they live in a separate plugin that has no domain dependencies.

### Anti-Pattern 4: Reading session inside a use case

**What people do:** Inject `request` or session store into the use case to "check who's calling."
**Why it's wrong:** Leaks HTTP concerns into domain. Identity resolution is a presentation/infra concern; authorization checks based on identity are domain concerns — those check `ctx`, not session storage.
**Do this instead:** Identity resolution happens exactly once per request, in the `authContextPlugin`. The resulting `AuthContext` is the only identity source of truth downstream.

### Anti-Pattern 5: Hand-writing the BetterAuth schema

**What people do:** Copy example schema from a blog post, tweak column types.
**Why it's wrong:** BetterAuth's schema evolves with plugins (API Key, 2FA, etc.) and versions. Hand-written drift = runtime crashes.
**Do this instead:** `bunx @better-auth/cli generate` produces the Drizzle schema; commit it as-is. Re-run whenever BetterAuth version bumps. Extend via separate Drizzle tables with FKs to `user.id`, never by editing BetterAuth-owned tables.

### Anti-Pattern 6: Using `.derive()` for auth without `.macro()`

**What people do:** `.derive(({ headers }) => ({ user: parseAuth(headers) }))` globally, then use `user` in handlers.
**Why it's wrong:** Every route now pays the auth cost, including public ones; `user` can be `null` so handlers need defensive checks — back to optional context.
**Do this instead:** Use `.macro({ requireAuth: { resolve: ... } })`. Routes opt-in with `{ requireAuth: true }`. Resolver returns status(401) on failure, meaning the handler is never entered with an absent context.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| PostgreSQL | Drizzle client in `shared/infrastructure/db`, injected into repos | Connection pool; use prepared statements for hot paths. |
| BetterAuth | Mounted via `.mount(auth.handler)` at `/auth/*`; server-side calls via `auth.api.getSession({ headers })` | Owns `user`, `session`, `account`, `verification` tables. Plugin tables (e.g. `apiKey`) also generated by CLI. |
| Email (future Resend) | Implements `IEmailPort`; swap `ConsoleEmailAdapter` → `ResendAdapter` by changing one line in `auth.module.ts` | v1 prints link to stdout; ADR 0009 will capture the switch. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Presentation ↔ Application | Direct call: controller constructs DTO, invokes `usecase.execute(ctx, dto)` | No event bus v1 — YAGNI. |
| Application ↔ Domain | Direct import of domain types; use case creates entities via factories | Domain never knows application exists. |
| Application ↔ Infrastructure | Through ports only | Ports live in `{feature}/application/ports/`. Adapters in `{feature}/infrastructure/`. |
| Feature ↔ Feature (`auth` ↔ `agents`) | Via exported types (AuthContext) and exported port interfaces only | No feature imports another feature's infrastructure. If `agents` needs to read a user, it defines its own `IUserReader` port, `auth` provides the adapter at module-wiring time. |
| Shared ↔ Features | Features import from `shared/kernel` and `shared/application/ports` freely | Shared never imports from features (would be a cycle). |

## Sources

- [Elysia Lifecycle docs](https://elysiajs.com/essential/life-cycle) — HIGH confidence, official
- [Elysia Plugin docs](https://elysiajs.com/essential/plugin) — HIGH confidence, official
- [Elysia Macro pattern](https://elysiajs.com/patterns/macro) — HIGH confidence, official
- [Elysia Extends Context](https://elysiajs.com/patterns/extends-context) — HIGH confidence, official
- [Better Auth — Elysia Integration](https://better-auth.com/docs/integrations/elysia) — HIGH confidence, official
- [Better Auth — API Key plugin](https://better-auth.com/docs/plugins/api-key) — HIGH confidence, official
- [Better Auth — Bearer plugin](https://better-auth.com/docs/plugins/bearer) — HIGH confidence, official
- [Better Auth — Drizzle Adapter](https://better-auth.com/docs/adapters/drizzle) — HIGH confidence, official
- [Better Auth — Database Concepts](https://better-auth.com/docs/concepts/database) — HIGH confidence, official
- [MADR project site](https://adr.github.io/madr/) — HIGH confidence, canonical format
- [MADR GitHub (templates)](https://github.com/adr/madr) — HIGH confidence
- [Vertical Slicing & Clean Architecture: Elysia Practical Guide (RezaOwliaei gist)](https://gist.github.com/RezaOwliaei/477ed74fc77aa5df2a854789538dd79d) — MEDIUM confidence, community but thorough and aligns with broader Clean Architecture literature
- [Bun + Elysia Clean Architecture Example (lukas-andre)](https://github.com/lukas-andre/bun-elysia-clean-architecture-example) — MEDIUM confidence, concrete reference repo
- [Khalil Stemmler — Repository/DTO/Mapper pattern in TS DDD](https://khalilstemmler.com/articles/typescript-domain-driven-design/repository-dto-mapper/) — MEDIUM confidence, established DDD guide
- [Drizzle Data-Access-Pattern First (Andrii Sherman, Drizzle author)](https://medium.com/drizzle-stories/the-data-access-pattern-first-approach-with-drizzle-bca035bbdc63) — MEDIUM confidence

---
*Architecture research for: opinionated TypeScript backend (Bun + Elysia + DDD + mandatory AuthContext)*
*Researched: 2026-04-18*
