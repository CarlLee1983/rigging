# 06-02 SUMMARY — CI Fail-mode Matrix

**Plan:** 06-02 (Phase 6 / v1.1 Release Validation)
**Requirements:** CI-05
**Status:** Complete
**Started:** 2026-04-20
**Completed:** 2026-04-20
**Sacrificial PR:** https://github.com/CarlLee1983/rigging/pull/2
**PR final state:** CLOSED (merged=false) — 依 D-05 關閉不 merge
**Sacrificial branch:** `phase-6-failmode-demo` (base = main @ 389512a) — 已於 local + origin 刪除

## Fail-mode Evidence Table

| # | Fail-mode | 破壞內容（patch 摘要） | 預期 red job / step | Check run URL |
|---|-----------|------------------------|---------------------|---------------|
| 1 | Lint (biome noDebugger) | `src/main.ts` 加 `debugger` statement（biome `recommended` → `noDebugger` error） | `CI / Lint (biome check)` job | https://github.com/CarlLee1983/rigging/actions/runs/24653524789/job/72081452273 |
| 2 | Typecheck (unused @ts-expect-error) | `src/main.ts`: `// @ts-expect-error` 放在 `const config = loadConfig()` 之前（無型別錯可壓抑） | `CI / Typecheck (tsc --noEmit)` job | https://github.com/CarlLee1983/rigging/actions/runs/24653608782/job/72081720411 |
| 3 | Test (flipped assertion) | `tests/unit/health/check-health.usecase.test.ts:13`: `ok: true` → `ok: false`（`CheckHealthUseCase > DB up → ok:true` 會 fail） | `CI / Test + coverage gate + migration drift` → `Test (with coverage)` step | https://github.com/CarlLee1983/rigging/actions/runs/24653675915/job/72081938123 |
| 4 | Drift (unused table, no migration) | 新增 `src/agents/infrastructure/schema/drift-demo.schema.ts`：定義一個完全未被 repository / query 引用的 `drift_demo` table；不跑 `bun run db:generate`（保留 porcelain dirty） | `CI / Test + coverage gate + migration drift` → `Migration drift check` step (Smoke step: **skipped** per R6 fail-fast) | https://github.com/CarlLee1983/rigging/actions/runs/24653784718/job/72082282721 |
| 5 | Smoke (SMOKE_TRIPWIRE env tripwire) | `src/bootstrap/app.ts` createApp 頂端加 `if (process.env.SMOKE_TRIPWIRE === '1') throw ...` + `.github/workflows/ci.yml` smoke step 加 `env: SMOKE_TRIPWIRE: '1'`；R3 runtime-only 隔離 → lint/tc/test 綠、drift 綠、只 smoke 紅 | `CI / Test + coverage gate + migration drift` → `Smoke (createApp boot + /health 200)` step；log line `✗ Smoke threw: ... Smoke tripwire: createApp intentionally failed for fail-mode #5` | https://github.com/CarlLee1983/rigging/actions/runs/24653882614/job/72082597955 |

## `[ASSUMED]` Verification Log

- A1 (RESEARCH): `tsc --noEmit` fails on unused `@ts-expect-error`（TS2578） — **result: VERIFIED**
  (local `bunx tsc --noEmit --strict /tmp/ts-a1/test.ts` emits `error TS2578: Unused '@ts-expect-error' directive.`；
  CI job `Typecheck (tsc --noEmit)` 於 FM#2 force-push 後 state=FAILURE 確認行為一致)
- A2 (RESEARCH): drift fail with unused column does not red `Test (with coverage)` step — **result: FALLBACK**
  採用新增 **unused table**（`drift-demo.schema.ts`）而非 unused column，理由：Drizzle 0.45 的
  `db.select().from(X)` 會依 schema 明示列出所有 columns，若加 column 到 existing schema 但
  migration 未產生，DB 實際無該欄位 → Postgres 回 `column does not exist` → `Test (with coverage)`
  step 也會紅（污染隔離）。新 table 完全未被 repository / query 引用 → `Test (with coverage)` 綠
  （CI 實測 step `success`），只有 `Migration drift check` step fail（CI log 包含
  `::error::Schema drift detected` 與 `drift_demo 2 columns 0 indexes 0 fks`）。A2 原假設語義
  （「drift fail-mode 隔離 Test step」）已達成，只是 patch 用 new-table 而非 new-column。

## Success Criteria 對照（ROADMAP Phase 6 SC#3 / SC#4 / SC#5）

- [x] **SC#3** — biome lint 刻意錯誤 → `CI / Lint (biome check)` job 紅 ✓（row #1：`debugger` statement 觸發 `noDebugger` recommended error；CI 對應 check run `24653524789`）
- [x] **SC#4** — typecheck / test / drift 三類 fail-mode 各驗一次
  - **SC#4a** typecheck：row #2 `@ts-expect-error` 無誤用 → `CI / Typecheck (tsc --noEmit)` 紅，lint/test/drift 綠（隔離）
  - **SC#4b** test：row #3 `tests/unit/health/check-health.usecase.test.ts` `ok: true → false` → `CI / Test + ... drift` job 於 `Test (with coverage)` step 紅
  - **SC#4c** drift：row #4 新增 unused table `drift_demo` 且不跑 `db:generate` → `Migration drift check` step 紅（Test step 綠、smoke step `skipped` 符合 R6 fail-fast 預期）
- [x] **SC#5** — smoke fail-mode → smoke step 紅 ✓（row #5：`SMOKE_TRIPWIRE` env-gated throw；lint/typecheck/test/drift 全綠只紅 smoke，完美隔離）

## Notes

- **PR 關閉（D-05 達成）**：2026-04-20 執行 `gh pr close 2`，`gh pr view 2 --json state,mergedAt`
  回傳 `{"state":"CLOSED", "mergedAt":null}` → merged=false。
- **sacrificial branch 已清理**：local (`git branch -D phase-6-failmode-demo`) 與 remote
  (`git push origin --delete phase-6-failmode-demo`) 兩處皆已刪除，`git ls-remote origin phase-6-failmode-demo`
  回傳空。
- **R2 discipline 守住**：5 次 force-push 全部等到 `gh pr checks --watch` 終態才推下一輪 —
  對所有 5 個 check run URL 逐一 `gh run view --json conclusion` 驗證，無任何 `cancelled`
  狀態污染 evidence。
- **R6 行為驗證**：Fail-mode #4（drift）的 `Smoke (createApp boot + /health 200)` step 狀態為
  `skipped` — 這是 GitHub Actions 在前置 step（`Migration drift check`）fail 後的 fail-fast 預期
  行為，**非 bug**；SUMMARY row #4 已明記。
- **ADR 決策**：本 plan **未新增 ADR**。Fail-mode demo 屬 Tier 3 process 類工作
  （evidence collection / CI gate 驗證），不涉及 Tier 1/2 架構決策或 stack 變更，無需 ADR。
- **main 未被污染**：最終 main HEAD `grep -q 'SMOKE_TRIPWIRE' src/bootstrap/app.ts` → 無、
  `grep -q 'debugger' src/main.ts` → 無、drift-demo schema 未進 main、ci.yml smoke step 無
  `SMOKE_TRIPWIRE` env block — 全部破壞僅存於 sacrificial branch 的 force-push commits，
  branch 刪除後 orphan commits 會由 GitHub gc 回收。

## Deviations 紀錄

### Fail-mode #1 — Plan 偏離記錄

原 PLAN 指定 `var x = 1` 作為 lint fail 觸發 → 實測 biome 2.4.12 `recommended` 只對 `var` 發出
**warning**（`noVar` 並非 recommended error；`noUnusedVariables` 是 warning），exit code 0 → lint
job 不會紅。改用 `debugger` statement 觸發 `noDebugger` rule（recommended 級 error）達到同樣的
「只紅 lint、不動 typecheck / test」隔離效果。此偏離屬 Rule 1（原 patch 無法達成既定 fail-mode，
需替換為可實際觸發 biome error 的 pattern）。

### Fail-mode #4 — A2 FALLBACK 記錄

原 PLAN 與 RESEARCH §Assumptions Log A2 假設採用「新增 unused column」，local 預驗發現 Drizzle
0.45 的 `db.select().from(X)` 會依 schema 明示列出所有 columns — 若加 column 到 existing
schema 但 migration 未產生，DB 實體無該欄位 → Postgres 回 `column does not exist` → 污染到
`Test (with coverage)` step（會同時紅，無法隔離 drift gate）。改用新增 unused **table**
（`src/agents/infrastructure/schema/drift-demo.schema.ts` 定義 `drift_demo`，完全未被 repository
或 query 引用）→ `Test (with coverage)` step 綠、只 `Migration drift check` step 紅。A2 的
**隔離語義**（drift fail-mode 不污染 Test step）已達成，只是 patch 形式由 column 改為 table。
