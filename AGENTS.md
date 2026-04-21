<a id="ai-agent-onboarding"></a>

# AGENTS.md

> AI Agent 接手本專案前必讀 / AI Agent Onboarding

1. **[Core Value + Why Rigging](#project)** — 1 分鐘：harness engineering 是什麼（見下方 Project 區塊）
2. **[Rigidity Map (必嚴格 / 可 ADR 逃生 / 純約定)](#rigging-rigidity-map--ai-agent-接手本專案前必讀)** — 2 分鐘：三級嚴格度決定你能動什麼
3. **[Anti-features (禁止提議擴張)](#anti-features-do-not-propose-extending)** — 1 分鐘：哪些事 Rigging v1 不做
4. **[GSD workflow role](#gsd-workflow-enforcement)** — 本檔的 GSD 區塊如何運作
5. **[Further reading](#further-reading)** — [README.md](README.md) · [docs/architecture.md](docs/architecture.md) · [docs/decisions/](docs/decisions/README.md)

---

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Rigging**

Rigging 是一個用 **Harness Engineering** 思維打造的 opinionated 專案骨架（最終形式是 `npx rigging`，v1 先以 Reference App 形式存在）。它不是工具箱（像 LangChain），而是「軌道」——透過強意見的技術棧（Bun + Elysia + DDD + ADR）與強制的 AuthContext 身分邊界，讓 AI Agent 在其上實作功能時，**被結構本身約束**寫出安全、一致、可組合的程式碼。

使用對象是開發者與 AI Agent：開發者選擇這條軌道，AI Agent 在軌道上敷捷分段實作功能。

**Core Value:** **AI Agent 寫出來的程式碼必須「自動」具備安全性與結構性——靠的不是提示詞約束，而是框架本身的軌道（type system + runtime guards + DI）讓錯誤的寫法根本跑不起來。**

如果其他都失敗，這一點不能失敗：任何 Domain 操作必須通過 AuthContext，沒有 AuthContext 就連 handler 都 wire 不起來。

### Constraints

- **Tech stack**: Bun + Elysia + TypeScript + PostgreSQL + Drizzle ORM + BetterAuth — 已鎖定，為維持強意見不走回頭路
- **Architecture**: DDD 分層（Domain / Application / Infrastructure / Presentation）+ ADR — 一切核心決策須寫 ADR
- **Auth mechanism**: Runtime Guards + DI 為主（Elysia `.derive()` / `.decorate()` + plugin），非純型別層強制 — 偏好實務可維護性
- **Identity**: 雙軌驗證（session for human, API Key for agent）一次到位 — Agent 使用情境 v1 就要能跑
- **Email**: Dev-only console log — 避免外部服務依賴污染核心 harness 開發
- **Quality**: 社群可用等級（unit + 關鍵 integration tests），非生產級 — 為了維持開發節奏
- **Delivery**: API-first，無前端 UI — 聚焦後端骨架
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Executive Summary
## Recommended Stack
### Core Technologies (LOCKED by user — versions verified 2026-04-18)
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Bun** | `^1.3.12` | Runtime, bundler, test runner, package manager | Native TS (no `tsx`/`ts-node`), `Bun.password` native argon2, `bun:test` built-in, `bun --watch` replaces nodemon. Elysia is Bun-native. |
| **Elysia** | `^1.4.28` | Web framework | TypeScript-first. `.derive()` + `.decorate()` + `.macro()` are the primary DI + runtime-guard primitives — exactly the "rails" surface for AuthContext enforcement. **≥ 1.4 is mandatory** for `.mount()` Set-Cookie preservation (BetterAuth session flow depends on it). |
| **TypeScript** | `^5.9` (Elysia peerDep: `>= 5.0.0`) | Static types | Locked. Use `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `target: "ESNext"`, `moduleResolution: "bundler"`, `types: ["bun-types"]`. |
| **PostgreSQL** | `16.x` (via Docker image `postgres:16-alpine`) | Primary database | DDD Repository pattern maps cleanly to Postgres. Drizzle's strongest dialect. Version 16 is mainstream-stable in 2026; avoid bleeding-edge 17/18 unless a specific feature is needed. |
| **Drizzle ORM** | `^0.45.2` (NOT 1.0 beta) | Type-safe query builder / schema / migrations | Deep TS type inference. Relational queries. Schema-first migrations via `drizzle-kit`. **Do NOT pin `1.0.0-beta.x`** — beta since late 2025, still churning; a harness framework MUST ship on the stable line. |
| **drizzle-kit** | `^0.31.10` | Migration generation + push + studio | Generates SQL migrations from schema diffs (`drizzle-kit generate`), applies (`drizzle-kit migrate`), ships `drizzle-kit studio` web UI for local DB inspection. Declared peer of `drizzle-orm`. |
| **BetterAuth** | `^1.6.5` | Auth (session + password + email verification + password reset + API keys via plugin) | Lucia is in maintenance. BetterAuth is framework-agnostic, TS-first, ships `@better-auth/drizzle-adapter` in lockstep. `apiKey()` plugin covers the Agent auth track — no custom implementation needed for MVP. |
| **postgres (`postgres.js`)** | `^3.4.9` | Postgres driver | Drizzle's recommended driver for Bun/Node. Lighter than `pg`, better TS types, cleaner Bun compat. Prefer over `pg` (`^8.20.0`) unless you need a connection-pool library that only supports `pg`. |
### Schema Validation (Handler Boundaries)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@sinclair/typebox** | `^0.34.49` | JSON Schema + TS type validation at Elysia boundaries | **Default choice.** Elysia's `t.Object({...})` *is* TypeBox — you're already using it when you type a route body. Stay here for handler I/O validation. Pinned as Elysia peerDep (`>= 0.34.0 < 1`). |
| ~~Zod~~ | ~~`^4.3.6`~~ | ~~Alternative validator~~ | **Don't introduce directly.** BetterAuth pulls Zod 4 transitively — you can rely on it internally for BetterAuth's surface, but don't adopt Zod as your Domain validation layer. One validator per project. |
### Auth Layer (Detailed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| **better-auth** | `^1.6.5` | Session auth core | `email-and-password` strategy is built-in. Session cookies via signed HTTP-only cookie. Config lives in `src/infrastructure/auth/index.ts`. |
| **@better-auth/drizzle-adapter** | `^1.6.5` | Persists BetterAuth tables via Drizzle | Use `drizzleAdapter(db, { provider: "pg", schema })`. Generate BetterAuth's schema via `bunx @better-auth/cli generate`, then pass through `drizzle-kit generate`. Versions track BetterAuth core 1:1. |
| **better-auth / apiKey plugin** | bundled with core | API Key generation + verification for Agent track | Built-in plugin — handles creation, hashing (server-side), revocation. Saves you from implementing the Agent auth track from scratch. Dual-track (cookie + `x-api-key` header) resolves into a single BetterAuth session representation. |
| **Bun.password** | built into Bun 1.3.12 | Argon2id password hashing (if you need *anything* beyond BetterAuth's surface) | Native, zero deps. `await Bun.password.hash(pwd)` / `await Bun.password.verify(pwd, hash)`. Defaults to argon2id in PHC format. BetterAuth handles user-password hashing itself; this is for *any other* secret hashing you do (e.g., hashing API keys before storing). |
### Logging
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@bogeychan/elysia-logger** | `^0.1.10` | Pino-backed structured request logger for Elysia | **Default.** Structured JSON logs, automatic req/res/error capture, type-safe `ctx.log` on handlers. Future-proof for OTEL / Loki / Datadog shipping. |
| **pino** | `^10.3.1` | Underlying logger | Peer dep of elysia-logger. Use `pino-pretty` (`^13.1.3`) as `dev`-only transport for human-readable console output. |
| ~~logixlysia~~ | — | Alternative: pretty console logger | **Reject for harness.** Pretty but unstructured. Cannot feed observability pipelines. Fine for a toy but wrong primitive for a "community-ready" framework. |
### Testing
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **bun:test** | built into Bun 1.3.12 | Test runner, assertions, mocks, coverage | Jest-compatible API. 20x faster than Jest. Zero config. Built-in `--coverage`, snapshot, `--watch`. Use this instead of Vitest. |
| **@elysiajs/eden** | `^1.4.9` | End-to-end-typed test client (`edenTreaty`) | Pass Elysia app instance → get a typed client → assert on response. In-process, no HTTP server, type-level regressions caught at compile-time. Primary integration-test primitive. |
| **testcontainers** | `^11.14.0` | Ephemeral Postgres per test suite | For integration tests that hit a real DB. Spin up `postgres:16-alpine`, run migrations, truncate between tests. Preferred over long-lived dev DB for CI reproducibility. |
| **@faker-js/faker** | `^10.4.0` | Fixture / fake data generation | For seeding test users, sessions, API keys. v10 is stable. |
### Dev Tooling
| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| **Biome** | `^2.4.12` (`@biomejs/biome`) | Linter + formatter in one | Single `biome.json` at repo root. Rust-native, ~20x faster than ESLint+Prettier. v2 has type-aware rules closing the `@typescript-eslint` gap. Nested config supports workspaces if you later split into a monorepo. |
| **bun --watch** | built-in | Dev file watcher (replaces nodemon / tsx watch) | `bun --watch src/index.ts`. Also `bun --hot` for HMR-style reload that preserves state. |
| **dotenv** | — (NOT NEEDED) | Env loading | Bun auto-loads `.env`, `.env.local`, `.env.development`, `.env.production`. Do NOT install `dotenv` — Bun's built-in handling is richer (priority order, interpolation). |
| **lefthook** or **husky** | lefthook `^1.13` | Git hooks (pre-commit lint/format/typecheck) | Lefthook is Go-binary, works with Bun; husky pulls in Node tooling. Prefer lefthook. |
### Container / Deploy Shape (v1 Reference App)
| Tool | Purpose | Notes |
|------|---------|-------|
| **Dockerfile** (`oven/bun:1.3-alpine`) | Production image | Multi-stage: `bun install --frozen-lockfile --production` → copy → `bun run src/index.ts`. Alpine to keep image small. |
| **docker-compose.yml** | Local Postgres + Adminer | `postgres:16-alpine` + optional `adminer` for quick DB browsing. Volume-mounted for persistence. |
| **`.dockerignore`** | Exclude `node_modules`, `.git`, `.env*`, `bun.lockb` rebuild avoided | — |
## Installation
# Core runtime (one-time)
# Project dependencies
# Dev dependencies
## Integration Pattern: BetterAuth + Elysia + Drizzle (canonical)
## Alternatives Considered
| Recommended | Alternative | When the Alternative Is Better |
|-------------|-------------|--------------------------------|
| Bun | Node.js 22 LTS + tsx | Only if you need a library that has a broken Bun compat (`bcrypt` native bindings were historically broken; now solved via `Bun.password`). In 2026, no compelling reason for a greenfield opinionated framework. |
| Elysia | Hono | Hono wins on cross-runtime portability (Cloudflare Workers, Deno, Node). Choose Hono if portability > Bun-specific DX. For a Bun-first harness, Elysia's `.macro`/`.derive` give better DI primitives. |
| Drizzle 0.45 | Drizzle 1.0-beta | When beta stabilises (watch the `latest` tag flip). Until then, beta = API drift = bad foundation for a framework. |
| TypeBox | Zod 4 | Zod is worth it if you need its richer `.transform` / `.refine` ergonomics outside handler boundaries. For handler I/O, TypeBox is already there via Elysia. |
| BetterAuth | Lucia | Don't. Lucia is in maintenance (as of 2024). |
| BetterAuth | Auth.js (NextAuth) | Auth.js is Next-centric and heavier. BetterAuth is the Elysia-friendly choice. |
| Biome | ESLint 9 + Prettier | Only if you need a specific ESLint plugin that has no Biome equivalent (very rare in 2026 — Biome 2.4 has 423+ rules incl. type-aware). |
| `@bogeychan/elysia-logger` | `logixlysia` | When you truly only want pretty local logs and will never ship structured logs. Reject for harness framework. |
| `Bun.password` | `argon2` npm pkg | When running on Node.js (outside this project's scope). |
| `postgres` driver | `pg` | If you need `pg-pool` specifically, or a library that hard-requires `pg`. |
| `bun:test` | Vitest | If porting an existing Vitest suite. For greenfield, use `bun:test`. |
| testcontainers | Docker-compose-up once, truncate between tests | Faster local iteration, worse CI isolation. Use shared container for local DX, testcontainers for CI. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Drizzle `1.0.0-beta.x`** | Beta since late 2025, API still churning. A harness framework cannot absorb upstream breaking changes. | `drizzle-orm@^0.45.2` (stable `latest`). |
| **Lucia** | In maintenance mode (official announcement). No new features, security-only. | BetterAuth. |
| **Elysia < 1.4** | `.mount()` drops `Set-Cookie` headers — BetterAuth sessions silently fail. | `elysia@^1.4.28`. |
| **`bcrypt` / `bcryptjs` npm** | `bcrypt` needs native build (painful on Bun/Alpine); `bcryptjs` is 10-100x slower than `Bun.password` native argon2. | `Bun.password` (argon2id, zero deps). |
| **`argon2` npm pkg** | Native bindings, build-time pain. Redundant when Bun ships it natively. | `Bun.password`. |
| **`dotenv`** | Bun auto-loads `.env*` with better priority rules. Adding `dotenv` creates two env-loading sources of truth. | Bun's built-in `.env` handling. |
| **`nodemon` / `ts-node-dev` / `tsx`** | Not needed on Bun. | `bun --watch` / `bun --hot`. |
| **ESLint + Prettier** | Two tools, slower, more config. For an opinionated greenfield framework in 2026, it's a regression. | Biome 2.x. |
| **Jest** | 20x slower than `bun:test`, needs `ts-jest`/Babel, awkward ESM story. | `bun:test`. |
| **Vitest** | Duplicates what `bun:test` does natively. Extra dep, extra config. | `bun:test`. |
| **`tsyringe` / `inversify` / other IoC containers** | Violates user's locked constraint ("Elysia's built-in .derive/.decorate is the DI"). Introduces a second mental model. | `.derive()`, `.decorate()`, `.macro()`, plugin composition. |
| **Zod as Domain validator** | You already have TypeBox via Elysia and Zod via BetterAuth transitively. Adding Zod as *your* Domain validator creates three validators. | TypeBox consistently across handlers and Domain schemas. |
| **`jsonwebtoken` / manual JWT** | BetterAuth handles sessions. Custom JWT = reinventing auth. If you truly need JWT for something, `@elysiajs/jwt` is the ecosystem plugin. | BetterAuth sessions (cookie) + BetterAuth API keys (header). No JWT for v1. |
| **`pg` (unless needed)** | `postgres.js` is lighter, better TS ergonomics, better Bun compat. | `postgres@^3.4.9`. |
| **Real email provider (Resend, SMTP)** for v1 | User-locked out-of-scope. | Console log the verify/reset URL in a `MailAdapter` interface. Swap the adapter later. |
| **Monorepo (pnpm workspaces / turbo / nx) for v1** | User-locked: v1 is single package. Premature workspace split is the #1 failure mode for opinionated scaffolds. | Single `package.json`. Revisit when extracting `@rigging/core` etc. |
## Stack Patterns by Variant
- Single `package.json`, single `tsconfig.json`
- `src/{domain,application,infrastructure,presentation}/` DDD folders
- Single Elysia app entry `src/index.ts`
- Dev DB via `docker-compose up -d postgres`
- Deploy = Dockerfile + `bun run src/index.ts`
- Move to Bun workspaces: `packages/{core,auth,db,cli}`
- Extract DI primitives (auth macro, DB container, logger) into `@rigging/core`
- CLI uses `bun init` + file templating
- Keep Biome nested config — each package can override
- Keep Pino, add OTEL trace bridge: `@opentelemetry/instrumentation-pino`
- Add `@elysiajs/opentelemetry` for span creation
- Ship to Tempo/Jaeger/Honeycomb via OTLP exporter
- No code churn in Domain layer
## Version Compatibility Matrix
| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `elysia@^1.4.28` | `@sinclair/typebox@>=0.34 <1`, `@types/bun@>=1.2`, `typescript@>=5.0` | Elysia peerDeps. Ignore at your peril — TypeBox 1.x will break. |
| `drizzle-orm@^0.45.2` | `drizzle-kit@>=0.31.4`, `postgres@>=3`, `pg@>=8` | Drizzle peerDep range. |
| `better-auth@^1.6.5` | `@better-auth/drizzle-adapter@^1.6.5` (track exact version) | Adapter version MUST match core — BetterAuth releases them in lockstep. |
| `better-auth@^1.6.5` | `elysia@>=1.4` | `.mount()` Set-Cookie fix is required for session flow. |
| `@bogeychan/elysia-logger` | `elysia@>=1.2.10`, `pino@>=9.6.0` | Stated peerDeps. Pino 10.x works fine. |
| `bun@^1.3.12` | All of above | Runtime floor. `Bun.password` has been stable since 0.6.8, available throughout 1.x. |
| Drizzle `1.0.0-beta.22` | would require `drizzle-kit@>=???` — still churning | **Do not mix.** Pin stable line until `latest` tag flips. |
## Risk Flags (for Roadmap)
| Risk | Severity | Mitigation |
|------|----------|------------|
| BetterAuth schema generation issue with newer Elysia (GitHub #5446) | MEDIUM | Generate BetterAuth schema once via `bunx @better-auth/cli generate`, then commit the generated Drizzle schema. Re-run only on BetterAuth version bumps. Test the integration in a spike before Phase 1 close. |
| Drizzle 1.0 release during project lifetime | MEDIUM | Pin `^0.45.2`. Track `latest` tag. When it flips to 1.x, write a Migration ADR — don't auto-bump. |
| Eden Treaty type inference edge cases with BetterAuth plugin (GitHub #215) | LOW | Use `app.handle(Request)` as a fallback for tests that Eden can't type. Document the workaround in a testing ADR. |
| Bun breaking change in a minor release | LOW | Pin Bun in CI and Dockerfile (`oven/bun:1.3-alpine`, not `oven/bun:latest`). Bun's 1.x line has been stable, but pinning is cheap insurance. |
| `postgres.js` driver connection pool semantics differ from `pg` | LOW | Document the "one connection per request via Drizzle" pattern. Don't mix drivers. |
## Sources
- **Context7 / npm registry (verified 2026-04-18):** `bun@1.3.12`, `elysia@1.4.28`, `drizzle-orm@0.45.2` (beta `1.0.0-beta.22`), `drizzle-kit@0.31.10`, `better-auth@1.6.5`, `@better-auth/drizzle-adapter@1.6.5`, `@sinclair/typebox@0.34.49`, `pino@10.3.1`, `@bogeychan/elysia-logger@0.1.10`, `@biomejs/biome@2.4.12`, `@elysiajs/eden@1.4.9`, `testcontainers@11.14.0`, `@faker-js/faker@10.4.0`, `postgres@3.4.9`, `pino-pretty@13.1.3`. — HIGH confidence
- **Official docs — [BetterAuth: Elysia Integration](https://better-auth.com/docs/integrations/elysia)** — canonical `.mount(auth.handler)` + `.macro({ auth: { resolve(...) } })` pattern. HIGH confidence
- **Official docs — [BetterAuth: Drizzle ORM Adapter](https://better-auth.com/docs/adapters/drizzle)** — `drizzleAdapter(db, { provider: "pg", schema })` + `bunx @better-auth/cli generate` flow. HIGH confidence
- **Official docs — [Elysia: Better Auth integration](https://elysiajs.com/integrations/better-auth)** — Elysia-side perspective, confirms 1.4 `.mount()` Set-Cookie fix. HIGH confidence
- **Official docs — [Elysia: Eden Treaty Unit Test](https://elysiajs.com/eden/treaty/unit-test)** and **[Elysia: Testing](https://elysiajs.com/patterns/unit-test)** — `edenTreaty(app)` pattern, `app.handle(Request)` alternative. HIGH confidence
- **Official docs — [Bun: Hashing](https://bun.com/docs/runtime/hashing)** and **[Bun.password reference](https://bun.com/reference/bun/password)** — native argon2id, Zig-backed, zero deps. HIGH confidence
- **GitHub issue — [better-auth/better-auth#5446](https://github.com/better-auth/better-auth/issues/5446)** — schema-gen compat issue with newer Elysia; last known-good was Elysia 1.4.9. MEDIUM confidence (still open at research time)
- **GitHub issue — [elysiajs/elysia#1806](https://github.com/elysiajs/elysia/issues/1806)** — `.mount(auth.handler)` 404 edge case on `/api/auth/*` — workaround is explicit GET/POST. MEDIUM confidence
- **GitHub issue — [elysiajs/eden#215](https://github.com/elysiajs/eden/issues/215)** — Eden Treaty type inference loss with BetterAuth plugin in modules. LOW severity, MEDIUM confidence
- **Ecosystem signal — [PkgPulse: Hono vs Elysia 2026](https://www.pkgpulse.com/blog/hono-vs-elysia-2026)**, **[PkgPulse: Biome vs ESLint vs Oxlint 2026](https://www.pkgpulse.com/blog/eslint-vs-biome-2026)** — ecosystem trend confirmation. MEDIUM confidence
- **Ecosystem — [@bogeychan/elysia-logger README](https://github.com/bogeychan/elysia-logger)** — peer deps, Pino integration pattern. HIGH confidence
- **Ecosystem — [PlanetScale: Why we chose NanoIDs](https://planetscale.com/blog/why-we-chose-nanoids-for-planetscales-api)**, **[prefix.dev: How we implemented API keys](https://prefix.dev/blog/how_we_implented_api_keys)** — API key generation patterns (though BetterAuth's apiKey plugin makes this largely moot for v1). MEDIUM confidence
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- RIGGING:rigidity-map-start source:docs/decisions/0009-rigidity-map.md -->
## Rigging Rigidity Map — AI Agent 接手本專案前必讀

Rigging uses a three-tier strictness model. Check the tier before proposing a change.

### Tier 1 — Must Be Rigid

1. AuthContext is the only path to any domain service.
   - Do not instantiate domain services outside the factory barrel.
   - `getXxxService(ctx: AuthContext)` is the only legal entry point.
   - Runtime guards throw `AuthContextMissingError` on missing context. See ADR 0006 and ADR 0007.

2. The domain layer is framework-free.
   - `src/**/domain/**` must not import `drizzle-orm`, `elysia`, `better-auth`, `postgres`, `@bogeychan/elysia-logger`, or `pino`.
   - Biome `noRestrictedImports` enforces this boundary.
   - A violation is a CI failure, not a review-time preference.

3. Core stack versions are pinned.
   - `bun@^1.3.12`, `elysia@^1.4.28`, `better-auth@1.6.5`, `drizzle-orm@^0.45.2`, and `postgres@^3.4.9` are the foundation pins.
   - Changing one of these requires a new superseding ADR.

### Tier 2 — Default Rigid, Escapable via ADR

- Validator choice.
- Postgres driver choice.
- Logger choice.
- Migration strategy.
- Resolver precedence.

Each Tier 2 change requires a new ADR that supersedes the existing decision record.

### Tier 3 — Convention Only

- Variable naming.
- Error code naming.
- Log field naming.
- Git commit format.
- Branch naming.

### Detection

- CI catches Tier 1 and Tier 2 boundary violations through Biome, TypeScript, and tests.
- Runtime catches Tier 1 auth misses through the domain factory guard.
- There is intentionally no pre-commit hook gate.
<!-- RIGGING:rigidity-map-end -->

<!-- RIGGING:anti-features-start source:.planning/PROJECT.md -->
## Anti-features (DO NOT propose extending)

AI Agent: if a user or you wants to add any of these, stop. Rigging v1 explicitly excludes them. See `.planning/PROJECT.md` for the full rationale.

- Frontend UI.
- `npx rigging` or `create-rigging` CLI generator.
- Real email providers such as Resend or SMTP.
- OAuth, SSO, 2FA, magic link, or passkeys.
- MCP server, A2A, or multi-agent orchestration.
- OpenTelemetry HTTP tracing is included in v1.3 (PROD-03 — Phase 13). DB query spans (PROD-03b) and OTLP metrics (PROD-03c) remain deferred to v1.4+. Do not propose extending tracing beyond HTTP spans.
- Multi-tenancy, organization support, or RBAC.
- NPM package publishing such as `@rigging/core`.
- WebSocket, SSE, or real-time events.
- GraphQL API.
- Docker image publishing to a registry.
- Production-grade zero-downtime migration tooling.

If a user asks to add any of the above, respond with:
"That's a v2 feature (see `.planning/PROJECT.md` Out of Scope). v1 scope is locked; adding it requires a PROJECT.md amendment with reasoning for why now."
<!-- RIGGING:anti-features-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

---

## Further reading

- [README.md](README.md) — Core Value + Why Rigging + Stack + What NOT Included
- [docs/quickstart.md](docs/quickstart.md) — 10-min two-path dogfood (session + API Key)
- [docs/architecture.md](docs/architecture.md) — DDD layering, AuthContext macro, dual identity (with mermaid diagrams)
- [docs/decisions/](docs/decisions/README.md) — 19 ADRs in MADR 4.0 format
- [.planning/PROJECT.md](.planning/PROJECT.md) — Core Value + Constraints + v1 Out of Scope
