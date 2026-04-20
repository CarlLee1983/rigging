---
phase: 09-scaffold-engine
plan: "04"
subsystem: scaffold
tags: [cli, bin, create-rigging, smoke-test, commonjs]
dependency_graph:
  requires:
    - packages/create-rigging/lib/helpers.js (Plan 01)
    - packages/create-rigging/bin/.gitkeep (Plan 03)
    - scripts/build-template.js (Plan 03)
    - packages/create-rigging/template/ (built by Plan 03)
  provides:
    - packages/create-rigging/bin/create-rigging.js
  affects:
    - scripts/build-template.js (EXCLUDE_PREFIXES update)
tech_stack:
  added: []
  patterns:
    - CJS CLI entry point with shebang (#!/usr/bin/env node)
    - Early-exit guard pattern (Node version, arg validation, path traversal, dest-exists)
    - Recursive directory copy with isTextFile/substituteProjectName dispatch
    - EXCLUDE_PREFIXES in build-template to exclude scaffold-internal tests from template
key_files:
  created:
    - packages/create-rigging/bin/create-rigging.js
  modified:
    - scripts/build-template.js
decisions:
  - "isNodeVersionSufficient() called with no arguments (uses live process.versions.node, not test string)"
  - "require('../lib/helpers') — relative to bin/, not './lib/helpers' or '../../lib/helpers'"
  - "path.join(__dirname, '../template') — D-06 canonical template location"
  - "Path traversal guard: resolvedDest.startsWith(cwd + path.sep) as second layer beyond validateProjectName"
  - "tests/unit/scaffold/ added to EXCLUDE_PREFIXES — these tests import packages/create-rigging/lib/helpers.js which does not exist in generated projects"
metrics:
  duration: "337s"
  completed: "2026-04-20"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
requirements:
  - SCAF-01
  - SCAF-04
  - SCAF-06
  - SCAF-07
---

# Phase 9 Plan 04: CLI Entry Point Summary

**One-liner:** CJS executable `bin/create-rigging.js` with Node >= 18 guard, arg/path validation, recursive copy with text substitution, and exact next-steps banner (`cd`, `bun install`, `docker compose up -d`, `bun test`); all SCAF smoke checks pass.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create packages/create-rigging/bin/create-rigging.js | 17b3a50 | packages/create-rigging/bin/create-rigging.js |
| 2 | End-to-end smoke test + build-template fix | cfc2e81 | scripts/build-template.js |

## What Was Built

**packages/create-rigging/bin/create-rigging.js** — CLI entry point (mode 100755) implementing:
- Shebang `#!/usr/bin/env node` + `'use strict'` (CJS, compatible with root `type: module` via packages/create-rigging/package.json `"type": "commonjs"`)
- Node version guard: `isNodeVersionSufficient()` → `process.exit(1)` if major < 18 (D-03)
- Arg parsing + `validateProjectName()` — covers empty string, reserved name 'rigging', '/' and '..' injection
- Path traversal second layer: `resolvedDest.startsWith(cwd + path.sep)` check (T-09-06)
- Destination existence check: `existsSync(resolvedDest)` → error + exit 1 (T-09-07)
- Template location: `path.join(__dirname, '../template')` with existence check (D-06)
- `copyDir()` recursive copy: `isTextFile()` dispatches to text substitution or verbatim `copyFileSync()`
- next-steps banner (SCAF-07 exact strings): `cd <name>`, `bun install`, `docker compose up -d`, `bun test`

**scripts/build-template.js** (Rule 1 auto-fix) — Added `'tests/unit/scaffold/'` to `EXCLUDE_PREFIXES` to prevent scaffold tool tests from being included in the generated project template.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Exclude tests/unit/scaffold/ from build-template EXCLUDE_PREFIXES**
- **Found during:** Task 2 verification (`bun test tests/unit/scaffold/`)
- **Issue:** `scripts/build-template.js` included `tests/unit/scaffold/` in the template. These test files import `../../../packages/create-rigging/lib/helpers.js` — a path that does not exist in a generated project. When bun test was invoked with glob pattern `tests/unit/scaffold/`, it matched both `tests/unit/scaffold/` (correct) and `packages/create-rigging/template/tests/unit/scaffold/` (wrong), causing 3 module-not-found errors.
- **Fix:** Added `'tests/unit/scaffold/'` to `EXCLUDE_PREFIXES` in `scripts/build-template.js`. Rebuilt template: 248 files (down from 251 — 3 scaffold test files excluded).
- **Files modified:** `scripts/build-template.js`
- **Commit:** cfc2e81

## Verification Results

| Check | Result |
|-------|--------|
| `node create-rigging.js` (no arg) → exit 1 + usage message | PASS |
| `node create-rigging.js rigging` → exit 1 + reserved name error | PASS |
| `node create-rigging.js my-app` → creates ./my-app/ exit 0 | PASS |
| `node create-rigging.js my-app` (second run) → exit 1 + "already exists" | PASS |
| `my-app/package.json` name = 'my-app' | PASS |
| `my-app/.planning/` absent (SCAF-05) | PASS |
| `my-app/packages/` absent (SCAF-05) | PASS |
| `my-app/.env.example` present with DATABASE_URL + BETTER_AUTH_SECRET (SCAF-06) | PASS |
| `my-app/src/`, `my-app/tests/`, `my-app/.github/workflows/` present (SCAF-03) | PASS |
| `bun test tests/unit/scaffold/` → 46 pass, 0 fail | PASS |
| `git ls-files -s bin/create-rigging.js` mode = 100755 | PASS |

## Threat Surface Scan

All threat model mitigations confirmed implemented:

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-09-06 | validateProjectName rejects '/' and '..'; resolvedDest.startsWith(cwd+sep) second layer | Implemented |
| T-09-07 | existsSync(resolvedDest) → error + exit 1, no silent overwrite | Implemented |
| T-09-08 | Template from git ls-files (no symlinks in tracked files) | Accepted |
| T-09-09 | .env excluded via git ls-files; only .env.example in template | Verified |

No new network endpoints, auth paths, or schema changes introduced.

## Known Stubs

None. `bin/create-rigging.js` is a complete, functional implementation. All SCAF acceptance criteria verified in smoke test.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| packages/create-rigging/bin/create-rigging.js | FOUND |
| scripts/build-template.js (updated) | FOUND |
| commit 17b3a50 (Task 1) | FOUND |
| commit cfc2e81 (Task 2) | FOUND |
| git mode 100755 for create-rigging.js | VERIFIED |
| bun test tests/unit/scaffold/ 46 pass 0 fail | VERIFIED |
| Smoke test: my-smoke-test created and cleaned up | VERIFIED |
