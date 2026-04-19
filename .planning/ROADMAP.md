# Roadmap: Rigging

**Created:** 2026-04-19
**Granularity:** Standard (5-8 phases; derived: 5)
**Parallelization:** Enabled
**Coverage:** 55/55 v1 requirements mapped

## Overview

Rigging v1 交付一個 opinionated、API-first 的 TypeScript backend Reference App,用 Harness Engineering 思維把 AuthContext 強制邊界寫進框架本身。五個 phase 依研究共識依賴順序推進:先鋪 Foundation(技術棧 + DDD 紀律 + ADR 機制)、再把 Elysia app skeleton 與 DDD 四層驗證起來、接著把 Auth Foundation(BetterAuth + 雙軌 AuthContext + Runtime Guards + CVE regression suite)作為 atomic unsplittable phase ship、然後以 Agent 元專案 dogfood 驗證 harness 可複用性、最後由 Quality Gate phase 收尾測試 / CI / docs。核心論述是:錯誤的寫法在這條軌道上根本 wire 不起來。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Stack lock、DDD 骨架、shared kernel、ADR 機制、AGENTS.md 就位 (completed 2026-04-19)
- [x] **Phase 2: App Skeleton** - Elysia root app、全域 plugin、`/health`、Swagger,驗證 DDD 四層模板 (completed 2026-04-19)
- [x] **Phase 3: Auth Foundation** - BetterAuth + 雙軌 AuthContext macro + Runtime Guards + CVE regression suite(atomic,不可拆) (completed 2026-04-19)
- [ ] **Phase 4: Demo Domain** - Agent 元專案 dogfood(Agent / PromptVersion / EvalDataset),驗證 feature module factory 複用性
- [ ] **Phase 5: Quality Gate** - Unit / integration / e2e tests、GitHub Actions CI、README、quickstart、architecture docs

## Phase Details

### Phase 1: Foundation
**Goal**: 鋪設 Rigging 的技術骨架與紀律基礎,讓後續所有 phase 都能安全依賴 shared kernel、確定 driver 選擇、以 ADR 記錄起始決策,並讓 DDD 四層結構被 lint 規則保護。
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, FND-04, FND-05, FND-06, ARCH-01, ARCH-02, ARCH-03, ARCH-04, ARCH-05, ADR-01, ADR-02, ADR-03, ADR-04, ADR-05, AGM-01, AGM-02
**Success Criteria** (what must be TRUE):
  1. 開發者可 clone repo、執行 `bun install && docker-compose up -d && bun run dev`,在 10 分鐘內看到 process 啟動且 Postgres 可連線
  2. Biome `check` / `tsc --noEmit` 於 clean checkout 下 pass,且 Biome 規則能阻擋 `src/**/domain/**` import `drizzle-orm`(CI-like 驗證)
  3. `docs/decisions/` 下至少 12 條 ADR(9 條起始 + Rigidity Map + postgres-js driver + Resolver precedence)以 MADR 4.0 格式 commit,且 `docs/decisions/README.md` 索引表列出每條 status
  4. `AGENTS.md` 在 repo 根層就位並明列 Rigidity Map 三級(必嚴格 / 可 ADR 逃生 / 純約定)與 anti-features 清單
  5. `src/shared/kernel/` 可被任意層 import 且 zero framework import(`Result` / `Brand` / `UUID` / `DomainError` 皆 framework-free)
**Plans:** 5 plans
**Plan list**:
- [ ] 01-01-PLAN.md — Project bootstrap (package.json, tsconfig, biome base, DDD 目錄 scaffold, main.ts stub)
- [ ] 01-02-PLAN.md — Shared kernel (Result / Brand / UUID / DomainError + unit tests + framework-free contract test)
- [ ] 01-03-PLAN.md — DDD scaffold + Biome overrides (4 條 overrides + 9 個違規檔 + contract test + AUX-06 stub)
- [ ] 01-04-PLAN.md — ADR seed + AGENTS.md + PR gate (12 ADR + README index + PR template + adr-check workflow + Rigidity Map + anti-features)
- [ ] 01-05-PLAN.md — Env + Docker + Drizzle config + CI (config.ts TypeBox + docker-compose + .env.example + drizzle.config + ci.yml)
**UI hint**: no

### Phase 2: App Skeleton
**Goal**: 在 Foundation 骨架之上掛起 Elysia root app 與全域橫切 plugin(error handler / logger / CORS / Swagger / `/health`),讓 DDD 四層模板被一個 trivial feature 真實驗證過,之後 auth / demo 都能 clone 這個 shape。
**Depends on**: Phase 1 (需要 shared kernel 的 `DomainError` 基底類別給 error handler mapping、需要 DDD 目錄結構就位)
**Requirements**: WEB-01, WEB-02, WEB-03, WEB-04
**Success Criteria** (what must be TRUE):
  1. `bun run dev` 啟動後 `curl http://localhost:3000/health` 回 200 OK,含 DB 連線健康檢查(DB down 時回 503 而非 500)
  2. `curl http://localhost:3000/swagger` 能看到自動生成的 OpenAPI 3.x spec 頁面
  3. 每次請求 log 為結構化 JSON(stdout 可見 request id / method / path / status / duration 欄位)
  4. 故意 throw 一個 `DomainError` 子類可正確被全域 error handler 映射為對應 HTTP status(400/401/403/404/409)而非裸 500
**Plans:** 3 plans
**Plan list**:
- [x] 02-01-PLAN.md — Shared Drizzle+postgres-js DB client + 4 global plugins (requestLogger / cors / errorHandler / swagger) + unit tests (completed 2026-04-19, commits a5981c6/59d3bb4/8447384)
- [x] 02-02-PLAN.md — /health DDD four-layer walkthrough (domain value + application port/usecase + Drizzle adapter + controller + feature module factory) (completed 2026-04-19, commits 2a7d828/c03fb5c/1919d61)
- [x] 02-03-PLAN.md — createApp assembly + main.ts wire + ADR 0012 canonical plugin ordering + integration smoke test (completed 2026-04-19, commits 60d4b01/53023a2/51fd66f)
**UI hint**: no

### Phase 3: Auth Foundation
**Goal**: 交付 Rigging 論述核心——BetterAuth 整合 + 雙軌 AuthContext(cookie + API Key)+ Runtime Guards + Regression Suite 一次 land。作為 atomic、unsplittable phase:schema 生成、resolver precedence、Runtime Guard、CVE-2025-61928 防線、session invalidation 任一拆出都會破壞雙軌論述或留 CVE-class 漏洞。
**Depends on**: Phase 2 (auth plugin 需掛在已有 root app + error handler 之上;BetterAuth 產生的 `user/session/account/verification/apiKey` 表需 Drizzle migration 管道就緒)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10, AUTH-11, AUTH-12, AUTH-13, AUTH-14, AUTH-15, AUTH-16, AUX-01, AUX-02, AUX-03, AUX-04, AUX-05, AUX-06, AUX-07
**Success Criteria** (what must be TRUE):
  1. 人類可透過 API 完整走過:註冊 → 讀 stdout 驗證連結 → verify → 登入(拿到 session cookie)→ 登出(session 立即失效)
  2. 人類可透過 API 請求密碼重設 → 讀 stdout 重設連結 → 設定新密碼後登入;且原有其他裝置的 session 全部失效(session fixation regression 通過)
  3. 已登入人類可 `POST /api-keys` 拿到一次性 plaintext key + metadata、`GET /api-keys` 列出、`DELETE /api-keys/:id` 撤銷;DB 中搜尋不到 raw key 子字串(integration test 驗證)
  4. Agent 可單帶 `x-api-key` header 呼叫 protected endpoint,resolver 回傳 `identityKind: 'agent'`;同時帶 API Key + cookie 時 API Key 優先(precedence test 通過)
  5. Regression test suite 通過:CVE-2025-61928 attack pattern(非擁有者嘗試建 API Key → 403)、AuthContext bypass(不掛 auth plugin 啟 app 則全 protected route 回 401 而非 500)、timing-safe API Key compare、password reset invalidates other sessions、API Key hashed not plaintext
**Plans:** 5 plans
**Plan list**:
- [x] 03-01-PLAN.md — BetterAuth schema-gen spike + Drizzle migration + AUTH-11 session-fixation probe + drift contract (completed 2026-04-19)
- [x] 03-02-PLAN.md — Auth domain (AuthContext + ALLOWED_SCOPES + errors + Runtime Guard factory) + 4 application ports (completed 2026-04-19)
- [x] 03-03-PLAN.md — BetterAuth identity-service adapter (D-10 timing align) + Drizzle repos + 7 use cases + ConsoleEmailAdapter (completed 2026-04-19)
- [x] 03-04-PLAN.md — Presentation macro + 3 controllers + createAuthModule wire + 14 integration/regression tests (completed 2026-04-19)
- [x] 03-05-PLAN.md — 4 ADRs (0013/0014/0015/0016) + README index + Phase 3 exit gate (completed 2026-04-19)
**UI hint**: no

### Phase 4: Demo Domain
**Goal**: 用 Agent 元專案(Agent / PromptVersion / EvalDataset)dogfood 整條 harness——證明拿到 AuthContext 之後,Agent 管理自己的 prompt 與 evaluation 是乾淨的 happy path,且 feature module factory pattern 在「第二個 feature」複用成本低。同時量化「harness 太緊」UX 事件(>3 次視為設計債,開 ADR)。
**Depends on**: Phase 3 (demo 所有 endpoint 都走 `requireAuth` macro、demo 的 API Key 驗證依賴 Phase 3 的 AuthContext 結構、scope check 用的是 Phase 3 的 `apiKey.scopes` 欄位)
**Requirements**: DEMO-01, DEMO-02, DEMO-03, DEMO-04, DEMO-05, DEMO-06
**Success Criteria** (what must be TRUE):
  1. 開發者可用 authenticated session 透過 REST 建立 Agent、為該 Agent 建立多個 PromptVersion(版本單調遞增)、查詢指定版本與歷史列表
  2. 開發者可建立 EvalDataset(含多個 `{input, expectedOutput}` cases)、列出、刪除;shape 由 P4 planning ADR 定案
  3. Rigging dogfoods 自己:開發者產生 API Key → Agent 拿 key 呼叫「查自己的 prompt 最新版本」endpoint 成功;系統驗證 `apiKey.userId === agent.ownerId`(跨 user 存取回 403)
  4. 只讀 scope 的 API Key 呼叫 write endpoint 必回 403(scope check 實測通過)
  5. Demo domain 完整走過 feature module factory pattern;若複用成本高(>3 次「要解釋 harness」事件)則已開 ADR 記錄 P1 template 設計債與調整方向
**Plans:** 4 plans
**Plan list**:
- [ ] 04-01-PLAN.md — Domain + ports + schemas + migration + friction-log template (DEMO-01/02/03/06)
- [ ] 04-02-PLAN.md — Mappers + Drizzle repositories + 13 use cases + unit tests (scope+ownership+retry)
- [ ] 04-03-PLAN.md — TypeBox DTOs + 3 controllers + createAgentsModule + createApp wire + smoke test
- [ ] 04-04-PLAN.md — 8 integration tests + ADR 0017 + friction-tally verifier + checkpoint (DEMO-04/05 + D-09/12)
**UI hint**: no

### Phase 5: Quality Gate
**Goal**: 把 Rigging 推到「社群可用」門檻——unit / integration / e2e test 覆蓋關鍵流程(含 Phase 3 regression suite)、GitHub Actions CI 在 clean checkout 跑 lint / typecheck / test / migration drift、README 與 quickstart 讓外部開發者 10 分鐘內發出第一個 authenticated request、architecture docs 與 ADR 索引 shipping-quality。
**Depends on**: Phase 4 (API / DX surface 在 demo domain dogfood 後才穩定;README / quickstart / architecture docs 必須反映最終 surface,不能在 API 還在改的時候寫)
**Requirements**: QA-01, QA-02, QA-03, QA-04, QA-05, CI-01, CI-02, CI-03, DOC-01, DOC-02, DOC-03, DOC-04, DOC-05
**Success Criteria** (what must be TRUE):
  1. 外部開發者照 `docs/quickstart.md` 於 clean 環境 10 分鐘內:clone → env → `docker-compose up` → migrate → dev → 發出第一個 authenticated request(含 session 與 API Key 兩條路徑)
  2. `bun install --frozen-lockfile && bun test` 於 clean checkout 全數通過(unit + integration with testcontainers + e2e),coverage ≥80% 於 `src/**/domain/` 與 `src/**/application/`
  3. 開 PR 觸發 `.github/workflows/ci.yml`:`biome check` / `tsc --noEmit` / `bun test` / `drizzle-kit generate --name=ci-drift` 四項全 pass;若 schema drift 則 CI fail
  4. `README.md` 首屏呈現 Core Value(harness engineering + AuthContext 強制邊界)而非 file layout;`docs/architecture.md` 摘要 DDD 分層 + AuthContext macro + 雙軌解析模式
  5. 「Looks Done But Isn't」checklist 全數 pass:ADR 索引實質 status、AGENTS.md 含「AI Agent 接手必讀」段、regression suite 可獨立執行、無 `@ts-ignore` 在 auth-critical 路徑
**Plans**: TBD (estimate: 3-4 plans — unit + integration tests(含 regression suite)、e2e tests + `bun:test` + edenTreaty、GitHub Actions CI + migration drift、README + quickstart + architecture.md + ADR index polish)
**UI hint**: no

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 5/5 | Complete | 2026-04-19 |
| 2. App Skeleton | 3/3 | Complete | 2026-04-19 |
| 3. Auth Foundation | 5/5 | Complete | 2026-04-19 |
| 4. Demo Domain | 0/TBD | Not started | - |
| 5. Quality Gate | 0/TBD | Not started | - |

## Dependency Notes

- **Phase 2 → Phase 1:** shared kernel 的 `DomainError` 基底類別是 global error handler 的映射目標;DDD 目錄結構必須先就位才能擺 plugin。
- **Phase 3 → Phase 2:** auth plugin 掛在 root app 之上;error handler 必須先在,否則 `DomainError` 會裸 500。
- **Phase 3 atomicity:** BetterAuth schema / 雙軌 resolver / Runtime Guard / CVE regression / session invalidation 任一拆出即破壞論述或留 CVE-class 漏洞——四份研究最強共識,**不得拆 phase**。
- **Phase 4 → Phase 3:** demo domain 存在意義是展示 AuthContext;「先 demo 後 auth」等於先違反規矩再補規矩。
- **Phase 5 → Phase 4:** README / quickstart / architecture docs 需反映最終穩定 surface;dogfood 揭露的 UX 問題必須先消化才寫文件。

## Risk Flags (research-tagged, surface during planning)

- **Phase 3:** 三件 spike 候選:(a) BetterAuth CLI schema generation 與 Elysia 1.4.28 相容性(GitHub #5446 still open)、(b) API Key vs cookie resolver precedence ADR(決定版本:API Key 優先)、(c) BetterAuth password reset hook 是否自帶其他 session 撤銷。建議 planning 階段觸發 `/gsd-research-phase`。
- **Phase 4:** EvalDataset entity shape(「一組 prompt-expected-output」vs「dataset 含多組 test cases」)需 light domain modeling + ADR;可參考 Anthropic「Demystifying evals for AI agents」與 LangChain Agent Evaluation Readiness Checklist。
- **Phase 1 / 2 / 5:** 無 high-risk spike,照 STACK.md / ARCHITECTURE.md 直接實作。

---
*Roadmap created: 2026-04-19*
*Last updated: 2026-04-19 after Phase 3 completion (UAT passed — full register→verify→login→logout flow + password reset + session invalidation all green; 122 tests pass, 0 fail)*
