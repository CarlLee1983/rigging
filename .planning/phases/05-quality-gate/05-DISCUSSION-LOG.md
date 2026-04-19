# Phase 5: Quality Gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 05-quality-gate
**Areas discussed:** 測試策略, E2E 範圍與框架, CI 強化, DX docs (README + quickstart)

---

## Area selection (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| 測試策略 | Integration DB (testcontainers vs docker-compose) + regression suite 整併 + bun test --coverage 門檻 | ✓ |
| E2E 範圍與框架 | tests/e2e/ 空; QA-04: bun:test + app.handle 或 @elysiajs/eden | ✓ |
| CI 強化 | Migration drift 實作、job 拆分、postgres provisioning、coverage gate | ✓ |
| DX docs (README + quickstart) | README 首屏 Core Value / quickstart 10 分鐘 dogfood 路徑 | ✓ |

**User's choice:** 全部四區
**Notes:** 使用者全部勾選，逐一深度討論。

---

## 測試策略

### Q1: Integration test DB

| Option | Description | Selected |
|--------|-------------|----------|
| 維持 real DB + CI 加 postgres service | 繼續 docker-compose postgres 本地 + GitHub Actions services:postgres:16-alpine | ✓ (Recommended) |
| 改用 testcontainers | 加 testcontainers@^10 dep、per-test-file container、符合 QA-02 字面 | |
| 混合：testcontainers auth+agents, unit 仍 fake | 部分採用 | |

**User's choice:** 維持 real DB + CI 加 postgres service
**Notes:** REQ QA-02 字面解釋為「有致於隔離的臨時 Postgres」，GitHub Actions services 同等達成。ADR 0018 記此 deviation。

### Q2: Regression suite

| Option | Description | Selected |
|--------|-------------|----------|
| 保留後綴、加 test:regression script | 不搬檔，script 達成「可獨立執行」目的 | ✓ (Recommended) |
| 搬到 tests/regression/ 統一目錄 | P3 CONTEXT deferred note 所述 | |
| 保留後綴 + script + 架構文件列映射表 | 選項 1 + regression map 表 | (併入 D-02 實作) |

**User's choice:** 保留後綴、加 test:regression script
**Notes:** Feature co-location 保留；architecture.md D-16-B regression map 表格仍會 ship，屬 docs polish 而非 suite 搬家。

### Q3: Coverage threshold enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| bun test --coverage + CI grep 門檻 | Bun 原生 + 自家 per-path gate script | ✓ (Recommended) |
| c8/istanbul + nyc-style threshold | 傳統 Node 生態 | |
| 柔性：只 report、不 fail CI | QA-01 字面被弱化 | |

**User's choice:** bun test --coverage + CI grep 門檻
**Notes:** 選項 1 的「grep 門檻」實作為 `scripts/coverage-gate.ts`（D-13）。

### Q4: Test parallelism

| Option | Description | Selected |
|--------|-------------|----------|
| 維持 Bun 平行、靠 email/userId namespace 隔離 | 現有 pattern、不改所有檔 | ✓ (Recommended) |
| 改 serial (`bun test --concurrency 1`) | 最安全、但運行時間 2-3x | |
| 混合：unit/contract 平行、integration serial | 多拆 scripts / jobs | |

**User's choice:** 維持 Bun 平行、靠 email/userId namespace 隔離
**Notes:** D-04-A 將 test convention 文件化（architecture.md 或 tests/README.md）。

### Q5: DB schema prep before tests

| Option | Description | Selected |
|--------|-------------|----------|
| P5 改為 `bun run db:migrate` 作 test precondition | 替換 ensure-agent-schema.ts | ✓ (Recommended) |
| 保留 ensure-agent-schema.ts 模式 | 手寫 guard | |
| 淡化：test runner 自行確保 | 在 _helpers 加 beforeAll schema check | |

**User's choice:** P5 改為 `bun run db:migrate` 作 test precondition
**Notes:** 源頭治理，也被 quickstart.md 流程驗證。

### Q6: Coverage target path

| Option | Description | Selected |
|--------|-------------|----------|
| Domain+Application 80% 硬門檻、其他 report | QA-01 字面，infrastructure report-only | ✓ (Recommended) |
| 全專案 75% 硬門檻 | 含 infrastructure | |
| Domain 90% + Application 80% + shared/kernel 95% | 最嚴格 | |

**User's choice:** Domain+Application 80% 硬門檻、其他 report
**Notes:** D-06-B 將 shared/kernel 視為 domain tier 同等對待。

---

## E2E 範圍與框架

### Q1: E2E 定義

| Option | Description | Selected |
|--------|-------------|----------|
| E2E = 跨 feature 的 user journey | Integration = 單 feature HTTP 路徑；E2E = 多 feature 串接 | ✓ (Recommended) |
| E2E = 全簡化用 eden Treaty 動式型別檢查 | Pitfall #15 為 E2E 核心動作 | |
| E2E = subprocess-based | 起真 server + fetch localhost | |

**User's choice:** E2E = 跨 feature 的 user journey
**Notes:** 差異化價值在「跨 feature 串接 auth + agents + api-key」。

### Q2: E2E 框架

| Option | Description | Selected |
|--------|-------------|----------|
| bun:test + app.handle(Request) | 與 integration 同 runtime、無 eden | ✓ (Recommended) |
| eden Treaty + app.handle (hybrid) | Pitfall #15 相關防線 | |
| eden 全換掉 app.handle | 大規模改寫 | |

**User's choice:** bun:test + app.handle(Request)
**Notes:** D-08-B 明確推遲 eden 到 v2 spike。

### Q3: E2E scope

| Option | Description | Selected |
|--------|-------------|----------|
| 三條核心 journey | dogfood happy path + password reset session isolation + cross-user 404 | ✓ (Recommended) |
| 單條 dogfood happy path | 低維護、只驗 10 分鐘路徑 | |
| 四條：三核心 + DEMO-05 scope rejection E2E | 加 read-only key → 403 | |

**User's choice:** 三條核心 journey
**Notes:** D-09 明列三個 test file 名稱與流程。DEMO-05 scope 已在 integration (agents/scope-check-read-only-key.test.ts)；e2e 重複運行價值不大。

---

## CI 強化

### Q1: Migration drift check mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| git status 檢查 drizzle/ 是否乾淨 | 一行可搞定 | ✓ (Recommended) |
| diff ./drizzle 與 generate 後狀態 | snapshot+restore 更複雜 | |
| drizzle-kit check + generate 雙管齊下 | 更 rigorous 但資料少 | |

**User's choice:** git status 檢查 drizzle/ 是否乾淨
**Notes:** D-10-A script + D-10-B 處理 ci-drift.sql 產生物清理。

### Q2: CI job structure

| Option | Description | Selected |
|--------|-------------|----------|
| 拆為 3 jobs：lint / typecheck / test+migration-drift | Parallel fail-fast、故障位置清楚 | ✓ (Recommended) |
| 保留單 job check | 最簡、但 fail signal 輪廓糊 | |
| 拆為 2 jobs：static-checks (lint+typecheck) / test | 中間選項 | |

**User's choice:** 拆為 3 jobs
**Notes:** D-11-A 完整 workflow 結構。

### Q3: Postgres in CI

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Actions services 原生 | postgres:16-alpine 對齊本地 docker-compose | ✓ (Recommended) |
| docker-compose up -d 在 CI runner | 最一致、但 CI 支持不一 | |
| testcontainers bootstrap | 與測試策略 D-01 衝突 | |

**User's choice:** GitHub Actions services 原生
**Notes:** D-12-A 完整 services 配置。

### Q4: Coverage gate enforcement in CI

| Option | Description | Selected |
|--------|-------------|----------|
| bun test --coverage + per-path grep script | 自家 scripts/coverage-gate.ts | ✓ (Recommended) |
| 單一 --coverage-threshold=0.8 全檔計數 | Bun 原生、但無 per-path | |
| 不 fail CI、只產 artifact | DX 友好但 QA-01 弱化 | |

**User's choice:** bun test --coverage + per-path grep script
**Notes:** D-13-B script 大綱已在 specifics 段。

---

## DX docs (README + quickstart)

### Q1: README 首屏

| Option | Description | Selected |
|--------|-------------|----------|
| 偏 narrative：Core Value + Why Rigging + Quickstart CTA | Hashicorp/tRPC/Zod 風格 | ✓ (Recommended) |
| 偏 code-first：Core Value 光捨 + shell quickstart block | 30s 能試的感覺 | |
| 偏 marketing：Badge + hero + feature grid | 與 opinionated 風格衝突 | |

**User's choice:** 偏 narrative
**Notes:** D-14-A / D-14-B / D-14-C 完整結構鎖定。

### Q2: Quickstart 10 分鐘路徑

| Option | Description | Selected |
|--------|-------------|----------|
| 兩條路徑、Dogfood 物語驅動 | register→verify→login→建 Agent→建 prompt→建 API Key→以 agent 讀自己 prompt | ✓ (Recommended) |
| 簡化 happy path（不經 demo domain） | register→login→api-key→/me | |
| 多事體路徑：含 reset + api-key + demo | 超過 10 分鐘 | |

**User's choice:** 兩條路徑、Dogfood 物語驅動
**Notes:** D-15-A 六步驟流程；D-15-D 錯誤範例選 1 個。

### Q3: Architecture.md 深度 + 圖示

| Option | Description | Selected |
|--------|-------------|----------|
| Prose + Mermaid + 引用 ADR | GitHub 原生 render、ADR 為細節 source | ✓ (Recommended) |
| ASCII 圖 + 深度教學文 | 自包含、維護成本高 | |
| 純 prose、無圖 | 雙軌 resolver 難描述 | |

**User's choice:** Prose + Mermaid + 引用 ADR
**Notes:** D-16 三章 + 附錄 regression map；D-16-D GitHub 原生 render 相容。

### Q4: AGENTS.md AI Agent Onboarding

| Option | Description | Selected |
|--------|-------------|----------|
| 頂部加 TOC + 重命名現有 L197 段 | 入口清楚、不複製既有內容 | ✓ (Recommended) |
| 新增獨立章節、保留 L197 | 內容重複 | |
| 純引用式：頂部 link bar | DOC-05「段落」字面不符 | |

**User's choice:** 頂部加 TOC + 重命名現有 L197 段
**Notes:** D-17-A TOC 結構 + D-17-B 段標題重命名 + D-17-D TOC 插入位置（`# AGENTS.md` 後、第一個 GSD managed 區塊前）。

---

## the agent's Discretion

以下項目未納入本次討論、researcher / planner 自行決定（見 CONTEXT.md `<decisions>` §the agent's Discretion 完整列表）：

- `scripts/coverage-gate.ts` 精確 parser 實作（Bun coverage JSON 格式確認）
- `bunfig.toml` 精確 key 名
- Mermaid 顏色 / shape 風格
- `tests/e2e/_helpers.ts` 是否 dup 或抽共用
- ADR 0018 檔名
- CI concurrency group 命名
- Coverage report artifact upload / PR comment bot
- E2E DB cleanup 時機（afterAll vs afterEach）
- README CI badge 決定
- quickstart.md curl vs HTTPie
- architecture.md 是否拆 docs/testing.md 獨立檔
- AGENTS.md 頂部 TOC anchor 格式
- Plan 數量（D-18 估 4 plans，planner 可調）
- Plan 05-01 unit test 補齊範圍（coverage baseline 後決定）

## Deferred Ideas

以下想法在討論過程中浮現、記錄供後續評估（見 CONTEXT.md `<deferred>` 完整列表）：

- `$gsd-secure-phase 04`（P4 threat-mitigation audit）—— 不 fold 進 P5，保留為獨立 out-of-band
- testcontainers → v2 PROD-*
- Eden Treaty → v2 spike
- `.regression.test.ts` 搬 tests/regression/ → 拒絕（D-02）
- Subprocess-based e2e → 拒絕（D-07）
- c8/istanbul → 拒絕（D-03）
- 全專案 coverage 80% → 拒絕（D-06）
- 05-HARNESS-FRICTION.md → optional，researcher 評估
- README GitHub topic tags → optional
- Markdown linter → v2
- CONTRIBUTING.md / CODE_OF_CONDUCT.md / SECURITY.md → v2 或 release polish
- CHANGELOG / semver release notes → v2
- v2 其他 SCAF-* / PROD-* / IDN-* / TEN-* / AGT-* → REQUIREMENTS.md §v2 已列

---

*Discussion duration: 2026-04-19 interactive session*
*Rounds: 13 question-answer rounds across 4 areas*
*All recommended options accepted by user*
