# Rigging

## What This Is

Rigging 是一個用 **Harness Engineering** 思維打造的 opinionated 專案骨架（最終形式是 `npx rigging`，v1 先以 Reference App 形式存在）。它不是工具箱（像 LangChain），而是「軌道」——透過強意見的技術棧（Bun + Elysia + DDD + ADR）與強制的 AuthContext 身分邊界，讓 AI Agent 在其上實作功能時，**被結構本身約束**寫出安全、一致、可組合的程式碼。

使用對象是開發者與 AI Agent：開發者選擇這條軌道，AI Agent 在軌道上敷捷分段實作功能。

## Current State

**Shipped:** v1.0 Reference App + **v1.1 Release Validation** (2026-04-20)

- **v1.0:** 21 plans / 5 phases；221 tests pass / 100% coverage (domain+application+kernel)；18 ADRs + harness docs
- **v1.1:** 3 phases / 5 plans — CI 真實 PR 全綠 + fail-mode 矩陣、`04-SECURITY.md` SEC-01 證據、ADR 0019 + `validate-adr-frontmatter` + sacrificial PR `adr-check` 紅燈舉證（archives: `milestones/v1.1-ROADMAP.md`）
- GitHub Actions：lint / typecheck / test+coverage / migration drift / **smoke**（`scripts/smoke-health.ts`）全為 PR gate
- 19 ADRs (0000..0019, MADR 4.0) + adr-check workflow；`docs/quickstart.md` / `docs/architecture.md` 維持
- **Active:** v1.2 Create Rigging — scaffold CLI + npm publish

## Current Milestone: v1.3 Production Hardening

**Goal:** 讓 Rigging harness 從 demo-ready 升級為 production-deployable，補上真實 email 發送、持久化限流、與分散式追蹤三條生產必要基礎設施。

**Target features:**
- PROD-01: 真實 email adapter（Resend / Postmark + bounce handling），透過 IEmailPort 無縫替換 ConsoleEmailAdapter
- PROD-02: Rate limit 持久化 store（Redis / DB-backed），讓限流狀態在重啟後存活、支援多 instance 部署
- PROD-03: OpenTelemetry instrumentation（traces + metrics），接入任何 OTLP-compatible backend

## Core Value

**AI Agent 寫出來的程式碼必須「自動」具備安全性與結構性——靠的不是提示詞約束，而是框架本身的軌道（type system + runtime guards + DI）讓錯誤的寫法根本跑不起來。**

如果其他都失敗，這一點不能失敗：任何 Domain 操作必須通過 AuthContext，沒有 AuthContext 就連 handler 都 wire 不起來。

**實證狀態：** Core Value 在 v1.0–v1.1 被 regression test suite 與 CI gates 守護——不掛 auth plugin 啟 app 則 protected route 必回 401（AUX-06），CVE-2025-61928 attack pattern 被整合測試擋下，cross-user 404 matrix 防枚舉；v1.1 補上 release self-verification（CI / SECURITY 文件 / ADR gate）。

## Requirements

### Validated

<!-- Shipped in v1.0 and confirmed valuable. Archive: milestones/v1.0-REQUIREMENTS.md -->

- ✓ Opinionated 技術棧鎖定（Bun 1.3.12 + Elysia 1.4.28 + PostgreSQL 16 + Drizzle 0.45.2 + BetterAuth 1.6.5 exact pinned）— v1.0
- ✓ DDD 四層骨架 + Biome lint 規則保護（domain 禁 import framework）— v1.0
- ✓ ADR 機制（MADR 4.0 / README 索引 + status 欄 / PR adr-check workflow）— v1.0；v1.1 補 ADR 0019 + `validate-adr-frontmatter`
- ✓ BetterAuth 整合：Email/Password 註冊 / 登入 / 登出 / session 管理 — v1.0
- ✓ Email 驗證（dev 階段 console log 輸出 ConsoleEmailAdapter）— v1.0
- ✓ 密碼重設（dev 階段 console log，ADR 0016 Scenario B wrap revokeSessions）— v1.0
- ✓ API Key 管理（POST / GET / DELETE，SHA-256 hash 儲存 + prefix index）— v1.0
- ✓ AuthContext 強制身分邊界（Elysia `.macro` + `resolve`，scope = global）— v1.0
- ✓ Runtime Guards（`getUserService(ctx)` 於 DI 邊界斷言 AuthContext 存在）— v1.0
- ✓ 雙軌驗證（session cookie + API Key header，ADR 0011 API Key 優先）— v1.0
- ✓ Demo Domain dogfood（Agent / PromptVersion / EvalDataset + feature module factory 複用）— v1.0
- ✓ Testing 社群可用等級（221 tests / 100% coverage 於 domain+application+kernel / testcontainers deviation ADR 0018）— v1.0
- ✓ 使用者文件（README narrative-first + `docs/quickstart.md` 10-min + `docs/architecture.md` 三章）— v1.0
- ✓ CI 首跑綠燈（push + PR → GitHub Actions 3 jobs all green + migration-drift）— Validated in Phase 6 (CI-04, 2026-04-20, PR #1 / run 24652628305)
- ✓ CI fail-mode 可觀測（lint / typecheck / test / drift / smoke 五 gate 皆有紅燈舉證）— Validated in Phase 6 (CI-05, 2026-04-20, PR #2 closed)
- ✓ Observability smoke in CI（`createApp` boot + `/health` HTTP ping 作為 PR gate 最後一關）— Validated in Phase 6 (OBS-01, 2026-04-20)
- ✓ Phase 04 SECURITY retroactive audit（`04-SECURITY.md` SEC-01 evidence）— v1.1 Phase 7 (2026-04-20)
- ✓ ADR 流程 self-check（README 索引 + `validate-adr-frontmatter` + `adr-check` sacrificial PR）— v1.1 Phase 8 (2026-04-20)；ADR 0019 landed
- ✓ **SCAF-01**: Developer can run `npx create-rigging <name>` and get a fully working project directory — v1.2 Phase 9 (2026-04-20)
- ✓ **SCAF-02**: Generated project's package name and relevant identifiers are automatically substituted with the given project name — v1.2 Phase 10 (2026-04-20)
- ✓ **SCAF-03**: Generated project passes `bun test` out of the box (all tests green) — v1.2 Phase 9 (2026-04-20)
- ✓ **SCAF-04**: Generated project includes ready-to-use GitHub Actions CI workflow — v1.2 Phase 9 (2026-04-20)
- ✓ **SCAF-05**: `create-rigging` package is published to npm (public, `npx` invocable) — v1.2 Phase 9 (2026-04-20)
- ✓ **SCAF-06**: `.planning/` and scaffold-internal files are excluded from the generated project — v1.2 Phase 9 (2026-04-20)
- ✓ **SCAF-07**: Usage documentation updated (README + `docs/quickstart.md`) to cover scaffold installation — v1.2 Phase 10 (2026-04-20)

### Active

<!-- v1.3 — populated via $gsd-new-milestone 2026-04-20 -->

- [ ] **PROD-01**: Developer can configure a real email adapter (Resend or Postmark) so that email verification and password reset emails are delivered to users' inboxes
- [ ] **PROD-02**: Rate limiting state persists across application restarts and multiple instances via a Redis or DB-backed store
- [ ] **PROD-03**: All HTTP requests and key domain operations emit OpenTelemetry traces and metrics compatible with any OTLP backend

**Deferred to v1.4+（候選池，待下個 milestone 重議）：**

- Extended identity: OAuth / 2FA / Magic link (IDN-01..03)

### Out of Scope

<!-- Confirmed at v1.0 close. Reasons still valid. -->

- **前端 UI（React/Vue/任何 client app）** — v1 是 API-first 後端；UI 留給未來或由使用框架的人自行搭配
- **真實 Email 服務商整合 v1 範圍內** — 移到 Active 候選池（PROD-01），v1.0 之後以 adapter 替換 ConsoleEmailAdapter
- **OAuth / SSO / 2FA / Magic Link v1 範圍內** — 移到 Active 候選池（IDN-01..03）；v1 只驗證 email+password 已達穩定
- **Agent 之間的 A2A 協議 / MCP server** — 是未來潛力不是近期範圍；先把單 Agent 在 harness 上的體驗磨好
- **生產級 observability / tracing / rate limiting v1 範圍內** — 移到 Active 候選池（PROD-02/03）
- **多租戶 / 團隊 / 權限 RBAC** — 下個抽象層次，留給 v2+
- **NPM 套件發布（@rigging/core 等）v1 範圍內** — 移到 Active 候選池（SCAF-03），待 API 再穩定一輪後拆
- **WebSocket / SSE / real-time events** — v1 只做 REST；real-time 屬 domain 功能擴充而非 harness 核心
- **GraphQL API** — REST + Swagger 足以展示 harness
- **容器 image 發布（Docker Hub / ghcr.io）** — docker-compose 供 dev；正式 deploy 由使用者自行打包

## Context

- **v1.0 交付規模：** 80 commits、320 files changed、~3,421 LOC `src/**/*.ts`；Phase 1-4 在 2026-04-19 單日 out-of-band 落地（atomic-per-phase commit 策略），Phase 5 在 2026-04-20 以 reconcile-in-place 模式收尾。Timeline 總共 ~2 天（2026-04-18 init → 2026-04-20 milestone close）。
- **技術生態驗證通過：** Bun 1.3.12 + Elysia 1.4.28 + Drizzle 0.45.2 + BetterAuth 1.6.5 組合在 v1.0 範圍內可用；唯一需要 adopted deviation 記錄的是 integration test 採共用 Postgres 而非 testcontainers（ADR 0018）。
- **Harness Engineering 論述 self-enforcing：** Phase 3 atomic 的「不可拆」在 Phase 4 dogfood 時被驗證——API Key verify 從 prefix-match 改為 hash-match 是在整合測試開跑才暴露的 harness 缺陷，若早一 phase 拆掉會漏。這個經驗寫入 `milestones/v1.0-ROADMAP.md` 的 Retrospective。
- **Adopted-scope 模式規範化：** Phase 4/5 皆以「PLAN.md files_modified 外的 hardening 擴張」為 atomic-phase commit 標準做法，SUMMARY.md 顯式記錄差異；未來 phase execution 的 deviation 預設沿用此 pattern。
- **v1.1 補齊：** CI 首跑 + fail-mode、SEC-01 文件證據、ADR gate + ADR 0019 已落地；剩餘可選人工驗證見 Phase 3 `03-VERIFICATION.md`（`human_needed`，milestone close 已 acknowledge）。
- **歷史：** v1.0 REQUIREMENTS traceability 已以 `milestones/v1.0-REQUIREMENTS.md` 固化；Phase 5 plan-level partial summaries 由 `05-SUMMARY.md` matrix 涵蓋。

## Constraints

- **Tech stack**: Bun + Elysia + TypeScript + PostgreSQL + Drizzle ORM + BetterAuth — ✓ v1.0 驗證可用，v1.1 預設繼續（換掉任一需 ADR）
- **Architecture**: DDD 分層 + ADR — ✓ v1.0–v1.1 落地 19 ADRs (0000..0019)，機制可持續
- **Auth mechanism**: Runtime Guards + DI 為主 — ✓ v1.0 proved workable；若要改純型別層強制需新 ADR
- **Identity**: 雙軌（session for human, API Key for agent）— ✓ v1.0 proved；OAuth 若進入下個 milestone Active 須配 ADR 擴充 identityKind
- **Email**: Dev-only console log — v1 範圍；下個 milestone 候選 PROD-01 轉真實 adapter（以 `IEmailPort` 替換實作即可）
- **Quality**: 社群可用等級 — ✓ v1.0 達成（100% coverage 於 domain+application 超標）；生產級留給 v2+
- **Delivery**: API-first，無前端 UI — 持續有效

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Runtime: Bun 1.3.12（非 Node.js） | 原生 TS、速度、與 Elysia 生態整合 | ✓ Good — v1.0 dev 體驗流暢，CI 用 `oven-sh/setup-bun@v2` |
| Web 框架: Elysia 1.4.28 | TypeScript-first、plugin 模式、`.macro` 為 AuthContext 落點 | ✓ Good — ADR 0012 canonical plugin ordering + `.macro` AuthContext 證實設計工作 |
| DB: PostgreSQL 16 + Drizzle ORM 0.45.2 | 生產級、TS 型別深度整合、DDD repository 體驗佳 | ✓ Good — 21 plans / 3 tables (auth/agents) landing 無阻 |
| DB driver: postgres-js（非 `bun:sql`） | ADR 0010 — bun:sql 尚不穩 | ✓ Good — v1.0 零事件 |
| Auth: BetterAuth 1.6.5 | Lucia maintenance，BetterAuth TS-first | ⚠️ Revisit — API Key 驗證要改 hash lookup（P4 hardening）+ AUTH-11 reset 不自動 revoke other sessions（ADR 0016 wrap）。機制仍可用但揭露出需要自己補程式的範圍 |
| DI/Guards: Elysia 內建（`.derive()` / `.decorate()` / `.macro()`） | 不引入第二套 IoC 避免概念分裂 | ✓ Good — Runtime Guard factory 配合 `.macro` 落地乾淨 |
| v1 交付形式: Reference App（非 scaffold） | 先驗證概念再抽 scaffold | ✓ Good — v1.0 shipped；SCAF-01 留給 v1.1+ 決策 |
| Email: dev-only console log | 避免外部服務綁架 harness | ✓ Good — `ConsoleEmailAdapter` via `IEmailPort`，未來可直換 |
| Demo Domain: Agent 元專案（dog-fooding） | 自己吃自己的狗糧 | ✓ Good — P4 dogfood 揭露 P3 API Key lookup 缺陷，dogfood 價值已證實 |
| Auth v1 範圍包含 API Key | 雙軌論述不完整沒法走 | ✓ Good — P4 DEMO-04 以 API Key 走完整 dogfood 流程 |
| Phase 3 atomic unsplittable | 任一拆出即破壞論述或留 CVE-class 漏洞 | ✓ Good — 1 phase 內完整 ship regression suite 含 CVE-2025-61928 |
| Canonical plugin ordering (ADR 0012) | 防 scoped plugin undefined cascade (elysiajs #1366) | ✓ Good — 整合測試走真 createApp，reorder 立刻紅燈 |
| Anti-enumeration: cross-user 統一 404 (D-09) | 不用 403 避免洩漏資源存在性 | ✓ Good — matrix 4 動詞統一 code |
| EvalDataset jsonb immutable (ADR 0017) | 外部 eval runner 可把 id 當快照 | ✓ Good — 三端點 POST/GET/DELETE 已落地 |
| Integration tests shared Postgres (ADR 0018, adopted deviation) | dev velocity + CI 簡化；trade-off 是測試間不完全隔離 | ⚠️ Revisit — 若 v1.1+ 進入多租戶或平行化測試須重評 |
| API Key hash lookup 取代 prefix lookup (P4 04-04 adopted scope) | 共用 prefix 時 prefix lookup 會選錯列 | ✓ Good — findByKeyHash 落地，SHA-256 hex 比對 |
| Session fixation: Scenario B wrap (ADR 0016) | BetterAuth 1.6.5 原生不清其他 session | ✓ Good — `ResetPasswordUseCase.execute` 自己呼叫 `revokeSessions` |
| Adopted-scope commit pattern | Phase 內執行期才暴露的 hardening 併入 atomic commit 以避免中間狀態紅燈 | ✓ Good — Phase 4/5 兩次應用皆在 SUMMARY.md 顯式記錄 |
| CI smoke + ADR validation in PR | Boot + `/health` 與 MADR frontmatter gate 可觀測擋錯 PR | ✓ Good — ADR 0019 + sacrificial PR #3 `adr-check` FAILURE URL recorded |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

<details>
<summary>Previous state (pre-v1.0-close snapshot)</summary>

Before milestone close on 2026-04-20, Requirements/Active listed the 13 v1 acceptance items as unchecked boxes and Key Decisions table had all outcomes marked `— Pending`. Full historical snapshot preserved in git at `50c32e1^ .planning/PROJECT.md`; milestone-scoped requirement archive in `milestones/v1.0-REQUIREMENTS.md`.

</details>

---
*Last updated: 2026-04-20 — v1.3 Production Hardening milestone started*
