# Phase 6: CI Pipeline Green-Run & Smoke Validation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `06-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 06-ci-pipeline-green-run-smoke-validation
**Areas discussed:** Plan 分解策略

---

## Gray Area Selection

以下是向用戶呈現的四個 gray area（多選）：

| Option | Description | Selected |
|--------|-------------|----------|
| Fail-mode 執行策略 | CI-05 四種破壞（lint/typecheck/test/drift）怎麼跑？單 PR force-push 多次 / 多 PR 分開 / 本地 ephemeral 分支不開 PR — 會直接決定 Phase 6 的 PR footprint 與 cleanup 複雜度 | |
| Smoke step 落點與實作 | OBS-01 smoke 跑在哪裡？加到 test job 尾 / 獨立第 4 個 parallel job / 最後 sequential gate；實作是 in-process(createApp+app.handle) / background server + curl / 重用 tests/e2e 設定 | |
| Plan 分解策略 | Phase 6 要切幾個 plan？1 plan atomic（CI-04+05+OBS-01 一口氣）/ 2 plan（green baseline vs fail-mode）/ 3 plan（per REQ）；各種切法對 bisect 與回滾成本不同 | ✓ |
| Evidence 與 SUMMARY 格式 | Fail-mode 的證據形式：Check run URL 清單 / 螢幕截圖附件 / workflow logs artifact / commit log + SUMMARY 敘述；以及 smoke step 綠燈要不要當作 OBS-01 Done 的唯一 proof | |

**User's choice:** Plan 分解策略
**Notes:** 用戶只選一個 area 討論；其他三個落到 the agent's Discretion（下游 researcher / planner 處理）或 deferred。

---

## Plan 分解策略

### Q1: Phase 6 切幾個 plan？

| Option | Description | Selected |
|--------|-------------|----------|
| 1 plan atomic（一口氣） | CI-04 + CI-05 + OBS-01 在同一 plan 內一次落地（Phase 3 atomic 風格、無中間紅燈狀態、但 SUMMARY/回滾粒度大） | |
| 2 plans（baseline / fail-mode） | Plan 1 = CI-04 首次綠燈 + OBS-01 smoke 加入 (green path)；Plan 2 = CI-05 四種破壞驗證 (fail-mode matrix) — 類型不同分開乾淨 | ✓ |
| 3 plans（per REQ-ID） | Plan 1 = CI-04 / Plan 2 = OBS-01 / Plan 3 = CI-05 — 每條 requirement 獨立 plan、traceability 最清、但 overhead 較高 | |
| the agent Discretion | 不把數量特別釘死，讓 planner 根據依賴關係 / 風險 decide | |

**User's choice:** 2 plans（baseline / fail-mode）
**Notes:** 選 2 plan 的理由是 green-path 與 fail-mode 性質不同（一個是交付 infra code + 驗 evergreen gate；另一個是刻意破壞產 evidence），分開切 SUMMARY 與回滾成本乾淨。

### Q2: Plan 間的依賴/順序要怎麼安排？

| Option | Description | Selected |
|--------|-------------|----------|
| Green 先、Fail 後 | 先 land CI-04 (+OBS-01) baseline 綠、再以另一個 sacrificial PR / commit 跑 CI-05 fail-mode。證據最清—綠燈現場已建立才破壞 | ✓ |
| Smoke 先、一次驗所有 green | 先 land OBS-01 (smoke step 加入 ci.yml)、再以 CI-04 首次驗完整 gate 包含 smoke 都綠。fail-mode 最後 | |
| 平行獨立 land | 各 plan 無強依賴、可任意序。適合多人/多 session 並行推進 | |
| the agent Discretion | 依賴由 planner 在 plan 內部標 Depends on 欄位決定 | |

**User's choice:** Green 先、Fail 後
**Notes:** CI-05 fail-mode 要在「已知 main 上 CI 全綠」的 baseline 上製造紅燈才有對照組；若先跑 fail-mode 無法區分紅燈是 fail-mode 效果還是 pipeline 本身壞掉。

### Q3: Plan 1 (Green baseline + smoke) 的 acceptance 收在哪裡？

| Option | Description | Selected |
|--------|-------------|----------|
| Code change only（smoke script + ci.yml更新） | Plan 1 只負責 smoke script 與 ci.yml 的 code change、本機 test 跑過即算完 | |
| Code change + 「開 PR 驗綠」納入 plan | Plan 1 steps 含 push branch + open PR + 等 CI finish、並把 check run URL 寫進 SUMMARY.md 作為 CI-04/OBS-01 的 shippable evidence | ✓ |
| Code change + 本機 smoke 驗證 | Plan 1 steps 包含「本機先跑 smoke script 百分百綠」才算 Done—但 PR 驗證在 plan 外 | |
| the agent Discretion | 由 planner 取捨 | |

**User's choice:** Code change + 「開 PR 驗綠」納入 plan
**Notes:** CI-04 本質是「在真 GitHub Actions 上跑過」這件事，不是 code 寫完就算。

### Q4: Plan 2 (fail-mode) 要富子到幾種破壞？

| Option | Description | Selected |
|--------|-------------|----------|
| 4/4 全覆蓋 | lint 錯 / typecheck 錯 / test 錯 / drift 錯 四種各驗一次 | |
| 3/4 代表性驗 | 選三種（例如 lint/typecheck/drift 或其他任三）、符合 success criteria 第 4 條「至少 3 類」的下限 | |
| 4/4 但可合併 commit | 四種都驗、但在同一個 sacrificial PR 用 force-push 或 commit chain 進行 | |
| smoke fail-mode 也要驗 | 四種為基本、額外加驗 smoke step fail-mode（故意破壞 config 校驗或 plugin wiring 讓 createApp 起不來）— 對應 ROADMAP success criteria 第 5 條 | ✓ |

**User's choice:** smoke fail-mode 也要驗
**Notes:** smoke step 是本 phase 新交付的 gate，沒驗 smoke fail-mode 等於沒證明 smoke 真的會擋 bad PR。總 fail-mode 數量收嚴為 5 種（lint / typecheck / test / drift / smoke）。

### Q5: Plan 1 的 PR (內含 smoke step code change) 最終狀態是？

| Option | Description | Selected |
|--------|-------------|----------|
| Merge 進 main | 這個 PR 也是「把 smoke step + 必要 ci.yml 調整落進 main」的正式 PR。一 PR 走完 CI-04 首綠 + OBS-01 smoke 加入 + 合併 | ✓ |
| 另開一 PR 負責 merge | Plan 1 的「驗綠 PR」不 merge (只當 demo)、再開一個專雀 infra PR 把 smoke code change 正式 land 進 main | |
| the agent Discretion | 細節由 planner 決定 | |

**User's choice:** Merge 進 main
**Notes:** Plan 1 code change 本就要進 main（OBS-01 交付物是「CI 有 smoke step」而非「demo 過一次」），合併成同一 PR 避免開兩個 PR 增加 footprint。

### Q6: Plan 2 (fail-mode) 五種破壞要用什麼方式跑？

| Option | Description | Selected |
|--------|-------------|----------|
| 單 PR force-push 5 次 | 開一個 sacrificial PR → force-push 染染挫插五次 (lint/typecheck/test/drift/smoke)、每次貼 check run URL、結束後直接 close 不 merge | ✓ |
| 五個獨立 PR | 每種 fail-mode 一 PR (總共五個 sacrificial PR)、各自驗完後 close。證據最清、但 PR footprint 大 | |
| 一 PR 分 5 commit、每 commit 觀察 check | 單 PR 用 5 個連續 commit (不 force-push)、每 push 一 commit 觀察對應 job 紅、最後貼 5 個 check URL後 close | |
| the agent Discretion | 細節由 planner 決定、context 只鎖「需驗滿 5 種 fail-mode + 負責 close 不 merge」 | |

**User's choice:** 單 PR force-push 5 次
**Notes:** 單 PR 比 5 PR 的 GitHub footprint 乾淨；force-push 而非 commit chain 的理由是每次觀察都獨立、紅燈只對應當次破壞、較易在 SUMMARY 表格中 1-row-per-fail-mode 呈現。

---

## the agent's Discretion

以下 gray area 未展開討論，留給 researcher / planner decision：

- Smoke step 實作細節（in-process / background server + curl / reuse tests/e2e）
- Smoke script 檔案落點（`scripts/smoke-health.ts` / inline workflow / npm script）
- Smoke step 在 ci.yml 的位置（test job 尾端 / 獨立 job / sequential gate）
- Plan 2 PR 的 base branch（main vs Plan 1 merge 後 HEAD）
- Plan 命名 / commit granularity
- ADR 0019 是否需要（視執行中是否出現值得記錄的新決策而定）

## Deferred Ideas

- Fail-mode 執行策略的其他變體（多 PR / commit chain / ephemeral 不開 PR）— 未本次選擇討論，D-05 已鎖單 PR force-push 策略
- Smoke step 的具體落點變體 — 留給 researcher / planner
- Evidence / SUMMARY 的截圖 / artifact 上傳替代方案 — D-05 已鎖 URL 清單
- Production 級 observability（OTel / metrics / logs 分流）— PROD-03，v1.2+
- 多 runtime / 多 DB driver CI 矩陣 — v1.1 Out of Scope
- Self-hosted runner / CI 加速策略 — v1.1 無此需求
