# Project Research Summary

**Project:** Rigging — opinionated TypeScript backend scaffold (Harness Engineering for AI Agents)
**Domain:** Bun + Elysia + DDD backend framework with mandatory AuthContext boundary and dual human/agent identity
**Researched:** 2026-04-18
**Confidence:** HIGH（stack + architecture + 關鍵 pitfalls 對官方 docs / Context7 / CVE advisory 驗證）；MEDIUM（AI-agent-harness UX pitfalls — 較新領域）

## Executive Summary

Rigging 佔據一個 2026 年幾乎沒有成熟競品的位置：**「AI Agent 作為一等公民、後端 only、強制結構的 TypeScript scaffold」**。競品掃描確認 T3 / RedwoodJS 綁前端、NestJS / Elysia starter 沒處理 Agent 雙軌身分、Mastra / Claude Agent SDK 解決「Agent 如何做事」而非「Agent 寫出來的後端長什麼樣」——Rigging 與它們互補而非競爭。

四份研究收斂出一致結論：**v1 成敗繫於三件事同時立住**——(1) AuthContext 作為強制邊界而非建議，(2) 雙軌身分（session + API Key）解析成同一個 AuthContext，(3) DDD + ADR 紀律讓 Agent 有軌道可循。

技術棧已鎖死且版本驗證到位：**Bun 1.3.12 + Elysia 1.4.28（必須 ≥1.4，低版本 `.mount()` 會吃掉 Set-Cookie）+ Drizzle 0.45.2（NOT 1.0-beta）+ BetterAuth 1.6.5（pin exact，CVE-2025-61928 已在 1.3.26 修補）+ postgres-js 3.4.9 驅動（不用 `bun:sql`，有未修復的 transaction hang bug）+ TypeBox + Biome 2.4.12 + `bun:test` + Pino**。最大風險有三：Elysia scoped-plugin `undefined` cascade、BetterAuth 快速演進 + API Key CVE 歷史、雙軌解析 precedence 與 session invalidation 語意未定——均有具體 mitigation。

## Key Findings

### Recommended Stack

詳見 `STACK.md`。研究確認 locked choices 之外的互補選擇異常收斂——對強意見 harness 是好事。

**Core technologies (versions locked):**

- **Bun `^1.3.12`** — 原生 TS、`Bun.password` argon2id、`bun:test` 內建、`bun --watch`
- **Elysia `^1.4.28`** — 必須 ≥1.4，低於此版本 `.mount(auth.handler)` 會吃掉 Set-Cookie，BetterAuth session 靜默失敗
- **TypeScript `^5.9`** — `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- **PostgreSQL 16 + Drizzle ORM `^0.45.2`** — **NOT** `1.0.0-beta.x`（beta 從 2025 末持續 churn）
- **drizzle-kit `^0.31.10`** — migration 一律 `generate` + `migrate`，非本機禁用 `push`
- **postgres `^3.4.9`（porsager/postgres）** — Drizzle 的 `postgres-js` 驅動；**不用 `bun:sql`**（constraint violation 下 transaction hang，bun#21934/#22395 未修）
- **BetterAuth `1.6.5`（pin exact）** — CVE-2025-61928 於 1.3.26 修補；auth lib 唯一不該用 caret
- **@better-auth/drizzle-adapter `1.6.5`** — 版號與 core 對齊；API Key plugin 內建雙軌處理
- **TypeBox `^0.34.49`** — Elysia peerDep；不另引入 Zod
- **Biome `^2.4.12`** — 單一 lint/format 工具取代 ESLint+Prettier
- **Pino 10 + `@bogeychan/elysia-logger` `^0.1.10`** — 結構化 JSON logs

### Expected Features

詳見 `FEATURES.md`。PROJECT.md Active 清單 13 條全部 P1 必要，缺任一條 Rigging 論述即站不住。

**Must have (table stakes):**

- `bun install` 一鍵起跑 + `.env.example` + env schema 校驗
- Postgres + Drizzle schema + migration + `docker-compose.yml`
- Elysia app + CORS + error handler + structured logger + `/health` + OpenAPI/Swagger
- BetterAuth email/password register/login/logout/session（Elysia 1.4 `.mount()` 模式）
- Email verification + password reset（dev-only console log adapter）
- Biome config、`tsconfig.json`、`.gitignore`、GitHub Actions CI
- README + quickstart（外部 dev clone 起跑 <10 分鐘）

**Should have (competitive — 三個核心 differentiator):**

- **強制 AuthContext 邊界（Runtime Guard via DI）** — Domain service 必須透過 AuthContext 取得；缺失 throw、handler wire 不起來
- **雙軌身分一次到位** — human 用 cookie、agent 用 API Key header，兩條路徑產生**同型別** `AuthContext { userId, identityKind: 'human'|'agent', scopes, apiKeyId?, sessionId? }`；API Key 優先
- **Dogfood Agent Domain** — Rigging 自己用自己的軌道做「Agent 管理 agent」元專案（`Agent` / `PromptVersion` / `EvalDataset`）
- DDD 四層強制骨架 + `AGENTS.md` at repo root（2025/08 開放標準）+ `docs/decisions/` MADR ADR
- BetterAuth API Key plugin CRUD endpoints
- Unit + integration test（auth flow + demo domain）+ CI（lint / typecheck / test / migration drift）

**Defer (v2+):**

- `create-rigging` / `npx rigging` CLI generator（v1 先 Reference App 驗證）
- NPM 套件化 `@rigging/core` 等
- OAuth / SSO / 2FA / Magic Link / Passkeys（違反「一條軌道」論述）
- Multi-tenancy / RBAC / organization（下一抽象層次）
- OpenTelemetry / tracing / metrics、前端 UI / admin panel、WebSocket/SSE、MCP integration、A2A、真實 email provider

### Architecture Approach

詳見 `ARCHITECTURE.md`。Bounded context × 分層：`src/{feature}/{domain,application,infrastructure,presentation}/` 垂直切片 × 水平分層（domain 零 framework import），搭配 `src/shared/{kernel,application/ports,infrastructure,presentation}/` 放 cross-cutting。DI 用純 factory function（`createAuthModule(shared)` 回傳 Elysia plugin），不引入 tsyringe/inversify。AuthContext 用 Elysia `.macro({ requireAuth: { resolve } })`，handler 不宣告 `requireAuth: true` 就取不到 ctx——型別層 + runtime 雙重失敗關閉。

**Major components:**

1. **AuthContext plugin** (`src/auth/presentation/plugins/auth-context.plugin.ts`) — 單一根層掛載；依序檢查 `x-api-key` → cookie session；失敗 401；產出 `AuthContext` value object
2. **Use Case** (`src/{feature}/application/usecases/*.usecase.ts`) — class with `execute(ctx: AuthContext, input: DTO): Promise<Result>`；AuthContext 為必填第一參數
3. **Repository + Mapper (Infrastructure)** — `findById(id): Promise<User|null>` 回 Domain entity，**絕不回 Drizzle row type**；`UserMapper.toDomain/toPersistence` 雙向
4. **BetterAuth Identity Service (Infrastructure adapter)** — 包在 `IIdentityService` port 後；`verifySession(headers)` / `verifyApiKey(raw)` 回同型別 AuthContext
5. **Feature Module (`{feature}.module.ts`)** — factory function：建 infra → use case → controller → 回 Elysia plugin；在 `bootstrap/app.ts` `.use()` 組裝
6. **Shared Kernel** (`src/shared/kernel/`) — `Result<T,E>` / `Brand` / `UUID` / `DomainError` 基底；任層可 import 且 framework-free
7. **Error handler plugin** — 全域 `.onError()` 把 DomainError 子類映射到 HTTP status
8. **ADR 機制** — `docs/decisions/` 下 MADR 4.0 格式、`NNNN-title.md`、Status 欄位實質使用；9 條起始 ADR（PROJECT.md Key Decisions + Rigidity Map + postgres-js driver）

### Critical Pitfalls

詳見 `PITFALLS.md`（15 條）。Top 5：

1. **CVE-2025-61928（BetterAuth 未授權建 API Key，CVSS 9.3）** — BetterAuth pin exact；Rigging 自包 `/api-keys` 強制 `body.userId === session.userId`；Day-1 regression test。Phase 3
2. **`bun:sql` Postgres transaction hang on constraint violation** — bun#21934/#22395 未修；constraint 觸發後 pool 卡死。`drizzle.config.ts` 明確用 `postgres-js` + ADR 鎖定；integration test「duplicate key 後下一 query 仍成功」。Phase 1
3. **AuthContext 被 module-level import 繞過（Core Value 失敗）** — Elysia `.derive()` 不移除直接 import 能力。Domain 只 export `getService(ctx)` factory、**永不 export class**；Biome 規則禁 `domain/**/internal/*` 外部 import；test 在無 auth plugin 下啟 app 斷言全 protected route 401。Phase 1 設計 + Phase 3 強制
4. **Elysia scoped-plugin `undefined` cascade（elysia#1366）** — scoped `.derive` 在後續 plugin 讓 `user: User` 實際 `undefined`。單一 canonical auth plugin 掛根 app、scope `global`；factory runtime assert（不信 TS narrowing）；test 不掛 auth plugin 斷言全 401。Phase 3
5. **Opinionated framework trap — rigid in the wrong places** — Rails trap：硬在 file naming、鬆在 AuthContext。Phase 1 ship **Rigidity Map ADR** 明列「必嚴格（無逃生口） / 預設嚴格可 ADR 逃生 / 純約定」；phase transition 複檢。Phase 1

額外 Major（未入 top 5 但 roadmap 必釘死）：password reset 不撤銷其他 session / API Key plaintext 儲存 / Repository 回 Drizzle row type / `drizzle-kit push` 誤用 / Harness 太緊誘發 `@ts-ignore` / ADR 表演化 / BetterAuth rate-limit gap（#2112）/ timing attack / Bun native-module（避開 `bcrypt` 用 `Bun.password`）/ Eden Treaty type inference 退化。

## Implications for Roadmap

研究四份文件對 phase 順序共識一致——依賴來自技術約束而非偏好。

### Phase 1: Foundation（骨架 + 紀律 + ORM 選擇）

**Rationale:** 所有 phase 都 import `src/shared/kernel/`；Postgres + Drizzle 沒就位則 auth schema 無法 migrate；driver 選擇（postgres-js vs `bun:sql`）必須在 P1 定案——Pitfall #2 是 project-killing、後期換 driver 很痛；Rigidity Map ADR 也必須在 P1——決定什麼嚴格什麼彈性，整 project 看它。
**Delivers:** Bun + TS strict + `tsconfig.json` + `biome.json` + `.env.example` + env schema + `docker-compose.yml`（Postgres 16-alpine）+ Drizzle config（**明確 `drizzle-orm/postgres-js`**）+ `src/shared/kernel/{result,brand,id,errors}` + `docs/decisions/` 含起始 ADR（0000 MADR / 0001 Bun / 0002 Elysia / 0003 DDD / 0004 BetterAuth / 0005 Drizzle / 0006 AuthContext / 0007 Runtime Guards / 0008 Dual Auth + Rigidity Map ADR + postgres-js driver ADR）+ `AGENTS.md` at repo root
**Addresses:** Active 條 1–3（stack lock / DDD 骨架 / ADR 機制）
**Avoids:** Pitfall #2 / #8 / #9 / #5 / #11 / #14

### Phase 2: App Skeleton + DDD Conventions 落地

**Rationale:** 有 app 才能 mount feature；這 phase 也是 DDD 四層骨架被真實驗證——一個 trivial feature（`/health`）走過 4 層 + error handler，之後 auth / demo domain 都 clone 這個 shape。**規矩先於 code**。
**Delivers:** `src/main.ts`、`src/bootstrap/{app,config,container}.ts`、全域 error handler plugin、request logger plugin（Pino + `@bogeychan/elysia-logger`）、CORS plugin、`/health` endpoint、`@elysiajs/swagger` 掛載
**Uses:** Elysia 1.4.28 `.use()` / `.onError()` / `.derive()`、`@elysiajs/cors`、`@elysiajs/swagger`
**Implements:** Architecture component #6（Shared Kernel）、#7（Error handler plugin）、`bootstrap/app.ts`
**Avoids:** Pitfall #4（早期 plugin 組裝錯誤會在 P3 爆炸）

### Phase 3: Auth Foundation — 不可拆

**Rationale:** **Rigging 論述核心**。四份研究一致：`[BetterAuth schema + sessions + email/password + verify + reset + API Key + AuthContext macro + dual resolver + Runtime Guard]` 無法分兩 phase——(a) BetterAuth 產生的 `user/session/account/apiKey` 表是後續 domain FK 基礎；(b) cookie resolver 和 API Key resolver 必須產出**同型別** AuthContext，任一缺失則雙軌論述垮；(c) Runtime Guard 是 Pitfall #3/#4 的防線，必須與 macro 同時 land；(d) password reset 不撤銷其他 session（#6）、CVE-2025-61928 regression test（#1）、timing-safe compare（#13）都必須此 phase ship。全 roadmap 最大、最危險、最關鍵的 phase。
**Delivers:** BetterAuth instance + `@better-auth/drizzle-adapter` + `apiKey()` plugin → `bunx @better-auth/cli generate` → `drizzle-kit generate` → commit schema + migration；`src/auth/domain/{auth-context,identity-kind,errors}` + value objects；ports（`IIdentityService` / `IUserRepo` / `IApiKeyRepo` / `IPasswordHasher` / `IEmailPort`）；adapters（Drizzle repos + BetterAuth identity service + `Bun.password` hasher + `ConsoleEmailAdapter`）；use cases（register / verify email / request/confirm password reset / create/list/revoke API key）；**authContextPlugin with `.macro({ requireAuth: { resolve } })` — API Key header 優先於 cookie**；Rigging 自包 `/api-keys` 強制 `body.userId === session.userId`；`DomainError → HTTP` mapping；CVE-2025-61928 regression test + password-reset-invalidates-other-sessions integration test + key-hashed-not-plaintext test
**Addresses:** Active 條 4–10
**Avoids:** Pitfall #1 / #3 / #4 / #6 / #7 / #12 / #13

### Phase 4: Demo Domain（Agent 元專案 dogfood）

**Rationale:** 不能在 AuthContext 之前做；必須是 Agent 元專案才閉環 dogfooding 論述；也是 Pitfall #10「harness 太緊」的驗證現場——量化「had to explain harness」事件，>3 次代表 UX 有 bug。
**Delivers:** `src/agents/` 完整四層結構 + entities（`Agent` / `PromptVersion`（版本化）/ `EvalDataset`）+ use cases + REST endpoints（全走 `requireAuth` macro）+ API Key-authenticated agent endpoints + scope check 實測（只讀 key 呼叫 write endpoint → 403）
**Implements:** Architecture component #2 / #3 / #5 在第二 feature 的**複用驗證**——若複用成本高則 P1 template 有設計債
**Avoids:** Pitfall #10

### Phase 5: Quality Gate（tests + CI + docs + quickstart）

**Rationale:** PROJECT.md 明文要求「社群可用等級」；沒 CI + README + quickstart 不算 ship；留最後因為 API/DX surface 在 P4 才穩定。
**Delivers:** Unit tests（domain entities + use cases w/ mocked ports）+ integration tests（`testcontainers` ephemeral Postgres，含 #1 / #4 / #6 regression 套件）+ e2e（`bun:test` + `app.handle(Request)` 或 edenTreaty）+ `.github/workflows/ci.yml`（biome lint / `tsc --noEmit` / `bun test` / `drizzle-kit generate --name=ci-drift-check` / `bun install --frozen-lockfile`）+ README（Core Value 最前而非 convention）+ quickstart（clone → env → migrate → dev 10 分鐘跑起 authenticated request）+「Looks Done But Isn't」checklist
**Addresses:** Active 條 12–13
**Avoids:** Pitfall #14 / #15 / #11

### Phase Ordering Rationale

- **P1 → P2：** Shared kernel + DB driver + Rigidity Map ADR 先定，app skeleton 才能 mount、error handler 才能 map 已定義的 DomainError 基底
- **P2 → P3：** Auth plugin 需註冊在根層；根層 app + error handler 必須先在
- **P3 整塊不可拆：** 四份研究最強共識。BetterAuth schema 驅動 migration / 雙軌 resolver 必須產同型別 / Runtime Guard + CVE regression + session invalidation + timing-safe compare——任一拆出即破壞論述或留 CVE-class 漏洞
- **P3 → P4：** Demo domain 存在意義是展示 AuthContext；先 demo 再 auth 等於「先違反規矩再補規矩」
- **P4 → P5：** P4 dogfood 揭露 harness UX（#10）；P5 的 README 和 integration test 才有最終版 surface 可描述
- **Rules before code：** DDD 四層 + AGENTS.md + ADR folder 全在 P1，auth 實作（P3）才不會「先違反再補」
- **BetterAuth schema 在 domain schema 之前：** `user/session/account/apiKey` 表是其他 domain 表的 FK 基礎
- **避開 pitfall 的順序硬性：** #2（driver）P1 決定 / #8（Repository）P1 template / #1/#4（CVE + plaintext）P3 同 phase / #10（UX）P4 驗證——不可逆

### Research Flags

**Phases likely needing deeper research (`/gsd-research-phase`):**

- **Phase 3 (Auth Foundation):** 三件高風險 spike——(a) BetterAuth schema 生成與 Elysia 1.4.28 相容性（#5446 still open，30 分鐘 spike 確認 `bunx @better-auth/cli generate` → `drizzle-kit generate` 流程），(b) API Key vs session resolver precedence ADR 定案（API Key 優先 vs cookie 優先 vs 拒絕兩者同時），(c) password reset hook 是否 BetterAuth 自帶 session 撤銷
- **Phase 4 (Demo Domain):** `EvalDataset` entity 形狀（「一組 prompt-expected output」vs「dataset 含多組 test」）— 參考 Anthropic 「Demystifying evals for AI agents」+ LangChain 「Agent Evaluation Readiness Checklist」

**Phases with standard patterns (skip research-phase):**

- **Phase 1:** 決策已有 ADR 草稿、driver 鎖定、ADR 格式選 MADR 4.0——照 `STACK.md` + `ARCHITECTURE.md` 實作
- **Phase 2:** Elysia `.use()` / `.onError()` / CORS / Swagger 屬 well-documented 標準模式
- **Phase 5:** `bun:test` + `testcontainers` + GitHub Actions 屬 standard CI 模式

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 版本號於 2026-04-18 對 Context7 / npm / 官方 docs 驗證；BetterAuth ↔ Elysia `.mount()` 修復於 1.4 確認；Drizzle 1.0 beta 風險有 mitigation |
| Features | HIGH | PROJECT.md Active 全對應 table stakes + differentiator；競品掃描確認定位獨特；anti-features 逐項對 Out of Scope 對齊 |
| Architecture | HIGH on Elysia/BetterAuth/Drizzle/MADR；MEDIUM on DDD folder layout | 社群主流一致但無 canonical spec；P4 若 friction 接受 refactor ADR |
| Pitfalls | HIGH on auth / Bun / BetterAuth / Drizzle 具體案例；MEDIUM on ADR 與 opinionated trap；MEDIUM on AI-agent-harness UX | Critical 級別都有具體 issue/CVE ID 可對 |

**Overall confidence:** HIGH — 可直接進 roadmap；MEDIUM 區塊都有「P4 dogfood + ADR 調整」迴圈機制

### Gaps to Address

- **雙軌身分 precedence 與衝突處理：** 同時帶 API Key + cookie 時優先規則 → P3 前寫 ADR 0009 定案並 ship test
- **BetterAuth password hashing vs `Bun.password` 分工：** BetterAuth 管 user password（scrypt），Rigging 管 API Key（argon2id） → P3 ADR 釐清
- **Session invalidation on password reset：** 是否 BetterAuth 原生支援 → P3 啟動 30 分鐘 spike + ADR
- **ADR numbering / supersede 流程：** → P1 `0000-use-madr-for-adrs.md` 自身解決
- **EvalDataset entity 概念形狀：** → P4 planning 時輕量 domain modeling + ADR
- **BetterAuth rate-limit gap（#2112）：** v1 dev 可容忍？→ P3 明確 log 觸發 + ADR；prod hardening 延後
- **`bun:sql` 何時可切回：** → P1 driver ADR 寫明 revisit 條件（bun#21934/#22395 close）

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| CVE-2025-61928-class bug in BetterAuth API Key（歷史已發生） | Project-killing | Pin `better-auth@1.6.5` exact；Rigging 自包 handler 強制 `body.userId === session.userId`；訂閱 GHSA；Day-1 CVE regression test |
| `bun:sql` transaction hang wedges pool on constraint violation | Project-killing | `drizzle.config.ts` 明確用 `postgres-js` + `postgres@^3.4.9`，ADR 鎖定；禁用 `drizzle-orm/bun-sql` 直到 bun#21934/#22395 關閉 |
| AuthContext 被 module-level import 繞過（Core Value 失敗） | Project-killing | Domain 只 export `getService(ctx)` factory，永不 export class；Biome 禁 `domain/**/internal/*` 外部 import；test 在無 auth plugin 下啟 app 斷言全 protected 401 |
| Elysia scoped plugin `undefined` cascade 讓 guard 假性通過 | Major | 單一 canonical auth plugin 掛根 app、scope `global`；factory runtime assert；test 不掛 auth plugin 全 401；pin Elysia 版號 |
| Opinionated framework trap | Major | P1 ship Rigidity Map ADR 明列三級嚴格度；phase transition 複檢 |
| Password reset 不撤銷其他 session（session fixation） | Major | P3 spike 確認 BetterAuth 行為；若不足則 wrap reset hook purge `session`；ship regression test |
| API Key plaintext / 不可 revoke | Major | 明確 `apiKey({ hashing })`；schema 含 `prefix`/`hash`/`revoked_at`/`expires_at`/`scopes`；test「DB 無 raw key 子字串」 |
| Repository 回 Drizzle `InferSelectModel` 讓 Domain leak | Major | P1 ship 正確 template（含 Mapper）；lint 禁 `domain/**` import `drizzle-orm`；CI grep |
| `drizzle-kit push` 被誤用於 shared DB | Major | `db:push` 僅 dev-labeled script；deploy 只 `db:migrate`；CI `drizzle-kit generate --name=drift-check` 必須無新檔 |
| Harness UX 太緊誘發 `@ts-ignore` | Major | 錯誤訊息附「what / why / ADR link / minimal example」；P1 ship `bun rigging new-domain <name>` scaffold；P4 量化 UX 事件 |
| ADR rot / performative | Major | PR template ADR checkbox；phase transition 檢 ADR 數；Status 欄位實質使用 |
| BetterAuth 內建 rate limit gap（#2112） | Major | per-email rate limiter wrap；dev log 觸發；持久化 store |
| Drizzle 1.0 release 期間 breaking change | Medium | Pin `^0.45.2`，watch `latest`；flip 時寫 migration ADR 不自動 bump |
| BetterAuth schema 生成與 Elysia 1.4.28 相容性（#5446） | Medium | P3 啟動先 spike；commit 生成結果不自動 regenerate |
| Timing attack on `===` string compare | Medium | `crypto.timingSafeEqual`；grep `=== ` 在 auth-critical 檔案 |
| Bun native-module 相容（bcrypt 等） | Minor-Major | 避 `bcrypt` 用 `Bun.password`；CI `bun install --frozen-lockfile` clean checkout |
| Eden Treaty type inference 掉成 `any` | Minor | P5 ship `expect-type` type-level test；v1 無前端故降級 |

## Sources

### Primary (HIGH confidence)

- Context7 / npm registry（2026-04-18）：`bun@1.3.12` / `elysia@1.4.28` / `drizzle-orm@0.45.2` / `drizzle-kit@0.31.10` / `better-auth@1.6.5` / `@better-auth/drizzle-adapter@1.6.5` / `@sinclair/typebox@0.34.49` / `pino@10.3.1` / `@bogeychan/elysia-logger@0.1.10` / `@biomejs/biome@2.4.12` / `@elysiajs/eden@1.4.9` / `testcontainers@11.14.0` / `postgres@3.4.9`
- BetterAuth 官方 docs：Elysia Integration / Drizzle Adapter / API Key plugin / Rate Limit / Security
- Elysia 官方 docs：Plugin / Macro / Life Cycle / Better Auth integration / Eden Treaty Unit Test
- Bun 官方 docs：Hashing (Bun.password) / Node.js Compatibility
- Drizzle 官方 docs：Migrations / Push / Relations v2 / Transactions
- MADR canonical：adr.github.io/madr / Nygard template
- CVE-2025-61928 ZeroPath write-up / GHSA-99h5-pjcv-gr6v
- GitHub issues：bun#21934 / #22395 / #17178 / #23215 / elysia#566 / #1366 / #1284 / #1468 / eden#215 / better-auth#3384 / #2306 / #5446 / #2112
- AGENTS.md 開放標準：agents.md
- OWASP Session Fixation

### Secondary (MEDIUM confidence)

- Martin Fowler、OpenAI、NxCode 2026「Harness Engineering」論述
- DDD refs：RezaOwliaei gist、lukas-andre bun-elysia-clean-architecture、Khalil Stemmler、CodelyTV、Nagarehazh skeleton-ddd
- Rails Doctrine
- Agent UX guardrails：Factory.ai、Snyk、ESLint as AI Guardrails
- PkgPulse Hono vs Elysia 2026 / Biome vs ESLint 2026
- API Key 設計：PlanetScale NanoIDs、prefix.dev、Google Cloud、OneUptime 2026
- Drizzle：「3 Biggest Mistakes」「Migrations in Production Zero-Downtime」
- Competitor scan：create-t3-app、tanstack-start-elysia-better-auth-bun、NestJS scaffolds、Mastra、Claude Agent SDK、LangChain deepagents
- Evals：Anthropic「Demystifying evals for AI agents」、LangChain Agent Evaluation Readiness Checklist

### Tertiary (LOW confidence — phase 執行時驗證)

- BetterAuth schema 生成與 Elysia 1.4.28 相容性（#5446 still open）→ P3 spike
- Drizzle 1.0 release 時程 → quarterly check
- Eden Treaty type inference 在 BetterAuth 場景穩定性 → P5 type-level test

---
*Research completed: 2026-04-18*
*Ready for roadmap: yes — 建議 5 phase 結構，P3 排 spike research slot*
