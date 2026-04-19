# Phase 4: Demo Domain - Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 33 new/modified files
**Analogs found:** 33 / 33 (primary analog coverage: 100%)

Purpose: give `gsd-planner` concrete clone targets from P3 `src/auth/**` and existing shared kernel, so each Plan's Action section points to exact file paths + line numbers + code excerpts to lift. The DDD four-layer `src/auth/` feature module is **the** reference — P4 `src/agents/` is "clone auth, rename, swap ownership semantics."

---

## File Classification

| # | New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|---|
| 1 | `src/shared/kernel/errors.ts` (MOD) | kernel/domain-error | — | self (add subclass alongside existing `NotFoundError`) | exact (in-place extension) |
| 2 | `src/agents/domain/values/ids.ts` | domain/value-object | — | `src/shared/kernel/id.ts` + brand usage in `src/auth/domain/auth-context.ts` line 10 | exact |
| 3 | `src/agents/domain/agent.ts` | domain/entity | — | `src/auth/application/ports/user-repository.port.ts` lines 3-11 (User interface shape) | role-match |
| 4 | `src/agents/domain/prompt-version.ts` | domain/entity | — | `src/auth/application/ports/api-key-repository.port.ts` lines 3-13 (ApiKeyRow shape) | role-match |
| 5 | `src/agents/domain/eval-dataset.ts` | domain/entity + value-object | — | `src/auth/domain/values/email.ts` (value object) + entity shape from above | role-match |
| 6 | `src/agents/domain/errors.ts` | domain/error | — | `src/auth/domain/errors.ts` lines 10-13 (`InsufficientScopeError` shape) | exact |
| 7 | `src/agents/domain/index.ts` | domain/barrel | — | `src/auth/domain/index.ts` | exact |
| 8 | `src/agents/application/ports/agent-repository.port.ts` | application/port | CRUD | `src/auth/application/ports/user-repository.port.ts` | exact |
| 9 | `src/agents/application/ports/prompt-version-repository.port.ts` | application/port | append-only + query | `src/auth/application/ports/api-key-repository.port.ts` lines 15-19 | role-match |
| 10 | `src/agents/application/ports/eval-dataset-repository.port.ts` | application/port | CRUD (no update) | `src/auth/application/ports/api-key-repository.port.ts` | role-match |
| 11 | `src/agents/application/usecases/create-agent.usecase.ts` | application/use-case | request-response (write) | `src/auth/application/usecases/create-api-key.usecase.ts` | exact (scope-check + construct) |
| 12 | `src/agents/application/usecases/update-agent.usecase.ts` | application/use-case | request-response (write) | `src/auth/application/usecases/create-api-key.usecase.ts` + ownership check | exact |
| 13 | `src/agents/application/usecases/delete-agent.usecase.ts` | application/use-case | request-response (write) | `src/auth/application/usecases/revoke-api-key.usecase.ts` | exact |
| 14 | `src/agents/application/usecases/get-agent.usecase.ts` | application/use-case | request-response (read) | `src/auth/application/usecases/list-api-keys.usecase.ts` | role-match |
| 15 | `src/agents/application/usecases/list-agents.usecase.ts` | application/use-case | request-response (read list) | `src/auth/application/usecases/list-api-keys.usecase.ts` | exact |
| 16 | `src/agents/application/usecases/create-prompt-version.usecase.ts` | application/use-case | append-only (write + retry) | `src/auth/application/usecases/create-api-key.usecase.ts` (prologue) + RESEARCH.md Example 4 (retry loop) | partial (unique pattern) |
| 17 | `src/agents/application/usecases/{get-latest,get,list}-prompt-version.usecase.ts` | application/use-case | request-response (read) | `src/auth/application/usecases/list-api-keys.usecase.ts` + ownership check prologue | role-match |
| 18 | `src/agents/application/usecases/create-eval-dataset.usecase.ts` | application/use-case | request-response (write, one-shot) | `src/auth/application/usecases/create-api-key.usecase.ts` | exact |
| 19 | `src/agents/application/usecases/{get,list,delete}-eval-dataset.usecase.ts` | application/use-case | request-response | `src/auth/application/usecases/{list,revoke}-api-key.usecase.ts` | exact |
| 20 | `src/agents/infrastructure/schema/agent.schema.ts` | infrastructure/schema | — | `src/auth/infrastructure/schema/user.schema.ts` (simpler: no relations block) | exact |
| 21 | `src/agents/infrastructure/schema/prompt-version.schema.ts` | infrastructure/schema | — | `src/auth/infrastructure/schema/api-key.schema.ts` lines 3-35 (pgTable + array callback with `index`) | exact |
| 22 | `src/agents/infrastructure/schema/eval-dataset.schema.ts` | infrastructure/schema | jsonb | `src/auth/infrastructure/schema/api-key.schema.ts` + add `jsonb` import | role-match |
| 23 | `src/agents/infrastructure/mappers/*.mapper.ts` | infrastructure/mapper | — | `src/auth/infrastructure/mappers/user.mapper.ts` (simple) + `api-key.mapper.ts` (with defensive parse for jsonb) | exact |
| 24 | `src/agents/infrastructure/repositories/drizzle-agent.repository.ts` | infrastructure/repository | CRUD | `src/auth/infrastructure/repositories/drizzle-user.repository.ts` (uses `.onConflictDoUpdate`) + `drizzle-api-key.repository.ts` (uses `and/eq/desc`) | exact |
| 25 | `src/agents/infrastructure/repositories/drizzle-prompt-version.repository.ts` | infrastructure/repository | append-only atomic | `src/auth/infrastructure/repositories/drizzle-api-key.repository.ts` + RESEARCH.md Example 4 `db.execute(sql\`INSERT ... ON CONFLICT ... RETURNING\`)` | partial |
| 26 | `src/agents/infrastructure/repositories/drizzle-eval-dataset.repository.ts` | infrastructure/repository | CRUD (no update) | `src/auth/infrastructure/repositories/drizzle-api-key.repository.ts` | exact |
| 27 | `src/agents/presentation/controllers/agent.controller.ts` | presentation/controller | request-response | `src/auth/presentation/controllers/api-key.controller.ts` | exact |
| 28 | `src/agents/presentation/controllers/prompt-version.controller.ts` | presentation/controller | request-response (nested prefix) | `src/auth/presentation/controllers/api-key.controller.ts` + Elysia `{ prefix: '/agents/:agentId' }` constructor | role-match |
| 29 | `src/agents/presentation/controllers/eval-dataset.controller.ts` | presentation/controller | request-response (nested prefix) | same as prompt-version.controller.ts | role-match |
| 30 | `src/agents/presentation/dtos/*.dto.ts` | presentation/dto | — | `src/auth/presentation/dtos/create-api-key.dto.ts` (TypeBox + `Static` + shared union) | exact |
| 31 | `src/agents/agents.module.ts` | module/factory | — | `src/auth/auth.module.ts` + `src/health/health.module.ts` | exact |
| 32 | `src/bootstrap/app.ts` (MOD) | bootstrap/wire | — | self (append one `.use(createAgentsModule(...))` after `createAuthModule`) | exact (in-place extension) |
| 33 | `drizzle/0002_demo_domain.sql` | migration (generated) | — | `drizzle/0001_auth_foundation.sql` | exact (shape) |
| 34 | `tests/integration/agents/_helpers.ts` | test/helper | — | `tests/integration/auth/_helpers.ts` (direct extension / super-set) | exact |
| 35 | `tests/integration/agents/dogfood-self-prompt-read.test.ts` | test/integration | — | `tests/integration/auth/me-endpoint.test.ts` (identity routing) + `api-key-crud.test.ts` (full POST+GET+DELETE flow) | exact |
| 36 | `tests/integration/agents/{scope-check,cross-user-404,prompt-version-monotonic,cascade-delete}.test.ts` | test/integration | — | `tests/integration/auth/macro-scope-global.test.ts` + `api-key-crud.test.ts` | role-match |
| 37 | `docs/decisions/0017-eval-dataset-shape-jsonb-immutable.md` | docs/ADR | — | `docs/decisions/0013-api-key-storage-hash-plus-index.md` (MADR 4.0, comparable scope) | exact |
| 38 | `docs/decisions/README.md` (MOD) | docs/ADR-index | — | self (append one row to index table) | exact (in-place extension) |
| 39 | `.planning/phases/04-demo-domain/04-HARNESS-FRICTION.md` | planning/log | — | — (novel document type, shape locked by CONTEXT D-15) | no analog |

---

## Pattern Assignments

### 1. `src/shared/kernel/errors.ts` (MOD — add `ResourceNotFoundError`)

**Analog:** `src/shared/kernel/errors.ts` itself (append new subclass alongside existing members)

**Imports pattern** (existing file already complete; no new imports needed):
```typescript
// src/shared/kernel/errors.ts (existing, lines 1-4)
// DomainError hierarchy — framework-free, HTTP mapping via `httpStatus` field.
// Error handler plugin (Phase 2) reads err.httpStatus directly — no mapping table.
// See docs/decisions/0003-ddd-layering.md + 0006-authcontext-boundary.md.
```

**Core pattern** (lines 36-39 — `NotFoundError` shape; clone it for the more-specific `ResourceNotFoundError`):
```typescript
// lines 36-39
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND'
  readonly httpStatus = 404
}
```

**Append this new class** (distinct code, same httpStatus — D-09 requires `RESOURCE_NOT_FOUND` code, NOT generic `NOT_FOUND`):
```typescript
// APPEND to src/shared/kernel/errors.ts
export class ResourceNotFoundError extends DomainError {
  readonly code = 'RESOURCE_NOT_FOUND'
  readonly httpStatus = 404
}
```

Barrel `src/shared/kernel/index.ts` line 2 already re-exports `./errors` — no barrel change needed.

---

### 2. `src/agents/domain/values/ids.ts` (domain, value-object)

**Analog:** `src/shared/kernel/id.ts` (newUUID generic) + `src/auth/domain/auth-context.ts` line 10 (UserId brand idiom)

**Imports pattern** (`src/shared/kernel/id.ts` lines 1-5, the canonical pattern):
```typescript
// src/shared/kernel/id.ts
import { type Brand, brand } from './brand'

export type UUID<K extends string> = Brand<string, K>

export const newUUID = <K extends string>(): UUID<K> => brand<K>()(crypto.randomUUID())
```

**Brand usage** from `src/auth/domain/auth-context.ts` line 10:
```typescript
// src/auth/domain/auth-context.ts line 10
export type UserId = UUID<'UserId'>
```

**Clone pattern for P4** (P4 adds constructors since it needs factories for `newAgentId()` etc; matches `src/auth/domain/values/email.ts` line 10 constructor idiom):
```typescript
// src/agents/domain/values/ids.ts
import { newUUID, type UUID } from '../../../shared/kernel'

export type AgentId = UUID<'AgentId'>
export type PromptVersionId = UUID<'PromptVersionId'>
export type EvalDatasetId = UUID<'EvalDatasetId'>

export const newAgentId = (): AgentId => newUUID<'AgentId'>()
export const newPromptVersionId = (): PromptVersionId => newUUID<'PromptVersionId'>()
export const newEvalDatasetId = (): EvalDatasetId => newUUID<'EvalDatasetId'>()
```

---

### 3. `src/agents/domain/agent.ts` (domain, entity)

**Analog:** `src/auth/application/ports/user-repository.port.ts` lines 3-11 (User interface — readonly, immutable record shape)

**Imports + shape pattern** (lines 1-11):
```typescript
// src/auth/application/ports/user-repository.port.ts
import type { UserId } from '../../domain/auth-context'

export interface User {
  readonly id: UserId
  readonly email: string
  readonly emailVerified: boolean
  readonly name: string
  readonly image: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}
```

**Clone for Agent:**
```typescript
// src/agents/domain/agent.ts
import type { UserId } from '../../auth/domain'
import type { AgentId } from './values/ids'

export interface Agent {
  readonly id: AgentId
  readonly ownerId: UserId
  readonly name: string
  readonly createdAt: Date
  readonly updatedAt: Date
}
```

---

### 4. `src/agents/domain/prompt-version.ts` + `eval-dataset.ts` (domain entities)

**Analog:** `src/auth/application/ports/api-key-repository.port.ts` lines 3-13 (ApiKeyRow — readonly record with FK-like userId)

```typescript
// src/auth/application/ports/api-key-repository.port.ts (lines 3-13)
export interface ApiKeyRow {
  readonly id: string
  readonly userId: UserId
  readonly label: string
  readonly prefix: string
  readonly hash: string
  readonly scopes: ReadonlyArray<string>
  readonly expiresAt: Date | null
  readonly revokedAt: Date | null
  readonly createdAt: Date
}
```

**Clone: `PromptVersion`** (scalar FK `agentId`, append-only → no `updatedAt`):
```typescript
// src/agents/domain/prompt-version.ts
import type { AgentId, PromptVersionId } from './values/ids'

export interface PromptVersion {
  readonly id: PromptVersionId
  readonly agentId: AgentId
  readonly version: number
  readonly content: string
  readonly createdAt: Date
}
```

**Clone: `EvalDataset` + `EvalCase` value object** (EvalCase = simplest domain value; same immutability discipline as `Agent`/`User` interfaces above):
```typescript
// src/agents/domain/eval-dataset.ts
import type { AgentId, EvalDatasetId } from './values/ids'

export interface EvalCase {
  readonly input: string
  readonly expectedOutput: string
}

export interface EvalDataset {
  readonly id: EvalDatasetId
  readonly agentId: AgentId
  readonly name: string
  readonly cases: ReadonlyArray<EvalCase>
  readonly createdAt: Date
}
```

---

### 5. `src/agents/domain/errors.ts` (domain, error)

**Analog:** `src/auth/domain/errors.ts` lines 10-13 (InsufficientScopeError — minimal DomainError subclass)

**Imports + subclass pattern**:
```typescript
// src/auth/domain/errors.ts (lines 1, 10-13)
import { DomainError } from '../../shared/kernel/errors'

// ...
export class InsufficientScopeError extends DomainError {
  readonly code = 'INSUFFICIENT_SCOPE'
  readonly httpStatus = 403
}
```

**Clone for agents-local 500 error** (`PromptVersionConflictError` is agents-specific per RESEARCH "Anti-Patterns"; do NOT put it in shared kernel):
```typescript
// src/agents/domain/errors.ts
import { DomainError } from '../../shared/kernel/errors'

export class PromptVersionConflictError extends DomainError {
  readonly code = 'PROMPT_VERSION_CONFLICT'
  readonly httpStatus = 500
}
```

---

### 6. `src/agents/domain/index.ts` (domain barrel)

**Analog:** `src/auth/domain/index.ts` (canonical barrel — re-exports types + values + errors; keeps internal/* unexported; adds `getXxxService(ctx)` factory if domain service exists)

**Barrel pattern** (lines 1-24 from `src/auth/domain/index.ts`):
```typescript
// src/auth/domain/index.ts (excerpt)
export {
  ALLOWED_SCOPES,
  type AuthContext,
  isAgent,
  isHuman,
  type Scope,
  type UserId,
} from './auth-context'
export {
  EmailNotVerifiedError,
  InsufficientScopeError,
  ScopeNotSubsetError,
  UnauthenticatedError,
  UserIdMismatchError,
} from './errors'
export type { IdentityKind } from './identity-kind'
export { ApiKeyHash } from './values/api-key-hash'
export { Email } from './values/email'
```

**Clone for agents** (no domain service → no `getXxxService` factory in v1; add only if a stateful domain service is introduced per P3 AUX-05 pattern):
```typescript
// src/agents/domain/index.ts
export type { Agent } from './agent'
export type { PromptVersion } from './prompt-version'
export type { EvalCase, EvalDataset } from './eval-dataset'
export type { AgentId, PromptVersionId, EvalDatasetId } from './values/ids'
export { newAgentId, newPromptVersionId, newEvalDatasetId } from './values/ids'
export { PromptVersionConflictError } from './errors'
```

---

### 7. Repository Ports (`src/agents/application/ports/*.port.ts`)

**Analog:** `src/auth/application/ports/user-repository.port.ts` lines 13-25 (CRUD port shape) + `api-key-repository.port.ts` lines 15-19 (narrow query port)

**CRUD port pattern** (from `user-repository.port.ts` lines 13-25):
```typescript
export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>
  findById(userId: UserId): Promise<User | null>
  save(input: {
    id: UserId
    email: string
    emailVerified: boolean
    name: string
    image: string | null
    createdAt?: Date
    updatedAt?: Date
  }): Promise<void>
}
```

**Narrow query port pattern** (from `api-key-repository.port.ts` lines 15-19):
```typescript
export interface IApiKeyRepository {
  findByPrefix(prefix: string): Promise<ApiKeyRow | null>
  listByUserId(userId: UserId): Promise<ApiKeyRow[]>
  markRevoked(id: string, userId: UserId): Promise<boolean>
}
```

**Clone for `IAgentRepository`** (full CRUD, scoped by ownerId at repo level for list):
```typescript
// src/agents/application/ports/agent-repository.port.ts
import type { UserId } from '../../../auth/domain'
import type { Agent, AgentId } from '../../domain'

export interface IAgentRepository {
  findById(id: AgentId): Promise<Agent | null>
  listByOwner(ownerId: UserId): Promise<Agent[]>
  create(agent: Agent): Promise<Agent>
  update(agent: Agent): Promise<Agent>
  delete(id: AgentId): Promise<boolean>
}
```

**Clone for `IPromptVersionRepository`** (append-only atomic create; see RESEARCH Example 4):
```typescript
// src/agents/application/ports/prompt-version-repository.port.ts
import type { AgentId, PromptVersion, PromptVersionId } from '../../domain'

export interface CreatePromptVersionCommand {
  readonly id: PromptVersionId
  readonly agentId: AgentId
  readonly content: string
  readonly createdAt: Date
}

export interface IPromptVersionRepository {
  createAtomic(cmd: CreatePromptVersionCommand): Promise<PromptVersion | null>
  findLatestByAgent(agentId: AgentId): Promise<PromptVersion | null>
  findByAgentAndVersion(agentId: AgentId, version: number): Promise<PromptVersion | null>
  listByAgent(agentId: AgentId): Promise<PromptVersion[]>
}
```

---

### 8. Use Cases — Scope + Ownership Prologue Pattern

**Analog:** `src/auth/application/usecases/create-api-key.usecase.ts` lines 29-40 (scope-guard prologue + mismatch check)

**Core prologue pattern** (from `create-api-key.usecase.ts` lines 29-40 — note: that file does NOT check `'*'` vs `'read:*'` because write scope check is deferred to `revoke-api-key.usecase.ts` lines 12-16; P4 combines both patterns):
```typescript
// src/auth/application/usecases/create-api-key.usecase.ts (lines 29-40)
async execute(ctx: AuthContext, input: CreateApiKeyInput): Promise<CreatedApiKeyDto> {
  if (input.userId && input.userId !== ctx.userId) {
    throw new UserIdMismatchError('Cannot create API Key for another user')
  }

  if (
    !input.scopes.every(
      (scope) => ctx.scopes.includes('*') || ctx.scopes.includes(scope as Scope),
    )
  ) {
    throw new ScopeNotSubsetError('Requested key scopes must be subset of your session scopes')
  }
  // ...
}
```

**Scope-check-against-'*' variant** (from `revoke-api-key.usecase.ts` lines 12-16):
```typescript
// src/auth/application/usecases/revoke-api-key.usecase.ts (lines 12-16)
const canWrite =
  ctx.scopes.includes('*') || (ctx.scopes as ReadonlyArray<string>).includes('write:*')
if (!canWrite) {
  throw new InsufficientScopeError('This operation requires scope write:*')
}
```

**P4 CANONICAL PROLOGUE** (all P4 write use cases — D-13 locks formula to `'*'` only because `ALLOWED_SCOPES = ['*', 'read:*']` per P3 D-01; `'write:*'` is the deprecated revoke text above and must NOT be copied):
```typescript
// src/agents/application/usecases/{create,update,delete}-agent.usecase.ts — PROLOGUE
// Step 1 — Scope check (D-13). Required for ALL write use cases.
if (!ctx.scopes.includes('*')) {
  throw new InsufficientScopeError('This operation requires scope *')
}

// Step 2 — Ownership check (D-09 + D-10). Required when mutating child of Agent or mutating existing Agent.
const agent = await this.agentRepo.findById(input.agentId)
if (!agent || agent.ownerId !== ctx.userId) {
  throw new ResourceNotFoundError('Resource not found')
}
```

**Complete use-case class skeleton** (using `src/auth/application/usecases/create-api-key.usecase.ts` class shape, lines 23-63):
```typescript
// TEMPLATE — src/agents/application/usecases/update-agent.usecase.ts
import { InsufficientScopeError } from '../../../auth/domain'
import { ResourceNotFoundError } from '../../../shared/kernel/errors'
import type { AuthContext } from '../../../auth/domain'
import type { IClock } from '../../../shared/application/ports/clock.port'
import type { Agent, AgentId } from '../../domain'
import type { IAgentRepository } from '../ports/agent-repository.port'

export interface UpdateAgentInput {
  agentId: AgentId
  name: string
}

export class UpdateAgentUseCase {
  constructor(
    private readonly agentRepo: IAgentRepository,
    private readonly clock: IClock,
  ) {}

  async execute(ctx: AuthContext, input: UpdateAgentInput): Promise<Agent> {
    if (!ctx.scopes.includes('*')) {
      throw new InsufficientScopeError('This operation requires scope *')
    }
    const agent = await this.agentRepo.findById(input.agentId)
    if (!agent || agent.ownerId !== ctx.userId) {
      throw new ResourceNotFoundError('Resource not found')
    }
    const updated: Agent = { ...agent, name: input.name.trim(), updatedAt: this.clock.now() }
    return this.agentRepo.update(updated)
  }
}
```

**Read-only use case template** (`list-api-keys.usecase.ts` lines 14-20 — no prologue needed for list because repo already scopes by owner):
```typescript
// src/auth/application/usecases/list-api-keys.usecase.ts (lines 14-20) — CLONE for list-agents
export class ListApiKeysUseCase {
  constructor(private readonly identity: IIdentityService) {}

  async execute(ctx: AuthContext): Promise<ApiKeyListItemDto[]> {
    return this.identity.listApiKeysByUser(ctx.userId)
  }
}
```

P4 `ListAgentsUseCase` clones this shape exactly — no scope check (read), no ownership check (repo filters by `ctx.userId`).

**Read-single + child** use cases: DO prologue ownership on parent Agent, then call child repo (child queries already scoped by agentId implicitly safe because we validated ownership).

**CreatePromptVersion retry-loop** — see RESEARCH.md `## Code Examples → Example 4` for the complete atomic ON CONFLICT pattern. Imports cloned from `create-api-key.usecase.ts` lines 1-5 (IClock, domain, errors).

---

### 9. Drizzle Schemas (`src/agents/infrastructure/schema/*.schema.ts`)

**Analog for simple table:** `src/auth/infrastructure/schema/user.schema.ts`

```typescript
// src/auth/infrastructure/schema/user.schema.ts (full file)
import { relations } from 'drizzle-orm'
import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { account } from './account.schema'
import { session } from './session.schema'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})
```

**Analog for table with composite unique + index:** `src/auth/infrastructure/schema/api-key.schema.ts` lines 3-35 (table callback returning array with `index(...).on(...)` — canonical form)

```typescript
// src/auth/infrastructure/schema/api-key.schema.ts (lines 3-35, excerpt)
export const apikey = pgTable(
  'apikey',
  {
    id: text('id').primaryKey(),
    // ... columns ...
  },
  (table) => [
    index('apikey_configId_idx').on(table.configId),
    index('apikey_referenceId_idx').on(table.referenceId),
    index('apikey_prefix_idx').on(table.prefix),
    index('apikey_key_idx').on(table.key),
  ],
)
```

**Clone `agent.schema.ts`** (FK to user with ON DELETE CASCADE — uses `references(() => user.id, { onDelete: 'cascade' })` per RESEARCH Example 3):
```typescript
// src/agents/infrastructure/schema/agent.schema.ts
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { user } from '../../../auth/infrastructure/schema/user.schema'

export const agent = pgTable('agent', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})
```

**Clone `prompt-version.schema.ts`** (composite UNIQUE + DESC index — RESEARCH Pattern 2):
```typescript
// src/agents/infrastructure/schema/prompt-version.schema.ts
import { index, integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { agent } from './agent.schema'

export const promptVersion = pgTable(
  'prompt_version',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').notNull(),
  },
  (table) => [
    unique('prompt_version_agent_id_version_uq').on(table.agentId, table.version),
    index('prompt_version_agent_id_version_idx').on(table.agentId, table.version.desc()),
  ],
)
```

**Clone `eval-dataset.schema.ts`** (jsonb column + `.$type<T>()` phantom — RESEARCH Pattern 3):
```typescript
// src/agents/infrastructure/schema/eval-dataset.schema.ts
import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { agent } from './agent.schema'

export type PersistedEvalCase = { input: string; expectedOutput: string }

export const evalDataset = pgTable('eval_dataset', {
  id: text('id').primaryKey(),
  agentId: text('agent_id')
    .notNull()
    .references(() => agent.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  cases: jsonb('cases').notNull().$type<PersistedEvalCase[]>(),
  createdAt: timestamp('created_at').notNull(),
})
```

**Do NOT add a `relations(...)` block** — auth schema uses relations only because `userRelations` is consumed by BetterAuth; agents feature has no drizzle-relations runtime consumer. [VERIFIED: `src/shared/infrastructure/db/client.ts` lines 23-25 passes only raw tables into `drizzle(sql, { schema })`.]

---

### 10. Mappers (`src/agents/infrastructure/mappers/*.mapper.ts`)

**Analog for simple mapper:** `src/auth/infrastructure/mappers/user.mapper.ts`

```typescript
// src/auth/infrastructure/mappers/user.mapper.ts (full file)
import type { User } from '../../application/ports/user-repository.port'

export type UserDbRow = {
  id: string
  email: string
  emailVerified: boolean
  name: string
  image: string | null
  createdAt: Date
  updatedAt: Date
}

export const UserMapper = {
  toDomain(row: UserDbRow): User {
    return {
      id: row.id as User['id'],
      email: row.email,
      emailVerified: row.emailVerified,
      name: row.name,
      image: row.image,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  },
}
```

**Analog for mapper with defensive parse** (for jsonb): `src/auth/infrastructure/mappers/api-key.mapper.ts` lines 17-26 (`parseScopes` filter — defensive read-path parse of serialized data that could be malformed):
```typescript
// src/auth/infrastructure/mappers/api-key.mapper.ts (lines 17-26)
function parseScopes(metadata: string | null): ReadonlyArray<string> {
  if (!metadata) return []
  try {
    const value = JSON.parse(metadata) as { scopes?: unknown }
    if (!value || !Array.isArray(value.scopes)) return []
    return value.scopes.filter((scope): scope is string => typeof scope === 'string')
  } catch {
    return []
  }
}
```

**Clone for `EvalDatasetMapper.parseCases`** (RESEARCH Example for jsonb cases — defensive parse of `unknown` jsonb value):
```typescript
// src/agents/infrastructure/mappers/eval-dataset.mapper.ts — parseCases helper
function parseCases(raw: unknown): EvalCase[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (c): c is EvalCase =>
      typeof c === 'object' &&
      c !== null &&
      typeof (c as Record<string, unknown>).input === 'string' &&
      typeof (c as Record<string, unknown>).expectedOutput === 'string',
  )
}
```

`AgentMapper` + `PromptVersionMapper` clone `UserMapper` shape directly (no defensive parse needed for scalar columns).

---

### 11. Repositories (`src/agents/infrastructure/repositories/drizzle-*.repository.ts`)

**Analog for CRUD:** `src/auth/infrastructure/repositories/drizzle-user.repository.ts` (uses `.onConflictDoUpdate` upsert pattern + simple `eq()` query)

```typescript
// src/auth/infrastructure/repositories/drizzle-user.repository.ts (lines 8-14, 32-52)
export class DrizzleUserRepository implements IUserRepository {
  constructor(private readonly db: DrizzleDb) {}

  async findByEmail(email: string) {
    const rows = await this.db.select().from(user).where(eq(user.email, email)).limit(1)
    return rows[0] ? UserMapper.toDomain(rows[0]) : null
  }
  // ...
  async save(input: ...) {
    await this.db.insert(user).values({...}).onConflictDoUpdate({...})
  }
}
```

**Analog for query-rich repo:** `src/auth/infrastructure/repositories/drizzle-api-key.repository.ts` lines 1-49 (imports `and, desc, eq, gt, isNull, or` — comprehensive operator usage; `markRevoked` returns boolean from `.returning({id})` check):
```typescript
// src/auth/infrastructure/repositories/drizzle-api-key.repository.ts (lines 1-9, 38-48)
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm'
import type { DrizzleDb } from '../../../shared/infrastructure/db/client'
import type { ApiKeyRow, IApiKeyRepository } from '../../application/ports/api-key-repository.port'
import { ApiKeyMapper } from '../mappers/api-key.mapper'
import { apikey } from '../schema/api-key.schema'

export class DrizzleApiKeyRepository implements IApiKeyRepository {
  constructor(private readonly db: DrizzleDb) {}
  // ...
  async markRevoked(id: string, userId: ApiKeyRow['userId']): Promise<boolean> {
    const result = await this.db
      .update(apikey)
      .set({ enabled: false, updatedAt: new Date() })
      .where(and(eq(apikey.id, id), eq(apikey.referenceId, userId), eq(apikey.enabled, true)))
      .returning({ id: apikey.id })
    return result.length > 0
  }
}
```

**Clone for `DrizzleAgentRepository`** — full CRUD with `.returning()` for create/update, boolean `delete` via `.returning()` length check (same idiom).

**Clone for `DrizzlePromptVersionRepository.createAtomic`** — use `db.execute(sql\`INSERT ... ON CONFLICT (agent_id, version) DO NOTHING RETURNING ...\`)` per RESEARCH Example 4 (lines 976-994). This is a DEPARTURE from the query-builder idiom because Drizzle 0.45.2 `.onConflictDoNothing()` on an `.insert().values(...)` does not compose cleanly with `SELECT MAX(...) + 1` subquery — `sql\`...\`` template is required. Imports `sql` from `drizzle-orm`.

---

### 12. Controllers (`src/agents/presentation/controllers/*.controller.ts`)

**Primary analog:** `src/auth/presentation/controllers/api-key.controller.ts` (full CRUD + TypeBox DTO wiring + AuthContext cast + `requireAuth: true`)

**Imports pattern** (lines 1-8):
```typescript
// src/auth/presentation/controllers/api-key.controller.ts (lines 1-8)
import { Type } from '@sinclair/typebox'
import { Elysia } from 'elysia'
import type { CreateApiKeyUseCase } from '../../application/usecases/create-api-key.usecase'
import type { ListApiKeysUseCase } from '../../application/usecases/list-api-keys.usecase'
import type { RevokeApiKeyUseCase } from '../../application/usecases/revoke-api-key.usecase'
import type { AuthContext, Scope } from '../../domain'
import { CreateApiKeyBodySchema, CreateApiKeyResponseSchema } from '../dtos/create-api-key.dto'
import { ListApiKeysResponseSchema } from '../dtos/list-api-keys.dto'
```

**AuthContext cast idiom (MANDATORY)** — lines 25, 57, 80 of `api-key.controller.ts` — RESEARCH Pitfall 3 explicitly forbids `@ts-ignore` or `(context as any).authContext`; **use this exact cast in every P4 controller handler**:
```typescript
const authContext = (context as unknown as { authContext: AuthContext }).authContext
```

**POST handler + scope decorations** (lines 22-53):
```typescript
// src/auth/presentation/controllers/api-key.controller.ts (lines 22-53)
.post(
  '/api-keys',
  async (context) => {
    const authContext = (context as unknown as { authContext: AuthContext }).authContext
    const { body, set } = context
    const input = {
      label: body.label,
      scopes: body.scopes ?? ['*'],
      ...(body.userId !== undefined ? { userId: body.userId } : {}),
      ...(body.expiresAt !== undefined ? { expiresAt: new Date(body.expiresAt) } : {}),
    }
    const result = await deps.createApiKey.execute(authContext, input)
    set.status = 201
    return { ...result, /* Date→ISO string conversions */ }
  },
  {
    body: CreateApiKeyBodySchema,
    response: { 201: CreateApiKeyResponseSchema },
    requireAuth: true,
    detail: {
      summary: 'Create an API key',
      tags: ['api-keys'],
      security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
    },
  },
)
```

**GET list + 200 response + cast** (lines 54-76), **DELETE with params + 204** (lines 77-94) — same controller lines 54-94.

**Controller factory wiring** (lines 20-21 + closure ending):
```typescript
export function apiKeyController(deps: ApiKeyControllerDeps) {
  return new Elysia({ name: 'rigging/api-key-controller' })
    // ...
}
```

**For `prompt-version.controller.ts` + `eval-dataset.controller.ts` nested routes** — use Elysia constructor prefix (RESEARCH Pattern 6):
```typescript
// Clone — src/agents/presentation/controllers/prompt-version.controller.ts
return new Elysia({ name: 'rigging/prompt-version-controller', prefix: '/agents/:agentId' })
  .post('/prompts', ..., { params: Type.Object({ agentId: Type.String({ minLength: 1 }) }), /* body, response, requireAuth, detail */ })
  .get('/prompts/latest', ..., { ... })
  .get('/prompts/:version', ..., { ... })
  .get('/prompts', ..., { ... })
```

**`me.controller.ts` read-only single-endpoint pattern** (lines 16-34) is the simplest analog if planner prefers to split `get-agent.controller.ts` as a standalone instance; both are valid per P3 controllers (`authController` + `apiKeyController` + `meController` are three separate Elysia instances `.use()`'d together).

---

### 13. DTOs (`src/agents/presentation/dtos/*.dto.ts`)

**Analog:** `src/auth/presentation/dtos/create-api-key.dto.ts` (TypeBox + `Static` type export + source-of-truth constant import)

**Complete pattern** (full file, lines 1-26):
```typescript
// src/auth/presentation/dtos/create-api-key.dto.ts (full)
import { type Static, Type } from '@sinclair/typebox'
import { ALLOWED_SCOPES } from '../../domain'

const [fullAccessScope, readOnlyScope] = ALLOWED_SCOPES
export const ScopeSchema = Type.Union([Type.Literal(fullAccessScope), Type.Literal(readOnlyScope)])

export const CreateApiKeyBodySchema = Type.Object({
  userId: Type.Optional(Type.String({ minLength: 1 })),
  label: Type.String({ minLength: 1, maxLength: 64 }),
  scopes: Type.Optional(Type.Array(ScopeSchema)),
  expiresAt: Type.Optional(Type.String({ format: 'date-time' })),
})

export const CreateApiKeyResponseSchema = Type.Object({
  id: Type.String(),
  key: Type.String(),
  prefix: Type.String(),
  label: Type.String(),
  scopes: Type.Array(ScopeSchema),
  expiresAt: Type.String({ format: 'date-time' }),
  createdAt: Type.String({ format: 'date-time' }),
})

export type CreateApiKeyBody = Static<typeof CreateApiKeyBodySchema>
export type CreateApiKeyResponse = Static<typeof CreateApiKeyResponseSchema>
```

**P4 clone — `create-eval-dataset.dto.ts`** (RESEARCH Example Pattern 3 — DTO is the runtime validation for jsonb cases per D-04):
```typescript
// src/agents/presentation/dtos/create-eval-dataset.dto.ts
import { type Static, Type } from '@sinclair/typebox'

export const EvalCaseSchema = Type.Object({
  input: Type.String(),
  expectedOutput: Type.String(),
})

export const CreateEvalDatasetBodySchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 128 }),
  cases: Type.Array(EvalCaseSchema, { minItems: 1 }),
})

export type CreateEvalDatasetBody = Static<typeof CreateEvalDatasetBodySchema>
export type EvalCase = Static<typeof EvalCaseSchema>
```

`create-agent.dto.ts` + `update-agent.dto.ts` + `create-prompt-version.dto.ts` — clone structure of `create-api-key.dto.ts` but skip `ScopeSchema` (no scope in bodies).

---

### 14. `src/agents/agents.module.ts` (factory)

**Primary analog:** `src/auth/auth.module.ts` (full file, lines 1-85)

**Imports pattern** (lines 1-21) — module file centralizes all wiring:
```typescript
// src/auth/auth.module.ts (lines 1-20, excerpt)
import { Elysia } from 'elysia'
import type { Logger } from 'pino'
import type { Config } from '../bootstrap/config'
import type { DrizzleDb } from '../shared/infrastructure/db/client'
import { CreateApiKeyUseCase } from './application/usecases/create-api-key.usecase'
// ... (other use cases)
import { DrizzleApiKeyRepository } from './infrastructure/repositories/drizzle-api-key.repository'
import { apiKeyController } from './presentation/controllers/api-key.controller'
import { authController } from './presentation/controllers/auth.controller'
import { meController } from './presentation/controllers/me.controller'
import { authContextPlugin } from './presentation/plugins/auth-context.plugin'
```

**Deps interface** (lines 22-28):
```typescript
export interface AuthModuleDeps {
  db: DrizzleDb
  logger: Logger
  config: Pick<Config, 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL'>
  clock?: { now(): Date }
  authInstance?: AuthInstance
}
```

**Factory wiring** (lines 30-84 — the canonical "infra → usecase → controller → Elysia plugin" shape; P4 skips mount+plugin-macro since P3 provides those):
```typescript
export function createAuthModule(deps: AuthModuleDeps) {
  const clock = deps.clock ?? { now: () => new Date() }
  // ... adapters ...
  const apiKeyRepo = new DrizzleApiKeyRepository(deps.db)
  const identity = new BetterAuthIdentityService(auth, apiKeyRepo)

  const createApiKey = new CreateApiKeyUseCase(identity, clock)
  const listApiKeys = new ListApiKeysUseCase(identity)
  const revokeApiKey = new RevokeApiKeyUseCase(identity)

  return new Elysia({ name: 'rigging/auth' })
    .mount('/', auth.handler)
    .use(authContextPlugin({ identity }))
    .use(authController({ ... }))
    .use(apiKeyController({ createApiKey, listApiKeys, revokeApiKey }))
    .use(meController())
}
```

**Simpler analog:** `src/health/health.module.ts` (lines 1-26, full file) — 26-line minimal factory, no plugin macro, no `.mount()`. P4 shape is closer to this than to auth.module.ts because P4 does NOT re-mount `authContextPlugin` (RESEARCH anti-pattern "Don't make the macro `requireAuth` a per-controller plugin").

```typescript
// src/health/health.module.ts (full file)
import { Elysia } from 'elysia'
import type { DrizzleDb } from '../shared/infrastructure/db/client'
import type { IDbHealthProbe } from './application/ports/db-health-probe.port'
import { CheckHealthUseCase, type IClock } from './application/usecases/check-health.usecase'
import { DrizzleDbHealthProbe } from './infrastructure/drizzle-db-health-probe'
import { healthController } from './presentation/controllers/health.controller'

export interface HealthModuleDeps {
  db: DrizzleDb
  clock?: IClock
  probe?: IDbHealthProbe
}

export function createHealthModule(deps: HealthModuleDeps) {
  const clock: IClock = deps.clock ?? { now: () => new Date() }
  const probe: IDbHealthProbe = deps.probe ?? new DrizzleDbHealthProbe(deps.db)
  const checkHealth = new CheckHealthUseCase(probe, clock)
  return new Elysia({ name: 'rigging/health' }).use(healthController({ checkHealth }))
}
```

**P4 clone shape** (RESEARCH Example Pattern 5, lines 509-552) — DO NOT re-include `authContextPlugin({ identity })`; macro scope `global` from P3 means `requireAuth: true` works on routes declared in any plugin composed after `createAuthModule`.

---

### 15. `src/bootstrap/app.ts` (MOD — one-line append)

**Analog:** `src/bootstrap/app.ts` itself (lines 42-61 — existing `createApp` function; add one `.use(createAgentsModule(...))` call)

**Current canonical ordering** (lines 54-61 — ADR 0012):
```typescript
// src/bootstrap/app.ts (lines 54-61)
return new Elysia({ name: 'rigging/app' })
  .use(requestLoggerPlugin(logger))
  .use(corsPlugin())
  .use(errorHandlerPlugin(logger))
  .use(swaggerPlugin())
  .use(createAuthModule(authDeps))
  .use(createHealthModule(healthDeps))
```

**Required P4 mod** (insert `createAgentsModule` between `createAuthModule` and `createHealthModule`, or after health — both valid; CONTEXT code_context line 248 says "接 auth"; ADR 0012 rule is "feature modules after horizontal plugins" and order between feature modules is free):
```typescript
.use(createAuthModule(authDeps))
.use(createAgentsModule({ db, logger, clock }))   // NEW
.use(createHealthModule(healthDeps))
```

Imports section (lines 1-14) gets one new line: `import { createAgentsModule } from '../agents/agents.module'`.

---

### 16. `drizzle/0002_demo_domain.sql` (generated migration)

**Analog:** `drizzle/0001_auth_foundation.sql` (full file, 82 lines — canonical migration shape with `--> statement-breakpoint` separators + `CREATE TABLE` + `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ... REFERENCES ... ON DELETE cascade` + `CREATE INDEX`)

**Shape to expect** (lines 1-82 — excerpts):
```sql
-- drizzle/0001_auth_foundation.sql (lines 17-40, excerpt — apikey shape)
CREATE TABLE "apikey" (
    "id" text PRIMARY KEY NOT NULL,
    -- ...
    "created_at" timestamp NOT NULL,
    "updated_at" timestamp NOT NULL,
    -- ...
);
--> statement-breakpoint

-- (lines 74-75 — FK + cascade)
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- (lines 76-82 — indexes)
CREATE INDEX "apikey_prefix_idx" ON "apikey" USING btree ("prefix");
```

**Generation rule** — DO NOT hand-write the SQL. Run `bunx drizzle-kit generate --name=demo_domain` after schema files are in place. `drizzle.config.ts` already globs `src/**/infrastructure/schema/*.ts` per CONTEXT code_context line 263. The output is **commit-as-is** per P1/P3 convention. The file will contain `agent` + `prompt_version` + `eval_dataset` CREATE TABLE, their FK constraints, the `unique` on prompt_version, the index with DESC sort, and will NOT touch auth tables (drizzle-kit diffs against existing meta).

---

### 17. Tests — `tests/integration/agents/`

#### 17a. `tests/integration/agents/_helpers.ts`

**Analog:** `tests/integration/auth/_helpers.ts` (474 lines — canonical harness factory `makeTestApp()` + seeding utilities `signUpAndSignIn`, `insertTestApiKey`)

**Imports pattern** (lines 1-35 — extensive absolute imports against `src/...`):
```typescript
// tests/integration/auth/_helpers.ts (lines 1-35 excerpt)
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { serializeSignedCookie } from 'better-call'
import { Elysia } from 'elysia'
// ... src/* imports ...
import { authContextPlugin } from '../../../src/auth/presentation/plugins/auth-context.plugin'
import type { Config } from '../../../src/bootstrap/config'
import { createDbClient, type DbClient, type DrizzleDb } from '../../../src/shared/infrastructure/db/client'
```

**TEST_CONFIG constant** (lines 36-44):
```typescript
export const TEST_CONFIG: Config = {
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://rigging:rigging_dev_password@localhost:5432/rigging',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  // ...
}
```

**`insertTestApiKey` helper** (lines 240-293) — direct raw SQL insert bypassing use case; P4 `_helpers.ts` will re-export this + add `insertTestAgent(sql, ownerId, name)` + `insertTestPromptVersion(sql, agentId, content)` helpers following same pattern.

**`makeTestApp()` factory** (lines 329-476) — full app harness using `createDbClient` + `makeAuth` + hand-wired controllers + `resolveAuthContext` helper. P4 harness extends this by calling `.use(createAgentsModule({ db, logger, clock }))` on the returned Elysia app (or by running a parallel `makeTestAgentsApp()` that includes both auth + agents modules).

**P4 extension approach** (see RESEARCH Example 5 comment lines 1034-1036 — "Plan 04-04 will augment _helpers.ts or add an agents-specific helper that also wires createAgentsModule"). Prefer direct extension of `makeTestApp()` — one harness, both auth + agents routes available.

**Cleanup pattern** for `afterAll` (lines 17-24 of `api-key-crud.test.ts`):
```typescript
afterAll(async () => {
  await harness.sql`DELETE FROM "apikey" WHERE reference_id = ${userId}`
  await harness.sql`DELETE FROM "account" WHERE user_id = ${userId}`
  await harness.sql`DELETE FROM "session" WHERE user_id = ${userId}`
  await harness.sql`DELETE FROM "verification" WHERE identifier = ${email}`
  await harness.sql`DELETE FROM "user" WHERE id = ${userId}`
  await harness.dispose()
})
```

P4 tests prepend `"prompt_version"`, `"eval_dataset"`, `"agent"` deletes before `"apikey"` (children first, then parent) — or rely on `ON DELETE CASCADE` by deleting from `"agent"` directly with `WHERE owner_id = ${userId}`.

#### 17b. `tests/integration/agents/dogfood-self-prompt-read.test.ts` (DEMO-04)

**Primary analog:** `tests/integration/auth/me-endpoint.test.ts` (identity-kind routing via cookie-vs-x-api-key header)

```typescript
// tests/integration/auth/me-endpoint.test.ts (lines 28-50 — identity routing test)
test('API-key-only /me returns agent identity; cookie-only /me returns human identity', async () => {
  const agentRes = await harness.app.handle(
    new Request('http://localhost/me', {
      headers: { 'x-api-key': rawKey },
    }),
  )
  expect(agentRes.status).toBe(200)
  const agentBody = (await agentRes.json()) as Record<string, unknown>
  expect(agentBody.identityKind).toBe('agent')
  // ...
})
```

**Full 4-variant shape:** RESEARCH Example 5 lines 1029-1132 (complete test file scaffold with all 4 DEMO-04 variants — clone verbatim).

#### 17c. `tests/integration/agents/scope-check-read-only-key.test.ts` (DEMO-05)

**Analog:** `tests/integration/auth/macro-scope-global.test.ts` (scope-check smoke test, lines 1-43 — tests protected vs public route contrast)

For DEMO-05, clone shape: create read-only API key via `insertTestApiKey(sql, userId, { scopes: ['read:*'] })`, POST to `/agents/:agentId/prompts` with that key, assert `res.status === 403` + `body.error.code === 'INSUFFICIENT_SCOPE'`.

#### 17d. `tests/integration/agents/cross-user-404.test.ts` (D-09)

Clone the 3-4 variant shape from dogfood test variant 3 (RESEARCH Example 5 lines 1111-1119) and repeat for: GET `/agents/:id`, DELETE `/agents/:id`, POST `/agents/:id/prompts`. All return `404 RESOURCE_NOT_FOUND`.

#### 17e. `tests/integration/agents/prompt-version-monotonic.test.ts` (D-06 race test)

**Analog:** None in P3 tests (no concurrent-write race test exists). Shape: use `Promise.all([10 POST requests])` → assert 10 distinct versions, no holes. RESEARCH Example 6 lines 1135-1139+ is the scaffold (partial shown in research; planner expands).

#### 17f. `tests/integration/agents/cascade-delete.test.ts` (D-12)

Clone `api-key-crud.test.ts` shape (lines 1-87 — full POST+GET+DELETE). After DELETE agent, assert that `SELECT FROM prompt_version WHERE agent_id = $1` returns 0 rows and `SELECT FROM eval_dataset WHERE agent_id = $1` returns 0 rows. Use `harness.sql\`SELECT ...\`` direct queries.

---

### 18. `docs/decisions/0017-eval-dataset-shape-jsonb-immutable.md`

**Analog:** `docs/decisions/0013-api-key-storage-hash-plus-index.md` (comparable scope — feature-level schema decision)

**Full ADR shape** (lines 1-75 of 0013 — frontmatter + sections):
```yaml
---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/phases/04-demo-domain/04-CONTEXT.md D-01..D-05 D-17
informed: future AI Agents and future maintainers
---

# 0017. EvalDataset Shape Frozen at v1 (jsonb cases, immutable after creation)

## Context and Problem Statement
[...]

## Decision Drivers
- D-03 / D-04 / D-05 (CONTEXT 04)
- [...]

## Considered Options
- **Option A — jsonb cases, immutable, DELETE-only (chosen)**
- Option B — normalized eval_case table + FK
- Option C — jsonb cases + PATCH append endpoint

## Decision Outcome
Chosen option: **A — ...**, because: [...]

### Consequences
Good
- [...]
Bad
- [...]
Note
- v2 normalization path: new ADR supersedes this one [...]

## Pros and Cons of the Options
[...]

## References
- `.planning/phases/04-demo-domain/04-CONTEXT.md` D-01..D-05, D-17
- ADR 0003 DDD layering
- ADR 0005 ORM Drizzle
- [...]
```

Clone frontmatter + section headings exactly from ADR 0013. Sections 4+ vary per decision content.

---

### 19. `docs/decisions/README.md` (MOD — one-line append)

**Analog:** `docs/decisions/README.md` itself (lines 1-27 — canonical index table, last row at line 25)

**Append row** (format per existing lines 10-25):
```markdown
| [0017](0017-eval-dataset-shape-jsonb-immutable.md) | EvalDataset Shape Frozen at v1 (jsonb cases, immutable) | accepted | 2026-04-19 | — |
```

Conditional: if D-16 triggers, append a second row for ADR 0018.

---

## Shared Patterns

These cross-cutting patterns apply to multiple P4 files. All planner action sections should reference these by name rather than re-stating them.

### A. AuthContext Macro (P3-provided; P4 consumes, never reinstalls)

**Source:** `src/auth/presentation/plugins/auth-context.plugin.ts` + mounted in `src/auth/auth.module.ts` line 67
**Applies to:** all P4 controllers

All P4 controllers declare `requireAuth: true` in route `options` — the macro is mounted globally by `createAuthModule` (scope `global` from P3 D-11 + ADR 0007). Re-mounting the plugin in `createAgentsModule` is an **anti-pattern** (RESEARCH "Don't make the macro a per-controller plugin"). Never import `authContextPlugin` in `src/agents/`.

### B. AuthContext Cast Idiom

**Source:** `src/auth/presentation/controllers/api-key.controller.ts` lines 25, 57, 80
**Applies to:** every P4 controller handler

Elysia 1.4.28 does not narrow macro-derived context types across `.use()` plugin boundaries. The P3-established cast:

```typescript
const authContext = (context as unknown as { authContext: AuthContext }).authContext
```

**NEVER** use `@ts-ignore`, `@ts-expect-error`, or `(context as any).authContext`. Violating this is a D-15 structural friction event (log it).

### C. Scope-Then-Ownership Prologue

**Source:** `src/auth/application/usecases/create-api-key.usecase.ts` lines 29-40 (scope-subset form) + ordering rule from RESEARCH Pitfall 5
**Applies to:** every P4 write use case; ownership-only for P4 read use cases that touch a specific Agent / child

Scope check **FIRST** (throws 403 `INSUFFICIENT_SCOPE` regardless of agent ownership), ownership check **SECOND** (throws 404 `RESOURCE_NOT_FOUND`). Reversing the order leaks read-only-key-with-bad-target into 404 where DEMO-05 requires 403.

### D. Error Body Shape (P2-provided)

**Source:** `src/shared/presentation/plugins/error-handler.plugin.ts` lines 17-40
**Applies to:** all thrown DomainErrors propagated from P4 use cases → controllers

Error handler reads `err.httpStatus` + `err.code` + `err.message` automatically. P4 authors never touch HTTP response shaping for errors. New errors only need to subclass `DomainError` with `readonly code = '...'` and `readonly httpStatus = XXX`. Body is uniform `{ error: { code, message, requestId } }` per P2 D-12.

### E. Drizzle Schema Conventions (P1 + P3)

**Source:** `src/auth/infrastructure/schema/{user,api-key}.schema.ts` + `drizzle.config.ts`
**Applies to:** all P4 schema files

- `text('id').primaryKey()` — **not** `uuid().defaultRandom()` (RESEARCH "Don't hand-roll"; domain generates UUIDs via `newUUID<K>()`)
- `timestamp('created_at').notNull()` — NO `.defaultNow()` on infrastructure-owned timestamps (let domain/clock set them via mapper `toPersistence`; P3 user.schema uses `defaultNow` because BetterAuth manages that column — P4 does not; match `api-key.schema.ts` which has no `.defaultNow()` on `created_at`)
- `references(() => parent.id, { onDelete: 'cascade' })` — for child-to-parent FKs
- snake_case column names (`owner_id`, `created_at`, `agent_id`)
- Table callback returns array: `(table) => [ unique(...).on(...), index(...).on(...) ]`
- `.asc()` / `.desc()` on index columns for directional sort hints (P4 `prompt_version` index uses `.desc()` on `version`)

### F. Mapper Contract

**Source:** ARCH-03 + `src/auth/infrastructure/mappers/{user,api-key}.mapper.ts`
**Applies to:** all P4 mappers

- Accept `XxxDbRow` type declared in mapper file (NOT `InferSelectModel<typeof table>` — decouple domain from Drizzle's internal type machinery; keeps P1 Biome rules happy)
- Return domain entity type imported from domain (or port in auth case — P4 imports from `../../domain`)
- Cast scalar ID columns to branded types: `id: row.id as User['id']`
- Defensive parse for jsonb or serialized columns (follow `ApiKeyMapper.parseScopes` lines 17-26 pattern)

### G. Repository Contract

**Source:** ARCH-03 + `src/auth/infrastructure/repositories/drizzle-*.repository.ts`
**Applies to:** all P4 repositories

- Constructor: `constructor(private readonly db: DrizzleDb) {}` — single dependency
- Class implements port interface from `application/ports/`
- **Returns mapped domain entities, not Drizzle rows** — `ApiKeyMapper.toDomain(row)` is the canonical idiom
- **Stateless** — no AuthContext parameter; filtering by `ownerId` is passed explicitly from the use case via `ctx.userId`
- Drizzle operator imports: `and, eq, desc` basic set from `'drizzle-orm'`; add `gt, isNull, or` for complex where; add `sql` for raw SQL paths (PromptVersion ON CONFLICT)

### H. Feature Module Factory Shape

**Source:** `src/health/health.module.ts` (minimal — 26 lines) + `src/auth/auth.module.ts` (complex — 85 lines)
**Applies to:** `src/agents/agents.module.ts`

- Export `export interface AgentsModuleDeps { db: DrizzleDb; logger?: Logger; clock?: IClock }`
- Export `export function createAgentsModule(deps: AgentsModuleDeps)` returning `Elysia`
- Order inside factory: default-fill optional deps → repo instances → use-case instances → `new Elysia({ name: 'rigging/agents' }).use(controller1).use(controller2)...`
- Name suffix `'rigging/<feature>'` for debuggability

### I. TypeBox DTO Idiom

**Source:** `src/auth/presentation/dtos/create-api-key.dto.ts` + `list-api-keys.dto.ts`
**Applies to:** every P4 DTO file

- Import `type Static, Type` from `'@sinclair/typebox'`
- Export `XxxBodySchema` + `XxxResponseSchema` as const schemas
- Export `type XxxBody = Static<typeof XxxBodySchema>` + `type XxxResponse = Static<typeof XxxResponseSchema>` for use-case inputs and controller handler signatures
- Date fields: `Type.String({ format: 'date-time' })` (never `Type.Date()` — response is JSON, serialized via `.toISOString()`)
- Length bounds: `Type.String({ minLength: 1, maxLength: 128 })` for names/labels

### J. Domain Barrel + Internal Boundary

**Source:** `src/auth/domain/index.ts` + biome `noRestrictedImports` rules (P1 D-09)
**Applies to:** `src/agents/domain/index.ts`

- `internal/` directory contents NEVER exported from barrel
- If agents introduces a domain service (not anticipated in v1 per CONTEXT), wrap it in `getAgentService(ctx)` factory matching `getApiKeyService(ctx)` pattern at lines 31-47 of auth domain index
- All public agents domain types + factory constructors (`newAgentId`, etc.) exported here; this is what `application/`, `infrastructure/`, `presentation/` import

### K. Integration Test Harness Reuse

**Source:** `tests/integration/auth/_helpers.ts` (makeTestApp + insertTestApiKey + signUpAndSignIn)
**Applies to:** all P4 integration tests

- P4 tests import from `../auth/_helpers` OR from a new `../agents/_helpers` that re-exports from auth helpers
- Reuse `makeTestApp()` factory directly where possible; extend by calling `.use(createAgentsModule(...))` on the returned Elysia
- Test file naming: `<what-it-verifies>.test.ts` (integration) or `<cve-or-regression-name>.regression.test.ts` (regression)
- `beforeAll` + `afterAll` per describe block; `afterAll` always cleans DB rows + calls `harness.dispose()`
- Request helper: `harness.app.handle(new Request('http://localhost/...', { method, headers, body }))` — Elysia's `.handle()` bypasses HTTP stack

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.planning/phases/04-demo-domain/04-HARNESS-FRICTION.md` | planning/log | append-only log | Novel document type introduced by P4 CONTEXT D-15; shape locked by decision text (entry: `- [YYYY-MM-DD HH:MM] [P4-XX-PLAN] symptom: ... | workaround: ... | structural: yes/no`). Planner uses CONTEXT `<specifics>` template directly (04-CONTEXT.md lines 332-355). |
| `tests/integration/agents/prompt-version-monotonic.test.ts` | test/integration | concurrent-write race | No existing concurrent-write race test in the codebase. RESEARCH Example 6 provides partial scaffold; planner must author the full test using `Promise.all([POST...])` shape — closest structural relative is `tests/integration/auth/timing-safe-apikey.regression.test.ts` (1000-iteration timing test) but data-flow is different. |

---

## Metadata

**Analog search scope:**
- `src/auth/**` (23 files) — primary analog source for every P4 file
- `src/health/**` (5 files) — minimal module factory reference
- `src/shared/kernel/**` (5 files) — brand types, errors, Result
- `src/shared/infrastructure/db/client.ts` + `src/shared/presentation/plugins/error-handler.plugin.ts` — wiring + error handling
- `src/bootstrap/app.ts` — root composition
- `tests/integration/auth/**` (16 files) — test harness + per-concern test pattern
- `drizzle/0001_auth_foundation.sql` — migration shape
- `docs/decisions/0013-api-key-storage-hash-plus-index.md` — ADR MADR 4.0 shape
- `docs/decisions/README.md` — ADR index table

**Files scanned:** ~60 source + test files under `src/` + `tests/integration/` + `drizzle/` + `docs/decisions/`

**Pattern extraction date:** 2026-04-19

**Key observation:** P4 is a near-total clone of `src/auth/**` with renaming + minor data-flow shifts (append-only PromptVersion via ON CONFLICT, jsonb EvalDataset, nested sub-resource routes). Every non-trivial new file has an exact or role-matched analog. The single novel pattern is `PromptVersion.createAtomic` using `db.execute(sql\`INSERT ... ON CONFLICT ... RETURNING\`)`, which has no analog in auth (API keys are inserted by BetterAuth, not by direct Drizzle) but is fully documented in RESEARCH Example 4 + Pitfall 2. This clone-heavy structure IS the P4 harness test: if cloning `src/auth/` into `src/agents/` produces >3 D-15 friction events, ADR 0018 triggers.
