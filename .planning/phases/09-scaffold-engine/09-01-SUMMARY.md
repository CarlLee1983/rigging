---
phase: 09-scaffold-engine
plan: "01"
subsystem: scaffold
tags: [cli, package, helpers, commonjs]
dependency_graph:
  requires: []
  provides:
    - packages/create-rigging/package.json
    - packages/create-rigging/lib/helpers.js
  affects:
    - .gitignore
tech_stack:
  added: []
  patterns:
    - CommonJS CLI package (type: commonjs overrides root type: module)
    - Pure exported helper functions for unit testability
key_files:
  created:
    - packages/create-rigging/package.json
    - packages/create-rigging/lib/helpers.js
  modified:
    - .gitignore
decisions:
  - "type: commonjs in packages/create-rigging/package.json is mandatory — root type: module causes ReferenceError for require/__dirname (RESEARCH Pitfall 1)"
  - "lib/helpers.js has no shebang — it is a library module; shebang belongs only in bin/create-rigging.js"
  - "TEXT_EXTENSIONS not exported — internal constant; five public functions exported via module.exports"
  - "Full path packages/create-rigging/template/ in .gitignore avoids ambiguity with src/_template/ (Pitfall 4)"
metrics:
  duration: "130s"
  completed: "2026-04-20"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 1
requirements:
  - SCAF-01
  - SCAF-05
---

# Phase 9 Plan 01: Package Foundation Summary

**One-liner:** CommonJS npm package manifest plus five pure exported helper functions (isTextFile, toTitleCase, substituteProjectName, validateProjectName, isNodeVersionSufficient) with .gitignore exclusion for the build-time template directory.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create packages/create-rigging/package.json | 477119d | packages/create-rigging/package.json |
| 2 | Create packages/create-rigging/lib/helpers.js | 2729e45 | packages/create-rigging/lib/helpers.js |
| 3 | Update .gitignore | 30bdd48 | .gitignore |

## What Was Built

**packages/create-rigging/package.json** — npm package manifest declaring:
- `"type": "commonjs"` (critical override of root `"type": "module"`)
- `"bin": { "create-rigging": "./bin/create-rigging.js" }` for npx invocation
- `"files": ["bin/", "lib/", "template/"]` — lib/ included because bin requires ../lib/helpers
- `"engines": { "node": ">=18.0.0" }` (D-02)
- No `"private"` field (will be published), no `"dependencies"` (pure built-ins, D-01)

**packages/create-rigging/lib/helpers.js** — Pure CommonJS module exporting five functions:
- `isTextFile(filePath)` — extension whitelist (.ts/.tsx/.js/.json/.md/.yml/.yaml/.toml/.sql/.txt) plus .env* basename detection
- `toTitleCase(s)` — capitalize first letter only ("rigging" -> "Rigging", "my-app" -> "My-app")
- `substituteProjectName(content, projectName)` — replaces both 'rigging' and 'Rigging' variants (D-07, D-08)
- `validateProjectName(projectName)` — guards empty string, reserved name 'rigging', path separator '/', and '..' traversal (T-09-01)
- `isNodeVersionSufficient(versionString?)` — checks major >= 18; accepts optional versionString for unit testing (D-02/D-03)

**.gitignore** — Appended `packages/create-rigging/template/` with full path (not bare `template/`) to avoid ambiguity with `src/_template/` (Pitfall 4, D-05).

## Deviations from Plan

None — plan executed exactly as written.

The plan specified exact file content verbatim. All content matches the specification. The only minor note: the shebang (`#!/usr/bin/env node`) was correctly omitted from `lib/helpers.js` per the plan's NOTE (shebang belongs only in the bin entry point).

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All code is pure functions with no I/O. T-09-01 (path traversal in validateProjectName) is fully mitigated as specified.

## Known Stubs

None. This plan delivers a library module with no data rendering or UI. All functions are complete implementations, not placeholders.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| packages/create-rigging/package.json | FOUND |
| packages/create-rigging/lib/helpers.js | FOUND |
| commit 477119d (Task 1) | FOUND |
| commit 2729e45 (Task 2) | FOUND |
| commit 30bdd48 (Task 3) | FOUND |
