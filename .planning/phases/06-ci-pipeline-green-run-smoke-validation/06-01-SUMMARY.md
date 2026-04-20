# 06-01 SUMMARY — CI Green Baseline + Smoke Step

**Plan:** 06-01 (Phase 6 / v1.1 Release Validation)
**Requirements:** CI-04, OBS-01
**Status:** Complete
**Completed:** 2026-04-20

## Evidence (D-03 shippable)

| Item | Value |
|------|-------|
| PR URL | https://github.com/CarlLee1983/rigging/pull/1 |
| PR state | MERGED |
| Merged commit SHA | bf9eaf4d6afff4b9048d3af250677d5344ea80da |
| Green CI run (Test+coverage+drift+smoke) | https://github.com/CarlLee1983/rigging/actions/runs/24652628305 |
| Lint check URL | https://github.com/CarlLee1983/rigging/actions/runs/24652628305/job/72078610998 |
| Typecheck check URL | https://github.com/CarlLee1983/rigging/actions/runs/24652628305/job/72078610983 |
| ADR-check URL | https://github.com/CarlLee1983/rigging/actions/runs/24652628309/job/72078592438 |
| Smoke step log line | `✓ Smoke OK — createApp boot + /health 200 + db up` |

## Success Criteria 對照（ROADMAP Phase 6 SC#1 + SC#2）

- [x] SC#1: 非 master 分支 PR 首跑 4 個 check item 全綠 — see table above
- [x] SC#2: smoke step 在同 PR run 中 green + log 含 `✓ Smoke OK` — see table above

## Files Changed

- scripts/smoke-health.ts (new; success path uses `process.exit(0)` so CI does not hang on open postgres pool)
- package.json (scripts 區塊 + `smoke`)
- .github/workflows/ci.yml (test job env + smoke step)
- .github/workflows/adr-check.yml (PR body via `env` — avoids markdown backticks breaking the shell)

## Notes

- ADR：本 plan 未新增 ADR（smoke script 落點屬 Tier 3 convention）
- 首跑 `adr-check` 因 PR body 內反引號被 bash 誤解析而失敗；已改為 `PR_BODY` env + `printf` 管道 grep
- 首跑 CI `Smoke` step 曾因 postgres-js 連線池保持 process alive 而無限 pending；已在 `scripts/smoke-health.ts` 成功路徑補 `process.exit(0)`
- R1 / R10（PORT + `postgresql://`）已於 ci.yml test job 滿足
