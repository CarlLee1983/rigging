# Phase 8 — Technical Research

**Phase:** 8 — ADR Process Self-Check  
**Question:** What must we know to plan ADR audit + `adr-check` fail-mode evidence well?

## RESEARCH COMPLETE

---

## 1. Current `adr-check` behavior (verified)

Source: `.github/workflows/adr-check.yml`

- Triggers on `pull_request` to `main`.
- Parses PR body for checked line: `- [x] This PR introduces a decision that requires a new ADR`.
- If required: fails only when **no new** `docs/decisions/*.md` files are added (`git diff --name-only --diff-filter=A ...`).
- **Does not** parse YAML front matter, MADR section headings, or `status` values.

**Implication:** A PR can add a **malformed** ADR (empty file, missing front matter) and still pass `adr-check` today. **ADR-06(a)** and ROADMAP success criterion 1 (“malformed ADR … `adr-check` … fail”) require **workflow hardening** before sacrificial-PR evidence is meaningful.

## 2. MADR 4.0 “full variant” minimum signal (from ADR 0000)

Reference: `docs/decisions/0000-use-madr-for-adrs.md`

- YAML front matter with at least: `status`, `date`, `deciders`, `consulted`, `informed` (see sample in 0000).
- Title line: `# NNNN. …`
- Body sections aligned with MADR full variant (Context, Decision Drivers, Considered Options, Decision Outcome, …).

**Pragmatic CI validation:** Enforce **required YAML keys** + **presence of opening `---` fences** + **non-empty `#` title** on **added** `docs/decisions/*.md` files when ADR is required. Optional follow-up: grep for `## Context` (or `Context and Problem Statement`) to catch empty stubs.

## 3. ADR index and numbering

- Repo has **19** numbered files `0000`–`0018` under `docs/decisions/` plus `README.md` (verified via listing).
- `docs/decisions/README.md` index table must match each file’s front matter `status` and title intent.

**Naming note:** ROADMAP success criterion 2 uses **Title Case** labels (`Accepted` / `Superseded` / `Deprecated`); file front matter and README currently use **lowercase** `accepted`. Audit should record **canonical values** and either (a) standardize README column to match ROADMAP wording or (b) document that “accepted” in files maps to **Accepted** in checklist language—planner locks this in Plan 08-01.

## 4. Evidence pattern (mirror Phase 6)

Reference: `.planning/phases/06-ci-pipeline-green-run-smoke-validation/06-02-SUMMARY.md`

- One sacrificial PR, base `main`, **closed not merged**.
- **Check run URL** for failing `adr-check` job captured in Phase 8 SUMMARY.
- Branch cleanup / no pollution of `main`.

## 5. Dependency: Phase 6

Phase 8 **Depends on:** Phase 6 (`adr-check` must exist on `main` and run on PRs). Executor must confirm merged `main` contains `adr-check.yml` before opening sacrificial PR.

## 6. Validation Architecture (Nyquist)

| Dimension | Signal for this phase |
|-----------|------------------------|
| **D8** | External GitHub check URLs + SUMMARY tables; local script dry-run optional |
| **Coverage** | ADR-06(a)(b)(c) mapped to plans 08-01 / 08-02 |

---

## 7. GitHub Actions: Bun on `adr-check`

`adr-check.yml` currently only runs `actions/checkout` — unlike `ci.yml` it does **not** invoke `oven-sh/setup-bun`. Any step that runs `bun run scripts/...` **must** add `oven-sh/setup-bun@v2` (pin `bun-version: 1.3.12` to match `ci.yml`) and `bun install --frozen-lockfile` before calling the validator.

## Recommendations

1. **Plan 08-01** — Audit + README alignment + **extend `adr-check`** with a blocking validation step (Bun script in `scripts/` recommended to match stack).
2. **Plan 08-02** — After 08-01 merges, open sacrificial PR with intentional MADR violation; capture red `adr-check` URL.
3. **ADR 0019** — If hardening CI counts as a new architectural decision per project norms, add `0019-*.md` + README row in 08-01; else document “no new ADR” rationale in milestone close (per ROADMAP SC4).
