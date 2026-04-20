# Project Retrospective

*Living document — updated at milestone boundaries.*

## Milestone: v1.1 — Release Validation

**Shipped:** 2026-04-20
**Phases:** 3 | **Plans:** 5

### What Was Built

- CI pipeline 在 GitHub 上首次全綠 + 五類 fail-mode（sacrificial PR #2）
- `04-SECURITY.md` SEC-01 證據（CVE-2025-61928、timing-safe、cross-user matrix）
- ADR 0019、`validate-adr-frontmatter`、malformed-ADR sacrificial PR #3 + `adr-check` FAILURE URL

### What Worked

- Sacrificial PR「關閉不 merge」保留 fail-mode 證據而不污染 main
- Phase 7 以單一計畫集中補 SECURITY 文件，與 Phase 04 代碼路徑對齊

### What Was Inefficient

- `audit-open` 仍回報 Phase 3 舊的 `human_needed` 驗證項 — 以 milestone close acknowledge 收斂，非 v1.1 範圍阻擋

### Patterns Established

- Smoke step 作為 CI 最後一關（OBS-01）+ 專用 tripwire fail-mode

### Key Lessons

1. ADR gate 需在 CI 穩定後才容易證明 workflow 結論（Phase 8 soft-depends Phase 6）。
2. Requirements 檔在執行期應同步勾選，避免 archive 前 traceability 漂移。

### Cost Observations

- Notable: hygiene milestone 以證據 URL / run id 為交付物，與 feature milestone 不同

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v1.0 | 5 | Reference App + 社群級測試與文件 |
| v1.1 | 3 | Operations self-verify（CI / SECURITY 文件 / ADR gate） |

### Cumulative Quality

| Milestone | Tests (v1.0 baseline) | Notes |
|-----------|------------------------|-------|
| v1.0 | 221 pass | 100% domain+application+kernel coverage gate |
| v1.1 | unchanged product tests | + CI smoke + validation scripts |
