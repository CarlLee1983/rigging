# 06-02 SUMMARY — CI Fail-mode Matrix

**Plan:** 06-02 (Phase 6 / v1.1 Release Validation)
**Requirements:** CI-05
**Status:** In progress
**Started:** 2026-04-20
**Sacrificial PR:** https://github.com/CarlLee1983/rigging/pull/2
**Sacrificial branch:** `phase-6-failmode-demo` (base = main @ 389512a)

## Fail-mode Evidence Table

| # | Fail-mode | 破壞內容（patch 摘要） | 預期 red job / step | Check run URL |
|---|-----------|------------------------|---------------------|---------------|
| 1 | Lint (biome noDebugger) | `src/main.ts` 加 `debugger` statement（biome `recommended` → `noDebugger` error） | `CI / Lint (biome check)` job | https://github.com/CarlLee1983/rigging/actions/runs/24653524789/job/72081452273 |
| 2 | Typecheck (unused @ts-expect-error) | `src/main.ts`: `// @ts-expect-error` 放在 `const config = loadConfig()` 之前（無型別錯可壓抑） | `CI / Typecheck (tsc --noEmit)` job | https://github.com/CarlLee1983/rigging/actions/runs/24653608782/job/72081720411 |
| 3 | Test (flipped assertion) | — | — | — |
| 4 | Drift (unused column, no migration) | — | — | — |
| 5 | Smoke (SMOKE_TRIPWIRE env tripwire) | — | — | — |

## `[ASSUMED]` Verification Log

- A1 (RESEARCH): `tsc --noEmit` fails on unused `@ts-expect-error`（TS2578） — **result: VERIFIED**
  (local `bunx tsc --noEmit --strict /tmp/ts-a1/test.ts` emits `error TS2578: Unused '@ts-expect-error' directive.`；
  CI job `Typecheck (tsc --noEmit)` 於 FM#2 force-push 後 state=FAILURE 確認行為一致)
- A2 (RESEARCH): drift fail with unused column does not red `Test (with coverage)` step — result: (to be filled by Task 4)

## Notes

- 本 PR 將於 5 輪完成後 `gh pr close --comment ...` 關閉不 merge（D-05）
- sacrificial branch 於 close 後刪除（remote + local）
- R2 discipline：每次 force-push 前必等 `gh pr checks --watch` 終態（非 cancelled），避免
  `concurrency.cancel-in-progress: true` 把上次 run 砍掉失去 evidence

### Fail-mode #1 — Plan 偏離記錄

原 PLAN 指定 `var x = 1` 作為 lint fail 觸發 → 實測 biome 2.4.12 `recommended` 只對 `var` 發出
**warning**（`noVar` 並非 recommended error；`noUnusedVariables` 是 warning），exit code 0 → lint
job 不會紅。改用 `debugger` statement 觸發 `noDebugger` rule（recommended 級 error）達到同樣的
「只紅 lint、不動 typecheck / test」隔離效果。此偏離屬 Rule 1（原 patch 無法達成既定 fail-mode，
需替換為可實際觸發 biome error 的 pattern）。
