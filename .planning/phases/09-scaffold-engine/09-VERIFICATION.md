---
phase: 09-scaffold-engine
verified: 2026-04-20T00:00:00Z
status: archived
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run 'node packages/create-rigging/bin/create-rigging.js my-app' and visually confirm the printed next-steps banner"
    expected: "Banner shows exactly: cd my-app / bun install / docker compose up -d / bun test on separate lines with 2-space indent"
    why_human: "Plan 05 Task 3 is an explicit blocking checkpoint:human-verify gate (autonomous: false). The banner output is captured in test assertions and summary, but the plan requires a human to explicitly approve the visual output before the phase is considered complete."
---

# Phase 9: Scaffold Engine Verification Report

**Phase Goal:** A developer can run `npx create-rigging <project-name>` locally and receive a fully working, correctly named project directory
**Verified:** 2026-04-20
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running `node packages/create-rigging/bin/create-rigging.js my-app` creates a `./my-app/` directory with full DDD four-layer project | VERIFIED | Integration test SCAF-01 + SCAF-03: 23 tests pass; template contains src/, tests/, drizzle/, .github/workflows/, docker-compose.yml, tsconfig.json, bun.lock |
| 2 | Generated `package.json` has `"name": "my-app"` and other project-name references are substituted | VERIFIED | SCAF-04 integration test: `pkg.name === PROJECT_NAME` passes; single-pass regex `/Rigging|rigging/g` prevents double-substitution; `my-rigging-app` case produces correct output |
| 3 | `.planning/`, `packages/`, scaffold-internal files absent from generated output | VERIFIED | SCAF-05 integration test: 4 assertions (.planning/, packages/, .git/, .env) all pass; EXCLUDE_PREFIXES in build-template.js = ['.planning/', 'packages/', 'scripts/', 'tests/unit/scaffold/', 'tests/integration/scaffold/'] |
| 4 | Generated directory includes `.env.example` with DATABASE_URL, BETTER_AUTH_SECRET, PORT | VERIFIED | SCAF-06: template/.env.example contains all three variables; integration test 4 assertions pass |
| 5 | CLI prints next-steps: `cd my-app`, `bun install`, `docker compose up -d`, `bun test` | VERIFIED (automated) | SCAF-07: integration test captures stdout and asserts all 4 strings; manual capture confirms exact output; human checkpoint pending per Plan 05 Task 3 |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/create-rigging/package.json` | npm package manifest with bin, files, engines, type: commonjs | VERIFIED | type: commonjs, bin: {create-rigging: ./bin/create-rigging.js}, files: [bin/, lib/, template/], engines: {node: >=18.0.0}, no private, no dependencies |
| `packages/create-rigging/lib/helpers.js` | Five exported pure functions | VERIFIED | Exports: isTextFile, toTitleCase, substituteProjectName, validateProjectName, isNodeVersionSufficient; 100% line/function coverage; CJS module.exports |
| `packages/create-rigging/bin/create-rigging.js` | CLI entry point with shebang, helpers require, next-steps | VERIFIED | Starts with `#!/usr/bin/env node`, git mode 100755, require('../lib/helpers'), path.join(__dirname, '../template'), all 4 next-steps strings present |
| `scripts/build-template.js` | ESM build script using git ls-files + EXCLUDE_PREFIXES | VERIFIED | EXCLUDE_PREFIXES = ['.planning/', 'packages/', 'scripts/', 'tests/unit/scaffold/', 'tests/integration/scaffold/']; execSync('git ls-files', {cwd: repoRoot}); copyFileSync |
| `tests/unit/scaffold/substitution.test.ts` | Name substitution unit tests | VERIFIED | 11 tests covering toTitleCase (4) + substituteProjectName (7); imports from packages/create-rigging/lib/helpers.js |
| `tests/unit/scaffold/extension-whitelist.test.ts` | File extension whitelist tests | VERIFIED | 22 tests covering text extensions (10), binary extensions (8 incl. bun.lock), .env* files (4) |
| `tests/unit/scaffold/cli-validation.test.ts` | Input validation tests | VERIFIED | 15 tests: validateProjectName (9 cases incl. '.', '..', '../evil', 'path/inject', 'rigging', 'my-app') + isNodeVersionSufficient (6 cases) |
| `tests/integration/scaffold/cli-e2e.test.ts` | E2E integration test for all 6 SCAF requirements | VERIFIED | 23 tests covering SCAF-01 (1), SCAF-03 (7), SCAF-04 (3), SCAF-05 (4), SCAF-06 (4), SCAF-07 (4); beforeAll/afterAll lifecycle |
| `.gitignore` | Excludes packages/create-rigging/template/ | VERIFIED | Full path `packages/create-rigging/template/` present in .gitignore |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/create-rigging/bin/create-rigging.js` | `packages/create-rigging/lib/helpers.js` | `require('../lib/helpers')` | WIRED | Line 28: `require('../lib/helpers')`; imports 4 functions: isTextFile, substituteProjectName, validateProjectName, isNodeVersionSufficient |
| `packages/create-rigging/bin/create-rigging.js` | `packages/create-rigging/template/` | `path.join(__dirname, '../template')` | WIRED | Line 62: `path.join(__dirname, '../template')`; existence check before copyDir |
| `tests/unit/scaffold/*.test.ts` | `packages/create-rigging/lib/helpers.js` | relative import with .js extension | WIRED | All 3 test files import from `'../../../packages/create-rigging/lib/helpers.js'` |
| `tests/integration/scaffold/cli-e2e.test.ts` | `packages/create-rigging/bin/create-rigging.js` | `execSync('node packages/create-rigging/bin/create-rigging.js ...')` | WIRED | Line 25: execSync captures CLI stdout for SCAF-07 assertion |
| `tests/integration/scaffold/cli-e2e.test.ts` | `scripts/build-template.js` | `execSync('node scripts/build-template.js')` | WIRED | Line 21: beforeAll executes build-template before CLI invocation |
| `packages/create-rigging/package.json scripts.prepublishOnly` | `scripts/build-template.js` | `"node ../../scripts/build-template.js"` | WIRED | prepublishOnly and build-template scripts both reference same path |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces CLI tools and test infrastructure, not data-rendering components. All artifacts are command-line executables or pure functions with no UI rendering.

The key data flow (template → substituted output) is verified end-to-end by the integration test: `scripts/build-template.js` populates `template/` from git-tracked files, then `create-rigging.js` reads each file, applies `substituteProjectName()` for text files, and writes to the destination directory. The integration test asserts the destination `package.json` has the substituted name, confirming real data flows through all three layers.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit tests (48 cases, 100% coverage) | `bun test tests/unit/scaffold/` | 48 pass, 0 fail | PASS |
| Integration tests (23 cases, all SCAF) | `bun test tests/integration/scaffold/cli-e2e.test.ts` | 23 pass, 0 fail | PASS |
| Full scaffold suite | `bun test tests/unit/scaffold/ tests/integration/scaffold/` | 71 pass, 0 fail | PASS |
| helpers.js loads and exports correctly | `node -e "require('./packages/create-rigging/lib/helpers')"` | 5 exports: isTextFile, toTitleCase, substituteProjectName, validateProjectName, isNodeVersionSufficient | PASS |
| package.json is valid CJS manifest | `node -e "const p = require('./packages/create-rigging/package.json'); ..."` | type: commonjs, no private, no dependencies | PASS |
| CLI binary is executable (git mode 100755) | `git ls-files -s packages/create-rigging/bin/create-rigging.js` | 100755 | PASS |
| Single-pass regex prevents double-substitution | `helpers.substituteProjectName('rigging', 'my-rigging-app')` | 'my-rigging-app' (not 'my-my-rigging-app-app') | PASS |
| validateProjectName rejects '.', '..', '../evil', 'rigging', 'path/inject' | node -e | all return {valid: false} | PASS |
| CLI banner output | `node packages/create-rigging/bin/create-rigging.js banner-verify-test` | Contains cd, bun install, docker compose up -d, bun test | PASS |
| Template exclusions | `node -e "existsSync('template/.planning')"` | false; packages: false; scripts: false | PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| SCAF-01 | 09-01, 09-02, 09-04, 09-05 | Developer can run npx create-rigging to scaffold | SATISFIED | CLI binary exists at 100755 mode; integration test SCAF-01 assertion passes |
| SCAF-03 | 09-03, 09-05 | Generated project contains full reference app (DDD 4-layer, tests, CI) | SATISFIED | Integration test 7 SCAF-03 assertions pass; template contains src/, tests/, drizzle/, .github/workflows/, bun.lock |
| SCAF-04 | 09-01, 09-02, 09-04, 09-05 | Project name substituted in package.json and codebase | SATISFIED | Single-pass regex implementation; integration test 3 SCAF-04 assertions pass (incl. docker-compose.yml, bun.lock verbatim) |
| SCAF-05 | 09-01, 09-03, 09-05 | .planning/ and scaffold-internal files excluded | SATISFIED | EXCLUDE_PREFIXES verified; integration test 4 SCAF-05 assertions pass |
| SCAF-06 | 09-04, 09-05 | .env.example with required env vars documented | SATISFIED | .env.example present with DATABASE_URL, BETTER_AUTH_SECRET, PORT; 4 integration test assertions pass |
| SCAF-07 | 09-04, 09-05 | CLI outputs next-steps: cd / bun install / docker compose up -d / bun test | SATISFIED (auto) | Banner strings verified by test + manual capture; human checkpoint per Plan 05 Task 3 pending |
| SCAF-02 | Phase 10 | npm publish (public npx invocation) | DEFERRED | Explicitly assigned to Phase 10 in REQUIREMENTS.md traceability |
| SCAF-08 | Phase 10 | README.md and docs/quickstart.md updated | DEFERRED | Explicitly assigned to Phase 10 in REQUIREMENTS.md traceability |

**Coverage note:** SCAF-02 and SCAF-08 are not Phase 9 requirements. They are correctly assigned to Phase 10 in REQUIREMENTS.md and are not gaps for Phase 9.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/create-rigging/bin/create-rigging.js` | 93-102 | `console.log` | Info | Intentional CLI output — these are the SCAF-07 required next-steps banner messages, not debug logging |
| `scripts/build-template.js` | 82 | `console.log` | Info | Intentional build progress output — expected for a CLI build script |

No blockers found. All `console.log` calls in the deliverables are intentional user-facing output required by the spec, not debug artifacts.

**Note on build-template.js shebang:** The file uses `#!/usr/bin/env node` and `'use strict'` in the header comments/docblock, but the actual implementation uses ESM `import` syntax (auto-fixed from CJS during Plan 03 due to root `package.json` `"type": "module"`). This is correct behavior: the shebang `#!/usr/bin/env node` remains valid for ESM scripts in Node 18+.

**Note on EXCLUDE_PREFIXES deviation from original spec:** D-10 in CONTEXT.md listed `.planning/` and `packages/` as exclusions. The executor added `'scripts/'`, `'tests/unit/scaffold/'`, and `'tests/integration/scaffold/'` during Plan 04 auto-fix. This is an additive safety fix — `scripts/` contains the build-template.js tool (inappropriate in generated projects), and the scaffold test files import `packages/create-rigging/lib/helpers.js` which does not exist in generated projects. The additions are consistent with SCAF-05's intent ("scaffold-internal files are excluded") and do not represent a deviation from the requirement.

### Human Verification Required

#### 1. Banner Output Visual Confirmation (Plan 05 Task 3 — BLOCKING)

**Test:** From the repo root, run:
```
node scripts/build-template.js
node packages/create-rigging/bin/create-rigging.js my-app
```

**Expected output from the second command:**
```
Creating my-app...

Done! Your project is ready.

  cd my-app
  bun install
  docker compose up -d
  bun test

```

**Why human:** Plan 05, Task 3 is explicitly defined as `type="checkpoint:human-verify" gate="blocking"` and the plan is marked `autonomous: false`. The SUMMARY for Plan 05 records `tasks_completed: 2/3` with "Awaiting: checkpoint:human-verify — human must confirm banner output is correct." This is an explicit design decision in the phase plan that the banner visual approval must come from a developer, not automated tests.

After verifying, clean up:
```
rm -rf my-app
```

### Gaps Summary

No implementation gaps found. All 5 roadmap Success Criteria have corresponding verified implementation:

1. Full project directory created with DDD structure (SC-1) — VERIFIED
2. Project name substituted via single-pass regex (SC-2) — VERIFIED
3. .planning/ and scaffold-internal dirs excluded (SC-3) — VERIFIED
4. .env.example with required vars present (SC-4) — VERIFIED
5. Next-steps banner output correct (SC-5) — VERIFIED by automated tests; awaiting human approval per blocking Plan 05 checkpoint

The only outstanding item is the human checkpoint (Plan 05 Task 3), which is a process gate — not an implementation gap. The code is complete and all 71 automated tests pass.

---

_Verified: 2026-04-20_
_Verifier: Claude (gsd-verifier)_
