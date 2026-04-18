# Phase 1: Foundation - Research

**Researched:** 2026-04-19
**Domain:** Greenfield TypeScript backend bootstrap — DDD 四層骨架 + Shared Kernel + ADR 機制 + AGENTS.md Rigidity Map（無 domain feature、無 HTTP endpoint）
**Confidence:** HIGH（stack 版本、DDD 結構、ADR 格式、Biome 2.x 規則語法皆已於 research 階段對官方 docs / Context7 / npm / Web 驗證；P1 無 feature、無 runtime state，風險聚焦在「設定檔先後順序」與「rule 文字精確性」）

## Summary

Phase 1 是「紀律先於 feature」的骨架 phase——交付 12 條 ADR、DDD 四層目錄、Biome noRestrictedImports 邊界、shared kernel 四件套（Result/Brand/Id/DomainError）、docker-compose + env schema、AGENTS.md Rigidity Map 段落，**但絕無任何 domain feature**（`/health` 屬 Phase 2）。P1 成敗的關鍵不在複雜邏輯，而在**初始化順序與 lint rule 文字的四段格式精確性**——順序錯，後續 phase 會 import 到不存在的檔案；rule 錯，Domain 能 import `drizzle-orm` 仍過 CI，Core Value 在 P3 才被發現失守。

CONTEXT.md 鎖定了 16 條決策（D-01..D-16）——本研究在這些決策內部找**具體 API shape / 語法 / 檔位 / 測試策略 / ADR 條目初稿**，不再探索替代方案。P1 絕大多數技術選擇已有 HIGH confidence 來源（STACK/ARCHITECTURE/PITFALLS 三份 research），本文件的增量貢獻在：(1) 初始化檔案落地順序、(2) Biome 2.x `overrides.includes` 正確語法 + 四段 message 模板、(3) Shared kernel 四件套的具體 signature 與 100 LOC 實作 sketch、(4) 12 條 ADR 的 Context/Decision/Consequences 初稿，以及 (5) P1 沒有 feature 時的 Validation Architecture（靜態檢查為主 + placeholder integration test 保留 D-04 檢測落點）。

**Primary recommendation:** 先 lock tooling（tsconfig / biome / package.json 版本）→ 再落 shared kernel（任層 import）→ 再落 biome rule（此時有 `src/**/domain/**` 路徑可 override）→ 再落 ADR（已有可引用的 rule 編號與檔位）→ 最後落 AGENTS.md Rigidity Map + docker-compose + env schema。`drizzle.config.ts` 放最後、明確 `driver: 'postgres-js'` + `dialect: 'postgresql'`，Phase 2 才需要它實際 connect。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Rigidity Map 三級內容：**

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

**Shared kernel API shape：**

- **D-05** `Result<T, E>` — neverthrow 風自實作 < 100 LOC，無 dep；API：`Ok(value)` / `Err(error)` factory、`.isOk()` / `.isErr()` / `.map()` / `.mapErr()` / `.andThen()` / `.match()`；檔位 `src/shared/kernel/result.ts`
- **D-06** `Brand<T, K>` — phantom property（compile-time only、runtime zero-cost）；`type Brand<T, K extends string> = T & { readonly __brand: K }`；helper `brand<K>(v)` 內部 `as` cast；檔位 `src/shared/kernel/brand.ts`
- **D-07** Entity ID — `crypto.randomUUID() + Brand`；`type UserId = Brand<string, 'UserId'>`；生成 `crypto.randomUUID() as UserId`（Bun 原生）；handler 邊界用 TypeBox `t.String({ format: 'uuid' })`；DB column `uuid`；檔位 `src/shared/kernel/id.ts`
- **D-08** `DomainError` — abstract class，欄位 `code` (string) + `httpStatus` (number) + `cause?` (unknown)；起始子類：`ValidationError` (400) / `UnauthorizedError` (401) / `ForbiddenError` (403) / `NotFoundError` (404) / `ConflictError` (409)；全域 `.onError()` 直接讀 `err.httpStatus` 做 mapping（無對照表）；檔位 `src/shared/kernel/errors.ts`

**DDD 邊界 enforcement 機制：**

- **D-09** Biome `noRestrictedImports` + `overrides`：`overrides[].includes = ["src/**/domain/**"]`，`rules.style.noRestrictedImports` 禁 `drizzle-orm` / `better-auth` / `elysia` / `postgres` / `@bogeychan/elysia-logger` / `pino`；同樣 override 覆蓋 `src/**/application/**` 禁 `drizzle-orm` / `postgres`（application 允許 `elysia` / `better-auth`；P1 放寬，P3 再釐清）
- **D-10** Repository 回 domain entity — 型別 + lint 雙裏；Repository port 定義 return type 為 domain entity，tsc 型別層強制；加 D-09 lint rule 阻止 application/domain import `drizzle-orm`；Mapper pattern 雙向
- **D-11** Domain export barrel — 每 feature `domain/index.ts` 是唯一 barrel；export `getXxxService(ctx: AuthContext)` factory；`domain/internal/` 放 class 實作；Biome rule 禁 `application/**` 與 `presentation/**` 從 `domain/internal/**` import
- **D-12** Error message 格式 — 四段：what + why + ADR link + 具體修法；Biome 2.x `noRestrictedImports.paths[].message` 欄位寫入

**ADR 起始 12 條內容與編號順序：**

- **D-13** — 12 條 ADR 編號順序（技術堆疊底→高）：
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
- **D-14** 0011 Resolver precedence 在 P1 即 `Status: accepted`；research 已有明確立場；P3 spike 若發現需修正，另開 `0011a-*.md` Supersedes 原 ADR
- **D-15** `docs/decisions/README.md` 索引表欄位：**編號 / 標題 / Status / 日期 / Supersedes**
- **D-16** PR template + CI lint：`.github/PULL_REQUEST_TEMPLATE.md` 含 checkbox「此 PR 是否需 ADR？若需，連結 `docs/decisions/NNNN-*.md`」；GitHub Actions 檢查：若 PR body 勾「是」但 diff 未新增 `docs/decisions/*.md` → CI fail；ADR checkbox 副條件「是否更新索引表」

### Claude's Discretion

- **docker-compose.yml 內容**（adminer、volume、healthcheck 細節）— research 建議 `postgres:16-alpine` + optional adminer + named volume + healthcheck；researcher 可直接採納
- **env schema 具體欄位** — 起始清單建議：`DATABASE_URL`、`BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`、`PORT`、`NODE_ENV`、`LOG_LEVEL`；TypeBox schema 在 `src/bootstrap/config.ts` 啟動時驗證
- **lefthook 加不加** — D-04 已定「不設 pre-commit」；planner 可直接略過
- **Biome rule set 細節** — recommended 全開，額外自訂 rules 依 D-09/D-11/D-12 設定
- **AGENTS.md Rigidity Map 段落落點** — 視 GSD auto-managed 區塊結構；推薦在 `<!-- GSD:workflow-end -->` 之後新增 `<!-- RIGGING:rigidity-map-start -->` 自管理區塊
- **Template feature for P1** — P1 **不**包含任何 domain feature；`/health` 在 Phase 2
- **shared kernel 是否含 Brand helper 的 runtime validator** — D-06 採 phantom property 無 runtime footprint；若 planner 認為需要 typed brand constructor 可額外提供不強制

### Deferred Ideas (OUT OF SCOPE)

- **docker-compose / env schema 細節** — the agent's Discretion
- **AGENTS.md 與 GSD auto-managed 區塊的物理排版** — the agent's Discretion；executor 決定落點
- **Template feature 於 P1 驗證 DDD 四層** — 已定「P1 純骨架、不含 feature」；`/health` 延到 Phase 2
- **Application 層 import `elysia` 是否允許** (D-09 備註) — P1 放寬；若 P3 發現 use case 被 Elysia context 污染，再寫 ADR 補規則
- **Rigidity Map 中「性最廣義（含架構形狀）」的可 ADR 逃生選項** — 使用者選「層內細節可替換」；若後續 P4 dogfood 發現四層目錄佈局阻力過大，重新評估

未提及但屬於未來 phase：
- OAuth / SSO / 2FA / Passkey → `PROJECT.md` Out of Scope，v2 IDN-*
- `npx create-rigging` CLI generator → v2 SCAF-01
- 真實 email provider → v2 PROD-01
- Multi-tenancy / RBAC → v2 TEN-*

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **FND-01** | clone repo 後 `bun install && bun run dev` 能啟動 Elysia server | package.json `scripts.dev` + `src/main.ts` placeholder → Bootstrap Ordering §1-§3；Phase 2 才真的 listen，P1 可 print "ready for P2" 即滿足 |
| **FND-02** | `.env.example` 含所有必要環境變數，啟動時以 TypeBox schema 校驗缺值立即失敗 | `src/bootstrap/config.ts` TypeBox schema → docker-compose + env schema §；dev-loaded fail-fast → Environment Availability + Code Examples |
| **FND-03** | `docker-compose up` 啟動 PostgreSQL 16 + 預建 dev database | docker-compose 使用 `postgres:16-alpine` + healthcheck → docker-compose + env schema § |
| **FND-04** | Drizzle ORM 已配置並明確使用 `drizzle-orm/postgres-js` 驅動（非 `bun:sql`） | `drizzle.config.ts` + `src/shared/infrastructure/db/client.ts`（此檔 Phase 2 才用到，P1 只 ship config）→ Bootstrap Ordering §7；Pitfall #5 驅動鎖定 |
| **FND-05** | `src/shared/kernel/` 提供 `Result<T,E>` / `Brand<T,K>` / `UUID` / `DomainError`，皆 framework-free | 四件套 implementation sketch → Shared Kernel Sketch §；zero-import verification in Validation Architecture |
| **FND-06** | Biome 2.x 負責 lint + format，single config file 管控全 repo | `biome.json` 於 repo root → Bootstrap Ordering §4；`overrides` 語法 verified |
| **ARCH-01** | DDD 四層目錄結構在 repo 根層就位並被 lint 規則保護 | `src/{feature}/{domain,application,infrastructure,presentation}/` 模板 → DDD Scaffold §；P1 無 feature 故僅 ship `src/shared/` 與 `.gitkeep` 形塑骨架 |
| **ARCH-02** | Domain 層被 lint 規則禁止 import `drizzle-orm` 或任何 framework 套件（違規 CI fail） | Biome `noRestrictedImports` override on `src/**/domain/**` → DDD Scaffold §Biome Rule 實作；negative test 於 Validation Architecture |
| **ARCH-03** | Repository 必定回 Domain entity；絕不洩漏 Drizzle `InferSelectModel` 到 Domain 層 | P1 無 Repository 實體可 ship，但 lint rule（D-09）+ 型別架構（D-10）已就位；Phase 3 Repository 實作會落在此約束下 |
| **ARCH-04** | Feature Module 以 factory function 導出（`createXxxModule(shared)` 回傳 Elysia plugin），不使用 tsyringe/inversify | P1 無 feature module 可 ship；但 `AGENTS.md` Rigidity Map 明列此約束、package.json 不加 tsyringe/inversify |
| **ARCH-05** | 全域 error handler plugin 將 `DomainError` 子類映射到對應 HTTP status | P1 ship `DomainError` 基底 + 5 子類（`httpStatus` 欄位）；error handler plugin 本身 Phase 2 實作，但此 phase 提供 `httpStatus` 單一來源 |
| **ADR-01** | `docs/decisions/` 目錄就位，採 MADR 4.0 格式，`NNNN-kebab-case-title.md` 命名 | ADR Seed Content §；12 條 seed ADR 均遵循 MADR 4.0.0 "full" template（含 YAML front matter status/date/deciders） |
| **ADR-02** | 9 條起始 ADR 全部 ship（MADR 自指 / Bun / Elysia / DDD / BetterAuth / Drizzle / AuthContext / Runtime Guards / Dual Auth） | 對應 `0000-0008`，內容初稿於 ADR Seed Content § |
| **ADR-03** | 追加 3 條高風險 ADR（Rigidity Map / postgres-js driver / Resolver precedence） | 對應 `0009-rigidity-map.md` / `0010-postgres-driver-postgres-js.md` / `0011-resolver-precedence-apikey-over-cookie.md`，內容初稿於 ADR Seed Content §（含 0010 revisit 條件 + 0011 P1 即 accepted 的 P3 spike 驗證計畫） |
| **ADR-04** | `docs/decisions/README.md` 維護 ADR 索引表（編號 / 標題 / Status / 日期 / Supersedes） | 索引欄位依 D-15 鎖定；初始 12 列 + 範本寫法於 ADR Seed Content §README.md Index |
| **ADR-05** | PR template 包含 ADR checkbox | `.github/PULL_REQUEST_TEMPLATE.md` 草稿於 Bootstrap Ordering §8；GitHub Actions 驗證腳本於 CI + Runtime Guard § |
| **AGM-01** | Repo 根層 `AGENTS.md`（2025/08 開放標準格式）明列 Rigging 的 Rigidity Map 三級 | `AGENTS.md` Rigidity Map 段落 draft 於 AGENTS.md Rigidity Map §；與 GSD auto-managed 區塊共存於 `<!-- RIGGING:rigidity-map-* -->` 自管理區塊 |
| **AGM-02** | `AGENTS.md` 列出 anti-features（禁止 AI Agent 主動提議擴張的項目） | Anti-features 段落 draft 於 AGENTS.md Rigidity Map §；清單直接對 `PROJECT.md` Out of Scope 複製 |

</phase_requirements>

## Project Constraints (from AGENTS.md)

`AGENTS.md` 目前已有 GSD auto-managed 區塊（`<!-- GSD:project-start -->` / `<!-- GSD:stack-start -->` / `<!-- GSD:conventions-start -->` / `<!-- GSD:architecture-start -->` / `<!-- GSD:skills-start -->` / `<!-- GSD:workflow-start -->` / `<!-- GSD:profile-start -->`）。P1 的 Rigidity Map 段落必須：

1. **不侵入 GSD 區塊**：Rigging 自管理段落用獨立的 `<!-- RIGGING:rigidity-map-start -->` / `<!-- RIGGING:rigidity-map-end -->` 包裹；建議落在 `<!-- GSD:workflow-end -->` 之後、`<!-- GSD:profile-start -->` 之前
2. **遵守 GSD Workflow Enforcement**：在改動任何 repo 檔案（包含 P1 bootstrap）前必須先走 GSD command（`/gsd-execute-phase`），不直接 Edit/Write
3. **自動更新相容**：若未來 GSD 工具重寫 AGENTS.md，RIGGING 自管理區塊的註解標記能被保留（類似 GSD 區塊）

## Standard Stack

### Core (locked by D-01 / PROJECT.md Key Decisions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `bun` | `^1.3.12` | runtime + test + package manager | 原生 TS、`Bun.password`、`bun:test`、`bun --watch`；Elysia bun-native [VERIFIED: npm registry 2026-04-18 via STACK.md] |
| `elysia` | `^1.4.28` | Web framework（P2 才 mount） | `.macro` + `.derive` + `.mount()` Set-Cookie fix；P1 僅列入 deps [VERIFIED: npm registry 2026-04-18] |
| `typescript` | `^5.9` | static types | Elysia peerDep `>= 5.0.0`；P1 `strict: true` + `noUncheckedIndexedAccess` [VERIFIED: Elysia peerDep] |
| `@sinclair/typebox` | `^0.34.49` | validator（env schema + 未來 handler I/O） | Elysia peerDep `>= 0.34 < 1` [VERIFIED: Elysia peerDep] |
| `drizzle-orm` | `^0.45.2` | ORM（P1 僅 ship config，P3 才用） | 非 1.0-beta；Drizzle 的 `postgres-js` driver 是鎖定選項 [VERIFIED: npm registry 2026-04-18] |
| `drizzle-kit` | `^0.31.10` | migration tool（devDep） | peerDep `>= 0.31.4`；P1 ship config 不跑 migration [VERIFIED: Drizzle peerDep] |
| `postgres` (postgres.js) | `^3.4.9` | driver（與 Drizzle `drizzle-orm/postgres-js` 配對） | 避開 `bun:sql` transaction hang bug#21934/#22395 [VERIFIED: bun#21934 / #22395 still open via PITFALLS.md] |
| `@biomejs/biome` | `^2.4.12` | lint + format（devDep） | 單一 config；支援 `overrides.includes` 語法 [VERIFIED: biomejs.dev docs 2026-04-19] |
| `better-auth` | `1.6.5` **（exact pin, no caret）** | auth（P3 才配置） | P1 僅列 dep；CVE-2025-61928 class bug 歷史需 exact pin [CITED: ZeroPath CVE-2025-61928 write-up] |
| `@better-auth/drizzle-adapter` | `1.6.5` | BetterAuth + Drizzle adapter（P3 才用） | 與 core 版本 lockstep [CITED: BetterAuth official docs] |

### Supporting (P1 只列 deps、不實作)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@elysiajs/cors` | `^1.4.x` | CORS plugin | Phase 2 掛載 |
| `@elysiajs/swagger` | `^1.4.x` | OpenAPI 生成 | Phase 2 掛載 |
| `@bogeychan/elysia-logger` | `^0.1.10` | Pino-backed request logger | Phase 2 掛載 |
| `pino` | `^10.3.1` | 底層 logger | Phase 2 |
| `pino-pretty` | `^13.1.3` | dev transport | Phase 2 devDep |
| `bun-types` / `@types/bun` | latest | Bun 型別 | P1 devDep |

### Alternatives Considered / Rejected（CONTEXT.md 已 lock，此處 audit-trail 用）

| Rejected | Reason |
|----------|--------|
| `pg` driver | `postgres-js` 更輕、TS types 好、Bun 相容度高 [CITED: STACK.md] |
| `bcrypt` / `bcryptjs` | Bun native build 痛 + argon2id 已內建 `Bun.password`（Phase 3 才需） |
| `tsyringe` / `inversify` | PROJECT.md Constraints 明定「Elysia 內建 DI」；ARCH-04 禁用 |
| `Zod` as Domain validator | TypeBox 已透過 Elysia 存在；Zod 為 BetterAuth 透過傳遞性引入，不另自家引入 |
| `dotenv` | Bun 原生 `.env` 載入 [CITED: Bun docs] |
| `ESLint + Prettier` | Biome 2.x 單工具取代 |
| `Jest` / `Vitest` | `bun:test` 原生 |
| `neverthrow` npm package | D-05 自實作 < 100 LOC，避第三方 churn；與 shared kernel framework-free 原則一致 |
| `drizzle-orm/bun-sql` | bun#21934 / #22395 未修；Pitfall #5 鎖定 `postgres-js` |
| Drizzle `1.0.0-beta.x` | beta churn；watch `latest` tag flip |
| `lefthook` pre-commit hook | D-04 明定「不設 pre-commit hook」 |

### Installation（P1 一次到位）

```bash
# Core prod deps
bun add elysia@^1.4.28 \
        @elysiajs/cors@^1.4 \
        @elysiajs/swagger@^1.4 \
        @bogeychan/elysia-logger@^0.1.10 \
        pino@^10.3.1 \
        @sinclair/typebox@^0.34.49 \
        drizzle-orm@^0.45.2 \
        postgres@^3.4.9 \
        better-auth@1.6.5 \
        @better-auth/drizzle-adapter@1.6.5

# Dev deps
bun add -d @biomejs/biome@^2.4.12 \
           drizzle-kit@^0.31.10 \
           typescript@^5.9 \
           pino-pretty@^13.1.3 \
           @types/bun
```

**Version verification protocol:** P1 planner/executor 在 wave 0 必須跑 `bun pm view <pkg> version` 對每個 package 確認 2026-04-19 仍有效版本，差異者寫入 ADR `0001` consequences。STACK.md 版本於 2026-04-18 驗證過。

## Bootstrap Ordering

P1 檔案落地的**精確順序**（違反會使 lint rule 指涉不存在路徑、ADR 引用尚未存在的檔位）：

```
順序  檔案/目錄                                  為何此時落
────  ─────────────────────────────────────────────────────────
  1   package.json                              deps + scripts 先；後續 biome/tsc 檢查需要
  2   tsconfig.json                             strict 設定；後續 src/** 才能受保護
  3   .gitignore / .dockerignore                基本整潔
  4   biome.json (基本 recommended, 無 overrides) 此刻尚無 src/**/domain/** 路徑可 override
  5   src/shared/kernel/result.ts               framework-free，無 upstream dep
  5   src/shared/kernel/brand.ts                同上
  5   src/shared/kernel/id.ts                   import brand.ts
  5   src/shared/kernel/errors.ts               framework-free
  5   src/shared/kernel/index.ts                barrel export
  6   biome.json overrides（D-09/D-11/D-12 rule） 此刻 src/**/domain/** / src/**/application/** 路徑已有佔位 placeholder（下一步）
  7   src/{feature}/domain/.gitkeep            folder 就位（P1 無 feature，故僅 src/shared/ 與空 feature slot scaffold）
  7   src/{feature}/application/.gitkeep        同上
  7   src/{feature}/infrastructure/.gitkeep     同上
  7   src/{feature}/presentation/.gitkeep       同上
  7   src/bootstrap/.gitkeep                    Phase 2 會放 app.ts / config.ts
  7   src/main.ts (minimal stub)                FND-01 要求 `bun run dev` 能跑；P1 stub 只 print "Rigging P1 ready"
  8   src/bootstrap/config.ts                   TypeBox env schema；FND-02；startup fail-fast
  9   docker-compose.yml                        postgres:16-alpine + healthcheck；FND-03
 10   .env.example                              FND-02 要求欄位全在
 11   drizzle.config.ts                         driver: 'postgres-js'、schema glob；FND-04
 12   docs/decisions/0000-use-madr-for-adrs.md  ADR seed（自指 ADR）
 12   docs/decisions/0001-runtime-bun.md        ADR seed
 12   ...0011-resolver-precedence-apikey-over-cookie.md
 12   docs/decisions/README.md                  索引；ADR-04
 13   .github/PULL_REQUEST_TEMPLATE.md          ADR checkbox；ADR-05
 13   .github/workflows/adr-check.yml (CI lint)  驗 PR 勾「需 ADR」則 docs/decisions/ 必有新檔
 14   AGENTS.md 新增 <!-- RIGGING:rigidity-map-* --> 段落  AGM-01 + AGM-02
 15   README.md（最小 placeholder）             Phase 5 才 polish，但 P1 需有首屏提及 Core Value
```

**關鍵排序理由：**

- **biome.json overrides 在 shared kernel 之後**：`overrides[].includes = ["src/**/domain/**"]` 無 domain 目錄也能寫（Biome 不檢查 glob 是否對應既存檔案），但先 ship kernel 再 ship rule 讓 step 6 的 `bun run lint` 一次通過（若 kernel 缺失，biome 仍 pass 因無檔案 match）
- **ADR 在 lint rule 之後**：ADR 0003（DDD layering）/ 0009（Rigidity Map）引用 `biome.json` 中 `noRestrictedImports` 的具體 paths；先寫 rule、後在 ADR 引用
- **AGENTS.md 修改最後**：引用 ADR 0009（Rigidity Map）與 `biome.json` 路徑需先存在
- **docker-compose.yml 與 drizzle.config.ts 在 kernel 之後但 ADR 之前**：無執行依賴，可並行；但 ADR 0005（Drizzle）需 `drizzle.config.ts` 先存在以引用 driver 設定
- **沒有 `src/shared/kernel` 外的 `.ts` source**：P1 無 feature，`src/{feature}/*` 四層只放 `.gitkeep`；`src/bootstrap/config.ts` 是唯一的非 kernel runnable file

## DDD Scaffold & Biome Rule 實作細節

### 目錄結構 (P1 ship)

```
rigging/
├── src/
│   ├── main.ts                        # FND-01 stub；P2 會真的掛 Elysia
│   ├── bootstrap/
│   │   ├── config.ts                  # TypeBox env schema（FND-02）
│   │   └── .gitkeep                   # Phase 2 會加 app.ts / container.ts
│   ├── shared/
│   │   ├── kernel/
│   │   │   ├── result.ts              # FND-05
│   │   │   ├── brand.ts
│   │   │   ├── id.ts
│   │   │   ├── errors.ts
│   │   │   └── index.ts               # barrel export
│   │   ├── application/
│   │   │   └── .gitkeep               # 未來 ILogger / IClock port
│   │   ├── infrastructure/
│   │   │   └── .gitkeep               # 未來 db/client.ts
│   │   └── presentation/
│   │       └── .gitkeep               # 未來 error-handler.plugin.ts
│   ├── _template/                     # ⚠️ optional — scaffold 用 placeholder 讓 biome overrides 能對 glob 匹配
│   │   ├── domain/.gitkeep
│   │   ├── application/.gitkeep
│   │   ├── infrastructure/.gitkeep
│   │   └── presentation/.gitkeep
│   └── types/
│       └── .gitkeep
├── tests/
│   ├── unit/.gitkeep
│   ├── integration/.gitkeep
│   └── e2e/.gitkeep
├── docs/
│   └── decisions/
│       ├── 0000-use-madr-for-adrs.md
│       ├── ...
│       └── README.md                  # 索引
├── .github/
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── workflows/
│       └── adr-check.yml
├── drizzle/                           # empty；Phase 3 會有 migrations
├── .env.example
├── .gitignore
├── .dockerignore
├── biome.json
├── docker-compose.yml
├── drizzle.config.ts
├── package.json
├── tsconfig.json
├── AGENTS.md                          # 新增 RIGGING:rigidity-map-* 段落
└── README.md                          # 最小 placeholder
```

**`src/_template/` 的 tradeoff：**
- Option A（推薦）：建 `src/_template/{domain,application,...}/.gitkeep` — Biome overrides glob `src/**/domain/**` 在 P1 就有檔案 match，executor 的 `bun run lint` 能真實驗證 rule 結構正確（但不會有違規，因 `.gitkeep` 不是 `.ts`）；Phase 2 執行者可 `mv src/_template src/health` 當第一 feature
- Option B：只寫 glob 不建 placeholder 目錄 — Biome 不抱怨空 glob（已 verify），但 P1 的 contract test（見 Validation Architecture §）需額外建立臨時違規檔驗證 rule 生效

*Planner 可二擇一；此 research 推薦 Option A，executor 負擔低且 Phase 2 可直接改名為 `health`。*

### Biome 2.x noRestrictedImports 語法（VERIFIED 2026-04-19）

Biome 2.x `overrides` 使用 **`includes`** 鍵（複數），Biome 2.x `noRestrictedImports` 規則放在 `linter.rules.style`，`options.paths` 每個 module 可 map 到 string（message）或 object（message + importNames）。

**`biome.json` 完整草稿：**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.12/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "includes": ["src/**", "tests/**"] },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "asNeeded" } },
  "overrides": [
    {
      "includes": ["src/**/domain/**"],
      "linter": {
        "rules": {
          "style": {
            "noRestrictedImports": {
              "level": "error",
              "options": {
                "paths": {
                  "drizzle-orm": "Domain layer cannot import 'drizzle-orm'. Reason: Domain must stay framework-free (see docs/decisions/0003-ddd-layering.md, docs/decisions/0009-rigidity-map.md D-01). Fix: Move Drizzle usage to src/{feature}/infrastructure/, use a Mapper (src/{feature}/infrastructure/mappers/) to convert rows to domain entities.",
                  "postgres": "Domain layer cannot import 'postgres'. Reason: Domain must stay framework-free (ADR 0003, ADR 0009 D-01). Fix: Use the 'postgres' client only in src/shared/infrastructure/db/client.ts or {feature}/infrastructure/.",
                  "elysia": "Domain layer cannot import 'elysia'. Reason: Domain entities and factories are framework-free (ADR 0003, ADR 0006). Fix: HTTP concerns belong in src/{feature}/presentation/; derive AuthContext via the requireAuth macro (ADR 0007) and pass it into domain factories as a value object.",
                  "better-auth": "Domain layer cannot import 'better-auth'. Reason: BetterAuth is an infrastructure concern behind an IIdentityService port (ADR 0004, ADR 0006). Fix: Use ports in src/auth/application/ports/ and implement in src/auth/infrastructure/.",
                  "@bogeychan/elysia-logger": "Domain layer cannot import logger adapters directly. Reason: Logger is a port (ILogger) injected via the shared kernel (ADR 0003). Fix: Depend on ILogger from src/shared/application/ports/, adapter lives in src/shared/infrastructure/logger/.",
                  "pino": "Domain layer cannot import 'pino' directly (same reason as @bogeychan/elysia-logger). Fix: Use ILogger port from src/shared/application/ports/."
                }
              }
            }
          }
        }
      }
    },
    {
      "includes": ["src/**/application/**"],
      "linter": {
        "rules": {
          "style": {
            "noRestrictedImports": {
              "level": "error",
              "options": {
                "paths": {
                  "drizzle-orm": "Application layer cannot import 'drizzle-orm'. Reason: Use cases talk to ports, not ORMs (ADR 0003). Fix: Define a Repository port in this feature's application/ports/ and let infrastructure/ implement it with Drizzle.",
                  "postgres": "Application layer cannot import 'postgres'. Reason: Use cases talk to ports, not DB clients (ADR 0003). Fix: Inject the port defined in application/ports/; the adapter in infrastructure/ may use 'postgres'."
                }
              }
            }
          }
        }
      }
    },
    {
      "includes": ["src/**/application/**", "src/**/presentation/**"],
      "linter": {
        "rules": {
          "style": {
            "noRestrictedImports": {
              "level": "error",
              "options": {
                "patterns": [
                  {
                    "group": ["**/domain/internal/**", "**/domain/internal"],
                    "message": "Cannot import from domain/internal/. Reason: Only the domain/index.ts barrel is a legal entry point (ADR 0003, D-11). Fix: Import from '{feature}/domain' (the barrel) and use getXxxService(ctx) factory, never instantiate classes directly."
                  }
                ]
              }
            }
          }
        }
      }
    }
  ]
}
```

**Rule design notes:**
- Three `overrides` blocks: (1) domain 禁 framework package、(2) application 禁 drizzle-orm / postgres、(3) application + presentation 禁 `domain/internal/**` 子路徑
- Each `message` 嚴守**四段格式（what + why + ADR link + 修法）**per D-12
- `patterns[].group` 語法用於 path glob（import from `'{feature}/domain/internal/something'`）；Biome 2.x `group` 接受 gitignore-style glob
- **P1 `application/**` 允許 import `elysia` / `better-auth`**（D-09 備註）— P3 若發現 use case 被 Elysia context 污染再補；此放寬須在 ADR 0009（Rigidity Map）之 Consequences 段明記

**Biome rule 驗證策略（negative test）：**
建立 `tests/biome-contract/{domain-violation.ts,application-violation.ts,internal-barrel-violation.ts}` 三個故意違規檔；CI workflow 跑 `bun run lint` 期望 fail、且錯誤訊息含 "Move Drizzle usage to" 等 token。詳見 Validation Architecture §。*注意：這些檔案故意違規、不會被 tsc 編譯；需在 `biome.json` `files.includes` 包含 `tests/biome-contract/**`，但 `tsconfig.json` `exclude` 列入這些路徑。*

## Shared Kernel 實作 Sketch

四件套檔位 + signature + test 策略。所有檔案 **zero framework import**（Verification: `grep -r "from 'elysia\|drizzle-orm\|better-auth\|postgres'" src/shared/kernel/` 須回 0 行）。

### `src/shared/kernel/result.ts`（D-05, < 100 LOC）

```typescript
// Result<T, E> — neverthrow-style, self-implemented, no dep.
// See ADR 0003 (DDD layering) — kernel stays framework-free.

export type Result<T, E> = Ok<T, E> | Err<T, E>

class Ok<T, E> {
  readonly _tag = 'Ok' as const
  constructor(readonly value: T) {}
  isOk(): this is Ok<T, E> { return true }
  isErr(): this is Err<T, E> { return false }
  map<U>(fn: (v: T) => U): Result<U, E> { return new Ok(fn(this.value)) }
  mapErr<F>(_: (e: E) => F): Result<T, F> { return this as unknown as Result<T, F> }
  andThen<U>(fn: (v: T) => Result<U, E>): Result<U, E> { return fn(this.value) }
  match<R>(handlers: { ok: (v: T) => R; err: (e: E) => R }): R { return handlers.ok(this.value) }
}

class Err<T, E> {
  readonly _tag = 'Err' as const
  constructor(readonly error: E) {}
  isOk(): this is Ok<T, E> { return false }
  isErr(): this is Err<T, E> { return true }
  map<U>(_: (v: T) => U): Result<U, E> { return this as unknown as Result<U, E> }
  mapErr<F>(fn: (e: E) => F): Result<T, F> { return new Err(fn(this.error)) }
  andThen<U>(_: (v: T) => Result<U, E>): Result<U, E> { return this as unknown as Result<U, E> }
  match<R>(handlers: { ok: (v: T) => R; err: (e: E) => R }): R { return handlers.err(this.error) }
}

export const ok = <T, E = never>(value: T): Result<T, E> => new Ok(value)
export const err = <T = never, E = unknown>(error: E): Result<T, E> => new Err(error)

// Type guards also exported for external narrowing
export const isOk = <T, E>(r: Result<T, E>): r is Ok<T, E> => r._tag === 'Ok'
export const isErr = <T, E>(r: Result<T, E>): r is Err<T, E> => r._tag === 'Err'
```

*API 名稱 decision：`Ok` / `Err` 被 TypeScript 禁當首字母大寫 class name 直接 call（`new Ok(...)` OK，`Ok(...)` 會被視為構造函數呼叫錯）。為了 factory function 呼叫（`Ok(value)`）體驗，**推薦 export lowercase `ok` / `err` 作為 factory**，class 保持 internal。CONTEXT.md 寫「`Ok(value)` / `Err(error)` factory」—— executor 可依偏好選「export `Ok = ok` alias」或「API 實為 lowercase」。Planner 可下 decision。*

**Tests（`tests/unit/shared/kernel/result.test.ts`）:**
- `ok(1).map(x => x + 1)` → `ok(2)`
- `err('boom').map(x => x + 1)` → `err('boom')`
- `ok(1).andThen(x => x > 0 ? ok(x * 2) : err('neg'))` → `ok(2)`
- `.match({ ok, err })` exhaustive dispatch
- `.isOk()` / `.isErr()` type narrowing 於 tsc `--noEmit` 通過（type-level test）

### `src/shared/kernel/brand.ts`（D-06）

```typescript
// Brand<T, K> — phantom property pattern, compile-time only, runtime zero-cost.

declare const __brand: unique symbol
export type Brand<T, K extends string> = T & { readonly [__brand]: K }

/**
 * Internal `as` cast helper. Callers should NOT use this directly; instead,
 * each feature should define its own typed constructor:
 *
 *   export const UserId = (v: string): UserId => brand<'UserId'>(v)
 *
 * (If runtime validation is needed — e.g. UUID format check — the feature's
 *  constructor does the check before calling brand().)
 */
export const brand = <K extends string>() => <T>(value: T): Brand<T, K> =>
  value as Brand<T, K>
```

**Tests（compile-time only）:**
- `type UserId = Brand<string, 'UserId'>` + `type OrderId = Brand<string, 'OrderId'>` → `const uid: UserId = 'abc' as UserId; const oid: OrderId = uid` 應 tsc fail（Brand 不可互換）
- Runtime `brand<'UserId'>()('abc')` 值 `'abc'` 保持、zero cost

### `src/shared/kernel/id.ts`（D-07）

```typescript
import { brand, type Brand } from './brand'

// Generic UUID Brand — features compose their own on top
export type UUID<K extends string> = Brand<string, K>

// Convenience: generate a new UUID v4 via Bun's native crypto.randomUUID
export const newUUID = <K extends string>(): UUID<K> => brand<K>()(crypto.randomUUID())

// Example for usage by features (not exported from kernel; shown for docs):
//
//   // in src/auth/domain/values/user-id.ts
//   export type UserId = UUID<'UserId'>
//   export const UserId = (v: string): UserId => brand<'UserId'>()(v)
//   export const newUserId = (): UserId => newUUID<'UserId'>()
```

*註：`crypto.randomUUID()` 是 Bun / Node 20+ 原生 WebCrypto API [CITED: Bun docs / MDN]，無 dep；匹配 D-07「crypto.randomUUID + Brand」。*

**Tests:**
- `newUUID<'Foo'>()` 回傳 36-char UUID v4（regex `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`）
- 兩次呼叫不同值（n=1000 collision check）

### `src/shared/kernel/errors.ts`（D-08）

```typescript
// DomainError hierarchy — framework-free, HTTP mapping via `httpStatus` field.
// Error handler plugin (Phase 2) reads err.httpStatus directly — no mapping table.

export abstract class DomainError extends Error {
  abstract readonly code: string
  abstract readonly httpStatus: number

  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = this.constructor.name
    // Preserve stack trace in V8 / Bun
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR'
  readonly httpStatus = 400
}

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED'
  readonly httpStatus = 401
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN'
  readonly httpStatus = 403
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND'
  readonly httpStatus = 404
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT'
  readonly httpStatus = 409
}
```

**Tests:**
- `new ValidationError('bad').httpStatus === 400`
- `new UnauthorizedError('x') instanceof DomainError === true`
- `.name === 'ValidationError'`（重要：全域 error handler 會讀 `err.constructor.name` 做 log）
- Cause preservation: `new ValidationError('msg', new TypeError('x')).cause instanceof TypeError`

### `src/shared/kernel/index.ts`（barrel）

```typescript
export * from './result'
export * from './brand'
export * from './id'
export * from './errors'
```

### Framework-free enforcement

- **Lint:** `biome.json` 已禁 `src/**/domain/**` / `src/**/application/**` import framework；`src/shared/kernel/**` 理論上在 `shared` 層，可從任層 import，但 kernel **自身** 也不該 import framework
- **Contract test（wave 0 ship）:**
  ```bash
  # tests/contract/shared-kernel-no-framework-imports.test.ts 等價檢查
  grep -rE "from ['\"](elysia|drizzle-orm|better-auth|postgres|pino|@bogeychan)" src/shared/kernel/ && exit 1 || exit 0
  ```
  此腳本在 CI run，失敗則 block merge。或用 `bun test` 寫 Node-level test 讀 `fs.readFileSync` 檢查同樣 pattern（TS 等價）。

## ADR Seed Content 摘要

12 條 ADR 的 Context / Decision / Consequences 初稿。所有 ADR 遵循 **MADR 4.0.0 "full" template**（含 YAML front matter、Decision Drivers、Considered Options、Decision Outcome、Consequences、Pros and Cons of the Options）[CITED: adr.github.io/madr 2026-04-19]。

### 0000-use-madr-for-adrs.md（自指）

**Context:** Rigging 需要紀律性決策紀錄，讓 AI Agent 與未來 maintainer 能讀懂每個技術選擇的 why 與 alternatives。Markdown 規範必須穩定、有工具支援、跨 LLM 讀取。

**Decision Drivers:** 工具成熟度、social proof、支援 Status lifecycle（proposed/accepted/superseded/deprecated）、檔名可排序、可嵌 YAML metadata。

**Considered:** MADR 4.0、Nygard 原版、E-ADR (embedded)、Notion/Confluence、ADR-only-in-commit-messages。

**Decision:** MADR 4.0.0（"full" variant）。檔名 `NNNN-kebab-case-title.md`，`NNNN` 四位 0-padding。`docs/decisions/README.md` 維護索引（欄位：編號 / 標題 / Status / 日期 / Supersedes，D-15）。

**Consequences:** （+）結構化、工具友善、可 supersede；（−）每次決策須手寫 YAML front matter（可 mitigate via template snippet）。

### 0001-runtime-bun.md

**Context:** TS backend 2026 年有 Node / Bun / Deno 三選。需要原生 TS、fast test runner、built-in `.env` / password hasher，減少 yak shaving。

**Decision:** Bun `^1.3.12`。

**Consequences:** （+）原生 TS、`Bun.password` argon2id、`bun:test`、Elysia native integration；（−）2-5% npm native module 不相容（Pitfall #14，避 `bcrypt`/`sharp`/`sqlite3` 有 mitigation）。

### 0002-web-framework-elysia.md

**Context:** Bun-native framework，需要 DI primitive 能承載 Runtime Guard（AuthContext 強制邊界）。

**Decision:** Elysia `^1.4.28`（**≥ 1.4 強制**；低版本 `.mount()` 吃 Set-Cookie、BetterAuth session 失效 [CITED: elysiajs.com/integrations/better-auth]）。

**Consequences:** （+）`.macro` + `.derive` + `.decorate` 完美落點給 AuthContext；（−）綁 Bun runtime；（−）scoped-plugin undefined cascade（elysia#1366，mitigate via 單一根層掛載 + scope 'global' + runtime assert）。

### 0003-ddd-layering.md

**Context:** AI Agent 寫的 code 需要「軌道」，避免把 DB type 洩漏到 domain、或 handler 直接 new domain class 繞過 AuthContext。

**Decision:** `src/{feature}/{domain,application,infrastructure,presentation}/` 四層，vertical slice × horizontal layering。`src/shared/` 放 cross-cutting：`kernel/`（framework-free 基底）/ `application/ports/` / `infrastructure/` / `presentation/`。Biome `noRestrictedImports` override 於 `src/**/domain/**` 禁 framework package、於 `src/**/application/**` 禁 drizzle-orm/postgres；于 `src/**/application/**` 與 `src/**/presentation/**` 禁從 `domain/internal/**` import。

**Consequences:** （+）每 feature 檔案隔離、ORM swap 可能；（−）新 feature 要碰 6 個檔（Pitfall #11 有 mitigate via Phase 4 dogfood）；（+）lint rule 違規立即 CI fail。

### 0004-auth-betterauth.md

**Context:** auth lib 2026 選：Lucia（進 maintenance）/ NextAuth/Auth.js（Next 中心）/ BetterAuth（framework-agnostic、TS-first）。

**Decision:** BetterAuth `1.6.5`（**exact pin，無 caret**）+ `@better-auth/drizzle-adapter@1.6.5`。

**Decision Drivers:** CVE-2025-61928 類 bug 歷史需 exact pin；auto-upgrade 風險高於延後修補收益。

**Consequences:** （+）Elysia-compatible via `.mount(auth.handler)`；（−）fast-moving early-version（必須訂閱 GHSA、建立 advisory 響應流程）；（+）API Key plugin 內建，agent track 不需自 re-implement。

### 0005-orm-drizzle.md

**Context:** TS ORM 2026 選：Prisma（重、migration workflow 獨立）/ Drizzle（schema-as-TS、輕、TS 深整合）/ Kysely（純 query builder、無 migration）。

**Decision:** Drizzle `^0.45.2`（**NOT 1.0-beta.x**）+ `drizzle-kit ^0.31.10`。

**Consequences:** （+）深度 TS inference、relational query、migration generate；（−）1.0-beta 仍 churn，`latest` flip 前不自動升級；watch tag，升級時寫 migration ADR。

### 0006-authcontext-boundary.md

**Context:** Rigging Core Value：任何 Domain 操作必須通過 AuthContext；handler 無法繞過邊界直接 new domain service。

**Decision:** `AuthContext` 作為 value object 定義於 `src/auth/domain/auth-context.ts`（P3 實作）；Domain service 只透過 factory `getXxxService(ctx: AuthContext)` 取得，class 永不 export；barrel 限制於 `domain/index.ts`。Elysia `.macro({ requireAuth: { resolve } })` 是**唯一**產生 AuthContext 的路徑。

**Consequences:** （+）Core Value 物理化；（−）handler 需宣告 `requireAuth: true`（trade：忘了 → handler 取不到 ctx → tsc type error，可接受）；（+）可配 ADR 0007 + 0009 收斂違規 detection。

### 0007-runtime-guards-via-di.md

**Context:** TS type narrowing 不可信（Elysia scoped-plugin undefined cascade，elysia#1366）；純型別不足。

**Decision:** Runtime assertion：`getXxxService(ctx)` factory 頭一行 `if (!ctx?.userId) throw new AuthContextMissingError(...)`。不信 TS narrowing。

**Consequences:** （+）Elysia 版本 churn 也不漏；（−）多一行 boilerplate per factory；（+）integration test 可在「不掛 auth plugin」場景下斷言全 protected route 401。

### 0008-dual-auth-session-and-apikey.md

**Context:** Rigging 定位 AI Agent 一等公民，human 用 cookie、agent 用 API Key。不能讓 Domain 看到兩種身分模型。

**Decision:** 單一 `AuthContext` type；resolver 依序 `x-api-key` header → cookie session；兩條路徑產同型別。

**Consequences:** （+）Domain 只知 `identityKind: 'human' | 'agent'`，不知背後是 cookie 或 key；（−）resolver precedence 必明定（見 ADR 0011）。

### 0009-rigidity-map.md

**Context:** Opinionated framework 失敗模式為「rigid in wrong places / flexible in wrong places」（Rails Doctrine critique）。Rigging 需明示三級嚴格度讓 AI Agent / human 有依據。

**Decision Drivers:** 避免 Pitfall #10、讓 violation detection 對準核心、提供 ADR 逃生口給 non-critical 決定。

**Decision:** 三級：
- **必嚴格（無逃生口）**：AuthContext 強制邊界 / Domain 禁 framework import / 核心版本 pin（Bun/Elysia/BetterAuth/Drizzle/postgres）
- **可 ADR 逃生**：validator 選擇、driver 切換、logger 格式、migration 策略、resolver precedence
- **純約定**：變數命名、error code naming、log field naming、git commit format、branch naming

Detection：CI（biome + tsc + bun test）+ runtime assertion（getXxxService factory）。**不設 pre-commit hook**（D-04 尊重開發節奏）。

**Consequences:** （+）決策有參照 scale；（−）三級線在未來 phase 可能需 supersede（0009a），此處保留 supersede 欄位。P1 application 層允許 import elysia/better-auth — 明記為「放寬決策」，P3 若 dogfood 發現需收緊則寫 0009a。

### 0010-postgres-driver-postgres-js.md

**Context:** Drizzle 支援 `bun-sql` 與 `postgres-js` 兩種 driver。`bun:sql` 是 Bun 原生 native module、理論上更快。

**Decision Drivers:** bun#21934（transaction hang on constraint violation）、bun#22395（23P01 exclusion constraint driver 卡住）、bun#17178（connection loss after timeout）、bun#23215（connection leak）均 **open as of 2026-04-18**。這些是 production-hang 級 bug。

**Considered:** `drizzle-orm/bun-sql` / `drizzle-orm/postgres-js` + porsager/postgres / `drizzle-orm/node-postgres` + pg。

**Decision:** **`drizzle-orm/postgres-js` + `postgres@^3.4.9`**。`bun:sql` 絕不在 v1 使用。

**Revisit 條件（硬性）:**
- bun#21934 **AND** bun#22395 同時關閉（close 或 fix tag 出現在 release note）
- 於當時寫 `0010a-postgres-driver-revisit.md` Supersedes 本 ADR

**Consequences:** （+）避開 production hang；（−）略慢於 `bun:sql`（benchmark：社群報告 5-10%；接受）；（+）`postgres.js` battle-tested、transaction 錯誤傳播正確。

### 0011-resolver-precedence-apikey-over-cookie.md

**Context:** 當 request 同時帶 `x-api-key` header 與 session cookie，AuthContext 應從哪個來源產生？兩種可能：
- (a) API Key 優先（本案預設）
- (b) Cookie 優先
- (c) 同時 present 則 reject 401

**Decision Drivers:**
- Agent 通常沒 cookie（純 header request）；human 通常沒 API Key（純 browser session）
- 同時帶通常是 human 在 dev tool 測 agent endpoint；語意「我想當 agent」比「我忘了清 cookie」更常見
- Resolver 必須明定 precedence，避免「依 order 巧合決定身分」

**Considered:** (a) API Key 優先 / (b) Cookie 優先 / (c) 同時 present 則 401。

**Decision:** **API Key 優先**（(a)）。Resolver 邏輯：若 header `x-api-key` 存在且驗 OK → AuthContext(agent)；否則若 cookie 存在且驗 OK → AuthContext(human)；否則 401。

**Status：accepted（P1 即 lock）。**

**P3 Spike 驗證計畫（必寫入本 ADR "Decision Drivers" 段）：**
P3 在實作 resolver 時執行 30-min spike：
- 模擬 browser dev tool 同時帶 cookie + API Key → 確認行為符合 'agent' 語意
- 模擬 Agent CLI 帶 API Key → 確認 cookie 空也能通過
- 模擬誤用 human cookie 配錯 API Key → 確認拒絕（401），而非降級為 cookie path
若 spike 發現 (a) 不符預期，寫 `0011a-*.md` Supersedes 本 ADR；不回改本 ADR 的 Decision Outcome 段。

**Consequences:** （+）Agent-first 語意；（+）P3 spike 有具體 falsification test；（−）human 測 agent endpoint 需清 cookie 或用 incognito（可接受的 dev 摩擦）。

### docs/decisions/README.md 索引範例

```markdown
# Architecture Decision Records

See `0000-use-madr-for-adrs.md` for the MADR 4.0 template and workflow.

## Index

| # | Title | Status | Date | Supersedes |
|---|-------|--------|------|------------|
| [0000](0000-use-madr-for-adrs.md) | Use MADR 4.0 for ADRs | accepted | 2026-04-19 | — |
| [0001](0001-runtime-bun.md) | Runtime: Bun 1.3.12 | accepted | 2026-04-19 | — |
| [0002](0002-web-framework-elysia.md) | Web framework: Elysia 1.4.28 | accepted | 2026-04-19 | — |
| [0003](0003-ddd-layering.md) | DDD four-layer structure | accepted | 2026-04-19 | — |
| [0004](0004-auth-betterauth.md) | Auth: BetterAuth 1.6.5 (exact pin) | accepted | 2026-04-19 | — |
| [0005](0005-orm-drizzle.md) | ORM: Drizzle 0.45.2 (NOT 1.0-beta) | accepted | 2026-04-19 | — |
| [0006](0006-authcontext-boundary.md) | AuthContext as mandatory domain boundary | accepted | 2026-04-19 | — |
| [0007](0007-runtime-guards-via-di.md) | Runtime guards via DI (Elysia .macro) | accepted | 2026-04-19 | — |
| [0008](0008-dual-auth-session-and-apikey.md) | Dual auth: session (human) + API Key (agent) | accepted | 2026-04-19 | — |
| [0009](0009-rigidity-map.md) | Rigidity Map: three-tier strictness | accepted | 2026-04-19 | — |
| [0010](0010-postgres-driver-postgres-js.md) | Postgres driver: postgres-js (NOT bun:sql) | accepted | 2026-04-19 | — |
| [0011](0011-resolver-precedence-apikey-over-cookie.md) | Resolver precedence: API Key over cookie | accepted | 2026-04-19 | — |

## Workflow

1. Propose an ADR via PR — `Status: proposed`.
2. PR review discussion becomes the record.
3. Merge flips status to `accepted`. Never edit an accepted ADR's Decision Outcome section.
4. If the decision changes, write a NEW ADR that `Supersedes: NNNN`; update old ADR's Status to `superseded-by: <new>`.
5. PR checklist (`.github/PULL_REQUEST_TEMPLATE.md`) forces the "does this need an ADR?" question.
```

## AGENTS.md Rigidity Map 段落 draft

與 GSD auto-managed 區塊共存，使用獨立 `<!-- RIGGING:rigidity-map-* -->` 標記。**推薦落點：`<!-- GSD:workflow-end -->` 之後、`<!-- GSD:profile-start -->` 之前。**

```markdown
<!-- RIGGING:rigidity-map-start source:docs/decisions/0009-rigidity-map.md -->
## Rigging Rigidity Map (AI Agent: read this first)

Rigging enforces a three-tier strictness model. Know the tier before proposing changes.

### Tier 1 — Must Be Rigid (NO escape hatch, NO exceptions)

1. **AuthContext is the only path to any Domain service**
   - No `new UserServiceImpl(...)` from outside the factory barrel.
   - `getXxxService(ctx: AuthContext)` factory is the only legal entry point.
   - Runtime guard throws `AuthContextMissingError` on null ctx (ADR 0006, 0007).

2. **Domain layer is framework-free**
   - `src/**/domain/**` MUST NOT import `drizzle-orm`, `elysia`, `better-auth`, `postgres`, `@bogeychan/elysia-logger`, `pino`.
   - Enforced by Biome `noRestrictedImports` (biome.json overrides).
   - Violation = CI fail, no review bypass.

3. **Core stack versions are pinned**
   - `bun@^1.3.12`, `elysia@^1.4.28`, `better-auth@1.6.5` (exact), `drizzle-orm@^0.45.2`, `postgres@^3.4.9`.
   - Upgrade requires a new ADR with `Supersedes:` referencing 0001/0002/0004/0005/0010.

### Tier 2 — Default Rigid, Escapable via ADR

Changes below are allowed — but require a new ADR that supersedes the relevant record:

- **Validator choice** (TypeBox vs Zod) — currently TypeBox (ADR deferred; see STACK.md).
- **Postgres driver** — currently `postgres-js` (ADR 0010); revisit only when bun#21934 AND bun#22395 close.
- **Logger format / library** — currently Pino via `@bogeychan/elysia-logger` (ADR deferred).
- **Migration strategy** — currently `drizzle-kit generate` + `migrate` (ADR deferred); `push` local-only.
- **Resolver precedence** — currently API Key > cookie (ADR 0011); supersede to change.

### Tier 3 — Convention Only (no automated check)

Consistent-but-not-enforced. AI Agent should follow existing patterns, but no CI gate:

- Variable naming (camelCase for functions/vars, PascalCase for types/classes).
- Error code naming (SCREAMING_SNAKE_CASE).
- Log field naming (camelCase).
- Git commit format (follows repo history).
- Branch naming (follows repo history).

### Detection (where violations are caught)

- **CI (biome + tsc + bun test)** — Tier 1 rules 1 & 2; Tier 2 migration drift.
- **Runtime (`getXxxService` factory)** — Tier 1 rule 1 (AuthContextMissingError).
- **No pre-commit hook** — by design (ADR 0009, D-04). Keeps dev loop fast; CI is the authoritative gate.
<!-- RIGGING:rigidity-map-end -->

<!-- RIGGING:anti-features-start source:.planning/PROJECT.md -->
## Anti-Features (DO NOT propose extending)

AI Agent: if a user (or you) wants to add any of these, STOP. Rigging v1 explicitly excludes them. See `.planning/PROJECT.md` "Out of Scope" for full reasoning.

- **Frontend UI (React/Vue/SvelteKit/any client app)** — v1 is API-first. UI is delegated to downstream consumers.
- **`npx rigging` / `create-rigging` CLI generator** — v1 is Reference App; scaffold extraction is v2 (SCAF-01).
- **Real email providers (Resend/SMTP)** — v1 ships `ConsoleEmailAdapter` (logs to stdout). Swap adapter in v2 PROD-01.
- **OAuth / SSO / 2FA / Magic Link / Passkeys** — each new identity path is another resolver branch; violates "one rail" thesis. v2 IDN-*.
- **MCP server / A2A (Agent-to-Agent) / Multi-agent orchestration** — Rigging is "where agents write code", not "where agents run". v2 AGT-*.
- **OpenTelemetry / distributed tracing / Prometheus metrics** — v1 is community-grade (structured logs only). v2 PROD-03.
- **Multi-tenancy / Organization / RBAC** — next abstraction layer; v1 nails single-user AuthContext boundary. v2 TEN-*.
- **NPM package publishing (`@rigging/core` etc.)** — API still evolving. v2 SCAF-03.
- **WebSocket / SSE / real-time events** — domain feature addition, not harness core.
- **GraphQL API** — REST + Swagger demonstrates harness; GraphQL is presentation swap.
- **Docker image publishing (Hub / ghcr.io)** — v1 supplies compose for dev; prod deploy is user's choice.
- **Production-grade migration tooling (zero-downtime)** — left to deployment team.

If a user asks to add any of the above, respond with:
"That's a v2 feature (see `.planning/PROJECT.md` Out of Scope). v1 scope is locked; adding it requires a PROJECT.md amendment with reasoning for why now."
<!-- RIGGING:anti-features-end -->
```

**段落內容要點：**
- 每條 Tier 1 rule 都有 ADR link
- Tier 2 說明 ADR 逃生口語法（必須 supersede）
- Tier 3 純列舉，不含 "enforce" 字眼
- Detection 段對應 D-04
- Anti-Features 段 cross-reference `.planning/PROJECT.md`，AI Agent 回應 template 讓 Agent 知道如何禮貌拒絕

## docker-compose + env schema

### `docker-compose.yml` 草稿（FND-03）

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: rigging-postgres
    environment:
      POSTGRES_USER: rigging
      POSTGRES_PASSWORD: rigging_dev_password
      POSTGRES_DB: rigging
    ports:
      - '5432:5432'
    volumes:
      - rigging-pg-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U rigging -d rigging']
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s
    restart: unless-stopped

  # Optional: Adminer for quick DB browsing (commented out; enable if desired)
  # adminer:
  #   image: adminer:latest
  #   container_name: rigging-adminer
  #   ports:
  #     - '8080:8080'
  #   depends_on:
  #     postgres:
  #       condition: service_healthy

volumes:
  rigging-pg-data:
    driver: local
```

**選擇理由：**
- `postgres:16-alpine` — STACK.md 鎖定版本（避免 17/18 bleeding edge）
- `healthcheck` — 確保 `docker-compose up -d` 後 process 可立即 connect；FND-03 10 分鐘跑起來的承諾
- Named volume `rigging-pg-data` — 重啟保留資料，避免每次 reset
- Adminer 預留 optional（D-* discretion 允許）
- Port 5432 直接 expose（不擔心 dev box）；production 不會用這個 compose

### `.env.example` 草稿（FND-02）

```bash
# Database
DATABASE_URL=postgresql://rigging:rigging_dev_password@localhost:5432/rigging

# BetterAuth (Phase 3 才需要；P1 欄位就位)
BETTER_AUTH_SECRET=change-me-to-32-byte-random-hex-before-committing
BETTER_AUTH_URL=http://localhost:3000

# HTTP
PORT=3000

# Runtime
NODE_ENV=development
LOG_LEVEL=debug
```

### `src/bootstrap/config.ts` 草稿（FND-02, TypeBox schema）

```typescript
import { Type, type Static } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

// Startup env schema — fail fast if any required var missing/malformed.
// TypeBox is the single validator (Elysia peerDep; no Zod layered on top).
// See ADR 0003 (DDD) — config lives in bootstrap/, not in any feature.

const ConfigSchema = Type.Object({
  DATABASE_URL: Type.String({ pattern: '^postgresql://.+' }),
  BETTER_AUTH_SECRET: Type.String({ minLength: 32 }),
  BETTER_AUTH_URL: Type.String({ format: 'uri' }),
  PORT: Type.Integer({ minimum: 1, maximum: 65535 }),
  NODE_ENV: Type.Union([Type.Literal('development'), Type.Literal('production'), Type.Literal('test')]),
  LOG_LEVEL: Type.Union([
    Type.Literal('debug'),
    Type.Literal('info'),
    Type.Literal('warn'),
    Type.Literal('error'),
  ]),
})

export type Config = Static<typeof ConfigSchema>

// Bun auto-loads .env / .env.local / .env.development etc. — process.env is populated.
const rawEnv = {
  ...process.env,
  PORT: process.env.PORT ? Number(process.env.PORT) : undefined,
}

export function loadConfig(): Config {
  const errors = [...Value.Errors(ConfigSchema, rawEnv)]
  if (errors.length > 0) {
    const summary = errors
      .map((e) => `  - ${e.path}: ${e.message} (got: ${JSON.stringify(e.value)})`)
      .join('\n')
    throw new Error(
      `Invalid environment variables. See .env.example for required fields.\n${summary}`,
    )
  }
  return Value.Decode(ConfigSchema, rawEnv)
}

// Export a lazy-loaded singleton. Callers import `config` after bootstrap.
// In P1 we do not yet consume config; this exists for FND-02 validation-on-startup.
```

**Notes:**
- TypeBox + `Value.Errors` + `Value.Decode` 是 compile-safe runtime validation
- `Bun auto-loads .env*`（不用 dotenv，STACK.md 明記）
- `loadConfig()` 在 `src/main.ts` P1 stub 立即 call，缺值立即 crash
- Schema 欄位對齊 `.env.example`；欄位變動 = 兩檔同步改

### `drizzle.config.ts` 草稿（FND-04）

```typescript
import { defineConfig } from 'drizzle-kit'

// Per ADR 0010: use postgres-js driver explicitly; NOT bun:sql.
// Schema glob: feature slices own their schema in {feature}/infrastructure/schema/
// Phase 1 does not ship schema files — this config is ready for Phase 2/3.

export default defineConfig({
  dialect: 'postgresql',
  driver: 'pglite',  // ⚠️ drizzle-kit CLI driver; runtime driver for the app is 'postgres-js'.
                     //  'pglite' is wrong here — per drizzle-kit docs, pass nothing or use the
                     //  pg connection via dbCredentials. Researcher note: leave `driver` out;
                     //  runtime app driver choice is in src/shared/infrastructure/db/client.ts.
  schema: './src/**/infrastructure/schema/*.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  verbose: true,
  strict: true,
})
```

**⚠️ Important clarification (confidence MEDIUM, planner/executor verify):**

Drizzle Kit 的 `driver` 欄位與**運行時**（app runtime）的 driver 選擇是兩回事。`drizzle.config.ts` 的 `driver` 欄位用於 Drizzle Kit CLI 操作 DB；**app runtime driver** 在 `src/shared/infrastructure/db/client.ts` 裡 import `drizzle-orm/postgres-js` 指定。

```typescript
// src/shared/infrastructure/db/client.ts  (Phase 2 會實作；P1 不 ship)
// Per ADR 0010: postgres-js driver, NOT bun:sql.
// import { drizzle } from 'drizzle-orm/postgres-js'
// import postgres from 'postgres'
// const client = postgres(config.DATABASE_URL, { max: 10 })
// export const db = drizzle(client)
```

**P1 ship 的 `drizzle.config.ts` 只需讓 `drizzle-kit generate` 跑得動；Phase 2 才 ship `client.ts`。Planner 在 wave 0 需 `bunx drizzle-kit --help` 驗證正確 `driver` 值或是否省略該欄位。** 本 research 無法 100% 確定 `driver` 欄位在 drizzle-kit 0.31.10 的正確值——可能是 `'pg'`、可能省略改用 `dbCredentials.url` 自動判斷。Planner 必須 spike 5 分鐘確認。

**[ASSUMED] drizzle-kit 0.31.10 的 `driver` 設定 — 需 wave 0 `bunx drizzle-kit --help` 或 docs 驗證。**

## CI + Runtime Guard 策略

P1 無 auth plugin、無 feature endpoint，「不掛 auth plugin 則全 protected route 401」這種 integration test 沒 route 可測。**P1 的驗證策略退化為：**

### A. 靜態檢查（primary gate）

1. **`bun run lint` → `biome check .`** — D-09 rule 的 happy path（recommended + overrides 皆過）
2. **`bun run typecheck` → `tsc --noEmit`** — 全 repo 型別檢查過
3. **`bun test` → `bun:test`** — shared kernel unit tests + Biome contract tests（見 D 段）

### B. Biome rule contract tests（「不規則寫法根本跑不起來」之骨架驗證）

Biome rule 在 P1 雖未針對真正 feature 生效（P1 無 feature），但 rule 結構需驗證「若寫違規寫法會 fail」。三種做法，**推薦 B3**：

- **B1 (Reject)**：Phase 1 無違規來源、B 略過。缺點：Phase 2 才發現 rule 壞了（如 glob 寫錯）。
- **B2**：用 shell script grep 每個 override 的 paths 配對每個 restricted module name 以 `echo ... | biome check --stdin-file-path=...` 輸入一行違規程式碼、期望 fail。缺點：脆弱。
- **B3 (推薦)**：建 `tests/biome-contract/` 資料夾，裡面有三個故意違規的檔案：

  ```typescript
  // tests/biome-contract/domain-drizzle-violation.ts
  // @ts-nocheck — this file intentionally violates the Biome rule for contract testing.
  // It lives under tests/biome-contract/ but Biome is configured to lint it via
  // includes pattern. tsconfig.json excludes this path.
  // Expected: `biome check tests/biome-contract/domain-drizzle-violation.ts` exits non-zero.
  import { drizzle } from 'drizzle-orm'
  export const x = drizzle
  ```

  然後 `.github/workflows/biome-contract.yml` 或 `bun:test` 腳本：
  ```ts
  import { test, expect } from 'bun:test'
  import { spawnSync } from 'bun'

  test('biome rule blocks drizzle-orm import in domain', () => {
    const result = spawnSync(['bun', 'run', 'lint', 'tests/biome-contract/domain-drizzle-violation.ts'])
    expect(result.exitCode).not.toBe(0)
    const out = new TextDecoder().decode(result.stdout)
    expect(out).toContain('Move Drizzle usage to src/{feature}/infrastructure/')
  })
  ```
  **這個檔案路徑必須被 Biome 的 `overrides[].includes: ["src/**/domain/**"]` 或類似 glob 匹配。** 實作上，為了讓 contract test 檔案匹配 override，可用專屬 `tests/biome-contract/__domain__/...` 或在 biome.json 加 contract-only override。**Planner 可選：**
  - Option α：`tests/biome-contract/domain/drizzle-violation.ts` + `biome.json` 在 overrides 添加 `includes: ["tests/biome-contract/domain/**"]` 共享同 rule set
  - Option β：保留 `src/_template/domain/` placeholder 同時做 Biome rule 測試床 — 但 `_template/` 會被 production build 排除

### C. Placeholder integration test（D-04 「不掛 auth plugin」檢測落點的 P1 stub）

P1 無 Elysia app、無 route。D-04 的「不掛 auth plugin 則 protected route 401」test 真正會在 Phase 3 實作（AUX-06）。**P1 可選 ship stub：**

```ts
// tests/integration/auth-bypass-contract.test.ts
import { test, expect } from 'bun:test'

// Phase 3 will replace this stub with the real test (AUX-06).
// P1 ships the file so the test ID is claimed; the stub asserts a documented TODO.
test.skip('[AUX-06, Phase 3] app without auth plugin returns 401 on protected routes', () => {
  // When Phase 3 lands AuthContext plugin:
  //  1. Bootstrap app WITHOUT .use(authContextPlugin)
  //  2. Call every protected route (those with { requireAuth: true })
  //  3. Expect all to return 401 (not 500, not stale data)
  // Reference: AGENTS.md Rigidity Map Tier 1 rule 1; ADR 0006, 0007.
  expect(true).toBe(true)
})
```

*註：planner 可選「不 ship stub」，讓此 test 在 Phase 3 首次出現。推薦 ship stub 讓 ID AUX-06 有占位、Phase 3 執行者知道要找這檔修改。*

### D. CI workflow `.github/workflows/ci.yml`（P1 最小版，Phase 5 會擴充）

```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.12
      - run: bun install --frozen-lockfile
      - run: bun run lint      # biome check .
      - run: bun run typecheck # tsc --noEmit
      - run: bun run test      # bun test

  adr-check:
    # D-16: 若 PR body 勾「需 ADR」則 docs/decisions/ 必有新檔
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - id: adr-required
        run: |
          body="${{ github.event.pull_request.body }}"
          if echo "$body" | grep -qE '\- \[x\] .* (需要|required).*ADR'; then
            echo "required=true" >> $GITHUB_OUTPUT
          else
            echo "required=false" >> $GITHUB_OUTPUT
          fi
      - if: steps.adr-required.outputs.required == 'true'
        run: |
          added=$(git diff --name-only --diff-filter=A origin/${{ github.base_ref }}...HEAD -- 'docs/decisions/*.md' | wc -l)
          if [ "$added" -eq 0 ]; then
            echo "::error::PR marked as requiring an ADR but no new docs/decisions/*.md added."
            exit 1
          fi
```

### Runtime guards（P1 只驗 shared kernel）

P1 唯一的 runtime code 是 `src/bootstrap/config.ts`：
- 無效 env → throw → process exit non-zero：此為「runtime guard」fail-fast 模板
- Shared kernel 本身無 runtime guard（純資料結構）

Phase 3 的 runtime guard（Domain factory 檢 AuthContext）在 P1 僅存在於 `AGENTS.md` + ADR 0007，不 ship code。

## Runtime State Inventory

*Phase 1 是 greenfield 骨架 phase，無既有執行中服務 / 資料 / OS 註冊。此節為完整性保留，各類均為「None」。*

| Category | Items Found | Action Required |
|----------|-------------|-------------------|
| Stored data | **None** — greenfield repo（無 DB 資料、無 Mem0 記憶、無 ChromaDB collection） | 無 |
| Live service config | **None** — P1 無部署、無 n8n workflow、無 Datadog service、無 Tailscale ACL | 無 |
| OS-registered state | **None** — P1 無 systemd unit、無 Windows Task、無 pm2 process | 無 |
| Secrets/env vars | **`.env.example` 首次建立**；無既存 `.env.local`（需 developer 自建） | Developer 自 `.env.example` → `.env.local` 並生成 `BETTER_AUTH_SECRET`（`openssl rand -hex 32` 或 `bun eval 'crypto.randomUUID()'`） |
| Build artifacts | **None** — 無 `node_modules`、無 `dist/`、無 `.bun/` cache | 首次 `bun install` 後正常產生 |

**Nothing found in any stored state — verified by**: `ls -la /Users/carl/Dev/CMG/Rigging/` 只有 `.git/` / `.planning/` / `AGENTS.md`。

## Environment Availability

P1 的外部依賴最少：Bun runtime、Docker（for Postgres）、git。**Planner 在 wave 0 應對 executor 的 dev 機確認以下可用性：**

| Dependency | Required By | Version Req | Probe Command | Fallback |
|------------|-------------|-------------|---------------|----------|
| Bun | everything | `^1.3.12` | `bun --version` | **No fallback**（D-01 locked）。若版本太舊 → `curl -fsSL https://bun.sh/install \| bash` |
| Docker + docker-compose | FND-03（Postgres） | Docker 20+ / compose v2 | `docker --version && docker compose version` | 若無 Docker：讓 dev 自己裝 local Postgres 16（文件提供 Homebrew / apt 替代指令）；**P1 不 block** |
| git | version control | 2.20+ | `git --version` | 無 |
| Postgres client（optional）| debug | `psql` 15+ | `psql --version` | Adminer via docker-compose 替代 |
| Node（NOT needed）| — | — | — | — |

**Probe protocol（executor wave 0 開跑前）：**

```bash
# Minimum viable
bun --version    # must match ^1.3.12; ADR 0001 locks
docker --version # 20.x+
docker compose version  # v2+
git --version    # any modern

# Nice-to-have
psql --version   # for manual DB inspection
```

**Missing dependencies with no fallback:**
- Bun < 1.3.12 → 必裝，無 workaround（整個 stack 假設 Bun runtime）

**Missing dependencies with fallback:**
- Docker 缺 → planner 可在 `docs/quickstart.md` 提供 local Postgres install 指令；`docker-compose up` 非 P1 成功關鍵（`drizzle-kit generate` 在 P3 才會 connect）
- `psql` 缺 → 用 Adminer 或 Drizzle Studio（Phase 3+）

## Common Pitfalls

### Pitfall 1: Biome overrides 的 `includes` 寫成 `include`

**What goes wrong:** Biome 2.x `overrides` 欄位是 `includes`（複數、s），常見誤寫 `include`（單數）或 `files`（這是 ESLint 語法）。結果：override 完全不生效、全 repo 都用 root rule，domain 能 import drizzle-orm 也不報錯。
**Why it happens:** ESLint 用 `files`，Prettier 用 `files`，tsconfig 用 `include`；複數 s 易忽略。
**How to avoid:** Biome 官方 docs 明示 `includes`（已 VERIFIED 2026-04-19）。在 P1 biome contract test（策略 B3）驗證 rule 真實 blocking 違規檔，而非相信 json 語法。
**Warning signs:** `biome check tests/biome-contract/domain-drizzle-violation.ts` 退出碼 0（應為非 0）。

### Pitfall 2: TypeBox env schema 對 `process.env.PORT` 的 coerce 問題

**What goes wrong:** `process.env.PORT` 永遠是 string（或 undefined）；TypeBox `Type.Integer()` 直接 validate 會 fail 因 `'3000' !== 3000`。
**Why it happens:** Node/Bun env var 均 string；沒人在意直到 schema 失敗。
**How to avoid:** 在 validate 前手動 coerce：`{ ...process.env, PORT: process.env.PORT ? Number(process.env.PORT) : undefined }`（已在 config.ts 草稿處理）。或用 TypeBox `Type.Transform` 在 schema 內做 coercion。
**Warning signs:** `bun run dev` fail 帶「Expected integer, got string」。

### Pitfall 3: ADR YAML front matter 格式不一致 → 索引生成工具破

**What goes wrong:** 若未來用 `adr-log` CLI 生成 README 索引，YAML front matter 不統一（有的寫 `status: accepted`、有的寫 `Status: Accepted`）會讓工具 parse 失敗。
**How to avoid:** `0000-use-madr-for-adrs.md` 裡明定「status 欄位小寫（proposed | accepted | superseded-by: NNNN | deprecated）」；12 條 seed ADR 統一。
**Warning signs:** 索引 README.md 某欄位顯示 undefined / empty。

### Pitfall 4: `drizzle.config.ts` 的 `driver` 欄位值

**What goes wrong:** drizzle-kit 0.31.x 的 `driver` 配置對某 dialect 是 optional（可省略讓它從 `dbCredentials.url` 自動判斷），對某是 required。若寫錯 driver 名 → `bunx drizzle-kit generate` 直接 throw；若漏寫 → migration 跑得動但 introspection 可能壞。
**[ASSUMED] — wave 0 必須 spike。**
**How to avoid:** wave 0 跑 `bunx drizzle-kit generate --help` 看 supported driver values；若不確定就省略 `driver` 欄位，保留 `dialect: 'postgresql'` + `dbCredentials.url`。Phase 3 migration 執行前必試跑 `drizzle-kit generate --name=smoke-test`。
**Warning signs:** drizzle-kit CLI 報 "Invalid driver" 或 "driver is required for dialect 'postgresql'".

### Pitfall 5: P1 寫 Biome rule 但無違規檔測試 → rule 寫錯沒人發現

**What goes wrong:** `overrides[].includes` glob 打錯（例如 `"src/domain/**"` 漏了中間 `**`），P1 無違規源碼所以 biome check 全過，Phase 2 加第一 feature 時違規照過、Phase 3 auth domain 違規亦照過——直到某 reviewer 手動讀 JSON 才發現。
**How to avoid:** 策略 B3（contract tests）強制 P1 ship 三個故意違規檔 + assert `biome check` 非 0 + error message 含四段格式關鍵詞。
**Warning signs:** Phase 2 新 feature 的 domain/ 有 drizzle-orm import 仍 CI 過。

### Pitfall 6: Shared kernel 被誤加 framework import

**What goes wrong:** 未來 executor 為了方便加 `import { t } from 'elysia'` 到 `src/shared/kernel/id.ts`（為 TypeBox schema），直接破壞 kernel 的 framework-free 保證。Biome rule 目前 **未覆蓋 `src/shared/kernel/`**（overrides 只含 `src/**/domain/**` 和 `src/**/application/**`）。
**How to avoid:** 加第四條 override：`includes: ["src/shared/kernel/**"]` 同 domain 禁 framework package 清單。或用 wave 0 contract test `grep -rE "from '(elysia|drizzle-orm|better-auth|postgres)'" src/shared/kernel/` 非 0。
**Warning signs:** `src/shared/kernel/` 有 `import { ... } from 'elysia'` 或其他 framework 字樣。
**Recommendation:** planner 選加入 `src/shared/kernel/**` 到 framework-forbidden override list。

### Pitfall 7: AGENTS.md 的 `<!-- RIGGING:* -->` 標記被 GSD 工具覆蓋

**What goes wrong:** GSD 工具只保護 `<!-- GSD:* -->` 自管理區塊。若未來 GSD 全量重寫 AGENTS.md（如 `/gsd-regenerate-agents-md`），RIGGING 區塊可能被覆蓋。
**How to avoid:** 在 AGENTS.md 最上方（GSD 第一區塊之前）加一行備註 `<!-- CAUTION: RIGGING:* sections are Rigging-owned; do not regenerate this file in full. Use /gsd-edit-region. -->`；或將 Rigidity Map 內容**同時**留在 `docs/decisions/0009-rigidity-map.md`（canonical source），AGENTS.md 只 embed via 簡短 summary。
**Warning signs:** AGENTS.md 重跑 GSD 命令後 RIGGING:rigidity-map-* 段消失。

### Pitfall 8: `.env.example` 與 TypeBox schema 不同步（drift）

**What goes wrong:** 加新 env var 只改 TypeBox schema，忘了更新 `.env.example`；或反之。新 clone 者按 `.env.example` 設定後 `bun run dev` fail with「Missing FOO_KEY」。
**How to avoid:** wave 0 加契約測試：parse `.env.example` → 對比 TypeBox schema 欄位集——兩邊必相等（允許 example 含註解、不含 value）。
**Warning signs:** `bun run dev` 在剛 clone 的 repo 出 "Missing XXX_KEY" 錯誤但 `.env.example` 沒這個欄位。

## Code Examples

### `src/main.ts`（P1 stub）

```typescript
import { loadConfig } from './bootstrap/config'

// Phase 1: validate env on startup (FND-02) and exit.
// Phase 2 replaces this with Elysia app.listen().

const config = loadConfig()
console.log('[rigging] P1 foundation ready.')
console.log(`[rigging] env loaded: NODE_ENV=${config.NODE_ENV}, PORT=${config.PORT}`)
console.log('[rigging] Next: Phase 2 will mount Elysia root app.')
```

### `package.json` scripts（P1）

```json
{
  "name": "rigging",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/main.ts",
    "start": "bun src/main.ts",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "test:contract": "bun test tests/biome-contract tests/contract",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

### `tsconfig.json` 草稿

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "types": ["bun-types"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "baseUrl": "."
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"],
  "exclude": ["node_modules", "drizzle", "dist", "tests/biome-contract/**"]
}
```

*`tests/biome-contract/**` 刻意 exclude — 這些檔案意圖違反 Biome rule 而 tsc 也會抱怨未用 import；exclusion 避免 tsc 抱怨但 Biome 仍會 lint（Biome 用 `files.includes`）。*

### `.github/PULL_REQUEST_TEMPLATE.md` 草稿（D-16）

```markdown
## Summary

<!-- What does this PR do? 1-3 sentences. -->

## Linked issues / requirements

<!-- e.g., Closes #12; addresses REQ-XXX -->

## ADR checkpoint

- [ ] This PR introduces a decision that requires a new ADR — I added `docs/decisions/NNNN-*.md`
- [ ] This PR references an existing ADR — link: <!-- e.g., docs/decisions/0003-ddd-layering.md -->
- [ ] This PR does NOT require an ADR — the change fits within existing locked decisions

If ADR checkbox is marked YES:
- [ ] Did you update `docs/decisions/README.md` index?

## Rigidity Map

Which Rigidity Map tier does this change touch? (see AGENTS.md)

- [ ] Tier 1 (must be rigid) — explain below why this is OK
- [ ] Tier 2 (ADR-escapable) — ADR linked above
- [ ] Tier 3 (convention) — no gate

## Testing

<!-- How did you verify? -->
- [ ] `bun run lint` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes
```

### `.gitignore` 草稿

```
node_modules
dist
build

# Bun
.bun
bun.lockb.bak

# Env
.env
.env.*
!.env.example

# Logs
*.log
pnpm-debug.log*

# Editor
.vscode
.idea
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Drizzle (generated migrations are committed; meta is ignored)
# drizzle/meta/ — keep; drizzle-kit relies on it. Adjust per team policy.
```

### `.dockerignore` 草稿

```
node_modules
.git
.env
.env.*
!.env.example
*.log
dist
build
docs
.planning
.github
tests
```

## State of the Art

| Topic | Current (2026-04) | Notes |
|-------|-------------------|-------|
| Biome version | 2.4.12 | v2 新增 type-aware rules；`overrides.includes` 語法於 v2 穩定 |
| MADR version | 4.0.0（released 2024-09-17）| 4.x 保持穩定；前綴 YAML front matter 是 4.x 標準（非 v3 的 `# NNNN. Title` 單行） |
| AGENTS.md standard | 2025/08 | 跨 AI agent 標準（Claude / Cursor / Codex / Factory 等）；freeform markdown |
| Elysia `.mount()` + BetterAuth | ≥ 1.4 強制 | 低版本 Set-Cookie 失敗 |
| Drizzle 1.0 beta | 1.0.0-beta.22（still churn）| 2026-04 仍在 beta；`latest` tag 未 flip |
| Bun | 1.3.12 | `Bun.password` argon2id 內建；`bun:sql` 仍有 transaction hang bug（bun#21934/#22395 open） |

**Deprecated / outdated:**
- Lucia — 進 maintenance，用 BetterAuth
- ESLint + Prettier — Biome 2.x 取代
- dotenv — Bun 原生 `.env` 載入
- `bcrypt` / `bcryptjs` — `Bun.password` 原生（P3 才用）

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `bun:test`（Bun 內建，Jest-compatible）|
| Config file | 無需（零 config）；可選 `bunfig.toml` 設 coverage threshold |
| Quick run command | `bun test` |
| Full suite command | `bun test --coverage`（P1 無 coverage 目標；Phase 5 才 80%）|

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **FND-01** | `bun install && bun run dev` 能啟動 | smoke | `bun install --frozen-lockfile && timeout 10 bun run dev; test $? -eq 124 -o $? -eq 0` | ❌ Wave 0（`tests/smoke/bootstrap.test.ts` 或 CI job step）|
| **FND-02** | env 缺值立即 fail | unit + smoke | `BETTER_AUTH_SECRET= bun src/main.ts 2>&1 \| grep -q 'Invalid environment variables'` | ❌ Wave 0（`tests/unit/bootstrap/config.test.ts`）|
| **FND-03** | `docker-compose up` postgres health | smoke / manual | `docker compose up -d postgres && timeout 30 bash -c 'until docker compose exec -T postgres pg_isready; do sleep 1; done'` | manual step in `docs/quickstart.md`；CI 不跑 |
| **FND-04** | Drizzle 用 `postgres-js` driver | static grep | `! grep -rE "drizzle-orm/bun-sql" src/` 且 `grep -q "'postgres-js'" drizzle.config.ts src/shared/infrastructure/db/ 2>/dev/null \|\| true` | ❌ Wave 0（contract test）|
| **FND-05** | kernel framework-free | static grep | `! grep -rE "from ['\\\"](elysia\|drizzle-orm\|better-auth\|postgres)" src/shared/kernel/` | ❌ Wave 0（`tests/contract/kernel-framework-free.test.ts`）|
| **FND-05** | `Result.map/andThen/match` 行為正確 | unit | `bun test tests/unit/shared/kernel/result.test.ts` | ❌ Wave 0 |
| **FND-05** | `Brand<T,K>` 型別隔離 | type-level | `tsc --noEmit` + 一個 expect-error snippet | ❌ Wave 0（`tests/unit/shared/kernel/brand.test.ts`）|
| **FND-05** | `crypto.randomUUID` 生成 UUID v4 | unit | `bun test tests/unit/shared/kernel/id.test.ts` | ❌ Wave 0 |
| **FND-05** | DomainError httpStatus mapping | unit | `bun test tests/unit/shared/kernel/errors.test.ts` | ❌ Wave 0 |
| **FND-06** | Biome single config | static | `test -f biome.json && ! find . -name '.eslintrc*' -o -name '.prettierrc*'` | ❌ Wave 0 |
| **ARCH-01** | 四層目錄 placeholder 就位 | static | `test -d src/shared/application && test -d src/shared/infrastructure && ...` | ❌ Wave 0 |
| **ARCH-02** | Biome 阻擋 domain 層 import drizzle-orm | contract | `bun test tests/biome-contract/domain-drizzle.test.ts`（run biome 於違規檔 expect non-zero）| ❌ Wave 0 |
| **ARCH-03** | （Phase 3 才有 Repository）| deferred | — | N/A P1 |
| **ARCH-04** | package.json 無 tsyringe/inversify | static | `! grep -E "(tsyringe\|inversify)" package.json` | ❌ Wave 0 |
| **ARCH-05** | DomainError.httpStatus 欄位存在於 5 子類 | unit | 含於 FND-05 errors.test.ts | — |
| **ADR-01** | docs/decisions/ 就位、MADR 4.0 format | static | `test -d docs/decisions && for f in docs/decisions/0*.md; do head -5 "$f" \| grep -q '^status:'; done` | ❌ Wave 0 |
| **ADR-02** | 9 起始 ADR ship | static | `test $(ls docs/decisions/{0000,0001,0002,0003,0004,0005,0006,0007,0008}-*.md 2>/dev/null \| wc -l) -eq 9` | ❌ Wave 0 |
| **ADR-03** | 3 追加 ADR ship（0009/0010/0011）| static | `test $(ls docs/decisions/{0009,0010,0011}-*.md 2>/dev/null \| wc -l) -eq 3` | ❌ Wave 0 |
| **ADR-04** | README 索引含 status 欄 | static | `grep -q 'Status' docs/decisions/README.md && grep -q 'Supersedes' docs/decisions/README.md` | ❌ Wave 0 |
| **ADR-05** | PR template 含 ADR checkbox | static | `grep -q 'ADR' .github/PULL_REQUEST_TEMPLATE.md` | ❌ Wave 0 |
| **AGM-01** | AGENTS.md 含 Rigidity Map 三級 | static | `grep -q 'RIGGING:rigidity-map-start' AGENTS.md && grep -q 'Tier 1' AGENTS.md && grep -q 'Tier 2' AGENTS.md && grep -q 'Tier 3' AGENTS.md` | ❌ Wave 0 |
| **AGM-02** | AGENTS.md 含 anti-features | static | `grep -q 'RIGGING:anti-features' AGENTS.md && grep -q 'DO NOT propose' AGENTS.md` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `bun run lint && bun run typecheck`（< 5 秒；zero dep，無需 DB）
- **Per wave merge:** `bun run lint && bun run typecheck && bun test`（全 unit + contract；< 30 秒）
- **Phase gate:** `bun install --frozen-lockfile && bun run lint && bun run typecheck && bun test` 於 clean checkout + `docker compose up -d postgres` healthy check；在 `/gsd-verify-work` 前跑

### Wave 0 Gaps

Planner 須在 wave 0 建立（P1 前半段）：

- [ ] `bunfig.toml`（可選）— `bun test` config
- [ ] `tests/unit/shared/kernel/result.test.ts` — covers FND-05 Result behavior
- [ ] `tests/unit/shared/kernel/brand.test.ts` — covers FND-05 Brand type isolation
- [ ] `tests/unit/shared/kernel/id.test.ts` — covers FND-05 UUID generation
- [ ] `tests/unit/shared/kernel/errors.test.ts` — covers FND-05 / ARCH-05 DomainError hierarchy
- [ ] `tests/unit/bootstrap/config.test.ts` — covers FND-02 env schema fail-fast
- [ ] `tests/contract/kernel-framework-free.test.ts` — covers FND-05 zero framework import
- [ ] `tests/biome-contract/domain-drizzle-violation.ts`（含 Bun test harness）— covers ARCH-02
- [ ] `tests/biome-contract/application-drizzle-violation.ts` — covers D-09 application rule
- [ ] `tests/biome-contract/internal-barrel-violation.ts` — covers D-11
- [ ] `tests/integration/auth-bypass-contract.test.ts`（`test.skip` stub）— 預留 AUX-06 在 Phase 3
- [ ] Framework install: 無額外（`bun:test` 已內建 Bun 1.3.12）
- [ ] Optional `.github/workflows/ci.yml` 若 Phase 1 即 ship（否則 Phase 5）
- [ ] `.github/workflows/adr-check.yml` — D-16 強制

## Security Domain

> `security_enforcement` 預設 enabled。P1 無認證流程，但仍列明 P1 範圍內的 ASVS 對應。

### Applicable ASVS Categories (P1 scope)

| ASVS Category | Applies (P1) | Standard Control (P1-specific) |
|---------------|--------------|-------------------------------|
| V1 Architecture | **yes** | DDD 四層 + AuthContext boundary 定義於 ADR 0003/0006/0007；P1 僅奠基 |
| V2 Authentication | no (P3) | — |
| V3 Session Management | no (P3) | — |
| V4 Access Control | no (P3) | — |
| V5 Input Validation | **yes（limited）** | env schema TypeBox validation（FND-02）；後續 handler I/O 於 P2/P3 |
| V6 Cryptography | **yes（limited）** | `BETTER_AUTH_SECRET` minLength 32（`.env.example` 警告不 commit real secret）；`crypto.randomUUID` for IDs（未來用於 session/API key hashing 於 P3）|
| V7 Error Handling & Logging | **yes** | `DomainError` 基底有 `httpStatus`、`code`、`cause`；全域 handler Phase 2 land；P1 確認基底不洩 stack trace 到 HTTP body 的 contract |
| V8 Data Protection | no (P3) | — |
| V14 Configuration | **yes** | env schema fail-fast；`.gitignore` 禁 `.env*` commit（只允 `.env.example`）|

### Known Threat Patterns for P1 Tech Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 洩漏 secret 到 git（`.env` commit）| Information Disclosure | `.gitignore` 規則 `!.env.example`；P1 contract test：`! git ls-files \| grep -E '^\.env(\..+)?$' \| grep -v example` |
| Dockerfile / docker-compose 寫死 prod credential | Information Disclosure | `docker-compose.yml` 用的 password 是明示 `rigging_dev_password`、非真實 prod secret；README quickstart 說「dev-only」 |
| 依賴 package typosquat | Tampering | `bun install --frozen-lockfile` 於 CI；`bun.lockb` commit；警示：「不接受無 review merge 的 `package.json` diff」 |
| Postgres volume 混用 prod/dev | Tampering | `docker-compose.yml` named volume `rigging-pg-data` 與使用者 local prod instance 完全隔離 |
| Biome rule 被人手動關閉（`// biome-ignore`）| Tampering | P1 ADR 0009 Tier 1 rule 2：禁止無 ADR 的 biome-ignore；Phase 5 可加 `grep 'biome-ignore'` CI check |
| DomainError `cause` 洩漏到 HTTP response | Information Disclosure | Phase 2 error handler plugin 的責任；P1 基底欄位 `cause?: unknown` 明示不能直接 serialize |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `drizzle.config.ts` 的 `driver` 欄位於 drizzle-kit 0.31.10 的正確值（'pg' 或省略）| docker-compose + env schema § | drizzle-kit CLI 啟動 fail；Phase 2/3 migration 無法進行 |
| A2 | Biome 2.x `overrides[].linter.rules.style.noRestrictedImports.options.patterns[].group` 接受 gitignore-style glob（如 `**/domain/internal/**`）| DDD Scaffold § | D-11 rule 無法阻擋 `domain/internal` 繞道 import；Phase 3 可能失守 |
| A3 | AGENTS.md 的 `<!-- RIGGING:* -->` 標記不會被 GSD 工具於後續 regenerate 時覆蓋 | Pitfall 7 | Rigidity Map 段消失、Core Value 線索斷；mitigate via 雙寫於 ADR 0009 |
| A4 | Bun `crypto.randomUUID` 是 WebCrypto 標準 UUID v4（36 char with 4 at position 14）| Shared Kernel Sketch § | ID 格式不符 TypeBox `format: 'uuid'`；DB uuid column insert 失敗；verify via `tests/unit/shared/kernel/id.test.ts` |
| A5 | `tests/biome-contract/**` 可透過 `biome.json` `files.includes` 包含但被 `tsconfig.json` `exclude` 排除，兩者共存 | CI + Runtime Guard § | contract test 檔案被 tsc 視為違規 unused import；mitigate via `// @ts-nocheck` 首行 |
| A6 | `bunfig.toml` 對 P1 zero-config 即可；無需設任何 option | Validation Architecture § | 若需 coverage threshold / test path override 則後期補（Phase 5 可能需要）|
| A7 | 12 條 ADR 的 date 皆 `2026-04-19` | ADR Seed Content § | 所有 ADR 同一天 commit；研究 Pitfall #12 提「All ADRs are dated in a two-week window」是 warning sign——P1 是特例（bootstrap 一次性 12 條），此為 accept-and-document 情境；後續 ADR 日期自然分散 |
| A8 | P1 不 ship 任何 feature module（ARCH-04 的 factory pattern 僅於 `AGENTS.md` Rigidity Map 聲明，無 code sample）| Phase Requirements § | 驗證 ARCH-04 時 static check 只能查 package.json；Phase 2 的 `/health` 才是第一個落地 factory 模式——P1 不實測 |

## Open Questions (RESOLVED)

> All five questions below were resolved during phase planning. Each entry records the adopted resolution and the plan in which the decision materialised. Kept for traceability — not open issues anymore.

1. **`drizzle.config.ts` driver 欄位正確值（A1）**
   - What we know: Drizzle 0.45 / drizzle-kit 0.31 是配對版本；`dialect: 'postgresql'` 已確認
   - What's unclear: `driver` 欄位對 postgres dialect 是 'pg' / 'postgres-js' / 省略？
   - Recommendation: wave 0 由 planner/executor 跑 `bunx drizzle-kit --help` 5 分鐘 spike；結果寫入 ADR 0005 或 0010 Consequences；若不確定就省略 `driver` 欄位、保留 `dialect` + `dbCredentials.url`
   - **RESOLVED**: 採 Pitfall #4 mitigation — 省略 `driver` 欄位，僅留 `dialect: 'postgresql'` + `dbCredentials.url`；Phase 2 若需 driver 再補 ADR 0005a。— adopted in plan 01-05

2. **`src/_template/` placeholder 是否保留到 Phase 2**
   - What we know: 建 placeholder 讓 Biome overrides glob 真有 match；Phase 2 會加 `src/health/` feature
   - What's unclear: planner 是否想要 placeholder 被 Phase 2 改名，或 Phase 2 新建 feature 後刪掉 placeholder
   - Recommendation: planner 決定。推薦 Phase 2 executor `mv src/_template src/health`（修改歷史清爽）
   - **RESOLVED**: P1 ship `src/_template/{domain,application,infrastructure,presentation}/.gitkeep` placeholder；Phase 2 executor 負責 `mv src/_template src/health`（推薦）或新建 feature 後刪 placeholder。— adopted in plan 01-01

3. **contract test 檔案放哪**
   - What we know: 需被 Biome 匹配 `src/**/domain/**` override；但又不該是「真實 feature」
   - What's unclear: `tests/biome-contract/domain/` + biome.json 加 override path 是否最佳、或用 `src/_template/` + 違規檔案放裡面？
   - Recommendation: 獨立 `tests/biome-contract/` 並在 `biome.json` overrides 加 `tests/biome-contract/<layer>/**` 到對應 rule set；避免 production `src/` 混入故意違規檔
   - **RESOLVED**: 採獨立 `tests/biome-contract/<layer>/` 目錄；biome.json overrides 以 `tests/biome-contract/<layer>/**` glob 對應 rule；`tsconfig.json` exclude `tests/biome-contract/**` 避免 tsc 編譯。— adopted in plan 01-03

4. **shared kernel Brand helper 是否需 typed constructor**
   - What we know: D-06 採 phantom property，runtime zero-cost
   - What's unclear: 是否 export runtime helper `UserId.of(s: string): UserId` 讓 domain 層調用更順
   - Recommendation: P1 只 ship `brand<K>()` factory（已草稿），不強制 typed constructor；Phase 3 feature 各自決定
   - **RESOLVED**: P1 僅 ship `brand<K>()` phantom-property factory，runtime zero-cost；不強制 typed constructor；Phase 3 feature 各自決定是否加 `UserId.of(...)` helper。— adopted in plan 01-02

5. **ADR YAML front matter 是 MADR 4.0 "full" 還是 "minimal"**
   - What we know: MADR 4.0.0 有 bare / minimal / full 三 variant [CITED: adr.github.io/madr]
   - What's unclear: 12 條 seed ADR 統一用哪個
   - Recommendation: "full" variant（含 Decision Drivers / Considered Options / Pros and Cons）——研究豐富、後續 Agent 可讀性高；0000 ADR 自指即聲明此選擇
   - **RESOLVED**: 12 條 seed ADR 統一採 MADR 4.0 "full" variant；ADR 0000 自指聲明此 convention。— adopted in plan 01-04

## Sources

### Primary (HIGH confidence)

- `.planning/research/STACK.md`（2026-04-18 對 Context7 / npm 驗證的版本矩陣）
- `.planning/research/ARCHITECTURE.md`（DDD 四層 + AuthContext + Plugin composition）
- `.planning/research/PITFALLS.md`（15 條 pitfalls + 具體 GitHub issue / CVE 引用）
- `.planning/research/FEATURES.md`（anti-features 清單、與 competitor 對照）
- `.planning/research/SUMMARY.md`（Phase 1 Delivers / Addresses / Avoids）
- Biome 2.x [noRestrictedImports rule docs](https://biomejs.dev/linter/rules/no-restricted-imports/) — VERIFIED 2026-04-19
- Biome 2.x [configuration overrides docs](https://biomejs.dev/reference/configuration/) — `includes` key 語法 VERIFIED 2026-04-19
- [MADR 4.0.0 canonical](https://adr.github.io/madr/) — template variants VERIFIED 2026-04-19
- [AGENTS.md 開放標準](https://agents.md) — freeform markdown VERIFIED 2026-04-19
- Bun [crypto.randomUUID](https://bun.com/docs/runtime/web-apis) — WebCrypto 原生

### Secondary (MEDIUM confidence)

- GitHub issues [bun#21934](https://github.com/oven-sh/bun/issues/21934) / [bun#22395](https://github.com/oven-sh/bun/issues/22395) — ADR 0010 的 revisit 條件依據
- CVE-2025-61928 [ZeroPath write-up](https://zeropath.com/blog/breaking-authentication-unauthenticated-api-key-creation-in-better-auth-cve-2025-61928) — ADR 0004 exact pin 理由
- [Factory.ai — Using Linters to Direct Agents](https://factory.ai/news/using-linters-to-direct-agents) — D-12 rule message 設計論據
- [Ruby on Rails Doctrine](https://rubyonrails.org/doctrine) — ADR 0009 Rigidity Map 概念源頭

### Tertiary (LOW confidence — phase 執行時驗證)

- `drizzle.config.ts` `driver` 欄位於 drizzle-kit 0.31.10 的確切值（A1 — wave 0 spike）
- Biome 2.x `patterns[].group` glob 是否支援 `**/domain/internal/**`（A2 — contract test 驗證）

## Metadata

**Confidence breakdown:**
- User Constraints / Phase Requirements 對映：HIGH — CONTEXT.md 明確、REQUIREMENTS.md 明確
- Standard Stack：HIGH — STACK.md 已於 2026-04-18 對 Context7 / npm 驗證
- Bootstrap Ordering：HIGH — 簡單 dependency chain，手動可 trace
- DDD Scaffold & Biome Rule：MEDIUM-HIGH — `overrides.includes` 已 VERIFIED；`patterns[].group` glob 語法 MEDIUM（assumption A2）
- Shared Kernel Sketch：HIGH — 純 TypeScript、無外部 dep、neverthrow 風是成熟模式
- ADR Seed Content：HIGH — 研究已鎖定 12 條；每條 Context/Decision/Consequences 初稿可直接移入 MADR template
- AGENTS.md Rigidity Map：HIGH — 格式 freeform、GSD 區塊共存策略於 AGENTS.md 現有結構觀察
- Docker / env schema：HIGH — 業界標準模式；TypeBox 於 Elysia 生態是預設
- CI + Runtime Guard：MEDIUM — P1 特殊（無 feature、無 endpoint），驗證策略退化；Biome contract test approach 為 SOTA 模式
- Validation Architecture：HIGH — Bun test + bun:test 內建零 config；可直接映射 FND/ARCH 各條到指令
- Environment Availability：HIGH — 外部依賴少

**Research date:** 2026-04-19
**Valid until:** 2026-05-19（30 天；Biome / Drizzle / Bun 均穩定線）；若 Drizzle 1.0 `latest` tag flip 或 Bun 1.4 release 前則需早檢

---

*Phase 1 Foundation research complete — 2026-04-19*
