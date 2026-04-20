---
phase: 10-publish-docs
plan: "03"
subsystem: infra
tags: [npm, publish, registry, create-rigging, cli]
dependency_graph:
  requires:
    - phase: "10-01"
      provides: "version 0.1.0 in packages/create-rigging/package.json"
  provides:
    - "create-rigging@0.1.0 publicly available on npm registry"
    - "npx create-rigging works from any machine with Node 18+"
  affects: [end-users, documentation]
tech_stack:
  added: []
  patterns: [human-gated publish checkpoint, pre-publish verification before irreversible action]
key_files:
  created: []
  modified:
    - packages/create-rigging/package.json
key_decisions:
  - "Manual npm publish required — npm login requires interactive browser auth; cannot be automated"
  - "Pre-publish verification (dry-run + template build + leak check) run before human confirmation"
  - "publish executed from packages/create-rigging/ to avoid root-level package.json private:true error"
requirements_completed:
  - SCAF-02
duration: ~10 min
completed: "2026-04-20"
---

# Phase 10 Plan 03: npm publish Checkpoint Summary

**`create-rigging@0.1.0` published to the public npm registry — `npx create-rigging <project-name>` now works from any machine with Node 18+.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-04-20
- **Tasks:** 2 (1 automated verification + 1 human publish action)
- **Files modified:** 0 (publish is a registry operation; no local files changed)

## Accomplishments

- All 5 pre-publish checks passed (version, template build, src/ presence, no .planning/ leak, dry-run)
- `npm publish --dry-run` confirmed `create-rigging@0.1.0` (238 files, 142.5 kB) ready
- Human confirmed publish via `npm publish` from `packages/create-rigging/`
- `create-rigging@0.1.0` is live on the public npm registry

## Task Commits

1. **Task 1: Pre-publish verification** — automated checks (no commit; verification only)
2. **Task 2: Manual npm publish** — human action; registry operation (no git commit)

## Files Created/Modified

None — npm publish is a registry operation, not a file change.

## Decisions Made

- Published from `packages/create-rigging/` directory (NOT repo root) — root `package.json` has `"private": true` which blocks npm publish with error code 32
- `prepublishOnly` hook (`node ../../scripts/build-template.js`) ran automatically during publish, building a fresh `template/` (244 files, excluding `.planning/` and `packages/`)

## Deviations from Plan

None — plan executed exactly as written. Note: root `package.json` has `"private": true` (intentional monorepo guard) — publish must always be run from `packages/create-rigging/`.

## Issues Encountered

- Initial attempt from repo root produced npm error 32 ("Remove the 'private' field") — resolved by running from correct subdirectory as specified in the plan.

## Next Phase Readiness

Phase 10 complete — all success criteria satisfied:
1. ✓ `npx create-rigging my-app` works from any machine (SCAF-02)
2. ✓ `npm show create-rigging` confirms public availability
3. ✓ README.md Getting Started section first (SCAF-08, via 10-01)
4. ✓ docs/quickstart.md scaffold-first workflow (SCAF-08, via 10-02)

---
*Phase: 10-publish-docs*
*Completed: 2026-04-20*
