# Phase 6: CI Pipeline Green-Run & Smoke Validation - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

把 v1.0 已落地但尚未在真實 PR 上跑過的 GitHub Actions CI pipeline（`.github/workflows/ci.yml`
三個 parallel jobs：lint / typecheck / test(+coverage+drift)）首次在非 master 分支的 PR 上跑出全綠，
並在 CI 上新增 `createApp(config)` boot + `/health` HTTP ping 的 smoke step 作為 PR gate 最後一關；
同時以刻意破壞逐 gate 製造 fail-mode，證明每一層 gate 都能擋 bad PR。

**交付三件 requirement：**
- CI-04 — 非 master 分支 PR 首次 run，四個 check items 全綠，外部可驗
- CI-05 — 至少 3 類 fail-mode 各驗一次（本 phase 實際討論加嚴至 5 種：lint / typecheck / test / drift / smoke 全驗）
- OBS-01 — CI 加入 smoke step（`createApp` boot + `/health` 真 HTTP 回 200）

**不在範圍：**
- 任何 product feature / endpoint / domain 新增
- Production-grade observability（OpenTelemetry 等，屬 PROD-03）
- 改動既有 lint / typecheck / test / drift 邏輯（pipeline 結構已於 v1.0 固化）
- 取代或升級技術棧（Bun / Postgres / Drizzle 鎖定）

</domain>

<decisions>
## Implementation Decisions

### Plan 分解策略

- **D-01: Phase 6 切成 2 個 plans** — Plan 1 = Green baseline + smoke（CI-04 + OBS-01）；Plan 2 = Fail-mode matrix（CI-05）。
  理由：green-path 與 fail-mode 性質不同（一個是交付 infra code + 驗 evergreen gate；另一個是刻意破壞產 evidence），分開切 SUMMARY 與回滾成本乾淨。
  拒絕的選項：1 plan atomic（回滾/SUMMARY 顆粒過粗）、3 plans per REQ-ID（CI-04 與 OBS-01 天然共用同一個 PR，沒必要拆）。

- **D-02: Plan 順序為 Green 先、Fail 後** — Plan 2 在 ROADMAP.md `Depends on` 標明依賴 Plan 1 完成。
  理由：CI-05 fail-mode 要在「已知 main 上 CI 全綠」的 baseline 上製造紅燈才有對照組；若先跑 fail-mode 無法區分紅燈是 fail-mode 效果還是 pipeline 本身壞掉。

- **D-03: Plan 1 acceptance 含「開 PR 驗綠 + check URL 寫進 SUMMARY」** — Plan 1 不是 code-change-only；
  其 acceptance 必須包含：（a）push feature branch、（b）開 PR 到 main、（c）等 CI run finish、
  （d）把 CI check run URL 與全綠狀態寫進 plan SUMMARY.md 作為 CI-04 的 shippable evidence。
  理由：CI-04 本質是「在真 GitHub Actions 上跑過」這件事，不是 code 寫完就算；把驗證步驟收進 plan 可避免 plan 標 complete 但外部 requirement 未達成。

- **D-04: Plan 1 的 PR 直接 merge 進 main** — Plan 1 不是「demo PR」；它同時是把 smoke step（新 script + ci.yml 更新）正式落地到 main 的 infra PR。
  理由：Plan 1 code change 本就要進 main（OBS-01 交付物是「CI 有 smoke step」而非「demo 過一次」），把驗 CI-04 與 land OBS-01 合併成同一 PR 避免開兩個 PR 增加 footprint。

- **D-05: Plan 2 使用單一 sacrificial PR，force-push 5 次各驗一種 fail-mode** — 五種 fail-mode：
  （1）biome lint 錯誤、（2）`// @ts-expect-error` 無誤用、（3）刪一個必經 test、
  （4）手動改 schema 不補 migration、（5）破壞 `createApp` config 校驗或 plugin wiring 讓 boot 失敗。
  每次 force-push 後把 check run URL 貼進 plan SUMMARY 證據區；五次都驗完後 PR close 不 merge。
  理由：單 PR 比 5 PR 的 GitHub footprint 乾淨；force-push 而非 commit chain 的理由是每次觀察都獨立、
  紅燈只對應當次破壞、較易在 SUMMARY 表格中 1-row-per-fail-mode 呈現。

- **D-06: Fail-mode 範圍加嚴到 5 種（含 smoke fail-mode）** — ROADMAP.md Phase 6 success criteria 第 4 條
  最低要求「至少 3 類 fail-mode」；本 phase 收嚴為全量 4 類基礎 gate + 1 類 smoke gate = 5 種全驗。
  理由：smoke step 是本 phase 新交付的 gate，沒驗 smoke fail-mode 等於沒證明 smoke 真的會擋 bad PR
  （對應 ROADMAP success criteria 第 5 條的「smoke step 變紅並擋住 merge」）。

### the agent's Discretion

以下細節留給 researcher / planner 決定，CONTEXT.md 只鎖上方五條結構決策：

- **Smoke step 實作細節** — in-process（bun 直接 import `createApp` + `app.handle(Request)`）、
  background server + curl、或 reuse tests/e2e 既有 harness。researcher 應比較三種在 CI 的啟動延遲與
  debuggability 後決定，前提是結果必須達到「真 HTTP request 到 `/health` 回 200」的語意
  （不只是 import module 成功）。

- **Smoke script 檔案落點** — `scripts/smoke-health.ts` 新增、inline 在 workflow 的 `bun -e "..."`、
  或新增 `bun run smoke` npm script 等形式自由；planner 選一種並在 plan 中明記。

- **Smoke step 在 ci.yml 的位置** — 加入現有 test job 尾端（接在 drift 後）、獨立第 4 個 parallel job、
  或 sequential 最終 gate（`needs: [lint, typecheck, test]`）。planner 依「能否及早失敗」與「是否
  需要 DB service」兩個軸判斷；若 smoke 需要 Postgres service 可併入 test job 省去重複 service 設置。

- **Plan 2 PR 的 base branch** — 是開到 main 還是開到 Plan 1 merge 後的 HEAD；planner 決定，但
  必須確保 Plan 2 開 PR 時 Plan 1 已 merge（D-02 的順序保證）。

- **Plan 命名 / commit granularity** — planner 依 GSD plan 命名慣例決定（參見 Phase 5 plan 命名）。

- **ADR 0019 決策** — 若本 phase 執行中出現值得記錄的新決策（e.g. smoke step 實作方式），
  planner / executor 視情況新增 ADR；否則在 SUMMARY.md 明示「本 phase 無新 ADR」以供 Phase 8 審計。

### Folded Todos

無。本 phase 討論未折入任何外部 todo。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 定義與驗收
- `.planning/ROADMAP.md` §`### Phase 6` — Phase 6 goal / success criteria 5 條 / requirements CI-04 / CI-05 / OBS-01
- `.planning/REQUIREMENTS.md` §`CI Pipeline Validation (CI-04..05)` — CI-04 / CI-05 驗收文字（含四類 fail-mode 的範例）
- `.planning/REQUIREMENTS.md` §`Observability Smoke (OBS-01)` — OBS-01 驗收文字（含 smoke fail-mode 要求）
- `.planning/PROJECT.md` §`Current Milestone: v1.1 Release Validation` — milestone 範圍與技術棧鎖定

### 既有 CI / Workflow 基礎設施
- `.github/workflows/ci.yml` — 目前三 parallel jobs + drift 的完整 workflow；本 phase 的 smoke step 會改動這個檔
- `.github/workflows/adr-check.yml` — ADR gate（Phase 8 主用，Phase 6 不動，但驗全綠時會同時跑）
- `scripts/coverage-gate.ts` — 既有 coverage gate 實作（不改動，僅作為「已 land gate」的背景）
- `package.json` `scripts` 區塊 — 既有 `lint` / `typecheck` / `test:ci` / `coverage:gate` / `db:migrate` / `db:generate` 指令；smoke script 的 npm 指令命名需對齊既有風格

### Smoke step 會觸碰的程式碼
- `src/bootstrap/app.ts` — `createApp(config, deps?)` 唯一 assembly point，同步回傳（ADR 0012）；smoke step 需 import 並 boot 它
- `src/bootstrap/config.ts` — `Config` 型別與 env parsing（smoke 需提供最小可行 config）
- `src/health/health.module.ts` — Health feature module factory
- `src/health/presentation/controllers/health.controller.ts` — `/health` endpoint（200 於 DB up / 503 於 DB down）
- `src/health/application/usecases/check-health.usecase.ts` — DB probe 邏輯
- `src/health/infrastructure/drizzle-db-health-probe.ts` — 實際 DB 連線檢查

### 既有相關 ADR
- `docs/decisions/adr-0012-canonical-plugin-ordering.md` — `createApp` 的 plugin chain 順序（smoke step 必須走完整 chain，不可 bypass）
- `docs/decisions/adr-0018-integration-tests-shared-postgres.md` — CI 共用單一 Postgres service 的 adopted deviation（smoke 若需 DB 沿用同模式）
- `docs/decisions/README.md` — ADR 索引（Phase 8 自檢用；Phase 6 開 PR 時會被 adr-check workflow 掃到）

### v1.0 / Phase 5 的 CI 歷史脈絡
- `.planning/phases/05-quality-gate/05-SUMMARY.md` §`Plan Completion Matrix` / `Success Criteria 對照` — Plan 05-03 CI rewrite 是本 phase 要驗的 pipeline 的交付紀錄；其「CI 首 run 為 push 後 manual follow-up」是本 phase 直接承接的 deferred 項
- `milestones/v1.0-ROADMAP.md` — v1.0 milestone Retrospective（含「harness self-enforcing」經驗，影響 fail-mode demo 的敘事脈絡）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createApp(config, deps?)` (`src/bootstrap/app.ts`) — 已是同步 return 且單一 assembly point；smoke step 可直接 import 使用，不需另起 server process
- `/health` endpoint + 200/503 協議 — smoke 只需 HTTP GET，不需要注入 fake DB；DB down 時走 503 分支也符合「gate 紅燈」語意
- `bun run test:ci` / `bun run coverage:gate` — 既有 npm script 模板，smoke 指令可沿用風格（e.g. `bun run smoke`）
- `oven-sh/setup-bun@v2` + `actions/cache@v4` 快取策略已在 ci.yml 三個 job 皆用 — smoke step 沿用即可

### Established Patterns
- **ci.yml 每個 job 都獨立做 `bun install --frozen-lockfile`** — 若 smoke 併入 test job 可省一次 install；獨立 job 則需另算 install cost
- **ADR 0018 共用 Postgres service** — 若 smoke step 需 DB，應與 test job 同 service 而非另起
- **ADR 0012 plugin ordering** — smoke 必須走完整 `createApp` chain，不可 short-circuit（否則失去驗證 plugin wiring 能 boot 的意義）
- **Adopted-scope 模式（v1.0 Phase 4/5）** — plan 執行中發現需要的 hardening 可併入 atomic commit，SUMMARY 顯式記錄；本 phase 若遇到 smoke 實作時發現 createApp 有隱藏依賴，沿用此模式而非中斷 plan

### Integration Points
- **`.github/workflows/ci.yml`** — smoke step 注入點（位置由 planner 決定：test job 尾端 / 新 parallel job / 最終 sequential gate）
- **`package.json` `scripts`** — 可能新增 `smoke` 指令
- **`scripts/`** 目錄 — 若選 dedicated script 實作，檔案會落在這裡（沿用 `scripts/coverage-gate.ts` 同目錄慣例）
- **`docs/decisions/`** — 若產生 ADR 0019（smoke 實作決策），落在這裡；PR 上會被 `adr-check` workflow 掃到

### 本 phase 執行會觸發的 GitHub 外部狀態
- **Sacrificial PR（Plan 2）** — 本 phase 會在 GitHub 上留一個 closed-not-merged 的實驗 PR；commit history 仍保留於 fork/branch，PR 本身 close 後不 merge，不污染 main
- **真實 CI minutes 消耗** — Plan 1 一次綠跑 + Plan 2 五次 force-push 約消耗 6 次 full pipeline run

</code_context>

<specifics>
## Specific Ideas

- **Plan 1 的 PR 就是 smoke step 進 main 的 PR** — 不另開 demo PR（D-04 明確鎖定）
- **Plan 2 sacrificial PR 五次 force-push 各貼 check URL** — 在 plan SUMMARY.md 中以 5-row 表格呈現
  （| 序 | Fail-mode | 破壞內容 | 預期 red job | Check run URL |）這種結構最利於 Phase 8 / milestone close 時審計
- **Fail-mode 第 5 種（smoke fail）建議以 `createApp` 內部 config 校驗 throw 為觸發** — 比拔 plugin wiring
  更乾淨（plugin wiring 改動會同時破壞 test job，難以隔離 smoke gate 的獨立效果）；但此為建議，
  researcher / planner 可另提

</specifics>

<deferred>
## Deferred Ideas

- **Fail-mode 執行策略的其他變體**（多 PR、commit chain、ephemeral 不開 PR 等）— 用戶本次未選討論此 gray area，
  但 D-05 已鎖單一 sacrificial PR force-push 策略；其他變體若未來想重議，屬新 decision 不在本 phase
- **Smoke step 的具體落點**（test job 尾端 vs 獨立 job vs 最終 gate）— 歸入 the agent's Discretion，researcher / planner 決策
- **Evidence / SUMMARY 格式細節**（截圖 / artifact 上傳 vs URL 清單）— D-05 已鎖 check run URL 貼進 SUMMARY；
  若未來 milestone close 發現 URL 會 rot、需補截圖或 log artifact，屬新 decision
- **Production 級 observability 升級**（OTel / metrics / logs 分流）— PROD-03，v1.2+
- **多 runtime / 多 DB driver 支援 CI 矩陣** — v1.1 Out of Scope，未來 milestone 議
- **CI 跑在 self-hosted runner / 加速策略** — v1.1 無此需求

</deferred>

---

*Phase: 06-ci-pipeline-green-run-smoke-validation*
*Context gathered: 2026-04-20*
