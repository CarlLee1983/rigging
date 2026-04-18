# Feature Research

**Domain:** Opinionated TypeScript backend scaffold / AI-Agent harness framework (Bun + Elysia + DDD + BetterAuth)
**Researched:** 2026-04-18
**Confidence:** HIGH (stack features verified against BetterAuth / Elysia / Drizzle official docs + AGENTS.md / Harness Engineering public references; MEDIUM on "differentiator novelty" claims — cross-checked against T3, Hono/Elysia starters, NestJS scaffolds, Mastra, Claude Agent SDK, RedwoodJS)

## Context & Positioning

Rigging 不是在做 "AI agent runtime"（Mastra / LangChain / Claude Agent SDK 的地盤），也不是在做 "frontend-inclusive full-stack"（T3 / RedwoodJS / Blitz 的地盤）。它佔據的是一個目前**幾乎沒有成熟競品**的位置：

> **「AI Agent 作為一等公民的、後端 only、強制結構的 TypeScript scaffold。」**

競品掃描結論：
- **T3 stack**：Next.js-centric、前端優先、auth 採 NextAuth/Clerk、沒有 Agent-first identity 設計。
- **RedwoodJS / Blitz**：Rails 風格、React 綁死、GraphQL/RPC-first，哲學相近但不是 TypeScript-backend-only。
- **NestJS scaffolds**：模組化 DI + opinionated，但對 AI Agent 沒有特別設計；AuthContext 模式要自己做。
- **Bun + Elysia + BetterAuth starter**（如 `masrurimz/tanstack-start-elysia-better-auth-bun`）：技術棧很接近，但幾乎所有已知 starter 都以**前端 + 後端一起**為目標，未處理 Agent 雙軌身分。
- **Hono + DDD skeleton**（如 `Nagarehazh/skeleton-ddd-bun-hono-typescript`）：DDD 落地結構可參考，但沒有 auth、沒有 AGENTS.md、沒有 ADR。
- **AI Agent frameworks**（Mastra / Claude Agent SDK / LangGraph / deepagents）：解決的是「Agent 如何做事」，Rigging 解決的是「Agent 寫出來的後端長什麼樣」——是**互補而非競爭**關係。

這個定位讓 Rigging 的 feature set 必然長這樣：**table stakes 向後端 scaffold 對齊，differentiators 向 harness engineering / AGENTS.md 時代對齊。**

## Feature Landscape

### Table Stakes (Users Expect These)

Bun + Elysia + DDD + BetterAuth 使用者會直接假設存在的功能；缺了就「不像一個能 clone 起來跑的 scaffold」。

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **`bun install` 一鍵起跑** | 所有現代 TS scaffold 的 baseline（T3、create-elysia、create-t3-app 都是）。 | S | Bun 原生支援；`bun dev` + `bun test` 要各能跑。 |
| **`.env.example` + env schema（Zod）校驗** | T3 的 `env.mjs`、RedwoodJS 都視為標配；啟動缺 env var 應立即 fail-fast。 | S | `zod` 或 `@t3-oss/env-core` 類做法；Bun 原生支援 `.env`。 |
| **PostgreSQL + Drizzle schema + migration 腳本** | Drizzle 已是 2026 TS DDD 預設 ORM（T3 2025 換掉 Prisma 改推 Drizzle）；沒有 migration 流程無法談「clone 起來跑」。 | M | `drizzle-kit generate` / `migrate` / `studio` 三個 script 必備；seed 腳本是加分但有用。 |
| **Email/password 註冊 + 登入 + 登出 + session** | BetterAuth 官方 quickstart 的 minimum；任何 auth-bundled scaffold 都這樣宣傳。 | M | BetterAuth `.mount(auth.handler)` + email/password provider；Elysia 官方有 integration guide。 |
| **Email verification flow** | BetterAuth 預設 email provider 附帶；缺了等於 auth 半殘。 | S | Dev 階段 console.log 連結即可（與 PROJECT.md 一致）；production adapter 之後補。 |
| **Password reset flow** | 同上；BetterAuth 預設附帶。 | S | 同上，dev 階段 console.log。 |
| **Session 中介層（Elysia macro / derive）** | Elysia 官方 best-practice 就是這樣教；缺了等於沒 auth。 | M | `auth.api.getSession()` → derive `user` / `session`；Elysia 官方文件有範例。 |
| **OpenAPI / Swagger 自動產生** | Elysia 賣點之一：「1 line 產出 OpenAPI」；2026 使用者預期得到 `/swagger` 或 `/docs` endpoint。 | S | `@elysiajs/swagger` plugin；BetterAuth 也有 `openAPI()` plugin 可串。 |
| **CORS 預設設定** | 任何 API-first backend scaffold 的 baseline。 | S | `@elysiajs/cors` plugin。 |
| **Health check endpoint（`/health`）** | Ops 預設存在；deploy 時第一個用到。 | S | `GET /health` 回 200 + DB ping。 |
| **結構化 logging** | 所有「community-ready」scaffold 的最低門檻。 | S | 一個簡單 logger wrapper（pino 或 Bun `console` + 結構化）；不需要上 OpenTelemetry。 |
| **錯誤處理 convention（Elysia error handler）** | Elysia `.onError` + domain error → HTTP status 映射是標準做法。 | M | 定義 `DomainError` 基底、中央 error mapper；避免 handler 內到處 try/catch。 |
| **Unit test + integration test 範例** | "community-ready" 的明確要求（PROJECT.md 指名）。 | M | `bun test` 原生；至少涵蓋 auth flow + 一個 domain use case。 |
| **README + quickstart** | 明確在 Active 清單；外部 dev 能 clone 起來跑的前提。 | S | 三段式：clone → env → migrate → dev。 |
| **`.gitignore` / `tsconfig.json` / `biome.json` or `eslint` / `prettier`** | 基本整潔要求；審美疲勞但少了就沒人信這是「opinionated」scaffold。 | S | 推薦 Biome（比 ESLint+Prettier 輕量，與 Bun 調性一致）。 |
| **Docker / `docker-compose.yml` for Postgres** | 2026 本機開發標配；`docker compose up -d postgres` 就該跑起來。 | S | 單一 `docker-compose.yml`，只有 `postgres`。 |

### Differentiators (Competitive Advantage)

Rigging 的論述就靠這些站得住腳；與 PROJECT.md 的 Core Value 一致。

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **🎯 強制 AuthContext 邊界（Runtime Guard via DI）** | **Rigging 的核心論點**：任何 Domain service 必須透過解析過的 AuthContext 取得；缺失則 throw，連 handler 都 wire 不起來。這是「錯誤寫法跑不起來」的具象化。 | L | Elysia `.derive()` / macro 解析 cookie 或 header → 產出 `AuthContext` → 傳入 Use Case factory；factory 檢查 null → throw。屬於 runtime 層（PROJECT.md 已決策偏好實務可維護性 > 純型別強制）。 |
| **🎯 雙軌身分一次到位（Cookie session + API Key header → 同一個 AuthContext）** | 2026 AI Agent 時代的核心需求：**human 用 cookie、agent 用 API Key header，但 Domain 層完全無感**。絕大多數 scaffold 只做一邊；BetterAuth 本身兩邊都支援但**沒幫你合成一個 AuthContext**。 | L | 解析順序：先看 `x-api-key` header → 沒有則 fall back cookie session → 都沒有則 `AuthContext = null`。兩條路徑都要產生同型別的 `AuthContext { userId, principalType: 'human' | 'agent', permissions }`。 |
| **🎯 API Key 管理 UI（API endpoints）— human 生、agent 用** | BetterAuth 的 API Key plugin 提供 CRUD + rate limit + expiration；Rigging 要把它包成**「AI Agent 的正式入口」**的語意，而不只是「API token」。 | M | 使用 BetterAuth `apiKey()` plugin（built-in 支援 rate limit、expiration、metadata、scopes）；前端 UI 不做，v1 只暴露 REST endpoints。 |
| **🎯 DDD 四層強制骨架（Domain / Application / Infrastructure / Presentation）** | NestJS 有 module 但沒強制 DDD；大多數 Elysia starter 沒有分層。Rigging 的價值是**讓 Agent 面對一條已知的軌道**：放 entity 要去 Domain、放 DB 要去 Infrastructure。 | L | 目錄結構 + 範例程式碼 + `AGENTS.md` 聲明邊界。推薦 `src/modules/<context>/{domain,application,infrastructure,presentation}/` 結構。 |
| **🎯 ADR 流程內建（`docs/adr/`）** | 不只是建資料夾；提供 **ADR template + 第一批 ADR 範例**（Bun 選擇、Elysia 選擇、BetterAuth 選擇等 PROJECT.md 已記錄的決策）。這在 2026 是 harness engineering 的認可做法（OpenAI 的 AGENTS.md 論述直接討論到 ADR）。 | S | Markdown-based；推薦 MADR template 或自訂；配合 numbering convention（`0001-choose-bun.md`）。 |
| **🎯 `AGENTS.md` at repo root（2025/08 開放標準）** | Cursor / Codex / Claude / Factory 等共同採用的跨工具標準；2026 使用者（尤其是 AI agent 本身）會直接讀它學規則。Rigging 的 harness 論述**必須有這個**。 | S | 聲明 build/test/dev 指令、DDD 邊界、AuthContext 規則、「不要 bypass guard」等約束。 |
| **🎯 Demo Domain: Agent 元專案（prompt versioning / agent definitions / eval datasets）** | **Dogfooding**：用 Rigging 本身的軌道做出「AI agent 管理 agent」的元專案。這不只是範例，更是**證明 harness 可用**的現場示範。 | L | 三個 entity：`Agent`、`Prompt`（版本化）、`EvalDataset`。每個都透過 AuthContext 存取；API Key 給 agent 自己查詢自己。 |
| **🎯 "Community-ready" 測試品質聲明 + CI 配置** | PROJECT.md 明文要求；配 GitHub Actions `bun test` workflow + migration check + typecheck。許多 starter 漏掉 CI。 | M | `.github/workflows/ci.yml`：lint + typecheck + test + drizzle migration dry-run。 |
| **Drizzle migration folder share 於 monorepo-ready 結構** | 即使 v1 不是 monorepo，結構要**允許未來變 monorepo**（PROJECT.md 的 Out of Scope 說 v1 不拆套件，但未來可能）。 | S | Migration 在 `packages/db/` 或 `src/db/migrations/` 固定路徑；drizzle.config.ts 用相對路徑。 |

### Anti-Features (Commonly Requested, Often Problematic)

Rigging 成敗的一大關鍵是**守住範圍**；這些是使用者（或 AI agent 自己）會主動提議加但應該拒絕的東西。

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **前端 UI（React/Vue/Next/Tanstack Start 等）** | "Full-stack 比較完整" / "可以 demo"。 | 直接與 PROJECT.md Out of Scope 衝突；引入前端會**稀釋「後端 harness」的論述**；T3 / RedwoodJS 已經佔了這塊。 | API-first；demo 用 Swagger UI + curl / REST client 即可。未來可由其他人基於 Rigging API 組 UI。 |
| **OAuth / SSO / Magic Link / 2FA / Passkeys** | "真實產品都需要"；BetterAuth 官方推廣了這些 plugin。 | PROJECT.md 明確 Out of Scope；徒增 auth 表面積；**每加一個 provider，AuthContext 的解析路徑就多一條**，違反「一條軌道」哲學。 | v1 only email/password + API Key；production 接真實 email 用 Adapter 模式接 Resend/SMTP（dev console log 保留）。 |
| **RBAC / 多租戶 / team / organization** | "企業需求" / "SaaS 通用"。 | PROJECT.md Out of Scope；多租戶是**另一層抽象**，會污染 AuthContext 語意（變成 `{ userId, orgId, tenantId, role }`）；先把單使用者的邊界做乾淨。 | AuthContext v1 只有 `{ userId, principalType, permissions[] }`；`permissions` 當預留介面但 v1 只發 `['*']`。 |
| **完整 observability（OpenTelemetry、tracing、metrics）** | "生產級需要"。 | PROJECT.md 明文「社群可用等級先」；OTel 生態加進來會增加 onboarding 複雜度、污染 DI；使用者看到會誤以為這是生產框架。 | 結構化 logging 夠用；保留 `Logger` interface 以便未來注入 tracing。 |
| **NPM 套件化（`@rigging/core`、`@rigging/auth` 等）** | "這才叫真框架" / "可以被別人 install"。 | PROJECT.md Out of Scope；過早拆套件 = 過早抽象化；**v1 的重點是驗證 DX，不是發 npm 套件**。 | 單一 repo，以 Reference App 形式展示。未來若 API 穩定再抽。 |
| **`npx rigging` / `create-rigging` 生成器** | "像 create-t3-app 一樣"；使用者對 scaffold 的直覺反應。 | PROJECT.md Out of Scope；scaffold generator 要先有一個**被驗證過的**模板才有意義；v1 是「模板本身」。 | 使用者 `git clone` 或用 `degit`；Reference App 就是 scaffold。v2+ 再抽。 |
| **A2A（Agent-to-Agent）協議 / MCP server / AI SDK 綁定** | "AI agent 時代標配" / "跟 Mastra 競爭"。 | PROJECT.md Out of Scope；Rigging 的論述是「**agent 寫後端**」不是「**跑 agent**」；混入會失焦。 | v1 只暴露 REST + API Key。Agent runtime（Mastra / Claude Agent SDK）是**客戶**而非 Rigging 功能。 |
| **過度靈活的 DI 容器（tsyringe / inversify / Awilix）** | "型別安全 DI" / "方便測試"。 | PROJECT.md 決策：不引入第二套 IoC，避免概念分裂；Elysia `.derive()` / `.decorate()` 已足夠且與框架整合。 | 堅持用 Elysia 原生 plugin + 小量手工 factory；需要 mock 時用 Bun 原生 `mock.module`。 |
| **生產級 rate limiting / DDoS 保護** | "Production ready"。 | PROJECT.md Out of Scope；BetterAuth API key 已內建 per-key rate limit，對 v1 足夠；全域 rate limit 屬於 ops 層。 | 仰賴 BetterAuth 內建；部署層（Caddy / Cloudflare）處理全域。 |
| **Real-time features（WebSocket / SSE / pub-sub）** | "現代 app 都需要"。 | 非 v1 核心論述；Elysia 支援 WS，但引入需要另一條 AuthContext 解析路徑（WS 沒 header 解析 = 需要 query string token）。 | v1 純 REST；future extension 明文列出但不做。 |
| **Admin panel / dashboard 自動產生** | "RedwoodJS 有 scaffolder"。 | 會需要前端，違反 Out of Scope；且 admin dashboard 是領域特定的，不該屬於 harness。 | Swagger UI + Drizzle Studio 夠用；admin UI 由使用者自行組。 |

## Feature Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 0 — Foundation                                        │
├─────────────────────────────────────────────────────────────┤
│  [Bun setup] ──> [TypeScript + Biome config]                │
│        └──────> [Env schema (Zod)] ──> everything else      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 1 — Data                                              │
├─────────────────────────────────────────────────────────────┤
│  [Postgres + docker-compose] ──> [Drizzle schema]           │
│        └──> [drizzle-kit migrate] ──> [seed]                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 2 — Web framework                                     │
├─────────────────────────────────────────────────────────────┤
│  [Elysia app skeleton] ──> [CORS / error handler / logger]  │
│        └──> [OpenAPI / Swagger plugin]                      │
│        └──> [Health check]                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3 — Auth (BetterAuth)                                 │
├─────────────────────────────────────────────────────────────┤
│  [BetterAuth schema in Drizzle]                             │
│        └──> [Email/password provider]                       │
│        └──> [Email verification (console log adapter)]      │
│        └──> [Password reset (console log adapter)]          │
│        └──> [API Key plugin]                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 4 — Identity boundary  🎯 CORE DIFFERENTIATOR         │
├─────────────────────────────────────────────────────────────┤
│  [AuthContext type]                                         │
│        ├──> [Cookie session resolver]                       │
│        ├──> [API Key header resolver]                       │
│        └──> [Elysia macro / derive integration]             │
│               └──> [Runtime guard in Use Case factory]      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 5 — DDD scaffolding                                   │
├─────────────────────────────────────────────────────────────┤
│  [Domain / Application / Infrastructure / Presentation dirs]│
│        └──> [AGENTS.md at root]                             │
│        └──> [ADR folder + first ADRs]                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 6 — Demo domain (dogfood)                             │
├─────────────────────────────────────────────────────────────┤
│  [Agent entity] ──> [Prompt (versioned) entity]             │
│        └──> [EvalDataset entity]                            │
│        └──> REST endpoints using AuthContext                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 7 — Quality gate                                      │
├─────────────────────────────────────────────────────────────┤
│  [Unit tests (auth + domain)]                               │
│        └──> [Integration tests (auth flow + demo domain)]   │
│        └──> [GitHub Actions CI]                             │
│        └──> [README + quickstart]                           │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Notes

- **AuthContext requires both session resolver AND API Key resolver:** 這是雙軌身分的本質；任一缺失，Rigging 的核心論述就垮。**兩個必須同一個 phase 完成**。
- **Demo domain requires AuthContext:** Demo domain 的存在意義就是展示 AuthContext 如何被使用；不能在 AuthContext 之前做。
- **DDD dirs + ADR + AGENTS.md 應該在 auth 之前或同時設好:** 因為 auth 的實作本身就要遵守這個結構；順序反了的話，auth 實作會「先違反規則再補規則」。
- **BetterAuth schema 要在 domain schema 之前進 Drizzle:** BetterAuth 產生的表（`user`, `session`, `account`, `apiKey`）會被 domain 表以 FK 參考。
- **Email/password 與 API Key 可以獨立開發但共用同一個 BetterAuth instance:** API Key plugin 是 BetterAuth 上的 plugin，不是另一套系統。
- **CI conflicts with nothing, but blocks release:** CI 可以最後補，但「社群可用等級」沒 CI 就不算數。

## MVP Definition

### Launch With (v1 — 對應 PROJECT.md Active 全部勾選)

所有 PROJECT.md Active 清單都是 v1 必要；以下列出對應的 feature checkbox：

- [ ] **Foundation**：Bun + TS + Biome + `.env.example` + Zod env schema — 其他一切都依賴它
- [ ] **Postgres + Drizzle schema + migration + docker-compose** — Data layer 的起點
- [ ] **Elysia app + CORS + error handler + logger + health check + OpenAPI plugin** — Web framework baseline
- [ ] **BetterAuth: email/password register/login/logout/session** — PROJECT.md 明文
- [ ] **Email verification (dev console log adapter)** — PROJECT.md 明文
- [ ] **Password reset (dev console log adapter)** — PROJECT.md 明文
- [ ] **BetterAuth API Key plugin + human-generates endpoints** — PROJECT.md 明文
- [ ] **🎯 AuthContext type + cookie session resolver + API Key header resolver** — **核心 differentiator**，不做就沒 Rigging
- [ ] **🎯 Elysia macro / derive 整合 + Runtime Guard in Use Case factory** — **核心 differentiator**
- [ ] **🎯 DDD 四層目錄結構 + `AGENTS.md` + ADR folder（含 PROJECT.md 已有決策的 ADR）** — 讓 Agent「看得懂」軌道
- [ ] **🎯 Demo Domain: Agent / Prompt / EvalDataset** — Dogfooding 證明可用性
- [ ] **Unit tests (auth + 一個 demo use case) + integration tests (auth flow + demo endpoint)** — "community-ready" 要求
- [ ] **GitHub Actions CI (lint + typecheck + test + migration dry-run)** — 支撐 "community-ready"
- [ ] **README + quickstart** — PROJECT.md 明文

### Add After Validation (v1.x)

驗證後（Rigging Reference App 有外部使用者 clone 起來跑得動）可以擴充：

- [ ] **`degit` 模板化 + 安裝指南** — 從 Reference App 變成可 clone 模板；trigger：至少 3 個外部 repo clone 使用
- [ ] **Email adapter pattern + Resend/SMTP implementation** — trigger：有人要 deploy 到 production
- [ ] **`/admin` 類 endpoint（查 user / query log）** — trigger：dogfood 時發現查資料不便
- [ ] **Drizzle seed script 系統化** — trigger：demo domain 要展示更多 scenarios
- [ ] **Biome / TSC strict mode 進一步收緊** — trigger：Agent 產出的程式碼在鬆模式下仍出現型別漏洞

### Future Consideration (v2+)

以下明確留到 v2+，v1 不討論：

- [ ] **`create-rigging` / `npx rigging` CLI scaffold generator** — 需要 v1 被驗證過的模板作基礎
- [ ] **NPM 套件化（`@rigging/core` 等）** — API 穩定之前不拆
- [ ] **多租戶 / organization / RBAC** — 屬於下一個抽象層
- [ ] **OAuth / SSO / Magic Link** — 當 email/password 論述穩定後才擴充
- [ ] **OpenTelemetry / structured tracing** — 從社群級升級到生產級時
- [ ] **WebSocket / SSE support with AuthContext** — 當有具體 use case 時
- [ ] **MCP server integration（把 domain 包成 agent 可呼叫的 MCP tool）** — Rigging 與 Agent runtime 的橋樑
- [ ] **A2A 協議 / agent federation** — PROJECT.md 明文未來潛力

## Feature Prioritization Matrix

**Priority key：P1 = MVP 必要；P2 = 強烈建議在 v1 做但可容忍延後；P3 = v1.x+**

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Bun + TS + Biome + env schema | HIGH | LOW | P1 |
| Postgres + Drizzle + migration + docker-compose | HIGH | MEDIUM | P1 |
| Elysia app + CORS + error handler + logger | HIGH | LOW | P1 |
| Health check + OpenAPI / Swagger | MEDIUM | LOW | P1 |
| BetterAuth email/password + session | HIGH | MEDIUM | P1 |
| Email verification + password reset (console log) | HIGH | LOW | P1 |
| BetterAuth API Key plugin + CRUD endpoints | HIGH | MEDIUM | P1 |
| 🎯 AuthContext type + dual resolver | HIGH | HIGH | P1 |
| 🎯 Elysia macro + Runtime Guard | HIGH | HIGH | P1 |
| 🎯 DDD 四層目錄 + 範例程式碼 | HIGH | MEDIUM | P1 |
| 🎯 AGENTS.md + ADR folder + 起始 ADRs | HIGH | LOW | P1 |
| 🎯 Demo Domain (Agent / Prompt / EvalDataset) | HIGH | HIGH | P1 |
| Unit + integration tests | HIGH | MEDIUM | P1 |
| GitHub Actions CI | MEDIUM | LOW | P1 |
| README + quickstart | HIGH | LOW | P1 |
| Drizzle Studio convention | MEDIUM | LOW | P2 |
| Seed script framework | MEDIUM | LOW | P2 |
| Biome strict config + Bun typecheck in CI | MEDIUM | LOW | P2 |
| Email adapter (Resend stub) | LOW (v1) | LOW | P3 |
| `degit` 模板化文件 | MEDIUM | LOW | P3 |
| `create-rigging` generator | HIGH | HIGH | P3 (v2+) |
| NPM 套件化 | LOW (v1) | HIGH | P3 (v2+) |
| OAuth / SSO / 2FA | LOW (v1) | HIGH | P3 (v2+) |
| Multi-tenancy / RBAC | LOW (v1) | HIGH | P3 (v2+) |

## Competitor Feature Analysis

| Feature | T3 Stack (create-t3-app) | Elysia + BetterAuth starters（如 `masrurimz/...`） | NestJS scaffolds（如 `efd1006/nestjs-scaffold`） | **Rigging (our approach)** |
|---------|--------------------------|----------------------------------------------------|---------------------------------------------------|----------------------------|
| **Stack opinion** | Next.js + tRPC + Drizzle + Auth.js + Tailwind — 前端 + 後端綁死 | Bun + Elysia + BetterAuth + (often) Tanstack Start — 前後端一起 | NestJS + TypeORM/Prisma + Passport — 模組化後端 | **Bun + Elysia + Drizzle + BetterAuth — 後端 only，前端交給別人** |
| **Auth scope** | NextAuth/Auth.js：OAuth + session；API token 非預設 | BetterAuth：session + OAuth 都有，API key 要自己開 plugin | Passport：可配置但要自己寫 strategy | **BetterAuth session + API Key 都預先接好；合成同一個 AuthContext** |
| **Identity model** | 只有 human user；API 認證靠 session cookie 或 JWT | 通常只有 human user；API token 非核心 | 自由：可做 human + service account 但框架不強制 | **🎯 Dual identity: human (cookie) + agent (API Key) 一等公民** |
| **Auth enforcement** | 靠開發者在每個 route 記得加 `getServerSession()` | 靠 Elysia macro `{ isSignIn: true }`，開發者記得加 | 靠 `@UseGuards(AuthGuard)` decorator，開發者記得加 | **🎯 Runtime Guard in DI layer：忘記加 = throw at wire-time** |
| **Architecture enforcement** | 檔案結構靠 convention（`src/server/`、`src/app/`） | 多數 starter 沒強制；視 starter 而定 | Module + service + controller convention，但不強制 DDD | **🎯 DDD 四層 + AGENTS.md 聲明 + ADR 討論**；Agent 有明確規則可讀 |
| **AI-agent awareness** | 無；完全以人類開發者為預設 | 無 | 無 | **🎯 一等公民：API Key 身分 + AGENTS.md + demo domain 就是 agent 元專案** |
| **ADR infrastructure** | 無 | 無 | 無 | **🎯 內建 `docs/adr/` + starter ADRs + template** |
| **Dogfooding** | — | — | — | **🎯 Demo domain 是 AI agent 元專案（prompt version / eval dataset）** |
| **Frontend bundled** | Yes（Next.js + Tailwind） | Often（Tanstack Start / Vite） | No（純後端） | **No — 刻意不做** |
| **NPM distribution** | `create-t3-app` generator | 部分是 template | `nest new` + scaffolder | **v1 是 Reference App，不拆套件** |
| **Observability** | Minimal | Minimal | Minimal-to-moderate | **Minimal（dev log）— 刻意不追生產級** |
| **Complexity budget** | Medium（前端複雜度抵銷後端簡單） | Low–Medium | High（NestJS 學習曲線） | **Medium — 比 T3 少了前端，多了 DDD / ADR / AuthContext** |

## Key Takeaways for Downstream Consumers

1. **PROJECT.md Active 的 13 條全都是 P1**，一個不能少；缺任何一個，Rigging 的論述都會站不住腳（尤其雙軌身分 + Runtime Guard + Demo Domain 是三角支撐）。
2. **所有 table stakes 都是 S/M 複雜度**，但加起來數量多；別小看「設好 Elysia + Drizzle + BetterAuth」的 yak shaving 成本。
3. **🎯 三個 L 複雜度差異化功能**（AuthContext 雙軌 resolver、Runtime Guard、Demo Domain）是最大技術風險；應該**放在同一個 phase 且前面**，因為它們互相依賴且無法延後。
4. **Anti-features 清單對 AI agent 尤其重要**：Agent 會看到使用者說「再加個 OAuth 吧」就動手；AGENTS.md 必須明文禁止這些擴張。
5. **Reference App 形式（非 scaffold generator）是 v1 的定型選擇**；要確保文件讓使用者**知道這是 reference 而非 production framework**。
6. **Demo Domain 選「AI Agent 元專案」是刻意的**：每次有人說「Rigging 能幹嘛？」你可以說「看那個，那是 Rigging 自己跑出來的 agent registry」——這是論述閉環。

## Sources

### Harness Engineering & AI Agent Era
- [Harness engineering for coding agent users — Martin Fowler](https://martinfowler.com/articles/harness-engineering.html) (HIGH)
- [Harness engineering: leveraging Codex in an agent-first world — OpenAI](https://openai.com/index/harness-engineering/) (HIGH)
- [Harness Engineering: Complete Guide — NxCode 2026](https://www.nxcode.io/resources/news/what-is-harness-engineering-complete-guide-2026) (MEDIUM)
- [AGENTS.md open standard](https://agents.md/) (HIGH)
- [AGENTS.md vs Architecture Decision Records — AI Advances 2026](https://ai.gopubby.com/agents-md-is-the-ew-architecture-decision-record-adr-3cfb6bdd6f2c) (MEDIUM)
- [Agent Decision Records (AgDR) repo](https://github.com/me2resh/agent-decision-record) (MEDIUM)

### BetterAuth & Elysia (stack-specific features)
- [BetterAuth Elysia integration — official](https://better-auth.com/docs/integrations/elysia) (HIGH)
- [BetterAuth API Key plugin — official](https://better-auth.com/docs/plugins/api-key) (HIGH)
- [BetterAuth API Key Advanced features](https://better-auth.com/docs/plugins/api-key/advanced) (HIGH)
- [Elysia Best Practice — derive / decorate / macro](https://elysiajs.com/essential/best-practice) (HIGH)
- [Elysia Plugin — dependency injection pattern](https://elysiajs.com/essential/plugin) (HIGH)
- [masrurimz/tanstack-start-elysia-better-auth-bun — GitHub](https://github.com/masrurimz/tanstack-start-elysia-better-auth-bun) (MEDIUM — competitor reference)

### Competing scaffolds & DDD references
- [create-t3-app — GitHub](https://github.com/t3-oss/create-t3-app) (HIGH)
- [T3 Stack 2026 — StarterPick](https://starterpick.com/blog/t3-stack-2026) (MEDIUM)
- [Nagarehazh/skeleton-ddd-bun-hono-typescript — GitHub](https://github.com/Nagarehazh/skeleton-ddd-bun-hono-typescript) (MEDIUM)
- [CodelyTV/typescript-ddd-example — GitHub](https://github.com/CodelyTV/typescript-ddd-example) (MEDIUM)
- [RedwoodJS vs BlitzJS — RisingStack](https://blog.risingstack.com/redwoodjs-vs-blitzjs-comparison/) (MEDIUM)
- [NestJS scaffold with auth — `efd1006/nestjs-scaffold`](https://github.com/efd1006/nestjs-scaffold) (MEDIUM)

### AI Agent frameworks (adjacent, not competing)
- [Mastra AI Complete Guide 2026](https://www.generative.inc/mastra-ai-the-complete-guide-to-the-typescript-agent-framework-2026) (MEDIUM)
- [LangChain Deep Agents vs Claude Agent SDK](https://medium.com/@richardhightower/the-agent-framework-landscape-langchain-deep-agents-vs-claude-agent-sdk-1dfed14bb311) (MEDIUM)
- [langchain-ai/deepagents — agent harness](https://github.com/langchain-ai/deepagents) (MEDIUM)

### API Key & Auth patterns
- [API Key Security Best Practices 2026 — DEV Community](https://dev.to/alixd/api-key-security-best-practices-for-2026-1n5d) (MEDIUM)
- [OAuth vs API Keys for AI Agents — Scalekit](https://www.scalekit.com/blog/oauth-vs-api-keys-for-ai-agents) (MEDIUM)

### Drizzle / Migration patterns
- [Drizzle ORM — Migrations](https://orm.drizzle.team/docs/migrations) (HIGH)
- [Drizzle Migrations in a Monorepo setup — altan.fyi](https://altan.fyi/drizzle-migration-monorepo/) (MEDIUM)

### Agent evaluation (for Demo Domain design)
- [Demystifying evals for AI agents — Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) (HIGH)
- [Agent Evaluation Readiness Checklist — LangChain](https://www.langchain.com/blog/agent-evaluation-readiness-checklist) (MEDIUM)

---
*Feature research for: AI-Agent-targeted opinionated TypeScript backend scaffold (Rigging)*
*Researched: 2026-04-18*
