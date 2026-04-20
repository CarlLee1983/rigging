# 08-01 SUMMARY — ADR audit + MADR validation gate

**Plan:** 08-01 (Phase 8 / v1.1 Release Validation)
**Requirements:** ADR-06 (b/c — audit + CI gate before sacrificial PR)
**Status:** Complete
**Completed:** 2026-04-20

## Metadata

| Item | Value |
|------|-------|
| Branch | local execution (`gsd-sdk` unavailable in runner — inline execute-phase) |
| PR / merge | — (land via normal PR to `main`) |
| Merge commit SHA | 5f5a7fd (local `main`; update after push/PR merge to `origin/main`) |

## §Audit — ADR 0000..0018 + README (Task 1–2)

**README index row count (data rows 0000–0019):** 20 (after ADR 0019 added in Task 5).

**Footnote:** README “Status” column uses lowercase `accepted` to match file front matter `status: accepted` (MADR convention in 0000). Display is not Title Case in the table.

**Drift:** No drift for 0000–0018 — each file had `status: accepted`, `date: 2026-04-19`, required keys present; README rows matched before 0019 landed.

### Audit table (file vs README)

| ADR id | file status | README status | match? |
|--------|-------------|---------------|--------|
| 0000 | accepted | accepted | Y |
| 0001 | accepted | accepted | Y |
| 0002 | accepted | accepted | Y |
| 0003 | accepted | accepted | Y |
| 0004 | accepted | accepted | Y |
| 0005 | accepted | accepted | Y |
| 0006 | accepted | accepted | Y |
| 0007 | accepted | accepted | Y |
| 0008 | accepted | accepted | Y |
| 0009 | accepted | accepted | Y |
| 0010 | accepted | accepted | Y |
| 0011 | accepted | accepted | Y |
| 0012 | accepted | accepted | Y |
| 0013 | accepted | accepted | Y |
| 0014 | accepted | accepted | Y |
| 0015 | accepted | accepted | Y |
| 0016 | accepted | accepted | Y |
| 0017 | accepted | accepted | Y |
| 0018 | accepted | accepted | Y |
| 0019 | accepted | accepted | Y |

### Minimum spot-checks (0000, 0009, 0018) + 0019

**0000 — file:** `status: accepted` / `date: 2026-04-19` (`docs/decisions/0000-use-madr-for-adrs.md`). **README:** `| [0000](0000-use-madr-for-adrs.md) | Use MADR 4.0 for ADRs | accepted | 2026-04-19 |`.

**0009 — file:** `status: accepted` / `date: 2026-04-19` (`docs/decisions/0009-rigidity-map.md`). **README:** `| [0009](0009-rigidity-map.md) | Rigidity Map: three-tier strictness | accepted | 2026-04-19 |`.

**0018 — file:** `status: accepted` / `date: 2026-04-19` (`docs/decisions/0018-testcontainers-deviation-via-docker-compose.md`). **README:** `| [0018](0018-testcontainers-deviation-via-docker-compose.md) | testcontainers for v1 satisfied via docker-compose + GitHub Actions services | accepted | 2026-04-19 |`.

**0019 — file:** `status: accepted` / `date: 2026-04-20` (`docs/decisions/0019-adr-check-madr-validation.md`). **README:** `| [0019](0019-adr-check-madr-validation.md) | CI validates MADR front matter when a PR requires a new ADR | accepted | 2026-04-20 |`.

## §CI — adr-check extension (Task 4)

**Step order:** `actions/checkout` (fetch-depth 0) → `adr-required` (grep PR body checkbox) → **Require new ADR file when checkbox set** (count added `docs/decisions/*.md`) → **Setup Bun** (`oven-sh/setup-bun@v2`, 1.3.12) → **Cache bun deps** → **Install dependencies** (`bun install --frozen-lockfile`) → **Validate new ADR MADR front matter** (`bun run scripts/validate-adr-frontmatter.ts` per added path).

**Files touched:** `.github/workflows/adr-check.yml`, `scripts/validate-adr-frontmatter.ts`, `package.json` (`validate:adr` script).

**Local checks run:** `bun run lint` (pass); `bun run validate:adr docs/decisions/0000-use-madr-for-adrs.md` (exit 0); malformed copy without `deciders:` (exit 1, `::error::`).

## §ADR 0019 decision (Task 5)

**Recorded:** `docs/decisions/0019-adr-check-madr-validation.md` — CI enforcement of MADR shape when a PR declares a new ADR is an architectural/process decision worth an ADR (traceability for ADR-06 / SC4).

## §Ready for 08-02

- [x] `main` (after merge of this work) contains `scripts/validate-adr-frontmatter.ts` and conditional `adr-check` validation steps.
- [x] Validator fails fast on missing MADR keys or bad title line (`::error::`).
- [x] Sacrificial PR fail-mode evidence — see **`08-02-SUMMARY.md`** (PR #3, `adr-check` FAILURE, closed without merge).

ADR-06(a) evidence is recorded in **08-02**, not here.

## Self-Check: PASSED

- Acceptance criteria from 08-01-PLAN Tasks 1–6 verified for implemented scope.
- `bun run lint` exit 0 after edits.
