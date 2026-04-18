# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 01-foundation
**Areas discussed:** Rigidity Map, shared kernel API shape, DDD 邊界 enforcement, ADR 起始 12 條

---

## Rigidity Map 三級內容

### Q1. 「必嚴格（無逃生口）」清單

| Option | Description | Selected |
|--------|-------------|----------|
| 核心三條 (Recommended) | AuthContext 必經 requireAuth macro / Domain 禁 import framework / Stack 核心版本 pin (Bun/Elysia/BetterAuth) | ✓ |
| 核心三條 + Repository 模板 | 上述 + Repository 必回 domain entity（禁洩漏 Drizzle InferSelectModel） | |
| 上述 + Error 層級 mapping | 再添加 DomainError 子類必被全域 mapping、私有欄位禁裸暴露 | |

**User's choice:** 核心三條 (Recommended)
**Notes:** Pitfall #5 opinionated trap 的防線；其餘項目列入「可 ADR 逃生」

### Q2. 「預設嚴格但可 ADR 逃生」層包含

| Option | Description | Selected |
|--------|-------------|----------|
| 層內細節可替換 (Recommended) | Validator / driver 切換條件 / logger / migration / resolver precedence | ✓ |
| 性最廣義：含架構形狀 | 上述 + DDD 四層目錄佈局（某些 feature 可省略 application）+ DI 模式 | |
| 僅 stack 版本升級 | 除了版本升級外全列必嚴格 | |

**User's choice:** 層內細節可替換 (Recommended)

### Q3. 「純約定」層樣貌

| Option | Description | Selected |
|--------|-------------|----------|
| 命名 / log / commit (Recommended) | 變數命名、error code naming、commit format、branch naming | ✓ |
| 空：只有必嚴格 + 可逃生 | 不留灰地帶 | |
| 橫向支持工具 | lefthook / pino-pretty 格式 / DB browser / dev seed 等 | |

**User's choice:** 命名 / log / commit (Recommended)

### Q4. 違規 detection 落點

| Option | Description | Selected |
|--------|-------------|----------|
| CI + runtime 雙層 (Recommended) | CI biome/tsc/test + runtime factory assert；不設 pre-commit | ✓ |
| Pre-commit + CI + runtime | 加 lefthook 做 format + typecheck | |
| CI only (無 runtime assert) | 完全信 TS narrowing；會被 Pitfall #4 undefined cascade 穿透 | |

**User's choice:** CI + runtime 雙層 (Recommended)

---

## shared kernel API shape

### Q1. Result<T, E> 的 API 風格

| Option | Description | Selected |
|--------|-------------|----------|
| neverthrow 風 (Recommended) | Ok/Err + .isOk/.isErr/.map/.mapErr/.andThen/.match；自實作 < 100 LOC | ✓ |
| 純 discriminated union | type Result<T,E> = { ok: true, value } \| { ok: false, error }；極簡但 agent 寫錯率高 | |
| 不提供 Result，純 throw | Domain 層直接 throw DomainError | |

**User's choice:** neverthrow 風 (Recommended)
**Notes:** 自實作，不引 neverthrow npm package（shared kernel 原則 zero dep）

### Q2. Brand<T, K> nominal type 實作

| Option | Description | Selected |
|--------|-------------|----------|
| Phantom property (Recommended) | type Brand<T, K> = T & { readonly __brand: K }；compile-time only | ✓ |
| Unique symbol | 用 unique symbol 做 key，更嚴謹但語法繁 | |
| Class wrapper | class Brand<K, T> wraps value；instanceof 可檢查但 serialize 成本高 | |

**User's choice:** Phantom property (Recommended)

### Q3. 實體 ID 生成策略

| Option | Description | Selected |
|--------|-------------|----------|
| crypto.randomUUID + Brand (Recommended) | 原生 Bun、無 dep；TypeBox 格式驗證；DB uuid column 同構 | ✓ |
| NanoID + prefix | 人類可讀 (user_kj2k...)；debug 友善；但需 dep + DB TEXT column | |
| uuid v7 | 時序 UUID；索引友善；需 uuid pkg；v1 收益有限 | |

**User's choice:** crypto.randomUUID + Brand (Recommended)

### Q4. DomainError 基底類別設計

| Option | Description | Selected |
|--------|-------------|----------|
| code + httpStatus + cause (Recommended) | 子類含 ValidationError(400)/UnauthorizedError(401) 等；handler 直接讀 httpStatus | ✓ |
| + details 欄位 | 上述 + details?: Record<string, unknown> 裝 validation failure field 資訊 | |
| 純 code + cause | Domain 完全不知 HTTP；handler 有對照表；但新子類兩處都要改 | |

**User's choice:** code + httpStatus + cause (Recommended)

---

## DDD 邊界 enforcement 機制

### Q1. 「domain 層 import drizzle-orm」的 Biome 規則

| Option | Description | Selected |
|--------|-------------|----------|
| noRestrictedImports + overrides (Recommended) | biome.json 用 overrides 於 src/**/domain/**，禁 drizzle-orm/elysia/better-auth/postgres 等 | ✓ |
| 自訂 Biome 2.x GritQL plugin | Custom pattern、type-aware；精準但學習成本 | |
| ts-morph CI script | 獨立腳本掃 import graph；靈活但離開 Biome 生態 | |

**User's choice:** noRestrictedImports + overrides (Recommended)

### Q2. 「Repository 回 Drizzle row type」如何攔截

| Option | Description | Selected |
|--------|-------------|----------|
| 純型別 + lint 雙裏 (Recommended) | Repo port return type 為 domain entity (tsc) + Biome 禁 drizzle-orm import | ✓ |
| 加 ts-morph test | 上述 + bun test 掃 repo signature 不含 InferSelectModel | |
| 僅純型別 | 只靠 tsc；domain 不慎用 as 可能被跳過 | |

**User's choice:** 純型別 + lint 雙裏 (Recommended)

### Q3. 「Domain 只 export factory、不 export class」enforce

| Option | Description | Selected |
|--------|-------------|----------|
| barrel + internal 目錄 (Recommended) | domain/index.ts 唯一 barrel export getXxxService；domain/internal/ 放 class；Biome 禁從 internal 直 import | ✓ |
| barrel + internal + runtime assert | 上述 + factory 內 runtime 斷言 ctx.authContext 存在 | |
| 僅 barrel 約定 | 不做 internal 目錄標記；靠 developer 自律 | |

**User's choice:** barrel + internal 目錄 (Recommended)
**Notes:** Runtime assert 已在 Q4 Rigidity Map detection 層以「CI + runtime 雙層」方式涵蓋，所以這裡只需 barrel + internal 隔離

### Q4. Agent 踩到 lint violation 時，error message

| Option | Description | Selected |
|--------|-------------|----------|
| what + why + ADR link + 修法 (Recommended) | 包含具體修法提示；Pitfall #10 harness UX 太緊的直接防線 | ✓ |
| what + why + ADR link | 無具體修法 | |
| Biome default 訊息 | 不自訂 | |

**User's choice:** what + why + ADR link + 修法 (Recommended)

---

## ADR 起始 12 條內容與編號順序

### Q1. ADR 編號順序方案

| Option | Description | Selected |
|--------|-------------|----------|
| 按 research 建議順 (Recommended) | 0000 MADR / 0001 Bun / 0002 Elysia / 0003 DDD / 0004 BetterAuth / 0005 Drizzle / 0006 AuthContext / 0007 Runtime Guards / 0008 Dual Auth / 0009 Rigidity Map / 0010 postgres-js / 0011 Resolver precedence | ✓ |
| 概念分組重排 | 基礎 Stack → 架構 → 哲學 → 技術選擇 Annex | |
| Rigidity Map 提前異動 | 把 Rigidity Map 挪到 0001 | |

**User's choice:** 按 research 建議順 (Recommended)

### Q2. Resolver precedence ADR（API Key 優於 cookie）何時正式定案

| Option | Description | Selected |
|--------|-------------|----------|
| P1 即定案 + P3 實作驗證 (Recommended) | P1 ship status=accepted；P3 spike 驗證；若需修正另開 0011a Supersedes | ✓ |
| P1 ship draft (proposed) / P3 accept | 留選擇空間但多一次修改 | |
| P1 不 ship、P3 才開 | P1 只 ship 11 條 | |

**User's choice:** P1 即定案 + P3 實作驗證 (Recommended)

### Q3. docs/decisions/README.md 索引表欄位

| Option | Description | Selected |
|--------|-------------|----------|
| 編號/標題/Status/日期/Supersedes (Recommended) | MADR 標準 + supersedes 關係可追溯；Pitfall #11 ADR rot 追蹤機制 | ✓ |
| 編號/標題/Status/日期 | 最簡，無 supersedes | |
| + Rigidity Tier 欄位 | 每條 ADR 標 Rigidity 分級 | |

**User's choice:** 編號/標題/Status/日期/Supersedes (Recommended)

### Q4. PR template ADR checkbox 強制力

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox + CI lint (Recommended) | GH Actions 檢查：若勾「需 ADR」但 diff 無新增 docs/decisions/*.md → CI fail | ✓ |
| 純 Checkbox 提醒 | 靠 reviewer 人工 | |
| 無 PR template，靠 commit convention | commit 有 adr: 的就檢查 | |

**User's choice:** Checkbox + CI lint (Recommended)

---

## the agent's Discretion (未討論，交 planner/researcher 決定)

- docker-compose.yml 內容（adminer、volume、healthcheck）
- env schema 具體欄位
- lefthook 不加（已由 D-04 排除）
- Biome rule set 全開 vs 選擇性
- AGENTS.md Rigidity Map 段落落點（與 GSD auto-managed 區塊共存方式）
- Template feature 於 P1 驗證（已定 P1 純骨架，feature 延到 P2）
- Brand runtime constructor helper（D-06 採 phantom 無 runtime footprint；若 domain 需要可補）

## Deferred Ideas (明確推遲)

- Application 層 import elysia 是否允許（P1 先放寬，P3 再定）
- Rigidity Map 四級/五級擴充可能（dogfood 後評估）
- OAuth / CLI generator / 真實 email / Multi-tenancy（v2+）
