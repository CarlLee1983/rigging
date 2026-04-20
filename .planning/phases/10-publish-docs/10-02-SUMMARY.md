---
phase: 10-publish-docs
plan: "02"
subsystem: docs
tags: [quickstart, scaffold, onboarding, documentation]
dependency_graph:
  requires: []
  provides: [scaffold-first-quickstart]
  affects: [docs/quickstart.md]
tech_stack:
  added: []
  patterns: [scaffold-first onboarding, contributor-section-at-bottom]
key_files:
  created: []
  modified:
    - docs/quickstart.md
decisions:
  - "Scaffold (fastest path) section inserted between Prerequisites and Dev server — satisfies SCAF-08 scaffold-first ordering"
  - "Old Setup (2 min) section removed from top; content migrated to Developing Rigging Itself at bottom"
  - "docker compose (no hyphen) used in Scaffold section per SCAF-07 CLI verbatim requirement; docker-compose (hyphenated) preserved in Developing Rigging Itself contributor path"
metrics:
  duration: "~5 min"
  completed: "2026-04-20"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 10 Plan 02: Quickstart Scaffold-First Restructure Summary

**One-liner:** Restructured docs/quickstart.md to place `## Scaffold (fastest path)` before Dev server, demoting the git clone path to `## Developing Rigging Itself` at bottom — satisfying ROADMAP Phase 10 success criterion #4 (SCAF-08).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Restructure docs/quickstart.md — scaffold-first, git clone demoted | da36df3 | docs/quickstart.md |

## What Was Done

### Task 1: Restructure docs/quickstart.md

**Before:** Section order was title → Prerequisites → `## Setup (2 min)` (git clone) → Dev server → Path A → Path B → What just happened → Error shape → Next steps → footer

**After:** title → Prerequisites → `## Scaffold (fastest path)` → Dev server → Path A → Path B → What just happened → Error shape → Next steps → `## Developing Rigging Itself` → footer

**Changes made:**
- Removed `## Setup (2 min)` section from between Prerequisites and Dev server
- Inserted new `## Scaffold (fastest path)` section with exact CLI command sequence from SCAF-07:
  ```bash
  npx create-rigging <project-name>
  cd <project-name>
  bun install
  docker compose up -d
  bun test
  ```
- Added internal anchor link to Path A/B flows in Scaffold section
- Added new `## Developing Rigging Itself` section at bottom with original git clone contributor path (commands unchanged, docker-compose hyphenated preserved)

**All existing sections (Path A, Path B, What just happened, Error shape, Next steps) preserved verbatim — zero content modification.**

## Verification Results

All acceptance criteria passed:

```
Structure OK: scaffold=624 devserver=1016 developing=5686
docker compose (no hyphen) OK
bun test OK
No hyphen docker-compose in Scaffold OK
git clone in Developing section OK
docker-compose (hyphen) in Developing section OK
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — documentation-only change, no new network endpoints or auth paths introduced.

## Self-Check: PASSED

- [x] docs/quickstart.md modified and committed (da36df3)
- [x] `## Scaffold` section exists at position 624 (before Dev server at 1016)
- [x] `## Developing Rigging Itself` section at position 5686 (after all curl flow sections)
- [x] `## Setup (2 min)` not present in file
- [x] `docker compose up -d` (no hyphen) in Scaffold section
- [x] `docker-compose up -d` (hyphenated) in Developing Rigging Itself section
- [x] Path A, Path B, What just happened, Error shape, Next steps all intact
