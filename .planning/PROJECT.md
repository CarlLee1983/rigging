# Rigging

## What This Is

Rigging 是一個用 **Harness Engineering** 思維打造的 opinionated 專案骨架（最終形式是 `npx rigging`，v1 先以 Reference App 形式存在）。它不是工具箱（像 LangChain），而是「軌道」——透過強意見的技術棧（Bun + Elysia + DDD + ADR）與強制的 AuthContext 身分邊界，讓 AI Agent 在其上實作功能時，**被結構本身約束**寫出安全、一致、可組合的程式碼。

使用對象是開發者與 AI Agent：開發者選擇這條軌道，AI Agent 在軌道上敷捷分段實作功能。

## Core Value

**AI Agent 寫出來的程式碼必須「自動」具備安全性與結構性——靠的不是提示詞約束，而是框架本身的軌道（type system + runtime guards + DI）讓錯誤的寫法根本跑不起來。**

如果其他都失敗，這一點不能失敗：任何 Domain 操作必須通過 AuthContext，沒有 AuthContext 就連 handler 都 wire 不起來。

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] 定義並鎖定 opinionated 技術棧（Bun + Elysia + TypeScript + PostgreSQL + Drizzle）
- [ ] 建立 DDD 專案骨架（Domain / Application / Infrastructure / Presentation 分層）
- [ ] ADR（Architecture Decision Records）紀錄機制上線，關鍵技術決策留痕
- [ ] BetterAuth 整合：Email/Password 註冊 + 登入 + 登出 + session 管理
- [ ] Email 驗證流程（dev 階段 console log 輸出驗證連結）
- [ ] 密碼重設流程（dev 階段 console log 輸出重設連結）
- [ ] API Key 管理：人類使用者可在 dashboard API 產生/查詢/撤銷 API Key
- [ ] AuthContext 作為強制身分邊界：Elysia `.derive()` / `.decorate()` 注入，未通過則 handler 無法取得 Domain service
- [ ] Runtime Guards：DI 層在取用 Domain service 時檢查 AuthContext，缺失則 throw
- [ ] 雙軌驗證：人用 session（Cookie），Agent 用 API Key（Header）——兩者都能解析為 AuthContext
- [ ] 示範 Domain：Agent 自己用的元專案（agent 定義 / prompt 版本管理 / evaluation 資料集），證明 harness 可用性
- [ ] 測試品質達「社群可用」等級——核心模組單元測試 + 關鍵流程整合測試
- [ ] 使用者文件（README + quickstart）足以讓外部開發者 clone 起來跑

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- **前端 UI（React/Vue/任何 client app）** — v1 是 API-first 後端；UI 留給未來或由使用框架的人自行搭配
- **`npx rigging` CLI 生成器** — v1 先以手工維護的 Reference App 存在，驗證概念後再從中抽取 scaffold
- **真實 Email 服務商整合（Resend/SMTP）** — dev 階段 console log 即可；部署時再接，不影響 harness 本身
- **OAuth / SSO / 2FA / Magic Link** — 非核心，徒增 auth 複雜度；v1 只驗證 email+password 能穩定跑通
- **Agent 之間的 A2A 協作協議 / MCP server** — 是未來潛力不是 v1 範圍；先把單 Agent 在 harness 上的體驗磨好
- **生產級 observability / tracing / rate limiting** — 社群可用等級先，生產級強化留給後續橫向擴充
- **多租戶 / 團隊 / 權限 RBAC** — 先把「單一使用者 + AuthContext 邊界」做乾淨，團隊模型是下個抽象層次
- **NPM 套件發布（@rigging/core 等）** — v1 不拆套件，先在 monorepo/單 repo 內定型

## Context

- **技術生態：** Bun 1.x + Elysia 是新興但快速成熟的 TypeScript runtime/框架組合，性能優異，與型別系統深度整合。PostgreSQL + Drizzle 是目前 TS 生態 DDD 落地的主流選擇。
- **BetterAuth 選型理由：** Lucia 已宣告進入 maintenance 模式，社群正大量轉向 BetterAuth；它 framework-agnostic、支援 Elysia、TypeScript-first，是 2025~2026 當下的合理下注。
- **Harness Engineering 哲學：** 靈感類似 Ruby on Rails「convention over configuration」，但指向對象是 AI Agent 而非人類——讓 Agent 面對的不是無限自由，而是一條清楚的軌道，錯誤寫法被框架本身擋住。
- **DDD + ADR 組合：** DDD 提供分層結構，ADR 記錄「為什麼這樣選」；兩者合起來給 AI Agent 一份活的「脈絡」，未來新 Agent 接手能快速讀懂前人的決策脈絡。
- **敷捷分段：** 第一階段只做 harness 骨架 + auth；第二階段才開始用這條軌道跑縱向 Domain 功能，藉此驗證 harness 是否真的讓 Agent 寫起來又快又安全。

## Constraints

- **Tech stack**: Bun + Elysia + TypeScript + PostgreSQL + Drizzle ORM + BetterAuth — 已鎖定，為維持強意見不走回頭路
- **Architecture**: DDD 分層（Domain / Application / Infrastructure / Presentation）+ ADR — 一切核心決策須寫 ADR
- **Auth mechanism**: Runtime Guards + DI 為主（Elysia `.derive()` / `.decorate()` + plugin），非純型別層強制 — 偏好實務可維護性
- **Identity**: 雙軌驗證（session for human, API Key for agent）一次到位 — Agent 使用情境 v1 就要能跑
- **Email**: Dev-only console log — 避免外部服務依賴污染核心 harness 開發
- **Quality**: 社群可用等級（unit + 關鍵 integration tests），非生產級 — 為了維持開發節奏
- **Delivery**: API-first，無前端 UI — 聚焦後端骨架

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Runtime: Bun（非 Node.js） | 原生 TS、bun:sqlite、速度快、與 Elysia 生態原生整合 | — Pending |
| Web 框架: Elysia | TypeScript-first、plugin 模式與 harness 理念契合、`.derive()` 正好是 DI/guard 的落點 | — Pending |
| DB: PostgreSQL + Drizzle ORM | 生產級選擇、TS 型別深度整合、DDD repository 實作體驗佳 | — Pending |
| Auth: BetterAuth | Lucia 進入 maintenance，BetterAuth 社群動能強、支援 Elysia、TS-first | — Pending |
| DI/Guards: Elysia 內建（`.derive()` / `.decorate()` / plugin） | 與框架深度整合、不引入第二套 IoC（如 tsyringe）避免概念分裂 | — Pending |
| v1 交付形式: Reference App（非 scaffold） | 先驗證概念再抽取 scaffold，避免過早抽象化 | — Pending |
| Email: dev-only console log | 避免 v1 被外部服務依賴綁架，部署時可替換 Adapter | — Pending |
| Demo Domain: Agent 元專案（dog-fooding） | 自己吃自己的狗糧，每個功能都是 harness 可用性的真實驗證 | — Pending |
| Auth v1 範圍包含 API Key | Agent 雙軌驗證是核心論述，v1 就要能跑，否則 harness 論點不完整 | — Pending |

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

---
*Last updated: 2026-04-18 after initialization*
