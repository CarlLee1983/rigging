# Requirements: Rigging

**Defined:** 2026-04-19
**Core Value:** AI Agent 寫出來的程式碼必須「自動」具備安全性與結構性——靠的不是提示詞約束，而是框架本身的軌道（type system + runtime guards + DI）讓錯誤的寫法根本跑不起來。

## v1 Requirements

Requirements for initial Reference App release. Each maps to roadmap phases.

### Foundation

- [ ] **FND-01**: 開發者 clone repo 後執行 `bun install && bun run dev` 能啟動 Elysia server
- [ ] **FND-02**: `.env.example` 含所有必要環境變數，啟動時以 TypeBox schema 校驗缺值立即失敗
- [ ] **FND-03**: `docker-compose up` 啟動 PostgreSQL 16 + 預建 dev database
- [ ] **FND-04**: Drizzle ORM 已配置並明確使用 `drizzle-orm/postgres-js` 驅動（非 `bun:sql`）
- [ ] **FND-05**: `src/shared/kernel/` 提供 `Result<T,E>` / `Brand<T,K>` / `UUID` / `DomainError` 基底類別，皆 framework-free
- [ ] **FND-06**: Biome 2.x 負責 lint + format，single config file 管控全 repo

### Architecture Discipline

- [ ] **ARCH-01**: `src/{feature}/{domain,application,infrastructure,presentation}/` DDD 四層目錄結構在 repo 根層就位並被 lint 規則保護
- [ ] **ARCH-02**: Domain 層被 lint 規則禁止 import `drizzle-orm` 或任何 framework 套件（違規 CI fail）
- [ ] **ARCH-03**: Repository 必定回 Domain entity；絕不洩漏 Drizzle `InferSelectModel` 到 Domain 層（由 Mapper 轉換）
- [ ] **ARCH-04**: Feature Module 以 factory function 導出（`createAuthModule(shared)` 回傳 Elysia plugin），不使用 tsyringe/inversify 等外部 IoC container
- [ ] **ARCH-05**: 全域 error handler plugin 將 `DomainError` 子類映射到對應 HTTP status（ValidationError→400 / UnauthorizedError→401 / ForbiddenError→403 / NotFoundError→404 / ConflictError→409）

### ADR Mechanism

- [ ] **ADR-01**: `docs/decisions/` 目錄就位，採 MADR 4.0 格式，`NNNN-kebab-case-title.md` 命名
- [ ] **ADR-02**: 9 條起始 ADR 全部 ship（MADR 自指 / Bun / Elysia / DDD / BetterAuth / Drizzle / AuthContext / Runtime Guards / Dual Auth）
- [ ] **ADR-03**: 追加 3 條高風險 ADR（Rigidity Map / postgres-js driver 選擇 / Resolver precedence）
- [ ] **ADR-04**: `docs/decisions/README.md` 維護 ADR 索引表（編號 / 標題 / Status / 日期）
- [ ] **ADR-05**: PR template 包含 ADR checkbox（「此 PR 是否需要 ADR？」）

### AGENTS.md

- [ ] **AGM-01**: Repo 根層 `AGENTS.md`（2025/08 開放標準格式）明列 Rigging 的 Rigidity Map：必嚴格 / 可 ADR 逃生 / 純約定三級
- [ ] **AGM-02**: `AGENTS.md` 列出 anti-features（禁止 AI Agent 主動提議擴張的項目：OAuth / UI framework / 多租戶等）

### Web Framework Skeleton

- [ ] **WEB-01**: Elysia `^1.4.28` app 啟動並掛載全域 plugin（error handler / logger / CORS / Swagger）
- [ ] **WEB-02**: `/health` endpoint 回 200 OK 且含 DB 連線健康檢查
- [ ] **WEB-03**: `@elysiajs/swagger` 自動生成 OpenAPI 3.x spec，`/swagger` 可訪問
- [ ] **WEB-04**: Request logger 使用 `@bogeychan/elysia-logger` + Pino 產結構化 JSON logs（含 request id、duration、status）

### Authentication — Foundation

- [ ] **AUTH-01**: 使用者可用 email + password 註冊帳號（由 BetterAuth email-password plugin 驅動）
- [ ] **AUTH-02**: 使用者可用 email + password 登入，session 以 cookie 儲存並跨瀏覽器 refresh 維持
- [ ] **AUTH-03**: 使用者可登出，並立即失效 session cookie
- [ ] **AUTH-04**: 密碼以 BetterAuth 預設 hashing 儲存；絕不明文或用 `bcrypt`（Bun 相容性考量）
- [ ] **AUTH-05**: BetterAuth `user` / `session` / `account` / `verification` / `apiKey` schema 由 `bunx @better-auth/cli generate` 產生並 commit 進 `src/auth/infrastructure/schema/`；對應 Drizzle migration 已 commit 進 `drizzle/` 目錄

### Authentication — Email Verification

- [ ] **AUTH-06**: 註冊後系統透過 `IEmailPort` adapter 發送驗證連結；v1 由 `ConsoleEmailAdapter` 輸出到 stdout
- [ ] **AUTH-07**: 使用者點擊驗證連結後 email 狀態更新為 verified
- [ ] **AUTH-08**: 未驗證 email 的使用者嘗試特定受保護操作時回 403（保留擴充點）

### Authentication — Password Reset

- [ ] **AUTH-09**: 使用者可請求密碼重設，系統透過 `IEmailPort` 發送重設連結（v1 console log）
- [ ] **AUTH-10**: 使用者透過連結設定新密碼後可立即登入
- [ ] **AUTH-11**: 密碼重設成功後，使用者其他裝置的既有 session 全部失效（session fixation mitigation，Pitfall #6）

### Authentication — API Key (Agent Track)

- [ ] **AUTH-12**: 已登入使用者可透過 `POST /api-keys` 產生新 API Key，回傳一次性明文 key 與 metadata（之後永不回 plaintext）
- [ ] **AUTH-13**: API Key 儲存時為 hash 形式；DB 中不應含 raw key 子字串（integration test 驗證）
- [ ] **AUTH-14**: 使用者可列出自己的 API Key（`GET /api-keys`）與撤銷（`DELETE /api-keys/:id`）
- [ ] **AUTH-15**: 建立 API Key 時強制驗證 `body.userId === session.userId`（CVE-2025-61928 class 防線）
- [ ] **AUTH-16**: API Key 支援選填 `scopes: string[]` 與 `expiresAt`；v1 預設 `['*']` 並可設定 30/60/90 天過期

### AuthContext Boundary

- [ ] **AUX-01**: `AuthContext = { userId: UUID, identityKind: 'human' | 'agent', scopes: string[], apiKeyId?: UUID, sessionId?: UUID }` 作為 value object 定義於 `src/auth/domain/auth-context.ts`
- [ ] **AUX-02**: Elysia `.macro({ requireAuth: { resolve } })` plugin 單一根層掛載、scope = `global`；未宣告 `requireAuth: true` 的 handler 在型別層取不到 `ctx.authContext`
- [ ] **AUX-03**: Resolver 依序檢查 `x-api-key` header → cookie session；**API Key 優先於 cookie**；兩者皆無或皆失效則回 401
- [ ] **AUX-04**: Resolver 對 API Key 做 `crypto.timingSafeEqual` 比對，避免 timing attack
- [ ] **AUX-05**: Domain service factory（`getUserService(ctx: AuthContext)`）在 runtime 斷言 `ctx.authContext` 存在，缺失 throw `AuthContextMissingError`（不信 TS narrowing，Pitfall #4 防線）
- [ ] **AUX-06**: Integration test：啟動 app 不掛 auth plugin，所有 protected route 必回 401（不可 500、不可假性通過，Pitfall #3 防線）
- [ ] **AUX-07**: Integration test：帶 API Key 與 cookie 同時請求，AuthContext `identityKind` 為 `'agent'`（驗證 precedence）

### Demo Domain — Agent 元專案

- [ ] **DEMO-01**: `Agent` entity（id、name、owner userId、createdAt、updatedAt）完整 CRUD，全部經 AuthContext
- [ ] **DEMO-02**: `PromptVersion` entity（id、agentId、version 單調遞增、content、createdAt）支援建立新版本、查詢指定版本、列出歷史版本
- [ ] **DEMO-03**: `EvalDataset` entity（id、agentId、name、cases: Array<{ input, expectedOutput }>）支援建立 / 查詢 / 刪除；shape 由 P4 planning ADR 定案
- [ ] **DEMO-04**: Agent 可用 API Key 呼叫「查自己的 prompt 最新版本」endpoint；系統驗證 `apiKey.userId === agent.ownerId`
- [ ] **DEMO-05**: 只讀 scope 的 API Key 呼叫 write endpoint 必回 403（scope check 實測）
- [ ] **DEMO-06**: Demo domain 完整走過 feature module factory pattern——若複用成本高則視為 P1 template 有設計債，需 ADR 記錄調整

### Quality Gate — Testing

- [ ] **QA-01**: Domain entities 與 use cases 具備 unit tests（mocked ports），覆蓋率 ≥ 80% 於 `src/{feature}/domain/` 與 `src/{feature}/application/`
- [ ] **QA-02**: Integration tests 使用 `testcontainers` 臨時 Postgres，覆蓋 auth 完整流程（register / verify / login / reset / API Key CRUD）
- [ ] **QA-03**: Regression test 套件明確包含：CVE-2025-61928 attack pattern / AuthContext bypass / password reset invalidates other sessions / API Key hashed not plaintext / Elysia plugin undefined cascade
- [ ] **QA-04**: E2E tests 使用 `bun:test` + `app.handle(Request)` 或 `@elysiajs/eden` 跑過 demo domain 完整使用者流程
- [ ] **QA-05**: `bun test` 於 clean checkout（`bun install --frozen-lockfile`）下可全數通過

### Quality Gate — CI

- [ ] **CI-01**: `.github/workflows/ci.yml` 在每次 PR 跑：`biome check` / `tsc --noEmit` / `bun test` / migration drift check
- [ ] **CI-02**: Migration drift check 執行 `drizzle-kit generate --name=ci-drift` 並 fail if 有新生成檔案
- [ ] **CI-03**: CI 在 clean checkout 環境跑（驗證 Bun native-module 相容性）

### Quality Gate — Documentation

- [ ] **DOC-01**: `README.md` 首屏呈現 Core Value（harness engineering + AuthContext 強制邊界），而非 convention / file layout
- [ ] **DOC-02**: `docs/quickstart.md` 提供 10 分鐘內完成的路徑：clone → env → docker-compose up → migrate → dev → 發送 authenticated request
- [ ] **DOC-03**: `docs/architecture.md` 摘要 DDD 分層、AuthContext macro 與雙軌身分解析模式
- [ ] **DOC-04**: `docs/decisions/README.md` 為 ADR 索引，每條 ADR 有 status 標記
- [ ] **DOC-05**: `AGENTS.md` 含「AI Agent 接手本專案前必讀」段落，列 Rigidity Map + anti-features

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Scaffold & Distribution

- **SCAF-01**: `npx create-rigging <project-name>` CLI generator 從 Reference App 抽取 template
- **SCAF-02**: `bun rigging new-domain <name>` scaffold 命令產生完整 DDD 四層目錄與起始檔案（降低 harness UX 摩擦）
- **SCAF-03**: 套件拆分為 `@rigging/core` / `@rigging/auth` / `@rigging/testing` 發佈 npm

### Production Hardening

- **PROD-01**: 真實 email service adapter（Resend / Postmark），含 bounce webhook 處理
- **PROD-02**: BetterAuth rate limit 補強（per-email vs per-IP），用持久化 store（Postgres / Redis）
- **PROD-03**: OpenTelemetry instrumentation（traces + metrics），可接 Loki / Grafana
- **PROD-04**: Drizzle 1.0 migration ADR 與升級計畫（當 `latest` dist-tag flip 時）

### Extended Identity

- **IDN-01**: OAuth providers（Google / GitHub）— 必須配 AuthContext identityKind 擴充
- **IDN-02**: 2FA / TOTP 支援
- **IDN-03**: Magic link / passwordless login
- **IDN-04**: Passkey / WebAuthn 支援

### Multi-Tenancy

- **TEN-01**: Organization entity + membership
- **TEN-02**: RBAC（Role-Based Access Control）導入 AuthContext.scopes 結構化擴充
- **TEN-03**: Per-tenant API Key 範圍限制

### Agent Ecosystem

- **AGT-01**: MCP server 整合（Rigging 當 MCP server 暴露 domain operation）
- **AGT-02**: A2A（Agent-to-Agent）協議 —— Agent 間身分互信
- **AGT-03**: Webhook / event-bus 供 Agent 訂閱 domain events

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| 前端 UI / React / Vue / SvelteKit | v1 API-first；UI 留給使用 framework 的人自行搭配 |
| `npx rigging` CLI generator（v1 版本） | v1 先 Reference App 手工維護驗證概念，抽 scaffold 列入 v2 |
| 真實 email service（Resend / SMTP） | dev-only console log 足以驗證 email 流程；接 service 與 harness 核心無關 |
| OAuth / SSO / 2FA / Magic Link / Passkey | 每多一條身分路徑就多一條 AuthContext 解析分支，違反「一條軌道」論述 |
| MCP server / A2A / Agent orchestration | v1 聚焦「單 Agent 在 harness 上寫程式」，多 Agent 協作屬下個抽象層次 |
| OpenTelemetry / distributed tracing / Prometheus metrics | 社群可用等級先；生產級 observability 留給 PROD-03 |
| Multi-tenancy / Organization / RBAC | 下個抽象層次；v1 先把「單 user + AuthContext 邊界」做乾淨 |
| NPM 套件發布（@rigging/core 等） | API 還會改，不宜過早定型；v2 的 SCAF-03 處理 |
| WebSocket / SSE / real-time events | v1 只做 REST；real-time 屬 domain 功能擴充而非 harness 核心 |
| GraphQL API | v1 REST + Swagger 足以展示 harness；GraphQL 屬 presentation 層替換 |
| 容器 image 發布（Docker Hub / ghcr.io） | v1 docker-compose 供 dev；正式 deploy 由使用者自行打包 |
| Production-grade migration tooling（zero-downtime）| 社群可用等級；生產級 migration 策略留給實際部署團隊 |

## Traceability

Which phases cover which requirements. Per-requirement mapping confirmed at roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Pending |
| FND-02 | Phase 1 | Pending |
| FND-03 | Phase 1 | Pending |
| FND-04 | Phase 1 | Pending |
| FND-05 | Phase 1 | Pending |
| FND-06 | Phase 1 | Pending |
| ARCH-01 | Phase 1 | Pending |
| ARCH-02 | Phase 1 | Pending |
| ARCH-03 | Phase 1 | Pending |
| ARCH-04 | Phase 1 | Pending |
| ARCH-05 | Phase 1 | Pending |
| ADR-01 | Phase 1 | Pending |
| ADR-02 | Phase 1 | Pending |
| ADR-03 | Phase 1 | Pending |
| ADR-04 | Phase 1 | Pending |
| ADR-05 | Phase 1 | Pending |
| AGM-01 | Phase 1 | Pending |
| AGM-02 | Phase 1 | Pending |
| WEB-01 | Phase 2 | Pending |
| WEB-02 | Phase 2 | Pending |
| WEB-03 | Phase 2 | Pending |
| WEB-04 | Phase 2 | Pending |
| AUTH-01 | Phase 3 | Pending |
| AUTH-02 | Phase 3 | Pending |
| AUTH-03 | Phase 3 | Pending |
| AUTH-04 | Phase 3 | Pending |
| AUTH-05 | Phase 3 | Pending |
| AUTH-06 | Phase 3 | Pending |
| AUTH-07 | Phase 3 | Pending |
| AUTH-08 | Phase 3 | Pending |
| AUTH-09 | Phase 3 | Pending |
| AUTH-10 | Phase 3 | Pending |
| AUTH-11 | Phase 3 | Pending |
| AUTH-12 | Phase 3 | Pending |
| AUTH-13 | Phase 3 | Pending |
| AUTH-14 | Phase 3 | Pending |
| AUTH-15 | Phase 3 | Pending |
| AUTH-16 | Phase 3 | Pending |
| AUX-01 | Phase 3 | Pending |
| AUX-02 | Phase 3 | Pending |
| AUX-03 | Phase 3 | Pending |
| AUX-04 | Phase 3 | Pending |
| AUX-05 | Phase 3 | Pending |
| AUX-06 | Phase 3 | Pending |
| AUX-07 | Phase 3 | Pending |
| DEMO-01 | Phase 4 | Pending |
| DEMO-02 | Phase 4 | Pending |
| DEMO-03 | Phase 4 | Pending |
| DEMO-04 | Phase 4 | Pending |
| DEMO-05 | Phase 4 | Pending |
| DEMO-06 | Phase 4 | Pending |
| QA-01 | Phase 5 | Pending |
| QA-02 | Phase 5 | Pending |
| QA-03 | Phase 5 | Pending |
| QA-04 | Phase 5 | Pending |
| QA-05 | Phase 5 | Pending |
| CI-01 | Phase 5 | Pending |
| CI-02 | Phase 5 | Pending |
| CI-03 | Phase 5 | Pending |
| DOC-01 | Phase 5 | Pending |
| DOC-02 | Phase 5 | Pending |
| DOC-03 | Phase 5 | Pending |
| DOC-04 | Phase 5 | Pending |
| DOC-05 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 55 total
- Mapped to phases: 55 ✓
- Unmapped: 0 ✓
- Per-phase counts: Phase 1 = 18 / Phase 2 = 4 / Phase 3 = 23 / Phase 4 = 6 / Phase 5 = 13

---
*Requirements defined: 2026-04-19*
*Last updated: 2026-04-19 after roadmap creation (traceability expanded to per-REQ-ID rows)*
