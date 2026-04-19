# Phase 5: Quality Gate - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning
**Mode:** Interactive（使用者選四區：測試策略 / E2E / CI / DX docs，全部深度討論 → 17 條決策鎖定 + 1 條 script 待產）

<domain>
## Phase Boundary

Phase 5 把 Rigging 推到「社群可用」門檻——**tests + CI + docs 三軸一次到位**：

- **Tests (QA-01..05)** — unit coverage ≥80% 於 `src/**/domain/` 與 `src/**/application/`（硬門檻）、integration 走 docker-compose real postgres（保留現有 26 檔）、e2e 在 `tests/e2e/` 新增 3 條跨 feature user journey、regression suite 可獨立執行
- **CI (CI-01..03)** — GitHub Actions 拆 3 parallel jobs（lint / typecheck / test+migration-drift）、migration drift 透過 `git status --porcelain drizzle/` 偵測、postgres via `services: postgres:16-alpine`、coverage gate 由 `scripts/coverage-gate.ts` per-path 強制
- **Docs (DOC-01..05)** — README 首屏重寫為 Core Value + Why Rigging + Quickstart CTA、新增 `docs/quickstart.md` 10 分鐘兩條路徑 dogfood 物語、新增 `docs/architecture.md` prose+mermaid 三章、ADR 索引 status 欄打磨、AGENTS.md 頂部加 AI Agent Onboarding TOC

**規矩在 P1-P4 立，P5 驗證「社群外部人進來 10 分鐘能跑起來」**。這個 phase 不再新增 domain feature——它是把 P1-P4 的 harness 轉為**可被第三方 clone / 審查 / 貢獻**的狀態。

**Phase 5 特殊性質：P5 是 audit phase，不只是 build phase**。Success Criterion #5 明示「Looks Done But Isn't」checklist 全 pass——這意味著 P5 的 verifier 必須 cross-check P1-P4 的 exit criteria 都是真的 pass（ADR 索引有實質 status、regression suite 可獨立跑、AGENTS.md onboarding 段實質存在、auth-critical 路徑無 `@ts-ignore`）。

**Out of this phase（scope guard）：**
- `$gsd-secure-phase 04` 的 P4 threat-mitigation audit → **P5 不 fold**。保留為獨立 out-of-band 動作（deferred ideas 區有記）。P5 focus 是 shipping-quality test/CI/docs，不是 back-fill P4 security review
- Production-grade observability（OpenTelemetry / metrics shipping）→ v2 PROD-03
- Production-grade rate limit（持久化 store / per-email 統計儀表）→ v2 PROD-02
- 真 email provider（Resend / SMTP）→ v2 PROD-01
- OAuth / 2FA / Magic Link / Passkey → v2 IDN-*
- `npx create-rigging` CLI generator → v2 SCAF-01
- Container image publish（ghcr.io / Docker Hub）→ v2（docker-compose 供 dev 即可）
- NPM 套件拆分（`@rigging/core` 等）→ v2 SCAF-03
- `.regression.test.ts` 從 feature dir 搬到 `tests/regression/` → deferred（D-02 決定保留後綴 + script 即達成「可獨立執行」目的）
- Eden Treaty 整合 → v2 spike（Pitfall #15 已知風險；P5 `bun:test + app.handle` 已覆蓋 e2e 需求）
- docker-compose → production-ready config（健康檢查 timeout 調校、volume persistence strategy）→ v2
- Subprocess-based e2e（啟 server + fetch localhost）→ 不採（D-07 選 same-runtime `app.handle`）
- 多語言文件 / i18n → 不在 scope（英中混寫即可）

</domain>

<decisions>
## Implementation Decisions

### 測試策略（Integration / Unit / Regression）

- **D-01** — Integration test 繼續用 **docker-compose real postgres**，不導入 testcontainers
  - **Why:** 現有 26 檔 integration tests（auth/ 16 + agents/ 10）已在 `tests/integration/auth/_helpers.ts` 以 `harness.sql` + `harness.app.handle` 運作；切 testcontainers 需重寫 helper、每 file 加 5-15s cold start、增 ~100MB dep；QA-02 字面「testcontainers」解釋為「有致於隔離的臨時 Postgres」，GitHub Actions `services: postgres:16-alpine` 同等達成
  - **CI 配套:** D-12 用 GitHub Actions services
  - **本地配套:** quickstart.md D-15 明示 `docker-compose up -d` 為測試前置
  - **ADR 紀錄:** 新增 ADR 0018 `testcontainers-v1-via-docker-compose.md` 記此 deviation from literal REQ，v2 PROD-* 再考慮 testcontainers

- **D-02** — Regression suite **保留 `.regression.test.ts` 後綴**、不搬到 `tests/regression/`
  - **Why:** Feature locality 保留（auth regression co-locate with auth integration tests，helper 共享）；Success Criterion #5「regression suite 可獨立執行」由 D-02-A script 達成
  - **D-02-A — 新增 script:** `package.json` 加 `"test:regression": "bun test tests/**/*.regression.test.ts"`
  - **D-02-B — Architecture.md 交叉表:** `docs/architecture.md` 其中一節列 regression suite 對應 CVE / Pitfall 映射表（e.g., `cve-2025-61928.regression.test.ts` ↔ CVE-2025-61928 API key unauth creation；`session-fixation.regression.test.ts` ↔ Pitfall #6 AUTH-11）——讓「regression 在盯什麼」這件事有文件化答案

- **D-03** — Coverage 門檻 `bun test --coverage` + **`scripts/coverage-gate.ts` per-path 強制**
  - **Why:** Bun 原生 `--coverage-threshold` 僅全專案單值，無 per-path；QA-01 字面要求 Domain+Application ≥80%，不是全專案
  - **D-03-A — bunfig.toml 擴:** `[test]` 區塊加：
    ```toml
    coverage = true
    coverageReporter = ["text", "json-summary"]
    coveragePathIgnorePatterns = ["tests/", "node_modules/", "drizzle/"]
    ```
  - **D-03-B — 新增 script:** `scripts/coverage-gate.ts`：讀 `bun test --coverage --coverage-reporter=json-summary` 產生的 `coverage/coverage-summary.json`（或 Bun 自家格式，research 確認）、filter 到 `src/**/domain/` 與 `src/**/application/`、rollup lines+branches+functions 平均、< 80% exit 1
  - **D-03-C — package.json:** `"test:coverage": "bun test --coverage && bun run scripts/coverage-gate.ts"`；CI 跑此 script，本地 optional
  - **D-03-D — Infra/presentation 只 report，不閘:** `coverage-gate.ts` 只對 domain + application 失敗；infrastructure / presentation 的覆蓋率僅由 `text` report 印出供閱讀

- **D-04** — Test parallelism **維持 Bun 預設（parallel）**，靠 email/userId namespace 隔離
  - **Why:** 現有 integration tests 已全用 `crud-${Date.now()}@example.test` + `DELETE FROM "apikey" WHERE reference_id = ${userId}` 模式運作；改 serial 會讓 CI 運行時間 2-3x；與「社群可用」DX 相悖
  - **D-04-A — 文件化 convention:** `docs/architecture.md` 或 `tests/README.md`（D-16 決定）加一段「寫 integration test 的規矩」：`beforeAll` 用時間戳 email、`afterAll` scope 到 userId 做 cleanup、不共享 email / ownerId
  - **D-04-B — 不引入 `--concurrency 1`:** `package.json` test scripts 保留 default

- **D-05** — Integration test DB schema 準備改為 **`bun run db:migrate && bun test`**（取代 `scripts/ensure-agent-schema.ts`）
  - **Why:** `ensure-agent-schema.ts` 是 P4 技術債 workaround，手寫 `CREATE TABLE IF NOT EXISTS`；與 P1 ADR 0005 Drizzle 文化矛盾（應由 migration 單一來源）；quickstart.md D-15 步驟「migrate」必實；P5 schema drift 在 CI D-10 catch，`ensure-agent-schema` 留著只會 drift silence
  - **D-05-A — package.json 改:** `"test": "bun run db:migrate && bun test"`（本地）；`"test:ci": "bun test --coverage"`（CI 用；CI 的 migrate 在獨立 step 早跑）
  - **D-05-B — 刪除:** `scripts/ensure-agent-schema.ts`（commit 時一併清 .ts 檔 + `test` script 引用）
  - **D-05-C — 若 db:migrate 成本過高:** Planner 可評估是否只對 dirty schema 重跑（`drizzle-kit migrate` 內建 idempotent），預估每次 test run < 500ms overhead，可接受

- **D-06** — Coverage target path = **`src/**/domain/` + `src/**/application/` 硬門檻 80%**，其他路徑只 report
  - **Why:** 嚴格遵 QA-01 字面；Rigging 核心論述是「錯的 domain / use case 寫法跑不起來」——這兩層是 harness 的心臟，應 100% 近滿覆蓋；infrastructure（mapper / plugin / adapter）已被 integration test 曲線覆蓋，unit 覆蓋率低不代表 bug 風險高
  - **D-06-A — 排除 patterns:** `coveragePathIgnorePatterns` 排 `src/**/infrastructure/**`、`src/**/presentation/**`、`src/bootstrap/**`、`src/main.ts`、`src/types/**`、`tests/`、`scripts/`
  - **D-06-B — shared/kernel 算 domain tier:** `src/shared/kernel/` 視為 domain 層同等對待（framework-free、高影響），同享 80% 門檻
  - **D-06-C — Coverage report 格式:** CI 上傳 artifact（text + json-summary），PR comment 可選（researcher 決定是否值得）

### E2E（tests/e2e/ 的填充）

- **D-07** — **E2E = 跨 feature 的 user journey**，integration = 單 feature 的 HTTP 路徑完整性
  - **Why:** 現有 integration tests 已用 `app.handle` 走 HTTP boundary；不用引 eden 或 subprocess 的複雜度（D-08 選擇）；E2E 的差異化價值在「跨 feature 串接」——auth + agents + api-key 一起運作時才會暴露的 bug（resolver precedence 遇到 demo domain scope check 時的互動）
  - **與 integration 的界線:**
    - Integration（auth/）: 單一 feature HTTP 路徑完整、測 auth feature 自己的 API contract
    - Integration（agents/）: 單一 feature HTTP 路徑完整、測 agents feature 自己的 API contract
    - E2E: 兩個以上 feature 的互動、用 business language 描述而非 endpoint coverage
  - **E2E 測的是「Rigging 當作一個完整產品是否能被使用」**，不是「個別 endpoint 是否回對狀態碼」

- **D-08** — E2E 框架 = **`bun:test` + `app.handle(Request)`**（同 runtime，無 eden）
  - **Why:** 與 integration tests 同技術堆疊，test 可流動、`_helpers.ts` 可共享 setup；eden Treaty + BetterAuth type narrowing 已知有邊界問題（Pitfall #15），v1 不想在此踩坑；subprocess-based e2e 運行時間高、CI flaky、訊息值不值得
  - **D-08-A — 不加 `@elysiajs/eden` dep:** `package.json` 保持現狀
  - **D-08-B — Pitfall #15 延後到 v2:** 若未來 v2 要做 `npx create-rigging` 或 SDK 發布，屆時觸發 eden + BetterAuth type export spike；v1 CONTEXT 明指此風險已知、已推遲
  - **D-08-C — 測試組織:** `tests/e2e/_helpers.ts`（可從 `tests/integration/auth/_helpers.ts` 抽公共部分）+ `tests/e2e/{journey-name}.test.ts`

- **D-09** — E2E 收 **3 條核心 user journey**：
  1. **`dogfood-happy-path.test.ts`** — register → verify → login（cookie）→ 建 Agent → 建 PromptVersion → 建 API Key → 以 `x-api-key` header 呼 `GET /agents/:id/prompts/latest` → 驗 content + identityKind='agent'（DEMO-04 E2E 版 + Success Criterion #1 10 分鐘路徑的 test 化）
  2. **`password-reset-session-isolation.test.ts`** — register → login（session A）→ 建 API Key（key K）→ 請求 password reset → 讀 stdout reset link → 設新密碼 → 驗證 session A 已失效（AUTH-11 session fixation mitigation）→ 驗證 K 仍有效（API Key 與 session 獨立生命週期）→ 用 K 呼 protected endpoint 成功
  3. **`cross-user-404-e2e.test.ts`** — user A 註冊 + login + 建 Agent → user B 註冊 + login（B 的 cookie）→ user B 以 cookie 呼 `GET /agents/:A-agent-id` → 404 → user B 建 API Key → 用 B 的 `x-api-key` 呼同路徑 → 404（D-09 of P4 ownership 404 在 e2e 層再驗）
  - **Why 這三條:**
    - (1) dogfood happy path 把 P2-P4 整條軌道走一次——若有任一 feature module factory 出錯，這條先爆
    - (2) session vs API Key 生命週期獨立性是 Rigging 雙軌論述核心，整條 flow 測過才完整
    - (3) 跨 user 404 在 integration 層已測（agents/cross-user-404.test.ts），e2e 版本加「cookie + api-key 兩條 auth 路徑都 404」確保 resolver precedence 正確
  - **D-09-A — 每條 test 可用 beforeAll + afterAll 清理 user/session/apikey/agent:** 沿用 integration helpers pattern，ownerId-scoped DELETE
  - **D-09-B — Test runtime 預估:** 每條 ~2-5s（含 register / verify / login 多次 HTTP call），3 條 e2e 加 CI < 30s

### CI 強化（.github/workflows/ci.yml rewrite）

- **D-10** — Migration drift 用 **`git status --porcelain drizzle/` 檢查**
  - **Why:** 最直觀，一行即可；drizzle-kit generate 若無 diff 則 git tree 乾淨；檢測「新檔」+「修現有檔」兩種狀況
  - **D-10-A — CI step shape:**
    ```yaml
    - name: Migration drift check
      run: |
        bun run db:generate --name=ci-drift
        if [ -n "$(git status --porcelain drizzle/)" ]; then
          echo "::error::Schema drift detected — run 'bun run db:generate' locally and commit"
          git status drizzle/
          exit 1
        fi
    ```
  - **D-10-B — 產生物清理:** 若 generate 產生 `ci-drift.sql`，需 `git clean -f drizzle/` 或把該檔 pattern 加 `.gitignore`（researcher 選一）
  - **D-10-C — ci-drift migration name 只為本 step 用:** 避免 name 衝突，固定用 `ci-drift` keyword，不與 real migration 混淆

- **D-11** — CI workflow 拆 **3 個 parallel jobs：`lint` / `typecheck` / `test`**
  - **Why:** Lint 與 typecheck 無需 postgres，可快速 fail；test job 有 postgres service + migrate + e2e + coverage gate，時間較長；並行下 CI 總時間 ≈ max(lint, typecheck, test) ≈ test ≈ ~2-3 min；單 job 約 4-5 min
  - **D-11-A — Workflow 結構:**
    ```yaml
    jobs:
      lint:
        steps: [checkout, setup-bun, install --frozen, bun run lint]
      typecheck:
        steps: [checkout, setup-bun, install --frozen, bun run typecheck]
      test:
        services: { postgres: ... }
        steps: [checkout, setup-bun, install --frozen, bun run db:migrate, bun run test:ci, migration-drift-check, coverage-gate]
    ```
  - **D-11-B — setup-bun cache:** 用 `oven-sh/setup-bun@v2` 內建的 bun-version cache；install 步驟加 `--frozen-lockfile` 鎖 `bun.lock`
  - **D-11-C — fail-fast false:** 預設 true 即可；對 PR author 而言，lint 跟 typecheck 同時一起拿反饋比早收一個好
  - **D-11-D — concurrency group:** PR 重推時取消舊 run（`concurrency: group: ci-${{ github.ref }}, cancel-in-progress: true`）

- **D-12** — CI 內 postgres 用 **GitHub Actions `services: postgres:16-alpine`**
  - **Why:** 與本地 docker-compose 的 image 同 pin；零成本 dep；healthcheck 原生支援；`DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres` 標準
  - **D-12-A — Services config:**
    ```yaml
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: rigging_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    ```
  - **D-12-B — CI 的 DATABASE_URL:** env 明寫 `postgres://postgres:postgres@localhost:5432/rigging_test`（不同於 dev 的 `rigging`——避免意外共用）
  - **D-12-C — docker-compose 對齊:** `docker-compose.yml` 的 postgres service 若非 `postgres:16-alpine` 則此 phase 微調以對齊

- **D-13** — Coverage gate 用 **`scripts/coverage-gate.ts`（自家 script）**
  - **Why:** Bun `--coverage-threshold` 只有全專案一值，per-path 必自寫；見 D-03 詳解
  - **D-13-A — Script 位置:** `scripts/coverage-gate.ts`
  - **D-13-B — Script behavior:**
    1. Assume `bun test --coverage --coverage-reporter=json-summary` 已跑過，`coverage/coverage-summary.json` 存在（Bun coverage format 由 researcher 確認精確 key 名）
    2. Parse `.files` object, filter key matches `src/**/domain/**` 或 `src/**/application/**`
    3. 計算 aggregate lines+branches+functions 平均
    4. `< 80` exit 1，print failing path + actual %
    5. Report: `Domain: 87.5% (lines) / Application: 91.2% (lines) — PASS`
  - **D-13-C — Package.json 串接:**
    ```json
    "test:ci": "bun test --coverage --coverage-reporter=json-summary",
    "coverage:gate": "bun run scripts/coverage-gate.ts"
    ```
  - **D-13-D — CI step sequence:**
    ```yaml
    - bun run db:migrate
    - bun run test:ci            # 跑 tests + 產 coverage report
    - bun run coverage:gate      # 檢查 domain+application ≥80%
    - bun run db:generate --name=ci-drift  # 另一 step，獨立 fail signal
    - git status --porcelain drizzle/ ... (D-10)
    ```

### DX Docs（README + quickstart + architecture.md + AGENTS.md）

- **D-14** — README.md 改寫 = **narrative-first**
  - **Why:** DOC-01 字面「Core Value 而非 file layout」；Rigging 的 positioning 不是 "yet another TS backend template" 而是「帶強意見的 harness」——第一印象就該被這件事捕獲
  - **D-14-A — 首屏結構（above-the-fold，~70 行以內）:**
    1. H1：`Rigging`
    2. Tagline 一句：`Harness engineering for TypeScript backends where AI Agents write code on rails.`
    3. Core Value 段（3-4 行）：引用 PROJECT.md 的「**錯誤的寫法根本 wire 不起來**」論述，強調 AuthContext 強制邊界
    4. `## Why Rigging` 段（3-5 bullet）：指向 Pitfall #11 harness 太緊、#2 scoped plugin、#4 API key plaintext 這些真實陷阱，Rigging 透過 rails 自動防禦
    5. `## Quickstart` 一行 link：`See [docs/quickstart.md](docs/quickstart.md) — up and running in 10 minutes.`
  - **D-14-B — Below-the-fold:**
    - `## Stack` 簡列（Bun + Elysia + DDD + Drizzle + BetterAuth + Postgres）
    - `## What NOT Included` 引 AGENTS.md anti-features 清單（7 條）
    - `## Architecture` 一行 link 到 `docs/architecture.md`
    - `## Decisions` 一行 link 到 `docs/decisions/README.md`
    - `## Contributing` 一行 link 到 `AGENTS.md`（AI Agent + human contributors 共用）
    - `## License` 留 TBD 或 MIT（researcher 確認 repo root license 是否已有）
  - **D-14-C — Badge bar 不做:** Phase 1 CI status badge 可以加，但不做 marketing-style hero / feature grid（D-14 已否決偏 marketing 選項）

- **D-15** — docs/quickstart.md 10 分鐘路徑 = **兩條 dogfood 物語**
  - **Why:** DOC-02 + Success Criterion #1 字面要「session 與 API Key 兩條路徑都驗過」；Dogfood story（register → agent → api-key → agent 讀自己 prompt）是 Rigging 整條軌道最有力的展示，同時驗證 Phase 4 的 DEMO-04 dogfood 命題
  - **D-15-A — 完整步驟（預估 ≤10 min，含讀時間）:**
    1. **Setup (2 min)**: `git clone` → `cp .env.example .env` → `docker-compose up -d` → `bun install` → `bun run db:migrate`
    2. **Dev server (30s)**: `bun run dev` → check `http://localhost:3000/health` → `http://localhost:3000/swagger`
    3. **Path A: Human session (3 min)**:
       - `curl -X POST /api/auth/sign-up/email -d '{"email":"you@example.com","password":"password-123456","name":"You"}'` 
       - 讀 terminal stdout 找 verification link → `curl` 點 → account verified
       - `curl -X POST /api/auth/sign-in/email -d '{...}'` 拿 session cookie
    4. **Path B: Create & read agent (2 min)**:
       - 用 cookie `POST /agents` 建 Agent 拿 `agent-id`
       - 用 cookie `POST /agents/:agent-id/prompts` 建 prompt v1
       - 用 cookie `POST /api-keys` 拿 raw key `rig_live_xxx`（一次性）
       - 用 `x-api-key` header `GET /agents/:agent-id/prompts/latest` → 拿到自己 prompt content
    5. **What just happened (1 min)**: 解釋剛才你既是 human 又是 agent 操作自己的資源、雙軌 auth、resolver precedence、ownership 驗證
    6. **Next steps (link)**: 指向 `docs/architecture.md` 深入原理、`docs/decisions/` 讀決策脈絡
  - **D-15-B — 預期命中 Success Criterion #1:** 10 分鐘包含讀時間；熟手 5-6 min 可完
  - **D-15-C — Quickstart 內不放完整 ADR 解釋、不塞 framework philosophy:** 那些交給 architecture.md 與 PROJECT.md；quickstart 就是「跑一次」的 hands-on 路徑
  - **D-15-D — 錯誤處理範例選 1:** e.g., 若 register 時 email 格式錯，預期 response shape `{error: {code, message, requestId}}`——展現 P2 D-12 error body contract；不多放錯誤場景避免篇幅膨脹

- **D-16** — docs/architecture.md = **prose + mermaid + 每章指 ADR**
  - **Why:** DOC-03 三主題（DDD 分層 / AuthContext macro / 雙軌身分解析）都有視覺化價值；ADR 是 single source of truth、architecture.md 當 navigation hub 避免內容重複
  - **D-16-A — 三章結構:**
    1. **DDD Four-Layer Architecture** — mermaid flowchart：`Presentation → Application (use cases + ports) → Domain (entities + values) ← Infrastructure (Drizzle adapters)`；箭頭顯示依賴方向；標註「Domain framework-free」「Biome rule enforced」；指向 ADR 0003 + 0009（Rigidity Map Tier 1）
    2. **AuthContext Macro Flow** — mermaid sequence：`Request → authContextPlugin.resolve → checks x-api-key → checks cookie → throws 401 or sets ctx.authContext → route handler (if requireAuth:true) → use case.execute(ctx, input)`；強調「未宣告 requireAuth:true 則型別層拿不到 ctx.authContext」；指向 ADR 0006 + 0007
    3. **Dual Identity Resolution** — mermaid decision graph：`has x-api-key? → yes: verify hash → success? yes:agent / no:401 (no fallback, D-09 of P3) / no: check cookie → agent or human`；強調「API Key 優先、失敗不 fallback」；指向 ADR 0008 + 0011
  - **D-16-B — Regression suite 表格:** 附表（section 4 或附錄）：`*.regression.test.ts` → CVE/Pitfall 映射：
    ```
    | Test file | Protects against | Reference |
    |-----------|------------------|-----------|
    | cve-2025-61928.regression.test.ts | Unauth POST /api-keys with victim userId | CVE-2025-61928 |
    | no-plugin-401.regression.test.ts | AuthContext bypass if auth plugin not mounted | Pitfall #3, AUX-06 |
    | timing-safe-apikey.regression.test.ts | API Key timing attack | AUX-04, D-10 of P3 |
    | session-fixation.regression.test.ts | Password reset invalidates other sessions | AUTH-11, Pitfall #6 |
    | resolver-precedence.regression.test.ts | API Key over cookie (D-11 of P3) | AUX-07, ADR 0011 |
    | runtime-guard.regression.test.ts | Domain service missing AuthContext throws | AUX-05, Pitfall #1 |
    | password-hash-storage.regression.test.ts | Password hashed not plaintext | AUTH-04 |
    | key-hash-storage.regression.test.ts | API Key hashed not plaintext | AUTH-13, Pitfall #4 |
    ```
  - **D-16-C — Test convention 段落:** 第 5 章「Testing conventions」給 D-04-A 的整合測試規矩（email namespace、userId-scoped cleanup、parallel OK）一個落點；否則塞 tests/README.md 也可，researcher 選其一
  - **D-16-D — Mermaid 相容:** GitHub 原生 render `.md` 檔的 mermaid code block，無需 preprocessing；若未來改 MkDocs / VitePress 換 theme 時同 syntax 相容
  - **D-16-E — 不寫 code snippet 範例:** 架構文件主題是流程與邊界、不教寫 code；code 放 AGENTS.md + quickstart.md

- **D-17** — AGENTS.md 頂部加 **AI Agent Onboarding TOC**，L197 段重命名
  - **Why:** DOC-05 要「AI Agent 接手本專案前必讀」段；現有 L197 標題已有意圖（`Rigging Rigidity Map (AI Agent: read this first)`）但沒有 top-level navigation 指引；新 onboarding TOC 是入口
  - **D-17-A — 頂部 TOC（L1-20 區間）:**
    ```markdown
    # AGENTS.md

    > AI Agent 接手本專案前必讀 / AI Agent Onboarding

    1. **[Core Value + Why Rigging](#core-value)** — 1 分鐘：harness engineering 是什麼
    2. **[Rigidity Map (必嚴格 / 可 ADR 逃生 / 純約定)](#rigging-rigidity-map)** — 2 分鐘：三級嚴格度決定你能動什麼
    3. **[Anti-features (禁止提議擴張)](#anti-features)** — 1 分鐘：哪些事 Rigging v1 不做
    4. **[GSD workflow role](#gsd-workflow)** — 本檔的 GSD 區塊如何運作
    5. **[Further reading](#further-reading)** — [docs/architecture.md](docs/architecture.md) · [docs/decisions/](docs/decisions/README.md) · [.planning/PROJECT.md](.planning/PROJECT.md)
    ```
  - **D-17-B — L197 段重命名:** 現在的 `## Rigging Rigidity Map (AI Agent: read this first)` 改為 `## Rigging Rigidity Map — AI Agent 接手本專案前必讀`（或純中文版：`## AI Agent 接手本專案前必讀 (Rigidity Map)`）。保留既有內容，僅標題變
  - **D-17-C — anchor id 相容:** 重命名後 markdown anchor id 會從 `rigging-rigidity-map-ai-agent-read-this-first` 變成 `rigging-rigidity-map-ai-agent-接手本專案前必讀`；AGENTS.md 內部引用需一併更新、外部無依賴此 anchor
  - **D-17-D — AGENTS.md 頂部不動 GSD auto-managed 區塊:** TOC 插在「`# AGENTS.md`」標題後、第一個 `<!-- GSD:* -->` 區塊之前，保 GSD 工具對本檔的 managed section 結構完好
  - **D-17-E — README.md 的 Contributing link 指向此 TOC:** D-14-B 的 `## Contributing` 直指 `AGENTS.md#ai-agent-onboarding` (anchor 由 researcher 確認)

### Phase 結構（預估，非鎖死）

- **D-18** — Phase 5 預估 **4 plans**（ROADMAP 已預估 3-4）：
  - **Plan 05-01**: 測試策略改造 — `package.json` scripts 重整（D-02-A / D-03-C / D-05-A）、刪 `scripts/ensure-agent-schema.ts`（D-05-B）、新增 `bunfig.toml [test] coverage` 段（D-03-A）、新增 `scripts/coverage-gate.ts`（D-03-B / D-13-B）、unit test 補缺（打到 QA-01 的 80% 門檻——現有 35 檔 baseline 測量 + 補齊 agents / health 的 domain + application 層缺口）
  - **Plan 05-02**: E2E 三條 journey 實作 — `tests/e2e/_helpers.ts` + 3 個 journey test files（D-09）、`tests/e2e/` README（可選）
  - **Plan 05-03**: CI rewrite — `.github/workflows/ci.yml` 改 3 parallel jobs（D-11）+ postgres service（D-12）+ migration drift step（D-10）+ coverage gate step（D-13-D）
  - **Plan 05-04**: Docs ship — `README.md` 改寫（D-14）+ `docs/quickstart.md` 新（D-15）+ `docs/architecture.md` 新（D-16）+ `AGENTS.md` top TOC + L197 rename（D-17）+ `docs/decisions/README.md` status polish + 新增 ADR 0018（testcontainers deviation）
  - **Why 4 plans:** 每個 plan 有獨立 exit gate（tests 實際跑過 / e2e 實際跑過 / CI 實際綠 / 社群人讀過能順）；4 plans 相依清晰（01 → 02 → 03 必 test 全綠後才有資格 CI green、04 最後 docs 引用到 final 的 script 名稱 / file 路徑）
  - **Planner 可再拆:** 若 Plan 05-01 膨脹（coverage-gate 寫作 + bunfig 配置 + unit 補測），可拆 05-01a / 05-01b；researcher 評估

### the agent's Discretion

以下項目未納入本次討論，researcher / planner 可依 ARCHITECTURE.md + STACK.md + P1-P4 CONTEXT + 外部文件直接決定：

- **`scripts/coverage-gate.ts` 精確實作** — Bun coverage JSON summary 格式（`bun test --coverage --coverage-reporter=json-summary` 產出結構）由 researcher 確認；若 Bun 1.3.x 不支援 `json-summary` reporter，fallback 用 `text` + regex parse（可接受，script 做 parsing layer 隔離）
- **`bunfig.toml` 精確 key 名** — `coverageReporter` vs `coverage-reporter`、`coveragePathIgnorePatterns` 語法依 Bun 1.3.x 官方 docs 為準
- **Mermaid 顏色 / shape 風格** — D-16 的三張圖，researcher 選 github 預設 theme 相容的 colors；不用 custom theme
- **`tests/e2e/_helpers.ts` 是否 dup from `tests/integration/auth/_helpers.ts`** — 若 80%+ overlap，researcher 可考慮抽 `tests/_shared/helpers.ts` 公用檔；否則 dup 也接受
- **ADR 0018 檔名** — `0018-testcontainers-v1-via-docker-compose.md` 或類似；P1 D-13 編號順序原則（技術堆疊底→高）此處按時序順延
- **`.github/workflows/ci.yml` 的 `concurrency` group 命名** — D-11-D 建議 `ci-${{ github.ref }}`，researcher 最終定
- **Coverage report artifact upload** — D-06-C 提 CI 上傳 artifact、PR comment 可選；researcher 評估 PR comment bot 成本
- **E2E test 的 DB cleanup 時機** — `afterAll` userId-scoped DELETE（沿用 D-04-A / D-09-A pattern），researcher 確認是否需 `afterEach` 或只 `afterAll`
- **README 的 CI badge** — D-14-C 允許加 `![CI](...)` badge，researcher 選要不要、放哪
- **`docs/quickstart.md` 的具體 curl 命令 / HTTPie / fetch API** — D-15-A 建議 curl（通用），researcher 可補 HTTPie alternative 讓 DX 友好
- **`docs/architecture.md` 的附錄** — 若第 4 章（regression map）或第 5 章（test convention）膨脹，researcher 可獨立成 `docs/testing.md`；預設合在 architecture.md 單檔
- **AGENTS.md 頂部 TOC 的 anchor 格式** — 中英文 anchor id 的 GitHub markdown 解析細節（空格 vs `-`、中文 slugify 行為），researcher 實測確認
- **Plan 數量** — D-18 估 4 plans，planner 讀完所有 CONTEXT 後可調整為 3 或 5；無硬門檻
- **Plan 05-01 的 unit test 補齊範圍** — 目前 35 檔 baseline，coverage-gate 實跑後可知差距；researcher 建議 planner 先以「現有 35 檔 + agents domain 層（若有 gap）」為起點，跑一次 coverage 看落點再補

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level（必讀）
- `.planning/PROJECT.md` — Core Value、Constraints、Out of Scope（特別是 v1「社群可用」非生產級 / 雙軌 auth / API-first / 無 email provider / 無 OAuth）
- `.planning/REQUIREMENTS.md` §Quality Gate — Testing (QA-01..05) / CI (CI-01..03) / Documentation (DOC-01..05) — 13 條 P5 requirements
- `.planning/ROADMAP.md` §Phase 5 — Goal、Depends on（P4 demo 已穩）、5 條 Success Criteria（10 分鐘 onboarding / clean checkout bun test 綠 / CI 四項 pass / README 首屏 Core Value / Looks Done But Isn't checklist）、Plans estimate（3-4 plans）

### Prior phase context（必讀，避免重複決策）
- `.planning/phases/01-foundation/01-CONTEXT.md` — P1 的 16 條 D-xx 決策（特別是 D-08 DomainError httpStatus 欄位、D-09 Biome DDD rules、D-14-D-15 ADR 索引表格式、D-04 detection = CI + runtime 雙層）
- `.planning/phases/02-app-skeleton/02-CONTEXT.md` — P2 的 16 條 D-xx 決策（特別是 D-05 createApp synchronous factory + deps injection、D-06 canonical plugin ordering ADR 0012、D-11 pino redact paths、D-12 error body shape、D-14 Swagger always-on）
- `.planning/phases/03-auth-foundation/03-CONTEXT.md` — P3 的 25 條 D-xx 決策（特別是 D-01 ALLOWED_SCOPES、D-09 API Key 失敗硬 401、D-11 雙軌 AuthContext shape、D-19 `rig_live_` prefix、D-24 soft delete、regression test 命名 `.regression.test.ts` 後綴源起）
- `.planning/phases/04-demo-domain/04-CONTEXT.md` — P4 的 17 條 D-xx 決策（特別是 D-06 PromptVersion server auto-increment retry / D-09 cross-user 404 / D-13 scope check at use case layer / D-14 DEMO-04 dogfood 測試用 x-api-key header、D-15 04-HARNESS-FRICTION.md 格式）

### Prior phase 產出物（P5 必 consume / polish）
- `AGENTS.md` — 現有 `## Rigging Rigidity Map (AI Agent: read this first)` 段（L197）+ anti-features 段（L245）；P5 加頂部 TOC + rename L197（D-17）
- `README.md` — 現狀停在「Phase 1 underway」；P5 改寫（D-14）
- `.github/workflows/ci.yml` — 現狀跑 lint/typecheck/test 單 job；P5 拆 3 job + 加 postgres service + migration drift + coverage gate（D-11-13）
- `.github/workflows/adr-check.yml` — P1 ship、P5 不動
- `.github/PULL_REQUEST_TEMPLATE.md` — P1 ship、P5 可 polish（researcher 評估是否加 Phase 5 exit checklist 項目）
- `docs/decisions/` — 17 條 ADR（0000-0017）+ `docs/decisions/README.md` 索引；P5 加 ADR 0018（testcontainers deviation）+ index status polish
- `bunfig.toml` — 現狀「P1 zero-config; Phase 5 may add coverage thresholds」占位；P5 加 `[test] coverage` 段（D-03-A）
- `package.json` — 現有 scripts 保留 dev/start/lint/format/db:*/typecheck/test/test:contract；P5 加 test:regression / test:coverage / test:ci / coverage:gate（D-02-A / D-03-C / D-13-C）
- `tests/integration/auth/_helpers.ts` — integration test harness 樣板（makeTestApp / signUpAndSignIn / harness.sql 模式）；P5 E2E test helper 可 dup 或抽 shared
- `tests/integration/agents/_helpers.ts` — 同上
- `tests/unit/**/*.test.ts`（35 檔） — P5 coverage gate 的起點，補齊至 domain+application 80%
- `tests/integration/**/*.regression.test.ts`（7 檔） — P5 `test:regression` script 目標
- `scripts/ensure-agent-schema.ts` — **P5 刪除**（D-05-B），以 `bun run db:migrate` 取代
- `drizzle/` migrations + `drizzle.config.ts` — P5 不動，僅由 CI migration drift step 檢查
- `src/bootstrap/app.ts` — `createApp(config, deps)` 已 ship；E2E 用同 factory
- `src/main.ts` — P5 不動；P5 的 Graceful shutdown（SIGTERM）為 deferred（P2 02-CONTEXT 已記）
- `docker-compose.yml` — postgres:16-alpine 對齊 CI services image（D-12-C）；若需微調則 Plan 05-03 順手
- `.env.example` — quickstart 用；P5 `cp .env.example .env` 流程驗證可運行
- `biome.json` — P5 不動
- `tsconfig.json` — P5 不動
- `.planning/phases/04-demo-domain/04-HARNESS-FRICTION.md` — tally = 0，architecture.md D-16 可引為「P4 dogfood 期間 harness 穩定」的證據；不產生 ADR 0019

### Research（P5 規劃必讀）
- `.planning/research/ARCHITECTURE.md` §Pattern 1-5（architecture.md D-16 三章的底稿內容源） §Data Flow §Error Flow（README + architecture 引用）
- `.planning/research/STACK.md` §Bun 1.3.12、Elysia 1.4.28、Drizzle 0.45.2、BetterAuth 1.6.5（README Stack 段的版本 source of truth）§What NOT to Use
- `.planning/research/PITFALLS.md` — 核心必讀：
  - #1 AuthContext advisory（README Why Rigging 引用）
  - #2 Elysia scoped plugin undefined cascade（architecture.md §AuthContext macro 強調）
  - #3 CVE-2025-61928（regression map D-16-B 引）
  - #4 API key plaintext storage（regression map 引、README Why Rigging 引）
  - #6 session fixation（regression map 引）
  - #11 harness 太緊（P4 friction tally = 0，但 P5 是否新增 friction event 由 plan 05-04 doc 工作觀察 — 不強制）
  - #13 timing attack（regression map 引）
  - #15 Eden + BetterAuth type 破損（D-08-B v2 延後理由）
- `.planning/research/FEATURES.md` — must-have vs defer 對照（Out of Scope 再檢查）
- `.planning/research/SUMMARY.md` §Phase 5 — Delivers / Addresses / Avoids

### Existing ADRs（P5 docs 引用）
- `docs/decisions/0000-use-madr-for-adrs.md` — ADR 0018 格式 source
- `docs/decisions/0003-ddd-layering.md` — architecture.md §DDD Four-Layer 引
- `docs/decisions/0006-authcontext-boundary.md` — architecture.md §AuthContext Macro Flow 引
- `docs/decisions/0007-runtime-guards-via-di.md` — 同上
- `docs/decisions/0008-dual-auth-session-and-apikey.md` — architecture.md §Dual Identity Resolution 引
- `docs/decisions/0009-rigidity-map.md` — AGENTS.md D-17 AI Agent Onboarding TOC 引、architecture.md §DDD 引
- `docs/decisions/0011-resolver-precedence-apikey-over-cookie.md` — architecture.md §Dual Identity Resolution 引
- `docs/decisions/0012-global-plugin-ordering.md` — architecture.md §DDD 可引（橫切 plugin 在 feature module 前）
- `docs/decisions/0013-api-key-storage-hash-plus-index.md` — regression map 引（key-hash-storage.regression.test.ts）
- `docs/decisions/0017-eval-dataset-shape-jsonb-immutable.md` — P4 demo domain 示範

### External specs（researcher / planner / executor 實作時參考）
- Bun test coverage — `https://bun.com/docs/cli/test#coverage`（D-03-A bunfig 配置、D-13-B coverage JSON summary 格式）
- Bun `bunfig.toml` — `https://bun.com/docs/runtime/bunfig`（[test] section syntax）
- Drizzle Kit CLI — `https://orm.drizzle.team/docs/kit-overview`（D-10 `drizzle-kit generate --name=ci-drift`）
- GitHub Actions service containers — `https://docs.github.com/en/actions/using-containerized-services/about-service-containers`（D-12 postgres service 配置）
- GitHub Actions concurrency — `https://docs.github.com/en/actions/using-jobs/using-concurrency`（D-11-D）
- `oven-sh/setup-bun@v2` — `https://github.com/oven-sh/setup-bun`（D-11-B cache）
- Mermaid.js — `https://mermaid.js.org/`（D-16-A 三章圖）
- GitHub flavored markdown mermaid — `https://github.blog/developer-skills/github/include-diagrams-markdown-files-mermaid/`（D-16-D GitHub render 相容性）
- MADR 4.0 canonical — `https://adr.github.io/madr/`（ADR 0018 格式）
- GitHub Actions `services: postgres` pattern — `https://docs.github.com/en/actions/using-containerized-services/creating-postgresql-service-containers`
- Eden Treaty docs — `https://elysiajs.com/eden/overview`（**僅供 v2 spike 參考**，v1 不採；Pitfall #15 背景）

### CVE / advisory（regression map 引）
- CVE-2025-61928 — `https://zeropath.com/blog/breaking-authentication-unauthenticated-api-key-creation-in-better-auth-cve-2025-61928`
- OWASP Session Fixation — `https://owasp.org/www-community/attacks/Session_fixation`
- BetterAuth Security Advisories — `https://github.com/better-auth/better-auth/security/advisories`

### P5 產出物（由本 CONTEXT 鎖定、downstream 必產）
- `package.json` — scripts 新增 `test:regression` / `test:coverage` / `test:ci` / `coverage:gate`；`test` script 改為 `bun run db:migrate && bun test`（D-05-A）；移除 `ensure-agent-schema` 引用
- `bunfig.toml` — `[test]` 區塊擴充 coverage 配置（D-03-A）
- `scripts/coverage-gate.ts` — 新增，per-path rollup 80% 門檻（D-13-B）
- `scripts/ensure-agent-schema.ts` — **刪除**（D-05-B）
- `tests/e2e/_helpers.ts` — 新增（D-08-C / D-09-A）
- `tests/e2e/dogfood-happy-path.test.ts` — 新增（D-09 journey 1）
- `tests/e2e/password-reset-session-isolation.test.ts` — 新增（D-09 journey 2）
- `tests/e2e/cross-user-404-e2e.test.ts` — 新增（D-09 journey 3）
- `tests/unit/**/*.test.ts` — 補齊至 domain+application 80% 覆蓋（coverage gate 實跑後決定範圍）
- `.github/workflows/ci.yml` — rewrite 為 3 parallel jobs + postgres service + migration drift + coverage gate（D-10 / D-11 / D-12 / D-13-D）
- `README.md` — rewrite 為 narrative-first（D-14）
- `docs/quickstart.md` — 新增，兩條路徑 dogfood 物語（D-15）
- `docs/architecture.md` — 新增，prose + mermaid 三章 + regression map + test convention（D-16）
- `docs/decisions/0018-testcontainers-v1-via-docker-compose.md` — 新增 ADR（D-01 / D-12-A）
- `docs/decisions/README.md` — 新增 0018 索引列 + status 欄 polish（核對 0000-0017 每條 status 為實質 Accepted、非 占位 Draft）
- `AGENTS.md` — 頂部 AI Agent Onboarding TOC（D-17-A）+ L197 段 rename（D-17-B）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`tests/integration/auth/_helpers.ts`** — `makeTestApp()` + `signUpAndSignIn()` + `harness.sql` 模式（real postgres via docker-compose、beforeAll/afterAll userId-scoped cleanup）；E2E test helpers 可 dup 此檔或抽 shared（D-08-C）
- **`tests/integration/agents/_helpers.ts`** — 同上 pattern、agents feature 專用
- **`tests/integration/auth/cve-2025-61928.regression.test.ts`** — regression test 實作範本（file naming convention + describe + expect structure）；P5 E2E 可借 describe 結構
- **`src/bootstrap/app.ts`** — `createApp(config, deps)` synchronous factory；E2E 用同 factory 建 test app（與 integration tests 完全一致）
- **`package.json` scripts** — 現有 dev / start / lint / lint:fix / format / db:generate / db:migrate / db:push / db:studio / typecheck / test / test:contract；P5 擴充 scripts 而非改寫
- **`docs/decisions/0012-global-plugin-ordering.md`** — architecture.md §DDD 可引的「橫切 plugin 先於 feature module」範例
- **`docs/decisions/README.md`** — ADR 索引表格式（編號 / 標題 / Status / 日期 / Supersedes）；P5 polish status 欄位
- **`.planning/phases/04-demo-domain/04-HARNESS-FRICTION.md` tally 0** — P4 dogfood 期間 harness 穩定的證據；架構文件可引
- **Package dependencies 已全裝（P1-P4 ship）：** `drizzle-orm@0.45.2` / `postgres@3.4.9` / `elysia@1.4.28` / `better-auth@1.6.5` / `@sinclair/typebox` / `pino` 等 — P5 **無新 npm install**（明確不加 testcontainers / eden / c8 / istanbul）
- **AGENTS.md 既有結構** — `# AGENTS.md` → GSD auto-managed 區塊（L1-196）→ Rigging Rigidity Map (L197-244) → Anti-features (L245+)；P5 頂部 TOC 插在 `# AGENTS.md` 與第一個 GSD 區塊之間（D-17-D）

### Established Patterns（from P1 + P2 + P3 + P4 + research）
- **Integration test pattern** — `makeTestApp()` 建 harness → `beforeAll` setup user/session → `describe` 分組 → `afterAll` userId-scoped DELETE（D-04-A convention）
- **Regression test naming** — `*.regression.test.ts` 後綴可 grep 獨立運行（D-02）
- **Feature module factory** — `createXxxModule(deps): Elysia` 回 plugin；P5 不新增 module，僅 verify 所有 module 在 `createApp` 組裝後 `bun run dev` cold start 無 error
- **ADR MADR 4.0 格式** — 12 條 P1 + 1 條 P2 + 4 條 P3 + 1 條 P4 = 17 條；P5 新增 0018 遵同格式
- **CONTEXT.md decisions format** — P1 有 16 條、P2 有 16 條、P3 有 25 條、P4 有 17 條、P5 落 17 條（本檔）+ 1 條 plan 結構估算 = 18 條（D-18 為估算非硬鎖，不佔 D-xx 編號）
- **Biome DDD rules** — P1 D-09 已設；P5 新增 script 檔（`scripts/coverage-gate.ts`）位於 repo root scripts/ 下，不受 `src/**/domain/` rule 拘束——但仍須 Biome format 符合
- **Domain barrel + internal** — P1 D-11；P5 不新增 domain 層（tests 與 scripts 為主）
- **Drizzle schema auto-scan** — `drizzle.config.ts` `schema: './src/**/infrastructure/schema/*.ts'` 已涵蓋 P1-P4 schema；P5 不動

### Integration Points
- **`package.json` scripts 擴充** — 加 4 個 scripts（D-02-A / D-03-C / D-05-A / D-13-C）、改 1 個（`test`：加 `db:migrate` prefix、移除 `ensure-agent-schema`）
- **`bunfig.toml` [test] 擴充** — 新增 `coverage` / `coverageReporter` / `coveragePathIgnorePatterns`（D-03-A / D-06-A）
- **`.github/workflows/ci.yml` rewrite** — 單 job 變 3 jobs（D-11）+ 加 postgres service（D-12）+ 加 migration drift step（D-10）+ 加 coverage gate step（D-13-D）
- **`tests/e2e/` 目錄新建 + 3 journey files + _helpers.ts**（D-09）
- **`scripts/coverage-gate.ts` 新建**（D-03-B / D-13-B）
- **`scripts/ensure-agent-schema.ts` 刪除**（D-05-B）
- **README.md rewrite**（D-14）
- **`docs/quickstart.md` 新建**（D-15）
- **`docs/architecture.md` 新建，含 mermaid 圖**（D-16）
- **`AGENTS.md` 頂部加 TOC + L197 rename**（D-17）
- **`docs/decisions/0018-testcontainers-v1-via-docker-compose.md` 新建** — ADR 0018 記 testcontainers deviation
- **`docs/decisions/README.md` polish** — 加 0018 索引列 + 審查 0000-0017 status 欄為實質值（非占位 Draft）
- **docker-compose.yml postgres image 對齊 CI** — 若現有非 `postgres:16-alpine` 則微調（D-12-C）
- **與 P4 harness-friction 互動** — Plan 05-04 docs 執行期若新增 friction events，沿用 04-HARNESS-FRICTION.md 同 format 新建 `.planning/phases/05-quality-gate/05-HARNESS-FRICTION.md`（可選，researcher 評估 P5 是否需要繼續量測）

### Risks carried from Phase 1 + 2 + 3 + 4 to watch（P5 特別關注）
- **Pitfall #11 harness 太緊（friction）** — P4 tally = 0，P5 新增 docs / tests / CI 期間若遇「為何 Rigging 規矩不允許寫 X」事件，可選擇繼續 log（但非 mandatory，P5 主 scope 是 shipping quality 不是 framework iteration）
- **Pitfall #2 Elysia scoped plugin undefined cascade** — E2E test 經 `createApp(config, deps)` 建 app，沿用 integration test pattern，不新 scope plugin；無新風險
- **Pitfall #15 Eden + BetterAuth type narrowing** — D-08-B 明確 v1 不採 eden，避坑；architecture.md 可點一下「未來若做 SDK，此 Pitfall 為 v2 spike」
- **CI 運行時間膨脹** — 3 parallel jobs 預期 < 3min；若 testcontainers 改採則單 job ~8-12min（已避），docker-compose + services 路徑最快
- **Coverage gate false alarm** — 若 researcher 發現 Bun coverage JSON 格式與文件不符，`coverage-gate.ts` 需 fallback regex parse；CI 失敗時要有清晰 error message 告訴 PR author 「哪個 path 哪個百分比」
- **Migration drift check false positive** — 若 `drizzle-kit generate --name=ci-drift` 因 Drizzle 版本升級產生非預期欄位變動，CI 會無端 fail；D-10-C 固定命名 + researcher 建議 Plan 05-03 先本地 dry-run 確認乾淨
- **README rewrite 破壞 SEO / repo topic** — 現狀 README「Phase 1 underway」無 SEO 價值，rewrite 為 Core Value narrative 不損失；researcher 可順手加 repo topic tag（`harness`, `ddd`, `typescript`, `elysia`, `bun`）

</code_context>

<specifics>
## Specific Ideas

- **`scripts/coverage-gate.ts` 預期實作大綱（D-13-B）:**
  ```ts
  // scripts/coverage-gate.ts
  import { readFile } from 'node:fs/promises'
  import { glob } from 'node:fs/promises'

  const THRESHOLD = 0.8
  const TARGET_PATHS = [/^src\/.+\/domain\//, /^src\/.+\/application\//, /^src\/shared\/kernel\//]

  const summary = JSON.parse(await readFile('coverage/coverage-summary.json', 'utf-8'))
  const targetFiles = Object.entries(summary).filter(([path]) =>
    TARGET_PATHS.some(re => re.test(path))
  )

  type Bucket = { lines: number; covered: number }
  const bucket: Bucket = { lines: 0, covered: 0 }
  for (const [, stats] of targetFiles) {
    bucket.lines += stats.lines.total
    bucket.covered += stats.lines.covered
  }
  const pct = bucket.covered / bucket.lines
  if (pct < THRESHOLD) {
    console.error(`Coverage gate FAILED: Domain+Application at ${(pct * 100).toFixed(1)}% (threshold ${THRESHOLD * 100}%)`)
    process.exit(1)
  }
  console.log(`Coverage gate PASS: Domain+Application at ${(pct * 100).toFixed(1)}%`)
  ```
  Researcher 須驗 Bun `coverage-summary.json` 實際 key 名（`lines.total` / `lines.covered` 是 Istanbul 格式，Bun 可能不同），必要時加 parser adapter。

- **`.github/workflows/ci.yml` 預期結構（D-11 / D-12）:**
  ```yaml
  name: CI
  on:
    pull_request: { branches: [main] }
    push: { branches: [main] }
  concurrency:
    group: ci-${{ github.ref }}
    cancel-in-progress: true
  jobs:
    lint:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: oven-sh/setup-bun@v2
          with: { bun-version: 1.3.12 }
        - run: bun install --frozen-lockfile
        - run: bun run lint

    typecheck:
      runs-on: ubuntu-latest
      steps: [ ... same setup ..., run: bun run typecheck ]

    test:
      runs-on: ubuntu-latest
      services:
        postgres:
          image: postgres:16-alpine
          env:
            POSTGRES_USER: postgres
            POSTGRES_PASSWORD: postgres
            POSTGRES_DB: rigging_test
          ports: ['5432:5432']
          options: >-
            --health-cmd pg_isready
            --health-interval 10s
            --health-timeout 5s
            --health-retries 5
      env:
        DATABASE_URL: postgres://postgres:postgres@localhost:5432/rigging_test
        BETTER_AUTH_SECRET: test-secret-32chars-minimum-length
        BETTER_AUTH_URL: http://localhost:3000
        NODE_ENV: test
        LOG_LEVEL: warn
        PORT: 3000
      steps:
        - uses: actions/checkout@v4
        - uses: oven-sh/setup-bun@v2
          with: { bun-version: 1.3.12 }
        - run: bun install --frozen-lockfile
        - run: bun run db:migrate
        - run: bun run test:ci
        - run: bun run coverage:gate
        - name: Migration drift check
          run: |
            bun run db:generate --name=ci-drift
            if [ -n "$(git status --porcelain drizzle/)" ]; then
              echo "::error::Schema drift detected — run 'bun run db:generate' locally and commit"
              git status drizzle/
              exit 1
            fi
  ```
  Researcher 驗 `BETTER_AUTH_SECRET` 最小長度（P3 config schema）+ `DATABASE_URL` format。

- **`docs/architecture.md` 第 1 章 mermaid 範例（D-16-A）:**
  ```mermaid
  flowchart LR
    subgraph Pres["Presentation (Elysia)"]
      controllers["controllers + macros"]
    end
    subgraph App["Application"]
      usecases["use cases<br/>execute(ctx, input)"]
      ports["ports (interfaces)"]
    end
    subgraph Dom["Domain (framework-free)"]
      entities["entities + value objects"]
      errors["DomainError"]
      direction TB
    end
    subgraph Infra["Infrastructure"]
      repos["Drizzle repos + mappers"]
      adapters["adapters (BetterAuth, Console Email)"]
    end

    controllers --> usecases
    usecases --> ports
    ports -. implemented by .-> repos
    ports -. implemented by .-> adapters
    usecases --> entities
    repos --> entities
    classDef frameworkFree fill:#e8f5e9,stroke:#2e7d32
    class Dom frameworkFree
  ```
  註解「Domain（綠色）= framework-free，Biome rule 阻擋 import elysia / drizzle-orm / better-auth；ADR 0003 / 0009 Tier 1」。

- **`docs/quickstart.md` Path B 的 curl 範本（D-15-A 步驟 4）:**
  ```bash
  # 1. Create agent (using cookie from login)
  AGENT_ID=$(curl -s -X POST http://localhost:3000/agents \
    -H "Content-Type: application/json" \
    -b "better-auth.session_token=..." \
    -d '{"name":"my-first-agent"}' | jq -r '.id')

  # 2. Create prompt v1
  curl -X POST http://localhost:3000/agents/$AGENT_ID/prompts \
    -H "Content-Type: application/json" \
    -b "better-auth.session_token=..." \
    -d '{"content":"You are a helpful assistant."}'

  # 3. Create API key (one-shot raw key)
  API_KEY=$(curl -s -X POST http://localhost:3000/api-keys \
    -H "Content-Type: application/json" \
    -b "better-auth.session_token=..." \
    -d '{"label":"quickstart-key","scopes":["*"]}' | jq -r '.key')

  # 4. Now YOU ARE THE AGENT — fetch your own latest prompt via API key
  curl http://localhost:3000/agents/$AGENT_ID/prompts/latest \
    -H "x-api-key: $API_KEY"
  # => { "id": "...", "version": 1, "content": "You are a helpful assistant.", ... }
  ```
  Researcher 確認 BetterAuth session cookie 名稱（是否為 `better-auth.session_token`），調整範本。

- **Regression map 表實際放置位置（D-16-B）:**
  建議作為 `docs/architecture.md` 的附錄 §A「Regression Test Matrix」，避免主章節過長；若 researcher 覺得 7-8 列表太重可移至 `docs/testing.md`。

- **ADR 0018 內容大綱（D-01 / D-12-A）:**
  ```markdown
  # 0018 — testcontainers for v1 via docker-compose / GitHub Actions services

  ## Context
  REQ QA-02 literal: integration tests 用 `testcontainers`. 評估後決定 v1 透過
  docker-compose (本地) + GitHub Actions services (CI) 達成同等「隔離的臨時 Postgres」
  目的，不導入 `testcontainers` npm dep.

  ## Decision
  - 本地: `docker-compose up -d` 提供 postgres:16-alpine
  - CI: GitHub Actions `services: postgres:16-alpine` 每 job 自動啟動容器
  - `bun run db:migrate` 為 test 前置步驟

  ## Consequences
  - 外部 clone 者必啟 docker-compose（quickstart.md 明列）
  - 無 `testcontainers` 的 per-test-file container 隔離，改靠 email/userId namespace
  - v2 PROD-* 若真需 per-test-file 完全隔離，再 supersede 本 ADR

  ## Supersedes
  None. REQ QA-02 wording 保持不變，此 ADR 記錄 v1 如何滿足其 intent.
  ```

- **`AGENTS.md` 頂部 TOC 插入位置（D-17-D）:**
  現有 L1: `# AGENTS.md`；L2 起為 GSD auto-managed `<!-- GSD:* -->` 區塊。TOC 插在 L1 之後、L2 之前（即第一個 managed 區塊之前）。不動 `<!-- GSD:* -->` 區塊的 opening/closing comments，保工具管理相容。

- **Plan 05-01 coverage 補齊起點策略建議:**
  Researcher / Planner 先在本地跑一次 `bun test --coverage`（無 gate、純 report），從 `coverage-summary.json` 讀出 domain+application 當前百分比 baseline，再計算缺口。若 baseline 已 ≥80%，Plan 05-01 主要工作變為「寫 coverage-gate.ts + wire package.json + bunfig.toml」而非大規模補測試；若 baseline ~60-70%，則 Plan 05-01 須列出具體 missing test 清單並補測。

- **README narrative 第一段 tagline 候選（D-14-A）:**
  三個候選讓 planner 選：
  1. 英文：`Harness engineering for TypeScript backends where AI Agents write code on rails.`
  2. 中英：`Harness Engineering for TypeScript backends — 讓 AI Agent 在軌道上寫出安全、結構化的程式碼。`
  3. 中文：`給 AI Agent 寫 TypeScript backend 的軌道 — 錯誤的寫法根本 wire 不起來。`
  Researcher 可一併與 planner 討論 README 的語言策略（repo 目前 mixed 中英）。

- **E2E test 的 session cookie 處理（D-09）:**
  BetterAuth 在 email/password sign-in response 回 `set-cookie` header，e2e test 需從中 parse session token 並在後續 `app.handle(Request)` 時放回 `cookie` header。integration test `_helpers.ts` 已有 `signUpAndSignIn` 處理此，e2e helpers 直接 port 或抽共用。

</specifics>

<deferred>
## Deferred Ideas

以下想法在 P5 討論中浮現但屬後續 phase / v2 / out-of-band 範疇：

- **`$gsd-secure-phase 04` — P4 threat-mitigation audit** → 不 fold 進 P5。獨立 out-of-band 動作；建議在 P5 完結後 / 或 v1 release 前作為 separate retrospective 動作觸發。P5 blocker 不含此項（STATE 記 concern 而非 blocker）。
- **testcontainers 改用** → v2 PROD-*；v1 透過 docker-compose + GitHub Actions services 達成「隔離 postgres」目的（ADR 0018 記）
- **Eden Treaty 整合** → v2 spike；Pitfall #15 為已知風險；v1 e2e 用 app.handle 足夠
- **`.regression.test.ts` 搬到 `tests/regression/`** → 拒絕（D-02）；feature co-location + `test:regression` script 達成「可獨立執行」目的
- **Subprocess-based e2e（啟 server + fetch localhost）** → 拒絕（D-07）；app.handle 同 runtime 勝過
- **c8 / istanbul coverage 取代 Bun 原生** → 拒絕（D-03）；Bun 原生 + 自家 coverage-gate.ts 更貼近 Bun-only 宣言
- **Coverage 全專案 80% 門檻** → 拒絕（D-06）；domain+application 專注、infrastructure report-only
- **Production-grade CORS allowlist + security headers** → v2 production hardening
- **docker-compose healthcheck 調校、volume strategy** → v2；v1 用 P1 既有 config
- **OpenTelemetry tracing + metrics** → v2 PROD-03
- **Rate limit 持久化 store** → v2 PROD-02
- **真 email provider（Resend / Postmark）** → v2 PROD-01
- **OAuth / 2FA / Magic Link / Passkey** → v2 IDN-*
- **Multi-tenancy / RBAC** → v2 TEN-*
- **MCP server / A2A 協議** → v2 AGT-*
- **NPM 套件拆分 `@rigging/core`** → v2 SCAF-03
- **`npx create-rigging` CLI generator** → v2 SCAF-01
- **`bun rigging new-domain` scaffold 命令** → v2 SCAF-02
- **Container image publish（ghcr.io / Docker Hub）** → v2
- **Production deployment docs / k8s manifests / Cloud provider guides** → v2 / out of scope
- **Liveness vs readiness probe 拆分（`/health` 拆 `/live` + `/ready`）** → P2 02-CONTEXT 已記，v2 k8s deploy 時再評
- **Graceful shutdown（SIGTERM → close db pool）** → P2 02-CONTEXT 已記、v2 main.ts polish
- **PR comment bot 回報 coverage diff** → researcher 視 CI 成本決定是否順手加；非 must-have
- **05-HARNESS-FRICTION.md** — P4 log tally = 0，P5 docs 工作是否繼續量 harness friction 由 researcher/planner 決定，非 mandatory（ADR 觸發條件同 D-16 P4）
- **README repo topics（GitHub topic tags `harness` / `ddd` / `typescript` / `elysia` / `bun`）** — researcher 可順手加，非 mandatory，不影響 DOC-01 字面
- **Markdown linter（markdownlint / prettier markdown）for docs/*.md** → v2；v1 手工維護
- **文件雙語策略** — 目前 repo 中英混寫，P5 不強求統一；researcher 可在 quickstart.md / architecture.md / README 統一偏英，其他既有檔保持現狀
- **CONTRIBUTING.md** — D-14-B 的 `## Contributing` link 到 AGENTS.md，v1 不另新建 CONTRIBUTING.md；v2 若社群貢獻量起飛再拆
- **CODE_OF_CONDUCT.md / SECURITY.md (GitHub 推薦文件)** → v2 或 release 前 polish
- **Semantic versioning / release notes / CHANGELOG.md** → v2；v1 repo private / reference implementation 無 npm release

未提及但已知屬未來 phase：
- v2 所有 SCAF-* / PROD-* / IDN-* / TEN-* / AGT-* → 已在 REQUIREMENTS.md §v2 明列
- Real production deployment patterns → PROJECT.md Out of Scope 已鎖

</deferred>

---

*Phase: 05-quality-gate*
*Context gathered: 2026-04-19（interactive，4 區 × 3-4 題 = 13 輪對話，共 17 條 D-xx 決策 + 1 條 plan 結構估算）*
