# Phase 1: Foundation - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 交付「規矩」而非 feature：鋪設 Rigging 的技術骨架與紀律基礎，讓後續所有 phase 都能安全依賴 shared kernel、確定 driver 選擇、以 ADR 記錄起始決策，並讓 DDD 四層結構被 lint 規則保護。**這個 phase 結束時，repo 裡有目錄結構、shared kernel、12 條 ADR、Biome rules、docker-compose、env schema、AGENTS.md Rigidity Map——但沒有任何 domain feature（連 `/health` 都屬 Phase 2）。**

核心論述：「錯的寫法根本跑不起來」這條規矩在 P1 就透過 rails（type + lint + runtime guard）被物理實作，而非靠紀律或 review。

</domain>

<decisions>
## Implementation Decisions

### Rigidity Map 三級內容

- **D-01 (必嚴格，無逃生口)** — 三條核心：
  1. `AuthContext` 必經 `requireAuth` macro 取得（任何 Domain service factory 都依賴它）
  2. Domain 層禁 import `drizzle-orm` / `elysia` / `better-auth` / `postgres` 等 framework package（Domain framework-free）
  3. Stack 核心版本 pin：`bun@^1.3.12`、`elysia@^1.4.28`、`better-auth@1.6.5` (exact)、`drizzle-orm@^0.45.2`、`postgres@^3.4.9`
- **D-02 (可 ADR 逃生)** — 層內細節可替換：validator 選擇 (TypeBox vs Zod)、driver 切換條件 (postgres-js ↔ bun:sql 等 issue 關閉)、logger 格式、migration 策略 (generate vs push)、resolver precedence。要替換須寫 ADR 留痕
- **D-03 (純約定)** — 重在一致但不門檢：變數命名、error code naming、log field naming、git commit format、branch naming
- **D-04 (違規 detection 落點)** — **CI + runtime 雙層**：
  - CI：`biome check` + `tsc --noEmit` + `bun test`（含「不掛 auth plugin 則全 protected route 401」的 integration test）
  - Runtime：Domain service factory 斷言 `ctx.authContext` 存在，缺失 throw `AuthContextMissingError`
  - **不設 pre-commit hook**（尊重開發節奏，避免多一個外部依賴）

### shared kernel API shape

- **D-05** — `Result<T, E>` 採 **neverthrow 風**（自實作 < 100 LOC，無 dep）：
  - API：`Ok(value)` / `Err(error)` factory，`.isOk()` / `.isErr()` / `.map()` / `.mapErr()` / `.andThen()` / `.match()`
  - 檔位：`src/shared/kernel/result.ts`
  - Domain 層可用 `Result<T, DomainError>` 做 control flow；不強制，重大 invariant 仍可 throw
- **D-06** — `Brand<T, K>` 採 **phantom property** (compile-time only、runtime zero-cost)：
  - `type Brand<T, K extends string> = T & { readonly __brand: K }`
  - Helper：`brand<K extends string>(v: T): Brand<T, K>` (internal `as` cast)
  - 檔位：`src/shared/kernel/brand.ts`
- **D-07** — Entity ID 生成採 **crypto.randomUUID + Brand**：
  - `type UserId = Brand<string, 'UserId'>`
  - 生成：`crypto.randomUUID() as UserId` (Bun 原生、無 dep)
  - 驗證 (handler 邊界)：TypeBox `t.String({ format: 'uuid' })`
  - DB schema 用 `uuid` column type（與 TS 型別同構）
  - 檔位：`src/shared/kernel/id.ts`
- **D-08** — `DomainError` 基底類別欄位：`code` (string) + `httpStatus` (number) + `cause?` (unknown)：
  - `abstract class DomainError extends Error { readonly code: string; readonly httpStatus: number; readonly cause?: unknown }`
  - 起始子類與 HTTP status：`ValidationError` (400) / `UnauthorizedError` (401) / `ForbiddenError` (403) / `NotFoundError` (404) / `ConflictError` (409)
  - 全域 `.onError()` plugin 直接讀 `err.httpStatus` 做 mapping（無對照表）
  - 檔位：`src/shared/kernel/errors.ts`

### DDD 邊界 enforcement 機制

- **D-09 (Lint 規則)** — Biome `noRestrictedImports` + `overrides`：
  - `biome.json` 中 `overrides[].includes = ["src/**/domain/**"]`，`rules.style.noRestrictedImports` 禁 `drizzle-orm` / `better-auth` / `elysia` / `postgres` / `@bogeychan/elysia-logger` / `pino`
  - 同樣 override 覆蓋 `src/**/application/**` 禁 `drizzle-orm` / `postgres`（application 允許 `elysia` / `better-auth`？—— 待 P3 釐清；P1 先放寬，use case 須不 import framework）
- **D-10 (Repository 回 domain entity)** — **純型別 + lint 雙裏**：
  - Repository port 定義 return type 為 domain entity（`Promise<User | null>`），tsc 型別層強制
  - 加上 D-09 的 Biome rule 阻止 application/domain 層 import drizzle-orm，實務上 Drizzle row type 無法進到 domain
  - Mapper pattern：infrastructure 層有 `UserMapper.toDomain(row)` / `toPersistence(entity)` 雙向
- **D-11 (Domain export barrel)** — 每 feature `domain/index.ts` 是唯一 barrel：
  - `domain/index.ts` export `getXxxService(ctx: AuthContext)` factory
  - `domain/internal/` 放 class 實作（`UserServiceImpl` 等）
  - Biome rule：`application/**` 與 `presentation/**` 禁從 `domain/internal/**` import（只允許 `domain/index.ts` 或 `domain/index`）
- **D-12 (Error message 格式)** — 自訂訊息含 what + why + ADR link + 具體修法。範例：
  ```
  Domain layer cannot import 'drizzle-orm'.
  Reason: Domain must stay framework-free (see docs/decisions/0003-ddd-layering.md).
  Fix: Move Drizzle usage to src/{feature}/infrastructure/, use Mapper to convert.
  ```
  - 做法：Biome 2.x `noRestrictedImports.paths[].message` 欄位寫入

### ADR 起始 12 條內容與編號順序

- **D-13** — 12 條 ADR 編號順序按 research 建議（技術堆疊底→高）：
  - `0000-use-madr-for-adrs.md` (MADR 自指)
  - `0001-runtime-bun.md` (Bun 1.3.12)
  - `0002-web-framework-elysia.md` (Elysia 1.4.28)
  - `0003-ddd-layering.md` (DDD 四層)
  - `0004-auth-betterauth.md` (BetterAuth 1.6.5 pin exact)
  - `0005-orm-drizzle.md` (Drizzle 0.45.2 非 1.0-beta)
  - `0006-authcontext-boundary.md` (AuthContext 強制邊界)
  - `0007-runtime-guards-via-di.md` (Runtime Guards + Elysia `.macro`)
  - `0008-dual-auth-session-and-apikey.md` (雙軌身分)
  - `0009-rigidity-map.md` (三級嚴格度)
  - `0010-postgres-driver-postgres-js.md` (postgres-js，NOT bun:sql，含 revisit 條件：bun#21934/#22395 關閉)
  - `0011-resolver-precedence-apikey-over-cookie.md` (API Key 優先 cookie)
- **D-14** — 0011 Resolver precedence 在 P1 即 `Status: accepted`：
  - Research 已有明確立場（API Key 優於 cookie）
  - P3 spike 若發現需修正，另開 `0011a-*.md` Supersedes 原 ADR
- **D-15** — `docs/decisions/README.md` 索引表欄位：**編號 / 標題 / Status / 日期 / Supersedes**
  - Supersedes 欄位追蹤 ADR 替換關係（未來某 ADR 被推翻時保留歷史）
- **D-16 (PR gate)** — PR template + CI lint：
  - `.github/PULL_REQUEST_TEMPLATE.md` 含 checkbox：「此 PR 是否需 ADR？若需，連結 `docs/decisions/NNNN-*.md`」
  - GitHub Actions 檢查：若 PR body 勾「是」但 diff 未新增 `docs/decisions/*.md` 檔案 → CI fail
  - ADR checkbox 同時包含「是否更新索引表」副條件

### the agent's Discretion

以下項目未納入本次討論，下游 agent 可依約定 / research 直接決定：

- **docker-compose.yml 內容**（是否包 adminer、volume vs ephemeral、healthcheck 細節）— 研究建議 `postgres:16-alpine` + optional adminer + named volume，researcher 可直接採納
- **env schema 具體欄位** — 起始清單建議：`DATABASE_URL`、`BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`、`PORT`、`NODE_ENV`、`LOG_LEVEL`；TypeBox schema 在 `src/bootstrap/config.ts` 啟動時驗證
- **lefthook 加不加** — D-04 已定「不設 pre-commit」；planner 可直接略過
- **Biome rule set 細節** — recommended 全開，額外自訂 rules 依 D-09/D-11/D-12 設定
- **AGENTS.md Rigidity Map 段落落點** — 視 GSD auto-managed 區塊結構，planner/executor 決定新增段落與 managed 區塊的相對位置（推薦在 `<!-- GSD:workflow-end -->` 之後新增 `<!-- RIGGING:rigidity-map-start -->` 自管理區塊）
- **Template feature for P1** — P1 **不**包含任何 domain feature；`/health` 在 Phase 2。此決策採 "rules before code" 原則
- **shared kernel 是否含 Brand helper 的 runtime validator** — D-06 採 phantom property 無 runtime footprint；若 planner 認為 domain 需要 typed brand constructor (e.g., `UserId.of(s: string)`)，可額外提供不強制

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level (必讀)
- `.planning/PROJECT.md` — Core Value、Constraints、Key Decisions
- `.planning/REQUIREMENTS.md` §Foundation / §Architecture Discipline / §ADR Mechanism / §AGENTS.md — 18 條 P1 requirements (FND-01..06 / ARCH-01..05 / ADR-01..05 / AGM-01..02)
- `.planning/ROADMAP.md` §Phase 1 — Goal、Depends on、Success Criteria

### Research (P1 規劃必讀)
- `.planning/research/STACK.md` — Stack 版本鎖定依據、BetterAuth ↔ Elysia 1.4 mount 修復、Drizzle 1.0 beta 風險
- `.planning/research/ARCHITECTURE.md` — DDD 四層結構、AuthContext macro、Shared Kernel 設計、Error handler plugin pattern
- `.planning/research/PITFALLS.md` — 15 條 pitfalls，P1 直接相關：#2 (bun:sql hang) / #3 (AuthContext bypass) / #5 (opinionated trap / Rigidity Map) / #8 (Repository leak Drizzle row) / #9 (drizzle-kit push misuse) / #10 (harness 太緊) / #11 (ADR rot) / #14 (Bun native-module)
- `.planning/research/FEATURES.md` — must-have vs defer 對照
- `.planning/research/SUMMARY.md` §Phase 1 — Delivers / Addresses / Avoids

### External specs (agent 實作時參考)
- MADR 4.0 canonical — `https://adr.github.io/madr/` (ADR 格式)
- AGENTS.md 開放標準 — `https://agents.md` (2025/08 格式)
- Biome 2.x noRestrictedImports — 官方 docs (規則語法)
- Drizzle `drizzle-orm/postgres-js` driver docs — 避開 `bun:sql` 的技術依據

### 後續 phase 會用到的 P1 產出物（locked by this CONTEXT）
- `src/shared/kernel/{result,brand,id,errors}.ts` — framework-free 基底
- `biome.json` overrides rules — DDD 邊界 enforcement
- `docs/decisions/0000-0011` — 12 條 ADR + `docs/decisions/README.md` 索引
- `AGENTS.md` Rigidity Map 段、Anti-features 段
- `docker-compose.yml`、`.env.example`、`src/bootstrap/config.ts` (TypeBox env schema)

</canonical_refs>

<code_context>
## Existing Code Insights

本專案目前為空白 repo（`.planning/` 與 `AGENTS.md` 外無任何 source file）。P1 是零件組裝 phase。

### Reusable Assets
- 無既有 code 可複用——P1 正是在鋪基底

### Established Patterns (from research)
- **DDD 四層 × feature vertical slice**：`src/{feature}/{domain,application,infrastructure,presentation}/`（研究 `ARCHITECTURE.md`）
- **Factory function DI**：feature module 以 `createXxxModule(shared)` 回傳 Elysia plugin；不引入 tsyringe/inversify（研究 `STACK.md` §What NOT to Use）
- **Mapper 雙向轉換**：`UserMapper.toDomain(row)` / `toPersistence(entity)`（研究 `ARCHITECTURE.md` Major Components #3）

### Integration Points
- **`src/bootstrap/app.ts`** — 未來 Phase 2 的 Elysia root app 會從此 mount feature module 與全域 plugin；P1 不需要但目錄要就位
- **`src/shared/`** — `kernel/` (P1 ship) + 未來 `application/ports/` (P3 會加 IEmailPort) + 未來 `infrastructure/` + 未來 `presentation/`
- **`drizzle.config.ts`** — P1 ship 配置 `driver: 'postgres-js'` + `schema: './src/**/infrastructure/schema/*.ts'` + `dialect: 'postgresql'`
- **`docs/decisions/`** — ADR 目錄，PR template 連結此處

</code_context>

<specifics>
## Specific Ideas

- **Error message 模板要嚴格跟「what + why + ADR link + 修法」四段格式**（D-12）。Planner 設計 Biome rule 時明確寫 `.message` 欄位；executor 寫 rule 時四段齊備，不省略。
- **Rigidity Map 在 AGENTS.md 與 ADR 0009 雙位置 cross-reference**（D-15 supersedes 欄位是為此場景——未來若 Rigidity Map 調整，ADR 0009 會被 0009a 取代，AGENTS.md 的段落同步更新指向新 ADR）。
- **ADR 0010 (postgres-js driver) 必須寫明 revisit 條件**：bun#21934 和 bun#22395 同時關閉時重新評估切回 `bun:sql` 的可能。這是硬性 decision audit 要求。
- **ADR 0011 (Resolver precedence) 雖 P1 即 accepted，但需在 "Decision Drivers" 段落明寫 P3 spike 驗證計畫**，避免閱讀者質疑「為何 P1 就定 accepted」。
- **Result 採 neverthrow 風時不採用 neverthrow npm package**——自實作 < 100 LOC，避開第三方 churn 風險（與 shared kernel framework-free 原則一致）。

</specifics>

<deferred>
## Deferred Ideas

以下區塊在討論過程未被選擇，明確推遲：

- **docker-compose / env schema 細節** — the agent's Discretion 處理；若 planner 在 P1 發現需使用者決策，可提 follow-up 問題
- **AGENTS.md 與 GSD auto-managed 區塊的物理排版** — the agent's Discretion；executor 決定新增 `<!-- RIGGING:rigidity-map-* -->` 區塊落點
- **Template feature 於 P1 驗證 DDD 四層** — 已定「P1 純骨架、不含 feature」；`/health` 延到 Phase 2 作為第一個走過四層的 trivial feature
- **Application 層 import `elysia` 是否允許** (D-09 備註) — P1 先放寬 (tsc 層 + Mapper pattern 足以擋 Drizzle 洩漏)；若 P3 發現 use case 被 Elysia context 污染，再寫 ADR 補規則
- **Rigidity Map 中「性最廣義（含架構形狀）」的可 ADR 逃生選項** — 使用者選「層內細節可替換」。若後續 P4 dogfood 發現四層目錄佈局阻力過大，重新評估是否需把「可省略 application 層」等拉進「可 ADR 逃生」

未提及但屬於未來 phase：
- OAuth / SSO / 2FA / Passkey → `PROJECT.md` Out of Scope，v2 IDN-*
- `npx create-rigging` CLI generator → v2 SCAF-01
- 真實 email provider → v2 PROD-01
- Multi-tenancy / RBAC → v2 TEN-*

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-19*
