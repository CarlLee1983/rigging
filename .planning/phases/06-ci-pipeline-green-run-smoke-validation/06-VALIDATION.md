---
phase: 06
slug: ci-pipeline-green-run-smoke-validation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> 本 phase 交付物是「CI evidence + fail-mode evidence」而非 source code 行為；驗證訊號以
> GitHub check run URL / job status / SUMMARY.md 表格條目為主，local test 為輔。

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test (vitest-compat) + GitHub Actions CI runs |
| **Config file** | `tsconfig.json` / `.github/workflows/ci.yml` / `package.json` scripts |
| **Quick run command** | `bun run lint && bun run typecheck` |
| **Full suite command** | `bun run test:ci && bun run coverage:gate` |
| **Smoke (local)** | `bun run smoke` (Plan 1 will define this npm script) |
| **CI signal command** | `gh pr checks --watch` (Plan 1 / Plan 2 evidence collection) |
| **Estimated runtime (local full)** | ~30-60 seconds |
| **Estimated runtime (CI full pipeline)** | ~3-6 minutes（3 parallel jobs + smoke step） |

---

## Sampling Rate

- **After every task commit (local):** Run `bun run lint && bun run typecheck` (< 15s feedback loop)
- **After every plan wave (local):** Run `bun run test:ci && bun run coverage:gate` + `bun run smoke` (Plan 1 後)
- **After Plan 1 PR push:** `gh pr checks --watch` 等到終態，check run URL 寫入 SUMMARY.md
- **After Plan 2 each force-push:** `gh pr checks --watch` 等到 failure 終態（避免 cancelled 污染 evidence），check run URL 寫入 SUMMARY.md 的 fail-mode 表
- **Before `$gsd-verify-work`:** Plan 1 PR 必須 merged、Plan 2 PR 必須 closed with 5 rows of failure evidence
- **Max feedback latency (local):** 60 秒
- **Max feedback latency (CI):** 6 分鐘（單一 CI run）

---

## Per-Task Verification Map

> 每個 task 會在 Plan 1 / Plan 2 的 PLAN.md 產生後 backfill（Plan 1/2 task IDs 尚未產出）。
> 以下為 requirement-level verification map，planner 需在 PLAN.md 中將每個 task 映射到對應 requirement。

| Requirement | Success Criteria | Verification Signal | Signal Source | Sampling Trigger | Status |
|-------------|------------------|---------------------|---------------|------------------|--------|
| **CI-04** (SC #1) | 非 master 分支 PR 首次全綠 (lint/typecheck/test+coverage/drift) | 4 個 check run item 皆 `SUCCESS` | `gh pr checks <PR#>` + PR 頁面 URL | Plan 1 PR push 後 | ✅ green |
| **OBS-01** (SC #2) | smoke step 真實 boot `createApp` + HTTP GET `/health` → 200 | `smoke` step `SUCCESS` + log 顯示 `/health -> 200` | ci.yml `smoke` step log + check run URL | Plan 1 PR push 後 | ✅ green |
| **CI-05** FM#1 lint (SC #3) | 刻意 biome lint 錯誤 → `lint` job 紅燈 | `lint` job `FAILURE`；其他 3 job 不必紅 | Plan 2 PR push#1 check run URL | Plan 2 force-push #1 | ⬜ pending |
| **CI-05** FM#2 typecheck (SC #4a) | 刻意 `@ts-expect-error` 無誤用 → `typecheck` job 紅 | `typecheck` job `FAILURE` | Plan 2 PR push#2 check run URL | Plan 2 force-push #2 | ⬜ pending |
| **CI-05** FM#3 test (SC #4b) | 刻意刪/改 test assertion → `test` job 紅 | `test` job step (test) `FAILURE` | Plan 2 PR push#3 check run URL | Plan 2 force-push #3 | ⬜ pending |
| **CI-05** FM#4 drift (SC #4c) | 改 schema 不補 migration → `Migration drift check` step 紅 | `test` job `Migration drift check` step `FAILURE`；test step 本身可綠（避免污染） | Plan 2 PR push#4 check run URL | Plan 2 force-push #4 | ⬜ pending |
| **CI-05** FM#5 smoke (SC #5) | 破壞 `createApp` boot (runtime tripwire) → smoke step 紅 | `test` job `smoke` step `FAILURE`；lint/typecheck 仍綠（隔離語意） | Plan 2 PR push#5 check run URL | Plan 2 force-push #5 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Nyquist 取樣密度註記：**
- 每個 fail-mode **獨立取樣一次**即為 100% sampling（不可低估至「3 類代表樣本」—— CONTEXT D-06 已鎖 5 類全驗）
- Plan 1 的「全綠」signal 必須在「不同時間點」取樣 2 次：Plan 1 merge 前最後一次 push、Plan 1 merge commit 的 post-merge CI run（若 protection rules 觸發）

---

## Wave 0 Requirements

- [x] Bun test framework 已存在（Phase 1-5 持續使用）—— 不需新裝
- [x] `bun run test:ci` / `coverage:gate` / `db:generate` 既有 script 不需新增
- [x] **Plan 1 Wave 0:** 新增 `scripts/smoke-health.ts` 檔案 stub + `package.json` 新增 `"smoke": "bun run scripts/smoke-health.ts"`
- [x] **Plan 1 Wave 0:** `.github/workflows/ci.yml` `test` job `env` 補 `PORT: 3000`（若 smoke 需 `loadConfig()` 跑過 PORT 驗證）
- [ ] **Plan 2 Wave 0:** sacrificial PR branch 建立（e.g. `experiment/ci-fail-mode-matrix`），base = Plan 1 merge 後的 main HEAD

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Plan 1 PR 在 GitHub 上顯示全綠 | CI-04 | GitHub Actions 外部服務，local 無法 mock | 1. Push Plan 1 branch；2. `gh pr create`；3. `gh pr checks --watch`；4. 等到所有 check 為 `pass/success`；5. 截圖或複製 check run URL 貼進 Plan 1 SUMMARY.md |
| Plan 2 sacrificial PR 5 次 force-push 各紅對應 job | CI-05 | 同上；且 force-push + Actions concurrency 互動 GitHub-only | 1. 建 sacrificial PR；2. 每次 force-push 一個 fail-mode patch；3. **關鍵 SOP**：`gh pr checks --watch` 等到進入 `failure` 終態（不可中途 force-push，避免 `concurrency.cancel-in-progress: true` 把上次 run 砍成 `cancelled`）；4. 複製 check run URL 到 Plan 2 SUMMARY.md 的 5-row 表格；5. 全 5 輪完成後 close PR 不 merge |
| `/health` 200 語意 | OBS-01 | HTTP 協議行為驗證；local smoke script 已可驗，但 CI 是 shippable evidence | CI log 中 smoke step 輸出應含 `GET /health -> 200` 或同等 assertion；若用 in-process handler 需 assert `response.status === 200` 並 process.exit(non-zero) on fail |

---

## Validation Sign-Off

- [ ] 每個 Plan 1 / Plan 2 task 皆有 `<acceptance_criteria>` 可以 grep / gh / shell 驗證（planner 必須產出）
- [ ] 連續 3 個 task 不得皆缺 automated verify（planner 必須確保）
- [x] Wave 0 `smoke` script 落地 + `PORT` env 補上（含 `DATABASE_URL` → `postgresql://` scheme）
- [ ] No watch-mode flags in CI
- [ ] Feedback latency < 60s local / < 6min CI
- [ ] 5 種 fail-mode 各有獨立 check run URL 舉證，無 cancelled evidence
- [ ] `nyquist_compliant: true` set in frontmatter（SUMMARY 寫完後）
- [ ] 2 條 `[ASSUMED]`（見 RESEARCH §Assumptions Log）於 Plan 2 執行時 local 驗證並記錄結果

**Approval:** pending
