---
phase: 09-scaffold-engine
plan: "05"
subsystem: scaffold
tags: [integration-test, e2e, bun-test, scaf-validation]
dependency_graph:
  requires:
    - packages/create-rigging/bin/create-rigging.js (Plan 04)
    - scripts/build-template.js (Plan 03)
    - packages/create-rigging/lib/helpers.js (Plan 01)
    - tests/unit/scaffold/ (Plan 02)
  provides:
    - tests/integration/scaffold/cli-e2e.test.ts
  affects:
    - Phase 9 verification gate (all 6 SCAF requirements covered)
tech_stack:
  added: []
  patterns:
    - bun:test beforeAll/afterAll lifecycle for E2E test setup and teardown
    - execSync with cwd for cross-directory script invocation
    - Filesystem assertions via existsSync and readFileSync after CLI run
key_files:
  created:
    - tests/integration/scaffold/cli-e2e.test.ts
  modified: []
decisions:
  - "beforeAll runs build-template.js before create-rigging.js per RESEARCH Pitfall 2"
  - "Added idempotent cleanup at start of beforeAll (rmSync if DEST exists) to handle leftover from killed test runs"
  - "cliStdout captured via execSync return value (Buffer → toString()) for SCAF-07 assertions"
  - "bun.lock verbatim copy assertion: expect(content).toContain('rigging') confirms D-09 behaviour"
metrics:
  duration: "~180s"
  completed: "2026-04-20"
  tasks_completed: 2
  tasks_total: 3
  files_created: 1
  files_modified: 0
requirements:
  - SCAF-01
  - SCAF-03
  - SCAF-04
  - SCAF-05
  - SCAF-06
  - SCAF-07
---

# Phase 9 Plan 05: Integration Test + Human Verify Summary

**One-liner:** E2E integration test `cli-e2e.test.ts` covering all 6 SCAF requirements via build-template → create-rigging pipeline; 69 scaffold tests pass (46 unit + 23 integration); checkpoint awaiting human banner approval.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create tests/integration/scaffold/cli-e2e.test.ts | 6517c3c | tests/integration/scaffold/cli-e2e.test.ts |
| 2 | Run full scaffold test suite (unit + integration) | — | verification only, no new files |

## Task 3 Status

**Awaiting:** checkpoint:human-verify — human must confirm banner output is correct.

## What Was Built

**tests/integration/scaffold/cli-e2e.test.ts** — End-to-end integration test implementing:
- `beforeAll`: idempotent cleanup → `node scripts/build-template.js` → `node packages/create-rigging/bin/create-rigging.js test-scaffold-output` (captures stdout)
- `afterAll`: `rmSync(DEST, { recursive: true, force: true })`
- 23 test assertions covering:
  - **SCAF-01** (1 test): output directory `test-scaffold-output` exists
  - **SCAF-03** (7 tests): src/, tests/, drizzle/, .github/workflows/, docker-compose.yml, tsconfig.json, bun.lock present
  - **SCAF-04** (3 tests): package.json name substituted; docker-compose.yml contains project name; bun.lock verbatim copy
  - **SCAF-05** (4 tests): .planning/, packages/, .git/, .env absent
  - **SCAF-06** (4 tests): .env.example present with DATABASE_URL, BETTER_AUTH_SECRET, PORT
  - **SCAF-07** (4 tests): stdout contains cd, bun install, docker compose up -d, bun test

## Test Results

| Suite | Command | Result |
|-------|---------|--------|
| Integration only | `bun test tests/integration/scaffold/cli-e2e.test.ts` | 23 pass, 0 fail |
| Full scaffold suite | `bun test tests/unit/scaffold/ tests/integration/scaffold/` | 69 pass, 0 fail |

## CLI Verification Output (captured at checkpoint)

### `node scripts/build-template.js`
```
build-template: copied 249 files to .../packages/create-rigging/template
```

### `node packages/create-rigging/bin/create-rigging.js my-app-checkpoint-test`
```
Creating my-app-checkpoint-test...

Done! Your project is ready.

  cd my-app-checkpoint-test
  bun install
  docker compose up -d
  bun test

```
Exit code: 0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added idempotent cleanup at start of beforeAll**
- **Found during:** Task 1 test authoring
- **Issue:** The plan's `beforeAll` did not include cleanup of a leftover `DEST` directory from a previous killed test run. Without this, re-running the test would fail at the CLI step with "Error: directory already exists."
- **Fix:** Added `if (existsSync(DEST)) rmSync(DEST, { recursive: true, force: true })` as first line of `beforeAll`.
- **Files modified:** `tests/integration/scaffold/cli-e2e.test.ts`
- **Commit:** 6517c3c (included in initial commit)

## Known Stubs

None. The integration test is complete and functional. All assertions map to real scaffold output.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced.

The integration test executes system commands (`node scripts/build-template.js`, `node packages/create-rigging/bin/create-rigging.js`) but these are hardcoded — no user-controlled input reaches `execSync`.

| Flag | File | Description |
|------|------|-------------|
| — | — | No new threat surface identified |

## Self-Check: PASSED

| Item | Status |
|------|--------|
| tests/integration/scaffold/cli-e2e.test.ts | FOUND |
| commit 6517c3c (Task 1) | FOUND |
| bun test tests/integration/scaffold/ → 23 pass | VERIFIED |
| bun test tests/unit/scaffold/ tests/integration/scaffold/ → 69 pass | VERIFIED |
| CLI banner contains cd/bun install/docker compose up -d/bun test | VERIFIED |
| No modifications to STATE.md or ROADMAP.md | CONFIRMED |
