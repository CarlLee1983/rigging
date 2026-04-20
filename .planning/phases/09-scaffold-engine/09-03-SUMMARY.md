---
phase: 09-scaffold-engine
plan: "03"
subsystem: scaffold
tags: [cli, build-script, template, esm, node]
dependency_graph:
  requires:
    - packages/create-rigging/package.json (Plan 01)
    - .gitignore (Plan 01 — template/ exclusion)
  provides:
    - scripts/build-template.js
    - packages/create-rigging/bin/ (placeholder for Plan 04)
    - packages/create-rigging/template/ (build-time output, not tracked in git)
  affects:
    - packages/create-rigging/template/ (built on demand, gitignored)
tech_stack:
  added: []
  patterns:
    - ESM script (import/export) compatible with root type:module
    - git ls-files as template source (respects .gitignore automatically)
    - EXCLUDE_PREFIXES filter for additional exclusions beyond .gitignore
key_files:
  created:
    - scripts/build-template.js
    - packages/create-rigging/bin/.gitkeep
decisions:
  - "Used ESM import syntax instead of CommonJS require — root package.json has type:module so .js files are parsed as ESM; require would throw ReferenceError (Rule 1 auto-fix, Pitfall 1)"
  - "__dirname reconstructed via fileURLToPath(import.meta.url) + dirname() for ESM compatibility"
  - "EXCLUDE_PREFIXES = ['.planning/', 'packages/'] per D-10 — git ls-files handles all .gitignore excludes automatically"
  - "{ cwd: repoRoot } on execSync('git ls-files') — mandatory per Pitfall 5"
  - "Script self-included in template (247 original + scripts/build-template.js = 248 files) — correct and expected"
metrics:
  duration: "312s"
  completed: "2026-04-20"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
requirements:
  - SCAF-03
  - SCAF-05
---

# Phase 9 Plan 03: Build Template Script Summary

**One-liner:** Pre-publish ESM build script that runs `git ls-files` with EXCLUDE_PREFIXES to populate `packages/create-rigging/template/` with 248 tracked reference-app files (excluding `.planning/` and `packages/`).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create scripts/build-template.js | b77be66 | scripts/build-template.js |
| 2 | Verify template content and create bin/ directory | 7fdbef0 | packages/create-rigging/bin/.gitkeep |

## What Was Built

**scripts/build-template.js** — Pre-publish build script (ESM, Node.js >= 18) that:
- Uses `execSync('git ls-files', { cwd: repoRoot })` to enumerate all tracked repo files (respects `.gitignore` automatically)
- Filters with `EXCLUDE_PREFIXES = ['.planning/', 'packages/']` to exclude scaffold-internal directories (D-10)
- Cleans `packages/create-rigging/template/` before each run (idempotent)
- Copies all 248 files preserving relative directory structure via `mkdirSync + copyFileSync`
- Exits 1 if git fails or no files pass the filter
- Prints file count on success: `build-template: copied 248 files to .../template`

**packages/create-rigging/bin/.gitkeep** — Placeholder ensuring `bin/` directory is tracked in git. Plan 04 will create `bin/create-rigging.js` here and run `git update-index --chmod=+x` on it.

**Template content verified:**
- 248 files total (within 200-250 expected range)
- `.env.example` included (D-11) ✓
- `bun.lock` included (D-11) ✓
- `drizzle/` included (D-11) ✓
- `.github/` included (SCAF-04) ✓
- `src/` included ✓
- `tests/` included ✓
- `.planning/` excluded (D-10) ✓
- `packages/` excluded (D-10) ✓
- `.env` excluded (T-09-04: git ls-files does not track .env) ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESM syntax required (root type:module)**
- **Found during:** Task 1 — first run of `node scripts/build-template.js`
- **Issue:** Root `package.json` has `"type": "module"`, so `.js` files are parsed as ESM. The plan's `require()` calls throw `ReferenceError: require is not defined in ES module scope`.
- **Fix:** Rewrote script with ES module `import` syntax. Reconstructed `__dirname` using `fileURLToPath(import.meta.url) + dirname()`. All functional behavior is identical to the plan specification.
- **Files modified:** `scripts/build-template.js`
- **Commit:** b77be66

The functional behavior is 100% equivalent to the plan: EXCLUDE_PREFIXES, cwd: repoRoot, rmSync clean before copy, exit 1 on failure, file count output — all preserved.

## Threat Surface Scan

T-09-04 (Information Disclosure — `.env` copied into template) is **fully mitigated**:
- `git ls-files` does not include `.env` (it is in root `.gitignore`)
- Verified: `packages/create-rigging/template/.env` does not exist after build
- Only `.env.example` (intentionally tracked) is present in the template

T-09-05 (EXCLUDE_PREFIXES missing entry): `.planning/` and `packages/` are both in EXCLUDE_PREFIXES. No additional exclusions are needed — `git ls-files` handles all `.gitignore`-based excludes automatically.

No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Known Stubs

None. `scripts/build-template.js` is a complete implementation that runs successfully and produces the correct output.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| scripts/build-template.js | FOUND |
| packages/create-rigging/bin/.gitkeep | FOUND |
| node scripts/build-template.js exits 0 | VERIFIED |
| packages/create-rigging/template/package.json | FOUND |
| packages/create-rigging/template/src/ | FOUND |
| packages/create-rigging/template/.env.example | FOUND |
| packages/create-rigging/template/bun.lock | FOUND |
| packages/create-rigging/template/drizzle/ | FOUND |
| packages/create-rigging/template/.planning/ absent | VERIFIED |
| packages/create-rigging/template/packages/ absent | VERIFIED |
| packages/create-rigging/template/.env absent | VERIFIED |
| Template file count 200-250 | VERIFIED (248) |
| commit b77be66 (Task 1) | FOUND |
| commit 7fdbef0 (Task 2) | FOUND |
