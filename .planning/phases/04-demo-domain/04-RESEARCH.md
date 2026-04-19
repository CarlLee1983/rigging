# Phase 4: Demo Domain - Research

**Researched:** 2026-04-19
**Domain:** Elysia 1.4.28 + Drizzle 0.45.2 + postgres-js 3.4.9 DDD feature module (Agent / PromptVersion / EvalDataset) on top of Phase 3 AuthContext macro
**Confidence:** HIGH

## Summary

Phase 4 is implementation-depth research on top of a heavily pre-decided CONTEXT (16 locked D-xx decisions + 1 mandatory ADR). The job here is **not** to re-open decisions but to supply planner-ready syntax, exact version-aware patterns, reproducible pitfalls, and code that can be lifted into tasks. The feature is `src/agents/` — a second feature module after `src/auth/` (P3) that must prove `createXxxModule(deps): Elysia` factory pattern composes without friction. Critical technical pivot points are:

1. **Drizzle 0.45.2 + postgres-js 3.4.9 — UNIQUE violation detection.** Verified via Context7: postgres-js throws `sql.PostgresError` with `code === '23505'` and `constraint_name` populated. Drizzle does not wrap/rename this — it propagates the underlying postgres-js error through the call chain. `INSERT ... ON CONFLICT (agent_id, version) DO NOTHING RETURNING *` is the atomic alternative and is the **recommended** path because it eliminates the TOCTOU (time-of-check / time-of-use) gap between the SELECT MAX + INSERT that retry-loops try to paper over. Both paths satisfy D-06 contractually.

2. **jsonb with `.$type<T>()` is compile-time only.** Drizzle's `$type<>()` is pure phantom typing — zero runtime validation. TypeBox at the controller DTO boundary is the single source of truth that protects `cases` integrity on write; read-path defensive parsing is required because older rows could violate the type (especially during future schema evolution before ADR 0017 is superseded).

3. **Elysia nested sub-resource routing** — `/agents/:agentId/prompts/:version` fits cleanly into `new Elysia({ prefix: '/agents/:agentId' }).get('/prompts/:version', ...)` per Elysia 1.4 docs. The `prefix` constructor option, not `.group()`, is idiomatic because it lets each resource controller (`agent.controller.ts`, `prompt-version.controller.ts`, `eval-dataset.controller.ts`) be a free-standing Elysia instance that `createAgentsModule` composes via `.use()` — same wire shape as `authController / apiKeyController / meController` in P3.

4. **`requireAuth: true` macro propagation from P3 is automatic.** P3 mounted `authContextPlugin` with `scope: 'global'` (ADR 0007 + P3 D-11); once `createAgentsModule` is wired after `createAuthModule` in `createApp`, every P4 controller just declares `requireAuth: true` in the route `options` object — no re-mount of the macro, no additional plugin. The same `(context as unknown as { authContext: AuthContext }).authContext` cast used throughout `src/auth/presentation/controllers/` is the idiomatic pattern; P4 clones it verbatim.

5. **Ownership-404 pattern uses a 2-step use case prologue** — scope check first, then `findById + ownerId check → ResourceNotFoundError`. This sequence matches P3's scope-first idiom (P3 D-02) and collapses three cross-user scenarios (read, update, delete) into one error type. Putting `ResourceNotFoundError` in `src/shared/kernel/errors.ts` (confirmed appropriate slot — DomainError family already lives there) makes it reusable by future features without agents coupling.

**Primary recommendation:** Ship Phase 4 as **4 plans** — (Plan 04-01) domain + ports + schema + migration; (Plan 04-02) infrastructure (mappers, repos) + use cases with UNIQUE-violation handling via `onConflictDoNothing + RETURNING`; (Plan 04-03) controllers + DTOs + `createAgentsModule` + createApp wire; (Plan 04-04) integration tests (dogfood + scope + cross-user 404 + concurrent version + cascade) + ADR 0017 ship + 04-HARNESS-FRICTION.md tally verification. Keep `ADR 0018` conditional — only ship if D-16 triggers during plan execution.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Aggregate / Schema Shape:**
- **D-01** — `Agent` aggregate root: `{ id: AgentId (UUID), ownerId: UserId, name: string, createdAt: Date, updatedAt: Date }`. Drizzle schema落點: `src/agents/infrastructure/schema/agent.schema.ts`.
- **D-02** — `PromptVersion` 為 child entity: `{ id, agentId, version: number, content: string (text/plain), createdAt }`.
- **D-03** — `EvalDataset` 為 child entity: `{ id, agentId, name, cases: jsonb, createdAt }`. cases 型別 `Array<{ input: string, expectedOutput: string }>`,validate via TypeBox at controller.
- **D-04** — EvalCase shape 鎖在 `{ input: string, expectedOutput: string }`（不含 metadata）。驗證 `t.Object({ input: t.String(), expectedOutput: t.String() })`.
- **D-05** — Dataset cases **immutable after creation** — POST 帶完整 cases 一次性建立；之後只能 DELETE。無 PATCH / append endpoint。

**PromptVersion 語意:**
- **D-06** — `PromptVersion.version` server-side auto-increment。UNIQUE (agentId, version) 防 race；use case retry-on-conflict 上限 3，超過 throw `PromptVersionConflictError`（500）。
- **D-07** — PromptVersion immutable / append-only。無 PATCH / DELETE 單一 version。要取消 = 發新版本。cascade: DELETE Agent → FK ON DELETE CASCADE 連帶清掉。
- **D-08** — 「latest version」= `max(version) per agent` 即時計算，無 `Agent.currentVersionId` pointer。index `(agentId, version DESC)`。

**Ownership 與 API 形狀:**
- **D-09** — Cross-user 取錯資源 → **404 NotFound**（不洩漏存在性）。error class: `ResourceNotFoundError extends DomainError`（httpStatus 404, code `'RESOURCE_NOT_FOUND'`）。body: `{ error: { code: 'RESOURCE_NOT_FOUND', message: 'Resource not found', requestId } }`。
- **D-10** — Ownership 檢查落在 **use case 層**（repository stateless，不吃 AuthContext）。模板: findById Agent → 檢 `agent.ownerId !== ctx.userId` → throw ResourceNotFoundError。
- **D-11** — REST 路徑 = 嵌套 sub-resources。Agent `/agents`, PromptVersion `/agents/:agentId/prompts`, EvalDataset `/agents/:agentId/eval-datasets`。GET 接 `'*'` 或 `'read:*'`; write-only 接 `'*'`。
- **D-12** — Cascade DELETE = DB layer ON DELETE CASCADE（hard delete，無 soft delete）。schema: `references(() => agent.id, { onDelete: 'cascade' })`。

**Scope Check:**
- **D-13** — P4 write endpoints 的 scope check 公式 = `if (!ctx.scopes.includes('*')) throw InsufficientScopeError('This operation requires scope *')`. 在每個 write use case `execute(ctx, input)` 第一段。錯誤 body: `{ error: { code: 'INSUFFICIENT_SCOPE', message: 'This operation requires scope *', requestId } }`。read endpoints 不做 scope check。

**Dogfood Verification:**
- **D-14** — DEMO-04 實作 = Macro `requireAuth: true` + use case ownership check（D-10），不另設 dogfood-only endpoint。test `tests/integration/agents/dogfood-self-prompt-read.test.ts` 4 個變種: full-scope key 讀 → 200 / read-only key 讀 → 200 / cross-user → 404 / read-only 寫 → 403。

**Harness Friction 量測:**
- **D-15** — Friction log = executor 邊做邊填 `.planning/phases/04-demo-domain/04-HARNESS-FRICTION.md` append-only timestamped。每 entry 三行: `- [YYYY-MM-DD HH:MM] [P4-XX-PLAN] symptom: ... | workaround: ... | structural: yes/no`.
- **D-16** — ADR 觸發條件 = `>3 friction events` OR `任一 structural=yes`。ADR 0018「P1 Feature Module Template Iteration After P4 Dogfood」若觸發必開。verifier 讀 tally，若觸發但未開 ADR → flag must_haves violation。
- **D-17** — Phase 4 確定要開 **ADR 0017: EvalDataset Shape Frozen at v1**（鎖 D-01..D-05）。檔案 `docs/decisions/0017-eval-dataset-shape-jsonb-immutable.md`，MADR 4.0。

### Claude's Discretion

以下項目 researcher / planner 可自決:
- `createAgentsModule(deps): Elysia` factory shape — 與 `createHealthModule` / `createAuthModule` 一致；deps `{ db, clock?, logger? }`
- Drizzle schema 命名 — `agent` / `prompt_version` / `eval_dataset` (snake_case)；columns `created_at` / `updated_at` 等與 P3 一致
- `AgentMapper` / `PromptVersionMapper` / `EvalDatasetMapper` — 依 ARCH-03 + P3 pattern；`toDomain(row)` / `toPersistence(entity)`
- Repository ports 與位置 — `src/agents/application/ports/{agent-repository,prompt-version-repository,eval-dataset-repository}.port.ts`
- Use case 拆分粒度 — 預估 7-13 個 use case；researcher/planner 視測試與複用粒度合併或拆細
- Brand types — `AgentId` / `PromptVersionId` / `EvalDatasetId` 全為 `UUID<'AgentId'>` etc；P1 D-07 brand pattern 直接套
- Controller dtos 位置 — `src/agents/presentation/dtos/`
- `InsufficientScopeError` 重用 — 已於 P3 `src/auth/domain/errors.ts` 存在
- `ResourceNotFoundError` 落點 — 建議 `src/shared/kernel/errors.ts` 與 DomainError 同層（跨 feature 通用）
- `createApp` 整合 wire — `.use(createAgentsModule({ db, clock, logger }))` 加於 `createAuthModule` 之後
- PromptVersion UNIQUE-violation 寫法 — retry-loop vs `ON CONFLICT DO NOTHING RETURNING`；researcher 決
- Agent.name validation — 建議 1-128 chars, trim, UTF-8；是否 unique per owner researcher 自決
- Seed data / fixture / dev quickstart endpoint — P4 不包含
- 04-HARNESS-FRICTION.md template 細節 — 由 planner 決定

### Deferred Ideas (OUT OF SCOPE)

- Eval runner / actual prompt-vs-output 比對 → v2
- PromptVersion content 為 jsonb structured → v2 ADR supersede 0017
- Template engine (Jinja/Handlebars) → out of scope
- EvalDataset metadata 欄位 → v2 ADR supersede
- normalized eval_case table → v2
- Dataset PATCH / append cases endpoint → v2
- PromptVersion diff / branching → v2
- Dataset 公開 / 分享 → v2 multi-tenant
- DELETE PromptVersion 單一版本 → out of scope（D-07 immutable）
- Agent soft delete → v2
- PATCH `/agents/:id/active-version` pointer → v2（D-08 排除）
- Real-time WebSocket / SSE → out of scope
- Per-user quota / rate limit → v2
- Dataset import / export (CSV/JSONL) → v2
- Phase 5 quickstart endpoint 範例 → P5 自決
- GitHub Actions CI 跑 P4 integration tests → P5 CI-01
- 04-HARNESS-FRICTION.md 改 GitHub issue → 不採

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEMO-01 | `Agent` entity（id、name、owner userId、createdAt、updatedAt）完整 CRUD，全部經 AuthContext | D-01 aggregate shape + D-10 ownership at use case + D-11 nested REST + P3 `authContextPlugin` macro `global` scope auto-propagates. Standard Stack table + §Pattern 1 (Use Case with Scope+Ownership Prologue) + §Code Examples `CreateAgentUseCase`. |
| DEMO-02 | `PromptVersion` entity（id、agentId、version 單調遞增、content、createdAt）支援建立新版本、查詢指定版本、列出歷史版本 | D-06 server auto-increment + D-07 immutable + D-08 max-on-query. §Pitfall 2 (UNIQUE violation retry) + §Code Examples `CreatePromptVersionUseCase` (ON CONFLICT DO NOTHING RETURNING) + §Pattern 2 (Drizzle composite UNIQUE + index DESC). |
| DEMO-03 | `EvalDataset` entity（id、agentId、name、cases: Array<{ input, expectedOutput }>）支援建立/查詢/刪除；shape 由 P4 planning ADR 定案 | D-03 jsonb cases + D-04 EvalCase shape + D-05 immutable cases + D-17 ADR 0017. §Pattern 3 (jsonb + $type vs runtime validation) + §Code Examples `eval-dataset.schema.ts` + `create-eval-dataset.dto.ts` + ADR 0017 template in §State of the Art. |
| DEMO-04 | Agent 可用 API Key 呼叫「查自己的 prompt 最新版本」endpoint；系統驗證 `apiKey.userId === agent.ownerId` | D-14 dogfood test 4 變種. §Pattern 4 (Identity Kind Agnostic Ownership) + §Code Examples `dogfood-self-prompt-read.test.ts` scaffold reusing P3 `_helpers.ts` `insertTestApiKey`. |
| DEMO-05 | 只讀 scope 的 API Key 呼叫 write endpoint 必回 403（scope check 實測） | D-13 scope check formula. §Pattern 1 step 1 + §Code Examples `scope-check-read-only-key.test.ts`. |
| DEMO-06 | Demo domain 完整走過 feature module factory pattern；若複用成本高（>3 次「要解釋 harness」事件）則已開 ADR 記錄 P1 template 設計債與調整方向 | D-15 / D-16 friction log + ADR 0018 conditional. §Architecture Patterns §Feature Module Factory Reuse Checklist + §Code Examples `04-HARNESS-FRICTION.md` template + §Pitfall 6 (ADR trigger mis-count). |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Agent CRUD business rules (ownership, immutability) | Domain (agents) | Application (use cases) | Framework-free invariants — enforced by `getAgentService(ctx)` factory if domain service is needed, otherwise pure entity + use case scope/ownership prologue |
| PromptVersion monotonic numbering + race handling | Application (use case) | Infrastructure (DB UNIQUE) | DB provides the atomicity guarantee (composite UNIQUE); use case provides the retry or ON CONFLICT orchestration |
| EvalDataset cases integrity | Presentation (TypeBox DTO) | Infrastructure (jsonb) | `.$type<>()` is compile-time only — runtime validation must happen at HTTP boundary before reaching DB |
| REST routing `/agents/:agentId/prompts/...` | Presentation (Elysia controllers) | — | Sub-resource URL = ownership context encoded in URL; Elysia `prefix` option + `params` param typing |
| Dual-identity (human cookie / agent API Key) resolution | P3 `authContextPlugin` macro (global scope) | — | Already shipped in P3; P4 only declares `requireAuth: true` per-route |
| Scope check (`*` required for write) | Application (use case) | — | P3 D-02 precedent: scope check at use case, not macro. P4 D-13 same pattern |
| Cross-user 404 (ownership mismatch) | Application (use case) | — | `findById + ownerId check → ResourceNotFoundError` is a single-function prologue; not a repository concern |
| Cascade delete child rows | Infrastructure (DB FK ON DELETE CASCADE) | — | Atomic at DB level; Drizzle schema `references(..., { onDelete: 'cascade' })` |
| Factory module composition | Bootstrap (`createApp`) | — | `createApp` mounts `createAgentsModule` after `createAuthModule` — plugin ordering P2 ADR 0012 already canonical |
| Friction log / template iteration evidence | Planning (`04-HARNESS-FRICTION.md`) | Documentation (ADR 0018 if triggered) | D-15/D-16 harness signal capture — executor self-logs during implementation, not a runtime concern |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | 0.45.2 (pinned P1 ADR 0005) | PostgreSQL schema + queries | P1 ADR 0005 pinned; P4 agent/prompt_version/eval_dataset schemas follow auth schema conventions [VERIFIED: `package.json` + `bun pm ls`] |
| `postgres` (postgres-js) | 3.4.9 | DB driver | P1 ADR 0010 pinned (NOT bun:sql); exposes `sql.PostgresError` with `code` + `constraint_name` for UNIQUE-violation detection [VERIFIED: Context7 `/porsager/postgres`] |
| `elysia` | 1.4.28 | HTTP server + routing + plugins | P1 ADR 0002 pinned; `prefix` constructor option + nested `params` + macro `requireAuth` propagation from P3 [VERIFIED: Context7 `/elysiajs/documentation` + `src/auth/presentation/plugins/auth-context.plugin.ts`] |
| `@sinclair/typebox` | 0.34.49 | TypeBox schemas for DTOs (runtime validation) | Already used in `src/auth/presentation/dtos/*`; `t.Object({ input: t.String(), expectedOutput: t.String() })` for EvalCase, `t.Array(t.Object(...))` for cases list [VERIFIED: `src/auth/presentation/dtos/create-api-key.dto.ts`] |
| `pino` | 10.3.1 | Structured logging (injected via `createAgentsModule` deps) | Already wired globally; P4 logger usage optional (use case can take `{ logger: Logger }` dep if observability is needed) [VERIFIED: `src/auth/auth.module.ts`] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:crypto` (built-in) | Bun 1.3.12 | `crypto.randomUUID()` for `AgentId` / `PromptVersionId` / `EvalDatasetId` | Same pattern as P1 D-07; consumed via `newUUID<K>()` helper in `src/shared/kernel/id.ts` [VERIFIED: `src/shared/kernel/id.ts`] |
| `drizzle-kit` | 0.31.10 | Migration generation (`bunx drizzle-kit generate --name=demo_domain`) | Produces `drizzle/0002_demo_domain.sql`. Existing `drizzle.config.ts` globs `src/**/infrastructure/schema/*.ts` — P4 schema files auto-scanned [VERIFIED: `drizzle.config.ts`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `onConflictDoNothing + RETURNING` for version race (recommended) | retry-loop catching `PostgresError.code === '23505'` | Retry-loop has TOCTOU gap (SELECT MAX → INSERT is not atomic, even inside one connection). `ON CONFLICT` is atomic at the PG level. Retry is only needed when ON CONFLICT returns 0 rows (version actually collided) — then re-read max and retry. |
| jsonb `cases` column | Normalized `eval_case` table with FK to eval_dataset | Normalized is needed only when per-case filtering/stats are a feature (they are not — D-05 cases are immutable as a set). jsonb is **strictly** simpler for v1 and matches ADR 0017's "shape frozen at v1" intent. Normalized is v2 ADR supersede path. |
| `text('id').primaryKey()` with domain-generated UUID (recommended) | `uuid('id').primaryKey().defaultRandom()` (DB-generated) | P3 auth schema uses `text('id').primaryKey()` (see `user.schema.ts`, `apikey.schema.ts`). Matching P3 convention + domain-layer UUID generation (via `newUUID<K>()`) keeps ID creation testable + framework-free + easy to construct in unit tests. |
| `.group('/agents/:agentId', app => ...)` | `new Elysia({ prefix: '/agents/:agentId' })` + `.use()` composition (recommended) | `prefix` constructor + `.use()` composition matches P3 auth structure (`authController / apiKeyController / meController` are each independent Elysia instances). Avoids deep nesting; keeps each controller file independently testable. |

**Installation:**

No new packages required. All P4 dependencies are already installed from P1–P3 [VERIFIED: `bun pm ls` shows drizzle-orm@0.45.2, postgres@3.4.9, elysia@1.4.28, @sinclair/typebox@0.34.49, pino@10.3.1].

**Version verification:** All P4 packages were verified present and at pinned versions in `bun pm ls` output on 2026-04-19. No `bun add` commands in P4 plans.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HTTP Request (cookie OR x-api-key header)                                    │
└──────────┬───────────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ Elysia root app (createApp in src/bootstrap/app.ts)                          │
│   Global plugins (P2 ADR 0012 ordering):                                     │
│   1. requestLoggerPlugin (derives requestId)                                 │
│   2. corsPlugin                                                              │
│   3. errorHandlerPlugin (reads err.httpStatus, maps DomainError → HTTP)      │
│   4. swaggerPlugin                                                           │
│   5. createAuthModule (P3) — includes authContextPlugin macro, scope=global  │
│   6. createAgentsModule (P4 — NEW)                                           │
└──────────┬───────────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ agents.module.ts — createAgentsModule(deps)                                  │
│   .use(agentController)         mounts GET/POST/PATCH/DELETE /agents/...     │
│   .use(promptVersionController) mounts /agents/:agentId/prompts/...          │
│   .use(evalDatasetController)   mounts /agents/:agentId/eval-datasets/...    │
│                                                                              │
│  Each controller: declares `requireAuth: true` per-route → P3 macro resolves │
│  AuthContext from x-api-key (priority) or cookie (fallback); attaches to ctx │
└──────────┬───────────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ Controller                                                                   │
│   - Parse body via TypeBox schema (runtime validation)                       │
│   - Extract AuthContext: (ctx as { authContext: AuthContext }).authContext   │
│   - Invoke use case: `await deps.xxxUseCase.execute(authContext, input)`     │
└──────────┬───────────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ Use Case — 3-step prologue pattern                                           │
│   Step 1 (write only): `if (!ctx.scopes.includes('*')) throw Insufficient…` │
│   Step 2: `const agent = await agentRepo.findById(input.agentId)`            │
│           `if (!agent || agent.ownerId !== ctx.userId) throw NotFound…`      │
│   Step 3: business logic (create/update/delete/query)                        │
└──────────┬───────────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ Repository (Drizzle-backed)                                                  │
│   - Parameterized SQL via Drizzle query builder                              │
│   - Returns Domain entities (via Mapper) — NEVER Drizzle InferSelectModel    │
│   - For PromptVersion.create: uses ON CONFLICT DO NOTHING RETURNING path     │
└──────────┬───────────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ PostgreSQL (via postgres-js 3.4.9)                                           │
│   - agent table                                                              │
│   - prompt_version (FK agent_id ON DELETE CASCADE,                           │
│                     UNIQUE (agent_id, version),                              │
│                     INDEX (agent_id, version DESC))                          │
│   - eval_dataset (FK agent_id ON DELETE CASCADE, jsonb cases)                │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/agents/
├── agents.module.ts                                    # createAgentsModule factory
├── domain/
│   ├── index.ts                                        # barrel: re-exports values + entities + errors
│   ├── agent.ts                                        # Agent entity + factory
│   ├── prompt-version.ts                               # PromptVersion entity
│   ├── eval-dataset.ts                                 # EvalDataset entity + EvalCase value object
│   ├── values/
│   │   └── ids.ts                                      # AgentId / PromptVersionId / EvalDatasetId + new*Id()
│   └── errors.ts                                       # PromptVersionConflictError (500, agents-local)
├── application/
│   ├── ports/
│   │   ├── agent-repository.port.ts
│   │   ├── prompt-version-repository.port.ts
│   │   └── eval-dataset-repository.port.ts
│   └── usecases/
│       ├── create-agent.usecase.ts
│       ├── get-agent.usecase.ts
│       ├── list-agents.usecase.ts
│       ├── update-agent.usecase.ts
│       ├── delete-agent.usecase.ts
│       ├── create-prompt-version.usecase.ts
│       ├── get-latest-prompt-version.usecase.ts
│       ├── get-prompt-version.usecase.ts
│       ├── list-prompt-versions.usecase.ts
│       ├── create-eval-dataset.usecase.ts
│       ├── get-eval-dataset.usecase.ts
│       ├── list-eval-datasets.usecase.ts
│       └── delete-eval-dataset.usecase.ts
├── infrastructure/
│   ├── mappers/
│   │   ├── agent.mapper.ts
│   │   ├── prompt-version.mapper.ts
│   │   └── eval-dataset.mapper.ts
│   ├── repositories/
│   │   ├── drizzle-agent.repository.ts
│   │   ├── drizzle-prompt-version.repository.ts
│   │   └── drizzle-eval-dataset.repository.ts
│   └── schema/
│       ├── agent.schema.ts
│       ├── prompt-version.schema.ts
│       └── eval-dataset.schema.ts
└── presentation/
    ├── controllers/
    │   ├── agent.controller.ts
    │   ├── prompt-version.controller.ts
    │   └── eval-dataset.controller.ts
    └── dtos/
        ├── create-agent.dto.ts
        ├── update-agent.dto.ts
        ├── create-prompt-version.dto.ts
        └── create-eval-dataset.dto.ts
```

Also added/modified elsewhere:
- `src/shared/kernel/errors.ts` — add `ResourceNotFoundError` class
- `src/bootstrap/app.ts` — add `.use(createAgentsModule(...))` after `createAuthModule`
- `drizzle/0002_demo_domain.sql` — generated migration
- `docs/decisions/0017-eval-dataset-shape-jsonb-immutable.md` — new ADR
- `docs/decisions/README.md` — append ADR 0017 index row
- `tests/integration/agents/*.test.ts` — integration + regression tests
- `.planning/phases/04-demo-domain/04-HARNESS-FRICTION.md` — friction log

### Pattern 1: Use Case with Scope + Ownership Prologue

**What:** Every P4 use case that touches a user-owned resource runs a 2 or 3 step prologue before business logic:
1. (write only) Scope check — throw `InsufficientScopeError` if `'*'` missing
2. Ownership check — `findById + ownerId !== ctx.userId` → throw `ResourceNotFoundError`
3. Business logic

**When to use:** All P4 use cases except `ListAgentsUseCase` (no agentId to check — but it still filters by `ownerId` in repository query) and `CreateAgentUseCase` (no parent to check — only scope check + create; the new agent's `ownerId` is set from `ctx.userId` directly).

**Example:** [VERIFIED pattern from `src/auth/application/usecases/create-api-key.usecase.ts` lines 29-40]

```typescript
// src/agents/application/usecases/update-agent.usecase.ts
import { InsufficientScopeError } from '../../../auth/domain'
import { ResourceNotFoundError } from '../../../shared/kernel/errors'
import type { AuthContext } from '../../../auth/domain'
import type { AgentId, Agent } from '../../domain'
import type { IAgentRepository } from '../ports/agent-repository.port'
import type { IClock } from '../../../shared/application/ports/clock.port'

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
    // Step 1 — Scope check (write).  D-13.
    if (!ctx.scopes.includes('*')) {
      throw new InsufficientScopeError('This operation requires scope *')
    }

    // Step 2 — Ownership check.  D-09 + D-10.
    const agent = await this.agentRepo.findById(input.agentId)
    if (!agent || agent.ownerId !== ctx.userId) {
      throw new ResourceNotFoundError('Resource not found')
    }

    // Step 3 — Business logic.
    const updated: Agent = { ...agent, name: input.name.trim(), updatedAt: this.clock.now() }
    return this.agentRepo.update(updated)
  }
}
```

### Pattern 2: Drizzle Composite UNIQUE + DESC Index [VERIFIED: Context7 /drizzle-team/drizzle-orm-docs]

**What:** Table callback returns an array of `unique(...).on(...)` and `index(...).on(...)` constraints. Drizzle 0.45.2 supports both named and unnamed unique constraints; supports column `.asc()` / `.desc()` inside `index(...)` for directional sort hints.

**When to use:** `prompt_version` table needs both `UNIQUE (agent_id, version)` (race protection D-06) and `INDEX (agent_id, version DESC)` (fast "latest" query D-08).

**Example:**

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

**Note:** Drizzle's table callback in v0.45.2 accepts both array `[unique(), index()]` (used in P4 — matches P3 `apikey.schema.ts` convention lines 29-34) and object `{ uq: unique(), idx: index() }` forms. Array is canonical per latest docs.

### Pattern 3: jsonb with `.$type<T>()` + TypeBox Boundary Validation [VERIFIED: Context7 + P3 convention]

**What:** Drizzle `jsonb().$type<EvalCase[]>()` provides **compile-time-only** type inference. No runtime validation on either read or write. `.$type<>()` is a phantom type marker (zero runtime cost) — same pattern as `Brand<T, K>`. Runtime protection MUST come from TypeBox at HTTP boundary.

**When to use:** EvalDataset `cases` column — ADR 0017 locks shape `Array<{ input: string, expectedOutput: string }>`. TypeBox validates every incoming POST. For reads: defensive parsing (minimal — trust DB for v1 with explicit v2 migration ADR as escape hatch).

**Example (schema):**

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

**Example (DTO):**

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

**Defensive read pattern (mapper):**

```typescript
// src/agents/infrastructure/mappers/eval-dataset.mapper.ts
import type { EvalDataset, EvalDatasetId, AgentId, EvalCase } from '../../domain'

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

export const EvalDatasetMapper = {
  toDomain(row: { id: string; agentId: string; name: string; cases: unknown; createdAt: Date }): EvalDataset {
    return {
      id: row.id as EvalDatasetId,
      agentId: row.agentId as AgentId,
      name: row.name,
      cases: parseCases(row.cases),
      createdAt: row.createdAt,
    }
  },
}
```

### Pattern 4: Identity-Kind-Agnostic Ownership Check [VERIFIED from P3 AuthContext shape]

**What:** P3 resolver (`authContextPlugin`) produces one `AuthContext` whose `userId` is always the resource-owning user — whether the identity was resolved from cookie (`identityKind: 'human'`) or API Key (`identityKind: 'agent'`). For agent keys, `apiKey.userId` is mapped into `ctx.userId` directly. P4 use cases therefore check `agent.ownerId !== ctx.userId` **without** caring about `identityKind`.

**When to use:** All P4 ownership checks. DEMO-04 dogfood is "just" the normal path where `identityKind === 'agent'` and `ctx.userId === agent.ownerId`; no branching logic needed in use cases or controllers.

**Example:**

```typescript
// All P4 use cases reuse this prologue — no branch on identityKind
const agent = await this.agentRepo.findById(agentId)
if (!agent || agent.ownerId !== ctx.userId) {
  throw new ResourceNotFoundError('Resource not found')
}
```

[VERIFIED: `src/auth/domain/auth-context.ts` lines 20-26 — `userId: UserId` is the canonical field; `identityKind` is purely informational]

### Pattern 5: Feature Module Factory — `createAgentsModule(deps)`

**What:** Clone `createAuthModule` / `createHealthModule` shape — a function returning `Elysia` with wired dependencies. Composes individual controller Elysia instances via `.use()`. No IoC container.

**Example:**

```typescript
// src/agents/agents.module.ts
import { Elysia } from 'elysia'
import type { Logger } from 'pino'
import type { DrizzleDb } from '../shared/infrastructure/db/client'
import type { IClock } from '../shared/application/ports/clock.port'
import { CreateAgentUseCase } from './application/usecases/create-agent.usecase'
import { GetAgentUseCase } from './application/usecases/get-agent.usecase'
import { ListAgentsUseCase } from './application/usecases/list-agents.usecase'
import { UpdateAgentUseCase } from './application/usecases/update-agent.usecase'
import { DeleteAgentUseCase } from './application/usecases/delete-agent.usecase'
import { CreatePromptVersionUseCase } from './application/usecases/create-prompt-version.usecase'
import { GetLatestPromptVersionUseCase } from './application/usecases/get-latest-prompt-version.usecase'
import { GetPromptVersionUseCase } from './application/usecases/get-prompt-version.usecase'
import { ListPromptVersionsUseCase } from './application/usecases/list-prompt-versions.usecase'
import { CreateEvalDatasetUseCase } from './application/usecases/create-eval-dataset.usecase'
import { GetEvalDatasetUseCase } from './application/usecases/get-eval-dataset.usecase'
import { ListEvalDatasetsUseCase } from './application/usecases/list-eval-datasets.usecase'
import { DeleteEvalDatasetUseCase } from './application/usecases/delete-eval-dataset.usecase'
import { DrizzleAgentRepository } from './infrastructure/repositories/drizzle-agent.repository'
import { DrizzlePromptVersionRepository } from './infrastructure/repositories/drizzle-prompt-version.repository'
import { DrizzleEvalDatasetRepository } from './infrastructure/repositories/drizzle-eval-dataset.repository'
import { agentController } from './presentation/controllers/agent.controller'
import { promptVersionController } from './presentation/controllers/prompt-version.controller'
import { evalDatasetController } from './presentation/controllers/eval-dataset.controller'

export interface AgentsModuleDeps {
  db: DrizzleDb
  logger?: Logger
  clock?: IClock
}

export function createAgentsModule(deps: AgentsModuleDeps) {
  const clock: IClock = deps.clock ?? { now: () => new Date() }
  const agentRepo = new DrizzleAgentRepository(deps.db)
  const promptVersionRepo = new DrizzlePromptVersionRepository(deps.db)
  const evalDatasetRepo = new DrizzleEvalDatasetRepository(deps.db)

  // Agent use cases
  const createAgent = new CreateAgentUseCase(agentRepo, clock)
  const getAgent = new GetAgentUseCase(agentRepo)
  const listAgents = new ListAgentsUseCase(agentRepo)
  const updateAgent = new UpdateAgentUseCase(agentRepo, clock)
  const deleteAgent = new DeleteAgentUseCase(agentRepo)

  // PromptVersion use cases
  const createPromptVersion = new CreatePromptVersionUseCase(agentRepo, promptVersionRepo, clock)
  const getLatestPromptVersion = new GetLatestPromptVersionUseCase(agentRepo, promptVersionRepo)
  const getPromptVersion = new GetPromptVersionUseCase(agentRepo, promptVersionRepo)
  const listPromptVersions = new ListPromptVersionsUseCase(agentRepo, promptVersionRepo)

  // EvalDataset use cases
  const createEvalDataset = new CreateEvalDatasetUseCase(agentRepo, evalDatasetRepo, clock)
  const getEvalDataset = new GetEvalDatasetUseCase(agentRepo, evalDatasetRepo)
  const listEvalDatasets = new ListEvalDatasetsUseCase(agentRepo, evalDatasetRepo)
  const deleteEvalDataset = new DeleteEvalDatasetUseCase(agentRepo, evalDatasetRepo)

  return new Elysia({ name: 'rigging/agents' })
    .use(agentController({ createAgent, getAgent, listAgents, updateAgent, deleteAgent }))
    .use(
      promptVersionController({
        createPromptVersion,
        getLatestPromptVersion,
        getPromptVersion,
        listPromptVersions,
      }),
    )
    .use(
      evalDatasetController({
        createEvalDataset,
        getEvalDataset,
        listEvalDatasets,
        deleteEvalDataset,
      }),
    )
}
```

### Pattern 6: Nested Route Prefix Composition [VERIFIED: Context7 /elysiajs/documentation]

**What:** Elysia supports `new Elysia({ prefix: '/foo/:bar' })` — the prefix is prepended to every route defined on that instance, and `params.bar` is available in all handlers. Each sub-resource controller is a separate Elysia instance, composed via `createAgentsModule(...).use(agentController).use(promptVersionController)...`.

**Example:**

```typescript
// src/agents/presentation/controllers/prompt-version.controller.ts
import { Type } from '@sinclair/typebox'
import { Elysia } from 'elysia'
import type { CreatePromptVersionUseCase } from '../../application/usecases/create-prompt-version.usecase'
import type { GetLatestPromptVersionUseCase } from '../../application/usecases/get-latest-prompt-version.usecase'
import type { GetPromptVersionUseCase } from '../../application/usecases/get-prompt-version.usecase'
import type { ListPromptVersionsUseCase } from '../../application/usecases/list-prompt-versions.usecase'
import type { AuthContext } from '../../../auth/domain'
import type { AgentId } from '../../domain'
import {
  CreatePromptVersionBodySchema,
  PromptVersionResponseSchema,
} from '../dtos/create-prompt-version.dto'

export interface PromptVersionControllerDeps {
  createPromptVersion: CreatePromptVersionUseCase
  getLatestPromptVersion: GetLatestPromptVersionUseCase
  getPromptVersion: GetPromptVersionUseCase
  listPromptVersions: ListPromptVersionsUseCase
}

export function promptVersionController(deps: PromptVersionControllerDeps) {
  return new Elysia({ name: 'rigging/prompt-version-controller', prefix: '/agents/:agentId' })
    .post(
      '/prompts',
      async (context) => {
        const authContext = (context as unknown as { authContext: AuthContext }).authContext
        const { params, body, set } = context
        const result = await deps.createPromptVersion.execute(authContext, {
          agentId: params.agentId as AgentId,
          content: body.content,
        })
        set.status = 201
        return { ...result, createdAt: result.createdAt.toISOString() }
      },
      {
        params: Type.Object({ agentId: Type.String({ minLength: 1 }) }),
        body: CreatePromptVersionBodySchema,
        response: { 201: PromptVersionResponseSchema },
        requireAuth: true,
        detail: { summary: 'Create a new prompt version', tags: ['agents'], security: [{ cookieAuth: [] }, { apiKeyAuth: [] }] },
      },
    )
    .get('/prompts/latest', async (context) => { /* ... */ }, { /* requireAuth: true */ })
    .get('/prompts/:version', async (context) => { /* ... */ }, { /* requireAuth: true */ })
    .get('/prompts', async (context) => { /* ... */ }, { /* requireAuth: true */ })
}
```

**Note:** Swagger will group routes by the `tags` field in route `detail`; the URL prefix does not automatically group. Every controller should use `tags: ['agents']` (or a more specific subtag like `'agents/prompts'`) to keep the Swagger UI organized.

### Anti-Patterns to Avoid

- **Don't use retry-loop-only-with-try/catch for UNIQUE violation.** ON CONFLICT DO NOTHING RETURNING is atomic at PG level, simpler, and handles the race inside the database engine. Retry-loop still has a TOCTOU window between SELECT MAX and INSERT.
- **Don't import `drizzle-orm` in `src/agents/domain/**`.** Biome `noRestrictedImports` will fail CI. Keep schemas in `infrastructure/schema/`, mappers in `infrastructure/mappers/`. [VERIFIED: `biome.json` lines 29-51]
- **Don't write `src/agents/` schema with DB-side UUID default (`uuid('id').defaultRandom()`).** P3 pattern is domain-generated UUIDs via `newUUID<'AgentId'>()`. Consistency with P3 eliminates a per-feature decision point and keeps use cases unit-testable without DB.
- **Don't make the macro `requireAuth` a per-controller plugin.** P3 already mounts `authContextPlugin` at the auth module root with `scope: 'global'`. Every P4 route just declares `requireAuth: true` in the route `options` object — the macro resolver runs regardless of where the route lives. Remounting the macro in `createAgentsModule` would be redundant and would violate P3's "single macro root" invariant (CONTEXT D-15 "Macro 單一根層").
- **Don't use `ctx.authContext` as a typed property directly.** P3 set the canonical cast pattern: `(context as unknown as { authContext: AuthContext }).authContext`. Elysia macro-derived types don't always narrow cross-plugin; the cast is a P3 convention [VERIFIED: `src/auth/presentation/controllers/api-key.controller.ts` line 25, `me.controller.ts` line 19].
- **Don't use `.group('/agents/:agentId', app => ...)` inside a controller.** Use `new Elysia({ prefix: '/agents/:agentId' })` to keep each controller a free-standing, composable unit.
- **Don't put `PromptVersionConflictError` in `src/shared/kernel/errors.ts`.** It's agents-specific (D-06). Put it in `src/agents/domain/errors.ts`. `ResourceNotFoundError` is generic and belongs in `src/shared/kernel/errors.ts`.
- **Don't return `InferSelectModel<typeof agent>` from repositories.** Repository ports must return domain entities (Agent, PromptVersion, EvalDataset). Use mappers. This is enforced by P1 Biome rules + ARCH-03 port contract [VERIFIED: P3 `DrizzleApiKeyRepository` uses `ApiKeyMapper.toDomain(row)`].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Monotonic version assignment | Manual SELECT-MAX + mutex / retry-loop without DB constraint | Composite `UNIQUE (agent_id, version)` + `INSERT ... ON CONFLICT (agent_id, version) DO NOTHING RETURNING *` | DB provides the atomicity guarantee. ON CONFLICT is one SQL statement; retry-loops have TOCTOU windows. |
| UUID generation | Custom algorithm, `Math.random()`-based IDs | `crypto.randomUUID()` via `newUUID<K>()` helper | Bun-native, cryptographically sound, zero dep. P1 kernel already provides this. |
| jsonb type marking | Write your own reflective type checker | `jsonb('cases').$type<EvalCase[]>()` (compile-time) + TypeBox at boundary (runtime) | `.$type<>()` is phantom; TypeBox is the runtime invariant gate. Each tool does one thing well. |
| Sub-resource URL params | Manual URL parsing or middleware-attached params | `new Elysia({ prefix: '/agents/:agentId' })` + `.params` typed via TypeBox | Elysia 1.4 supports prefix with `:param` natively, produces typed `params.agentId`. |
| Cross-user authorization | Return 403 "not your resource" message | Return 404 ResourceNotFoundError uniformly | Hides resource existence from enumeration attackers. GitHub API + Google AIP-122 both return 404. |
| Cookie / API Key parsing | Custom Authorization header parser | P3 `authContextPlugin` macro (already shipped) | P3 resolved it; P4 only declares `requireAuth: true` per-route. |
| FK cascade deletion | Application-level loop deleting children | DB FK `ON DELETE CASCADE` in schema | Atomic, handled by PG engine, no races, no missed rows. |
| Resource existence vs ownership combined check | Two separate error types and two separate HTTP codes | Single `ResourceNotFoundError` on either miss or mismatch | Simpler use case prologue; prevents enumeration vector; P3 already set the precedent with UNAUTHENTICATED for all 401 scenarios (P3 D-12). |
| Migration SQL | Hand-written SQL migrations | `bunx drizzle-kit generate --name=demo_domain` | Drift detection + reproducibility. P1 convention. Hand-written SQL is an ADR-exception path only. |

**Key insight:** Every "Don't hand-roll" in P4 has a direct P3 precedent (UUID via kernel, 401 body single-code UNAUTHENTICATED, macro resolver, repository→mapper). P4 is a second customer of the harness — the harness should let it compose, not reinvent. When the executor feels tempted to hand-roll one of these, it's a D-15 friction event candidate (especially if structural=yes).

## Runtime State Inventory

> P4 is a greenfield feature phase (new `src/agents/`, new tables). No existing rename/refactor risk. Section included for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — P4 creates new `agent`, `prompt_version`, `eval_dataset` tables with fresh data. No existing data to migrate. | None |
| Live service config | None — no external services have P4-specific config. BetterAuth (P3) continues as-is; no BetterAuth changes. | None |
| OS-registered state | None | None |
| Secrets/env vars | None — reuses existing `DATABASE_URL` and `BETTER_AUTH_SECRET` from `config.ts`. No new env vars. | None |
| Build artifacts | None at start of phase; on completion, Drizzle generates `drizzle/0002_demo_domain.sql` (committed) and updates `drizzle/meta/`. Standard migration output. | Normal `bun install` + `bun run db:migrate` flow. |

## Common Pitfalls

### Pitfall 1: Drizzle `.$type<>()` treated as a runtime guarantee

**What goes wrong:** Developer writes `cases: jsonb('cases').$type<EvalCase[]>()` and assumes bad data can't enter the column. A test inserts malformed JSON via `sql` template tag directly (or a future migration leaves old rows in a different shape), and reads blow up deep inside a use case or presentation serializer with `TypeError: ... is not a function`.

**Why it happens:** `.$type<>()` is compile-time only (phantom). Drizzle does not validate shape at insert or select. This is documented but easy to miss — it looks like a type-enforcement API.

**How to avoid:**
1. TypeBox validation at the HTTP boundary (`CreateEvalDatasetBodySchema`) — this guards writes from the outside.
2. Defensive parse in the mapper `toDomain` (filter non-matching entries) — this guards reads even if the DB has garbage.
3. Future shape-change migration MUST be an ADR superseding 0017, not a silent schema diff. [ADR 0017 is the guardrail.]

**Warning signs:** An integration test passes POSTs through the controller but a direct `sql` insert test fails. A `toDomain()` function casts with `as` without filtering.

**Sources:** Drizzle `.$type<>()` [VERIFIED: Context7 `/drizzle-team/drizzle-orm-docs`] + P3 `ApiKeyMapper.parseScopes` pattern [VERIFIED: `src/auth/infrastructure/mappers/api-key.mapper.ts` lines 17-26] — P3 already demonstrates defensive parsing of `metadata: string | null` that's deserialized at read time; P4 applies the same discipline to jsonb `cases`.

### Pitfall 2: Retry-loop vs ON CONFLICT — race TOCTOU

**What goes wrong:** Naive code does `const max = SELECT MAX(version); INSERT (version: max+1)`. Under concurrent POSTs the two statements interleave, two requests both read MAX=5, both try to INSERT version=6, and one gets UNIQUE violation. The retry-loop catches and re-reads MAX — but during the retry **another** concurrent write can re-introduce the race, potentially livelocking under extreme concurrency (in practice retry-3 is enough for typical traffic — but the code is subtly wrong in principle).

**Why it happens:** SELECT and INSERT are separate statements even within a single JS async boundary. Without serializable isolation (default PG isolation is READ COMMITTED), reads don't block writes on other connections.

**How to avoid:** Prefer the **atomic ON CONFLICT** path:

```sql
INSERT INTO prompt_version (id, agent_id, version, content, created_at)
SELECT $1, $2, COALESCE(MAX(version), 0) + 1, $3, $4
FROM prompt_version
WHERE agent_id = $2
ON CONFLICT (agent_id, version) DO NOTHING
RETURNING *
```

Or in Drizzle query builder terms: use `db.execute(sql\`...\`)` with the above SQL. If the RETURNING clause is empty (0 rows), the INSERT conflicted — retry by reading max again and re-attempting.

Even this approach needs a bounded retry (D-06 locks retry=3). The difference vs naive SELECT-then-INSERT is that the ON CONFLICT path is one atomic statement — the gap is eliminated inside PG. [VERIFIED: Context7 `onConflictDoNothing` + `.returning()` compose in Drizzle.]

**Warning signs:** A concurrency test (Promise.all 10 POSTs) produces holes (v1, v2, v4 — skipping v3 because a retry consumed a MAX read) or duplicate versions (both succeed because you forgot the UNIQUE constraint). Test design: issue N concurrent POSTs, expect N distinct versions 1..N and no holes.

**Sources:** postgres-js docs [VERIFIED: Context7 `/porsager/postgres`] + Drizzle `onConflictDoNothing` [VERIFIED: Context7].

### Pitfall 3: `requireAuth: true` with no handler narrowing

**What goes wrong:** Controller handler writes `({ authContext, params }) => ...` but TypeScript complains `authContext` doesn't exist on the context type, or narrows to `undefined`. Developer wraps with `@ts-ignore`.

**Why it happens:** Elysia's macro type system (as of 1.4.28) doesn't always propagate macro-resolved context fields through sub-plugin instances, especially across `.use()` composition boundaries. P3 encountered this and adopted the `(context as unknown as { authContext: AuthContext }).authContext` cast as the standard workaround [VERIFIED: `src/auth/presentation/controllers/api-key.controller.ts` line 25, `me.controller.ts` line 19].

**How to avoid:** Use the **P3 cast idiom verbatim** in every P4 controller handler. Do not write `@ts-ignore` — this is a D-15 structural friction event. Do not invent a new cast utility — consistency with P3 is part of the harness.

```typescript
async (context) => {
  const authContext = (context as unknown as { authContext: AuthContext }).authContext
  // ...
}
```

**Warning signs:** An executor PR contains `@ts-ignore` or `@ts-expect-error` in a P4 controller — this is a friction event and potentially structural (D-15/D-16). Alternative casts like `(context as any).authContext` reduce type safety; reject.

### Pitfall 4: Returning 403 for cross-user access

**What goes wrong:** Developer writes `if (agent.ownerId !== ctx.userId) throw new ForbiddenError('Not your agent')`. Attacker iterates `/agents/:id` IDs and learns existence by 403 vs 404.

**Why it happens:** 403 feels correct ("user is authenticated but forbidden"), but it leaks information. 404 is industry standard for cross-tenant isolation (GitHub API, Google AIP-122).

**How to avoid:** Use `ResourceNotFoundError` on BOTH "not found" and "found but not owned":

```typescript
const agent = await this.agentRepo.findById(agentId)
if (!agent || agent.ownerId !== ctx.userId) {
  throw new ResourceNotFoundError('Resource not found')
}
```

The `!agent` OR `ownerId !== ctx.userId` single-throw keeps both branches indistinguishable from the outside. Same body, same status, same timing (both are a single repo call).

**Warning signs:** An integration test asserts `expect(res.status).toBe(403)` for a cross-user GET. That's the wrong expected status per D-09.

**Sources:** D-09 CONTEXT + GitHub API / Google AIP-122 convention [CITED: https://google.aip.dev/122].

### Pitfall 5: Ordering check before ownership check in mutation endpoints

**What goes wrong:** Developer writes `POST /agents/:agentId/prompts` use case with scope check first, then ownership check. Works correctly. But subtle variant: developer argues "scope check is cheap, do ownership first; if cross-user, 404 whether scope exists or not". That's fine for GET (both are enumeration-safe via 404). For **POST/PATCH/DELETE**, if an agent with a read-only key writes to someone else's agent, the 404 response is correct per CONTEXT but subtly masks the INSUFFICIENT_SCOPE path — the read-only key leak is undetectable.

**Why it happens:** Layering decisions feel arbitrary without a rule.

**How to avoid:** **Scope check FIRST** (D-13). If scope fails, return 403 INSUFFICIENT_SCOPE regardless of target agent ownership. Then ownership check. This is the P3 precedent — `CreateApiKeyUseCase` checks `UserIdMismatchError` (403) first, `ScopeNotSubsetError` (403) next [VERIFIED: `src/auth/application/usecases/create-api-key.usecase.ts` lines 29-40]. P4 same order: scope check → ownership check → business logic. This matches DEMO-05's intent ("read-only key → 403 INSUFFICIENT_SCOPE").

**Warning signs:** Test `scope-check-read-only-key.test.ts` passes for same-user writes but fails (returns 404 instead of 403) for cross-user writes. Fix: move scope check above ownership.

### Pitfall 6: ADR 0018 trigger mis-count or missing tally

**What goes wrong:** Executor adds entries to `04-HARNESS-FRICTION.md` but never updates the Tally section. Verifier reads tally = 0, concludes ADR 0018 not required, phase exits. Real count was 5 + 2 structural — ADR should have been written but wasn't.

**Why it happens:** Tally block is manually maintained (easiest structure) — easy to forget.

**How to avoid:**
1. Template includes an explicit `## Tally` section at the bottom with three integers: `Total events`, `Structural events`, `ADR threshold reached: YES/NO`.
2. Verification script reads via simple grep:
   ```bash
   total=$(grep -c '^\- \[[0-9]' 04-HARNESS-FRICTION.md)
   structural=$(grep -c 'structural: yes' 04-HARNESS-FRICTION.md)
   if [ "$total" -gt 3 ] || [ "$structural" -gt 0 ]; then
     echo "ADR 0018 threshold reached"
   fi
   ```
3. Commit message convention for friction events: `docs(04): log friction event P4-XX` — verifier can optionally audit git log for "log friction event" commits vs lines in file as a cross-check.
4. Per plan completion, executor updates Tally section as part of the commit — not as an afterthought.

**Warning signs:** A commit that adds a friction bullet but does not update tally. Linting this can be a grep-based CI step in P5 if it becomes a real problem.

## Code Examples

### Example 1: `ResourceNotFoundError` (new, in shared kernel)

```typescript
// src/shared/kernel/errors.ts — append to existing file
export class ResourceNotFoundError extends DomainError {
  readonly code = 'RESOURCE_NOT_FOUND'
  readonly httpStatus = 404
}
```

[Source: P1 D-08 DomainError convention + P3 D-12 single-error-body shape]

### Example 2: Agent entity + ID brand

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

```typescript
// src/agents/domain/errors.ts
import { DomainError } from '../../shared/kernel/errors'

// D-06 — 500-level: should be extremely rare (retry exhausted).
export class PromptVersionConflictError extends DomainError {
  readonly code = 'PROMPT_VERSION_CONFLICT'
  readonly httpStatus = 500
}
```

```typescript
// src/agents/domain/index.ts — barrel
export type { Agent } from './agent'
export type { PromptVersion } from './prompt-version'
export type { EvalCase, EvalDataset } from './eval-dataset'
export type { AgentId, PromptVersionId, EvalDatasetId } from './values/ids'
export { newAgentId, newPromptVersionId, newEvalDatasetId } from './values/ids'
export { PromptVersionConflictError } from './errors'
```

### Example 3: Drizzle schema for `agent`

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

**Why agent.owner_id → user.id ON DELETE CASCADE:** if a user account is deleted (P3 does not have hard delete for users in v1, but the FK makes the semantics explicit), their agents are deleted too. This matches D-12 cascade philosophy extended one level up.

### Example 4: PromptVersion create via `ON CONFLICT DO NOTHING RETURNING`

```typescript
// src/agents/application/usecases/create-prompt-version.usecase.ts
import { InsufficientScopeError } from '../../../auth/domain'
import { ResourceNotFoundError } from '../../../shared/kernel/errors'
import type { AuthContext } from '../../../auth/domain'
import type { IClock } from '../../../shared/application/ports/clock.port'
import {
  type AgentId,
  newPromptVersionId,
  PromptVersionConflictError,
  type PromptVersion,
} from '../../domain'
import type { IAgentRepository } from '../ports/agent-repository.port'
import type { IPromptVersionRepository } from '../ports/prompt-version-repository.port'

export interface CreatePromptVersionInput {
  agentId: AgentId
  content: string
}

const MAX_RETRY = 3

export class CreatePromptVersionUseCase {
  constructor(
    private readonly agentRepo: IAgentRepository,
    private readonly promptVersionRepo: IPromptVersionRepository,
    private readonly clock: IClock,
  ) {}

  async execute(ctx: AuthContext, input: CreatePromptVersionInput): Promise<PromptVersion> {
    // D-13 scope check.
    if (!ctx.scopes.includes('*')) {
      throw new InsufficientScopeError('This operation requires scope *')
    }

    // D-09 / D-10 ownership check.
    const agent = await this.agentRepo.findById(input.agentId)
    if (!agent || agent.ownerId !== ctx.userId) {
      throw new ResourceNotFoundError('Resource not found')
    }

    // D-06 — atomic INSERT ... ON CONFLICT DO NOTHING RETURNING. Retry bounded at 3.
    for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
      const created = await this.promptVersionRepo.createAtomic({
        id: newPromptVersionId(),
        agentId: input.agentId,
        content: input.content,
        createdAt: this.clock.now(),
      })
      if (created) return created
      // ON CONFLICT returned 0 rows — another concurrent writer won this slot. Retry.
    }
    throw new PromptVersionConflictError('Concurrent writes prevented version assignment')
  }
}
```

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
  /**
   * Atomically INSERT a new version with version = MAX(version)+1 for this agent,
   * guarded by UNIQUE (agent_id, version).  Returns null if ON CONFLICT fired
   * (another concurrent writer won this version number).
   */
  createAtomic(cmd: CreatePromptVersionCommand): Promise<PromptVersion | null>
  findLatestByAgent(agentId: AgentId): Promise<PromptVersion | null>
  findByAgentAndVersion(agentId: AgentId, version: number): Promise<PromptVersion | null>
  listByAgent(agentId: AgentId): Promise<PromptVersion[]>
}
```

```typescript
// src/agents/infrastructure/repositories/drizzle-prompt-version.repository.ts
import { and, desc, eq, sql } from 'drizzle-orm'
import type { DrizzleDb } from '../../../shared/infrastructure/db/client'
import type { AgentId, PromptVersion } from '../../domain'
import type {
  CreatePromptVersionCommand,
  IPromptVersionRepository,
} from '../../application/ports/prompt-version-repository.port'
import { PromptVersionMapper } from '../mappers/prompt-version.mapper'
import { promptVersion } from '../schema/prompt-version.schema'

export class DrizzlePromptVersionRepository implements IPromptVersionRepository {
  constructor(private readonly db: DrizzleDb) {}

  async createAtomic(cmd: CreatePromptVersionCommand): Promise<PromptVersion | null> {
    // Atomic insert: SELECT MAX + INSERT in a single statement, guarded by UNIQUE (agent_id, version).
    // `ON CONFLICT DO NOTHING` returns 0 rows iff another writer won the (agent_id, version) slot.
    const rows = await this.db.execute(sql`
      INSERT INTO prompt_version (id, agent_id, version, content, created_at)
      SELECT
        ${cmd.id},
        ${cmd.agentId},
        COALESCE(MAX(version), 0) + 1,
        ${cmd.content},
        ${cmd.createdAt}
      FROM prompt_version
      WHERE agent_id = ${cmd.agentId}
      ON CONFLICT (agent_id, version) DO NOTHING
      RETURNING id, agent_id AS "agentId", version, content, created_at AS "createdAt"
    `)
    const row = (rows as unknown as { agentId: string; id: string; version: number; content: string; createdAt: Date }[])[0]
    if (!row) return null
    return PromptVersionMapper.toDomain(row)
  }

  async findLatestByAgent(agentId: AgentId): Promise<PromptVersion | null> {
    const rows = await this.db
      .select()
      .from(promptVersion)
      .where(eq(promptVersion.agentId, agentId))
      .orderBy(desc(promptVersion.version))
      .limit(1)
    const row = rows[0]
    return row ? PromptVersionMapper.toDomain(row) : null
  }

  async findByAgentAndVersion(agentId: AgentId, version: number): Promise<PromptVersion | null> {
    const rows = await this.db
      .select()
      .from(promptVersion)
      .where(and(eq(promptVersion.agentId, agentId), eq(promptVersion.version, version)))
      .limit(1)
    const row = rows[0]
    return row ? PromptVersionMapper.toDomain(row) : null
  }

  async listByAgent(agentId: AgentId): Promise<PromptVersion[]> {
    const rows = await this.db
      .select()
      .from(promptVersion)
      .where(eq(promptVersion.agentId, agentId))
      .orderBy(desc(promptVersion.version))
    return rows.map((row) => PromptVersionMapper.toDomain(row))
  }
}
```

### Example 5: DEMO-04 dogfood integration test scaffold

```typescript
// tests/integration/agents/dogfood-self-prompt-read.test.ts
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { insertTestApiKey, makeTestApp, signUpAndSignIn, type TestHarness } from '../auth/_helpers'

// Note: this test reuses P3's test helpers (makeTestApp + insertTestApiKey) intentionally.
// Its scope extends the test app with the P4 agents module; Plan 04-04 will augment _helpers.ts
// or add an agents-specific helper that also wires createAgentsModule.

describe('[Integration DEMO-04] Agent reads own latest prompt via API Key', () => {
  let harness: TestHarness
  const aliceEmail = `alice-${Date.now()}@example.test`
  const bobEmail = `bob-${Date.now()}@example.test`
  let aliceUserId = ''
  let bobUserId = ''
  let aliceAgentId = ''
  let aliceFullKey = ''
  let aliceReadOnlyKey = ''
  let bobFullKey = ''

  beforeAll(async () => {
    harness = makeTestApp() // Plan 04-04: extend to include createAgentsModule
    const alice = await signUpAndSignIn(harness, aliceEmail, 'password-123456')
    const bob = await signUpAndSignIn(harness, bobEmail, 'password-123456')
    aliceUserId = alice.userId
    bobUserId = bob.userId
    // POST /agents as alice (human cookie) to create her agent
    const create = await harness.app.handle(
      new Request('http://localhost/agents', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...Object.fromEntries(alice.headers) },
        body: JSON.stringify({ name: 'alice-agent' }),
      }),
    )
    aliceAgentId = (await create.json() as { id: string }).id
    // POST first prompt version v1
    await harness.app.handle(
      new Request(`http://localhost/agents/${aliceAgentId}/prompts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...Object.fromEntries(alice.headers) },
        body: JSON.stringify({ content: 'you are a helpful assistant' }),
      }),
    )
    // Create API Keys directly via SQL helper
    aliceFullKey = (await insertTestApiKey(harness.sql, aliceUserId, { scopes: ['*'] })).rawKey
    aliceReadOnlyKey = (await insertTestApiKey(harness.sql, aliceUserId, { scopes: ['read:*'] })).rawKey
    bobFullKey = (await insertTestApiKey(harness.sql, bobUserId, { scopes: ['*'] })).rawKey
  })

  afterAll(async () => {
    await harness.sql`DELETE FROM "prompt_version" WHERE agent_id = ${aliceAgentId}`
    await harness.sql`DELETE FROM "agent" WHERE owner_id IN (${aliceUserId}, ${bobUserId})`
    await harness.sql`DELETE FROM "apikey" WHERE reference_id IN (${aliceUserId}, ${bobUserId})`
    await harness.sql`DELETE FROM "account" WHERE user_id IN (${aliceUserId}, ${bobUserId})`
    await harness.sql`DELETE FROM "session" WHERE user_id IN (${aliceUserId}, ${bobUserId})`
    await harness.sql`DELETE FROM "user" WHERE id IN (${aliceUserId}, ${bobUserId})`
    await harness.dispose()
  })

  test('variant 1: agent with full-scope key reads own latest prompt → 200', async () => {
    const res = await harness.app.handle(
      new Request(`http://localhost/agents/${aliceAgentId}/prompts/latest`, {
        headers: { 'x-api-key': aliceFullKey },
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json() as { version: number; content: string }
    expect(body.version).toBe(1)
    expect(body.content).toBe('you are a helpful assistant')
  })

  test('variant 2: agent with read-only key reads own latest prompt → 200', async () => {
    const res = await harness.app.handle(
      new Request(`http://localhost/agents/${aliceAgentId}/prompts/latest`, {
        headers: { 'x-api-key': aliceReadOnlyKey },
      }),
    )
    expect(res.status).toBe(200)
  })

  test('variant 3: cross-user API Key reads another user\'s agent → 404', async () => {
    const res = await harness.app.handle(
      new Request(`http://localhost/agents/${aliceAgentId}/prompts/latest`, {
        headers: { 'x-api-key': bobFullKey },
      }),
    )
    expect(res.status).toBe(404)
    expect((await res.json() as { error: { code: string } }).error.code).toBe('RESOURCE_NOT_FOUND')
  })

  test('variant 4: read-only key writes prompt → 403 INSUFFICIENT_SCOPE', async () => {
    const res = await harness.app.handle(
      new Request(`http://localhost/agents/${aliceAgentId}/prompts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': aliceReadOnlyKey },
        body: JSON.stringify({ content: 'new version' }),
      }),
    )
    expect(res.status).toBe(403)
    expect((await res.json() as { error: { code: string } }).error.code).toBe('INSUFFICIENT_SCOPE')
  })
})
```

### Example 6: Concurrent `POST /prompts` race test

```typescript
// tests/integration/agents/prompt-version-monotonic.test.ts
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { makeTestApp, signUpAndSignIn, type TestHarness } from '../auth/_helpers'

describe('[Integration DEMO-02] PromptVersion monotonic under concurrent writes', () => {
  let harness: TestHarness
  let headers: Headers
  let userId = ''
  let agentId = ''
  const email = `race-${Date.now()}@example.test`

  beforeAll(async () => {
    harness = makeTestApp()
    const signed = await signUpAndSignIn(harness, email, 'password-123456')
    headers = signed.headers
    userId = signed.userId
    const create = await harness.app.handle(
      new Request('http://localhost/agents', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...Object.fromEntries(headers) },
        body: JSON.stringify({ name: 'race-agent' }),
      }),
    )
    agentId = (await create.json() as { id: string }).id
  })

  afterAll(async () => {
    await harness.sql`DELETE FROM "prompt_version" WHERE agent_id = ${agentId}`
    await harness.sql`DELETE FROM "agent" WHERE owner_id = ${userId}`
    await harness.sql`DELETE FROM "account" WHERE user_id = ${userId}`
    await harness.sql`DELETE FROM "session" WHERE user_id = ${userId}`
    await harness.sql`DELETE FROM "user" WHERE id = ${userId}`
    await harness.dispose()
  })

  test('10 concurrent POSTs produce 10 distinct versions 1..10, no holes', async () => {
    const N = 10
    const promises = Array.from({ length: N }).map((_, i) =>
      harness.app.handle(
        new Request(`http://localhost/agents/${agentId}/prompts`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...Object.fromEntries(headers) },
          body: JSON.stringify({ content: `version ${i}` }),
        }),
      ),
    )
    const results = await Promise.all(promises)
    const successful = results.filter((r) => r.status === 201)
    expect(successful.length).toBe(N)

    const versions = await Promise.all(
      successful.map(async (r) => (await r.json() as { version: number }).version),
    )
    versions.sort((a, b) => a - b)
    // Expect [1, 2, 3, ..., 10] with no holes and no duplicates.
    expect(versions).toEqual(Array.from({ length: N }, (_, i) => i + 1))
  })
})
```

### Example 7: ADR 0017 template (MADR 4.0)

```markdown
# ADR 0017: EvalDataset Shape Frozen at v1 — jsonb cases, immutable, {input, expectedOutput}

* Status: accepted
* Date: 2026-04-19
* Supersedes: —

## Context and Problem Statement

Phase 4 Demo Domain ships `EvalDataset` as an example of an Agent's evaluation material.
We must freeze its shape at v1 because the harness (Rigging) is opinionated — downstream
Agent code that reads / writes EvalDataset cannot be silently broken by a schema drift.
Multiple valid shapes exist ({input, expectedOutput} vs rich metadata; jsonb vs normalized
eval_case table; immutable vs appendable). Each trade-off affects agent dogfood and future
eval runner integration.

## Decision Drivers

* **Harness engineering:** surface is a contract. Changing shape post-v1 breaks downstream.
* **Minimum viable dogfood:** DEMO-04 only requires "store evaluation cases" — not score.
* **Extensibility without complexity:** jsonb allows adding fields within `cases[].*`
  with a future ADR, while normalizing later requires data migration + ADR supersede.
* **Invariant reproducibility:** same dataset ID = same case set, so an eval run is
  reproducible. Mutation breaks that.

## Considered Options

1. **jsonb `cases` column with `{ input, expectedOutput }` entries, immutable.** (chosen)
2. Normalized `eval_case` table with FK to `eval_dataset`.
3. jsonb `cases` with `{ input, expectedOutput, metadata? }` — metadata open.
4. Mutable `cases` (PATCH endpoint to append).

## Decision Outcome

Chosen: **Option 1 — jsonb cases, strict `{ input, expectedOutput }` only, immutable after
creation.**

Rationale:
* jsonb aligns with aggregate boundary: the dataset is a single value object from Agent's
  perspective; splitting to a child table would imply per-case identity which has no v1
  consumer.
* The strict `{ input, expectedOutput }` shape matches the minimum needed to describe an
  eval case. Metadata can be added in a future ADR supersede without data migration risk
  IF it's added as an additional top-level field in `cases[]` entries AND old-row readers
  use defensive parsing (Pitfall 1 in RESEARCH.md). But v1 says no.
* Immutability guarantees reproducibility: an eval run in P4 + future v2 eval runner
  quotes `datasetId` as a fingerprint; if cases mutate, historical results lose ground.

## Consequences

* **Positive:**
  * One migration (v1 ships jsonb cases, no FK chain to extend).
  * No per-case authorization / editing UI to design.
  * Reproducibility guarantee is structural.
* **Negative / accepted trade-offs:**
  * "Add one more case" workflow requires creating a new dataset and copying.
  * Per-case statistics require an eval runner downstream (not a Rigging concern).
  * Any future shape change (add metadata, migrate to normalized eval_case table) MUST
    be a superseding ADR (0017a or 0018+) with a data-migration plan.
* **Neutral:**
  * TypeBox at controller validates shape on write; mapper defensive-parses on read.
    See RESEARCH.md §Pitfall 1.

## Validation

This ADR is validated by integration tests:
* `tests/integration/agents/eval-dataset-crud.test.ts` — POST / GET / DELETE happy path.
* `tests/integration/agents/eval-dataset-immutable.test.ts` — no PATCH endpoint exists
  (returns 404 to any PATCH /agents/:id/eval-datasets/:datasetId).

## Related

* PROJECT.md anti-feature: "no agent runtime / no LLM integration".
* ROADMAP.md §Phase 4 Risk Flag: "EvalDataset entity shape needs ADR".
* `.planning/phases/04-demo-domain/04-CONTEXT.md` D-01..D-05, D-17.
```

### Example 8: `04-HARNESS-FRICTION.md` template

```markdown
# Phase 4 Harness Friction Log

**Purpose:** Track moments where executor needed to explain harness, fight @ts-ignore urge, or
detected structural friction in P1 feature module template.  Real-time signal during implementation.

**ADR trigger (CONTEXT D-16):** more than 3 events accumulated OR any single event with
`structural: yes` → MUST ship `docs/decisions/0018-p1-template-iteration-after-p4-dogfood.md`.

## Events

<!-- Each event is a single bullet line with timestamp.  Append to this section during any commit.
     Do NOT reorder / delete existing entries.  Format:
     - [YYYY-MM-DD HH:MM] [P4-XX-PLAN] symptom: <phrase> | workaround: <phrase> | structural: yes|no
-->

(No events yet)

## Tally

Updated on every plan-complete commit.  ADR verifier reads the three numbers below.

* Total events: 0
* Structural events: 0
* ADR threshold reached: NO

## Verification (for P4 verifier / phase exit gate)

```bash
total=$(grep -cE '^- \[[0-9]{4}-[0-9]{2}-[0-9]{2}' 04-HARNESS-FRICTION.md)
structural=$(grep -c 'structural: yes' 04-HARNESS-FRICTION.md)
if [ "$total" -gt 3 ] || [ "$structural" -gt 0 ]; then
  echo "ADR 0018 threshold reached (total=$total, structural=$structural)"
  test -f docs/decisions/0018-p1-template-iteration-after-p4-dogfood.md || {
    echo "MUST_HAVES_VIOLATION: threshold reached but ADR 0018 missing"
    exit 1
  }
fi
```
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-written SQL migrations | `drizzle-kit generate` with schema drift detection | drizzle-kit 0.20+ (stable 2024) | Reproducibility + CI drift check. Rigging P1 ADR 0005/0010 pinned. |
| 403 on cross-tenant access | 404 (GitHub API, Google AIP-122 convention) | industry consensus ~2020+ | Prevents enumeration vector. P4 D-09 adopts this. |
| `json` column type with application-level parsing | `jsonb` with compile-time `$type<>()` + runtime TypeBox validation at boundary | Drizzle 0.20+ jsonb support (2023) | Better PG query performance; separation of concerns between type system and runtime guard. |
| Retry-loop for UNIQUE violation | `ON CONFLICT DO NOTHING RETURNING` (atomic) with bounded retry for conflict case only | PostgreSQL 9.5+ ON CONFLICT (2016) + Drizzle atomic query builder | Eliminates TOCTOU, one fewer DB round-trip, less code, fewer bugs. |
| `uuid` DB column + `defaultRandom()` | `text` column + domain-generated UUID via `crypto.randomUUID()` | P3 pattern (2026 Rigging) | Testability: use cases create entities with a stable `newAgentId()` that doesn't require a DB. |
| Two DomainError types for missing vs unauthorized-to-see | Single `ResourceNotFoundError` | P3 D-12 precedent + P4 D-09 | Fewer error types, less branching in error handler, better enumeration resistance. |

**Deprecated/outdated:**

- `bun:sql` driver for Drizzle: P1 ADR 0010 pinned it out because of bun#21934, bun#22395 (transaction hang on concurrent use). Revisit only when both issues are closed.
- `drizzle-orm@1.0.0-beta`: stays out per P1 ADR 0005; breaking changes vs 0.4x not worth v1 risk.
- Drizzle `import { pgTable }` with second-argument **object** returning named constraints: still supported in 0.45.2, but **array form** (used by P3 `apikey.schema.ts` and recommended for P4) is canonical in latest Drizzle docs [VERIFIED Context7].

## Assumptions Log

> All claims tagged `[ASSUMED]` in this research, for user / planner confirmation.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | None — all claims in this research are either [VERIFIED] via `bun pm ls`, grep of the repo, Context7 docs, or [CITED] from CONTEXT.md / existing source files. | — | — |

**Table is empty:** All claims in this research were verified or cited — no user confirmation needed for `[ASSUMED]` items. The only design choices the planner must still commit to are within the Claude's Discretion block from CONTEXT (which is explicitly marked as owned by researcher/planner in D-xx).

## Open Questions (RESOLVED)

1. **Whether `CreatePromptVersionUseCase` uses Drizzle query-builder `.onConflictDoNothing({ target: [...] })` vs raw `sql\`...\`` template.**
   - What we know: Drizzle supports both; `.onConflictDoNothing()` accepts a `target` array of columns or the unique constraint name. For SELECT-MAX inside the INSERT, raw SQL is simpler because Drizzle's query builder doesn't naturally express `INSERT ... SELECT MAX(...) + 1 FROM ...` in one statement.
   - What's unclear: the cleanest idiomatic Drizzle 0.45.2 code — either approach works.
   - Recommendation: use `db.execute(sql\`...\`)` (shown in Example 4) for readability and to match the "SELECT MAX + INSERT in one statement" shape. If planner finds query-builder form cleaner, acceptable alternative.
   - **RESOLVED:** Plan 04-02 §Interfaces adopts Drizzle query-builder form — `db.insert(promptVersion).values({...}).onConflictDoNothing({ target: [promptVersion.agentId, promptVersion.version] }).returning()` — paired with a bounded `MAX_RETRY = 3` loop re-reading `SELECT MAX(version)` each iteration and throwing `PromptVersionConflictError` on exhaustion. Both paths satisfy D-06; query-builder chosen for type safety and staying within Drizzle idioms (consistent with rest of P4 repository code).

2. **Whether Agent `ownerId` FK should `ON DELETE CASCADE` to user.id.**
   - What we know: P3 auth schema has no `user` hard-delete path (BetterAuth user lifecycle defaults). Adding `ON DELETE CASCADE` is defensive consistency with D-12 cascade philosophy.
   - What's unclear: if future PROD-* hardening adds user deletion, cascade would nuke their agents silently.
   - Recommendation: ship with `ON DELETE CASCADE` now (consistent with D-12 pattern); if v2 adds user deletion with retention semantics, revisit in an ADR.
   - **RESOLVED:** Plan 04-01 §Schema ships `agent.owner_id` with `references(() => user.id, { onDelete: 'cascade' })` — consistent with D-12 cascade philosophy across `prompt_version.agent_id` and `eval_dataset.agent_id`. If v2 PROD-* adds user-deletion lifecycle with retention semantics, that phase must open a new ADR to supersede (not P4's concern).

3. **Whether list endpoints (`GET /agents`, `GET /agents/:id/prompts`) support pagination at v1.**
   - What we know: CONTEXT does not lock pagination in v1; list endpoints return all rows. P3 `GET /api-keys` also returns all.
   - What's unclear: unbounded list on high-cardinality data (many PromptVersions per agent) could be slow. For v1 demo dogfood, unlikely.
   - Recommendation: ship v1 without pagination (`ORDER BY version DESC` for prompts, `ORDER BY created_at DESC` for agents). v2 convenience.
   - **RESOLVED:** No pagination in v1 — list endpoints return all rows. Agents `ORDER BY created_at DESC`, PromptVersion `ORDER BY version DESC`, EvalDataset `ORDER BY created_at DESC`. Decision parallels P3 `GET /api-keys` precedent (no pagination). Deferred to v2 convenience; 04-04-SUMMARY.md will surface this as a v1 surface contract so future consumers know pagination is additive (not breaking) when added. Not a friction event — deliberate scope choice, `structural: no`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | Runtime + `bun test` | ✓ | 1.3.12 (P1 ADR 0001 pinned) | — |
| PostgreSQL 16 | Drizzle migrations + test DB | ✓ (via `docker-compose up`) | 16-alpine (P1) | — |
| drizzle-kit 0.31.10 | Migration generation | ✓ | 0.31.10 | — |
| postgres-js 3.4.9 | Runtime DB driver | ✓ | 3.4.9 | — |
| elysia 1.4.28 | HTTP server | ✓ | 1.4.28 | — |
| drizzle-orm 0.45.2 | ORM | ✓ | 0.45.2 | — |
| @sinclair/typebox 0.34.49 | DTO validation | ✓ | 0.34.49 | — |
| pino 10.3.1 | Logger | ✓ | 10.3.1 | — |
| @bogeychan/elysia-logger 0.1.10 | Request logger | ✓ | 0.1.10 | — |
| BetterAuth 1.6.5 + @better-auth/api-key 1.6.5 | Auth resolver (P3) | ✓ | 1.6.5 (exact pin) | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `bun:test` (built-in to Bun 1.3.12) |
| Config file | None — Bun test discovers via filename convention `*.test.ts` |
| Quick run command | `bun test tests/unit/agents tests/integration/agents` |
| Full suite command | `bun test` |
| Contract tests (DDD import rules) | `bun test:contract` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEMO-01 | POST /agents creates agent owned by caller | integration | `bun test tests/integration/agents/agent-crud.test.ts` | ❌ Plan 04-04 |
| DEMO-01 | GET /agents/:id 404 on cross-user | integration | `bun test tests/integration/agents/cross-user-404.test.ts` | ❌ Plan 04-04 |
| DEMO-01 | PATCH /agents/:id updates name, updates updated_at | integration | `bun test tests/integration/agents/agent-crud.test.ts` | ❌ Plan 04-04 |
| DEMO-01 | DELETE /agents/:id cascade-deletes children | integration | `bun test tests/integration/agents/cascade-delete.test.ts` | ❌ Plan 04-04 |
| DEMO-02 | POST /agents/:id/prompts assigns monotonic version under concurrency | integration | `bun test tests/integration/agents/prompt-version-monotonic.test.ts` | ❌ Plan 04-04 |
| DEMO-02 | GET /agents/:id/prompts/:version returns exact version | integration | `bun test tests/integration/agents/prompt-version-crud.test.ts` | ❌ Plan 04-04 |
| DEMO-02 | GET /agents/:id/prompts lists in version DESC | integration | `bun test tests/integration/agents/prompt-version-crud.test.ts` | ❌ Plan 04-04 |
| DEMO-02 | GET /agents/:id/prompts/latest returns max version | unit | `bun test tests/unit/agents/get-latest-prompt-version.usecase.test.ts` | ❌ Plan 04-02 |
| DEMO-03 | POST /agents/:id/eval-datasets with cases array | integration | `bun test tests/integration/agents/eval-dataset-crud.test.ts` | ❌ Plan 04-04 |
| DEMO-03 | Malformed cases (missing field) → 400 ValidationError | integration | `bun test tests/integration/agents/eval-dataset-crud.test.ts` | ❌ Plan 04-04 |
| DEMO-03 | DELETE /agents/:id/eval-datasets/:id removes row | integration | `bun test tests/integration/agents/eval-dataset-crud.test.ts` | ❌ Plan 04-04 |
| DEMO-03 | ADR 0017 committed | manual | grep `docs/decisions/0017-*.md` | ❌ Plan 04-04 |
| DEMO-04 | Agent API Key reads own latest prompt → 200 (full + read-only) | integration | `bun test tests/integration/agents/dogfood-self-prompt-read.test.ts` | ❌ Plan 04-04 |
| DEMO-04 | Cross-user API Key → 404 RESOURCE_NOT_FOUND | integration | `bun test tests/integration/agents/dogfood-self-prompt-read.test.ts` | ❌ Plan 04-04 |
| DEMO-05 | Read-only key POST /prompts → 403 INSUFFICIENT_SCOPE | integration | `bun test tests/integration/agents/scope-check-read-only-key.test.ts` | ❌ Plan 04-04 |
| DEMO-05 | Full-scope key POST /prompts → 201 | integration | `bun test tests/integration/agents/scope-check-read-only-key.test.ts` | ❌ Plan 04-04 |
| DEMO-06 | `createAgentsModule` factory wires cleanly from `createApp` | smoke | `bun test tests/integration/agents/module-smoke.test.ts` | ❌ Plan 04-03 |
| DEMO-06 | 04-HARNESS-FRICTION.md tally matches committed state | verifier script | `bash .planning/phases/04-demo-domain/verify-friction-tally.sh` | ❌ Plan 04-04 |
| DEMO-06 | If tally >3 OR structural=yes, ADR 0018 shipped | verifier script | (same script as above) | ❌ Plan 04-04 |

### Sampling Rate

- **Per task commit:** `bun test tests/unit/agents tests/integration/agents/<affected>.test.ts`
- **Per wave merge:** `bun test tests/integration/agents` + contract tests (`bun test:contract`)
- **Phase gate:** `bun test` (full suite — includes 122 P3 tests regression + new P4 tests) + `bun run lint` + `bun run typecheck` + `bunx drizzle-kit generate --name=ci-drift` (no drift)

### Wave 0 Gaps

- [ ] `tests/integration/agents/_helpers.ts` — extend P3 `tests/integration/auth/_helpers.ts` with `createAgentsModule` wire; or add `withAgentsModule(harness)` helper
- [ ] `tests/integration/agents/agent-crud.test.ts` — covers DEMO-01 CRUD happy path
- [ ] `tests/integration/agents/cross-user-404.test.ts` — covers D-09 across GET/PATCH/DELETE/POST prompts
- [ ] `tests/integration/agents/cascade-delete.test.ts` — covers D-12 FK cascade across prompt_version + eval_dataset
- [ ] `tests/integration/agents/prompt-version-monotonic.test.ts` — covers D-06 concurrent race
- [ ] `tests/integration/agents/prompt-version-crud.test.ts` — covers D-08 latest / :version / list
- [ ] `tests/integration/agents/eval-dataset-crud.test.ts` — covers D-03/D-04/D-05
- [ ] `tests/integration/agents/dogfood-self-prompt-read.test.ts` — covers DEMO-04 4 variants
- [ ] `tests/integration/agents/scope-check-read-only-key.test.ts` — covers DEMO-05
- [ ] `tests/integration/agents/module-smoke.test.ts` — covers DEMO-06 factory composition
- [ ] `tests/unit/agents/*.usecase.test.ts` — unit tests per use case (ports mocked), covers application layer invariants (scope check / ownership check) in isolation
- [ ] `.planning/phases/04-demo-domain/verify-friction-tally.sh` — bash verifier script for D-15/D-16 tally + ADR 0018 presence
- [ ] Framework install: none — `bun test` is built-in

*Validation dimensions (Nyquist 1-8):*

1. **Behavioral (happy path):** Agent CRUD, PromptVersion create/read, EvalDataset create/read/delete — DEMO-01..03 integration tests
2. **Adversarial:** cross-user 404 (D-09), read-only key on write (DEMO-05), malformed jsonb cases → 400 (Pitfall 1), concurrent version race (Pitfall 2) — covers the non-happy axes
3. **Contractual:** OpenAPI spec (from `@elysiajs/swagger`) must reflect new routes with correct `response` schemas; module composition smoke test (DEMO-06); DDD contract test (P1 `test:contract` — no new agents domain import of drizzle-orm)
4. **Observability:** pino warn log emitted on ownership-fail (P2 errorHandler D-13 logs 4xx to warn with `{ code, requestId, path }`) and scope-fail — verifiable via log capture in integration tests if needed
5. **Resilience:** cascade delete test (D-12) — deleting agent takes children with it in one transaction; no orphaned rows
6. **Operational:** `bunx drizzle-kit generate --name=ci-drift` produces no new SQL after migration commit (drift check)
7. **Composability:** `createAgentsModule` composes cleanly with `createAuthModule` and health module in `createApp` (DEMO-06 smoke) — the harness proves itself reusable
8. **Harness friction:** 04-HARNESS-FRICTION.md tally + ADR 0018 conditional — meta-observation of the harness experience (DEMO-06 second clause)

## Sources

### Primary (HIGH confidence)

- Context7 `/drizzle-team/drizzle-orm-docs` — jsonb + composite UNIQUE + `onConflictDoNothing` + `.returning()` + index with `.desc()` (2026-04-19)
- Context7 `/porsager/postgres` — `sql.PostgresError` with `code === '23505'` + `constraint_name` for UNIQUE violations (2026-04-19)
- Context7 `/elysiajs/documentation` — `new Elysia({ prefix: '/foo/:bar' })` + `.use()` composition pattern (2026-04-19)
- `package.json` + `bun pm ls` — all P4 dependencies verified present at pinned versions
- `.planning/phases/04-demo-domain/04-CONTEXT.md` — 16 D-xx decisions + D-17 ADR 0017 lock
- `src/auth/auth.module.ts`, `src/health/health.module.ts`, `src/bootstrap/app.ts` — P2/P3 factory + composition patterns
- `src/auth/infrastructure/schema/api-key.schema.ts` — `pgTable` callback array form with `index(...)` constraints (P3 precedent)
- `src/auth/infrastructure/repositories/drizzle-api-key.repository.ts` — Drizzle query + Mapper pattern precedent
- `src/auth/presentation/controllers/api-key.controller.ts` — `(context as unknown as { authContext: AuthContext }).authContext` cast pattern + `requireAuth: true` route option usage
- `src/auth/application/usecases/create-api-key.usecase.ts` — scope-check + ownership-check prologue precedent
- `src/shared/kernel/errors.ts` + `id.ts` + `brand.ts` — DomainError base + UUID brand helpers
- `biome.json` — DDD framework-free rules
- `tests/integration/auth/_helpers.ts` — test harness + `insertTestApiKey` helper (P4 reuses)

### Secondary (MEDIUM confidence)

- `docs/decisions/0012-global-plugin-ordering.md` — plugin ordering for `createApp`
- `docs/decisions/0016-betterauth-defaults-trust.md` — P3 BetterAuth defaults baseline

### Tertiary (LOW confidence)

- Google AIP-122 / GitHub API 404-vs-403 convention [CITED: https://google.aip.dev/122] — industry convention, not project precedent

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all versions verified via `bun pm ls`, all APIs verified via Context7 + existing P3 source
- Architecture: HIGH — all patterns have direct P3 precedent (auth module), only composition details are new
- Pitfalls: HIGH — three of six pitfalls are direct P3 battle-scars (macro cast, 404-vs-403, tally trigger); two are Drizzle/PG specifics with verified Context7 docs; one is DB race theory with verified SQL
- Validation: HIGH — bun:test is built-in; `tests/integration/auth/_helpers.ts` provides reusable harness; all gaps are known file creations, no framework install needed

**Research date:** 2026-04-19

**Valid until:** 2026-05-19 (30 days — Drizzle 0.45.2 + Elysia 1.4.28 + postgres-js 3.4.9 are stable pins, no upstream churn expected)
