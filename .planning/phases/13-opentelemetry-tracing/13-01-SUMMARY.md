---
phase: 13-opentelemetry-tracing
plan: 01
subsystem: docs
tags: [opentelemetry, adr, madr, prod-03]

requires: []
provides:
  - ADR 0020 documenting manual OTel SDK assembly vs sdk-node all-in-one
affects:
  - phase-13-plans-02-through-05

tech-stack:
  added: []
  patterns:
    - "MADR 4.0 ADR with CI validate:adr gate"

key-files:
  created:
    - docs/decisions/0020-otel-sdk-manual-assembly.md
  modified: []

key-decisions:
  - "Choose manual assembly of sdk-trace-node + OTLP HTTP exporter + resources + semantic-conventions over @opentelemetry/sdk-node."

patterns-established: []

requirements-completed:
  - PROD-03

duration: 0min
completed: 2026-04-21
---

# Phase 13 Plan 01: ADR 0020 (OTel SDK manual assembly) Summary

**ADR 0020 records why Rigging uses manually assembled lightweight OTel packages instead of `sdk-node`, satisfying D-07 and ADR 0019 frontmatter validation.**

## Performance

- **Tasks:** 1
- **Files modified:** 1 created (ADR)

## Accomplishments

- Added `docs/decisions/0020-otel-sdk-manual-assembly.md` (MADR 4.0, five required frontmatter keys).
- Documented tradeoffs: bundle size, template downstream concern, avoidance of Node built-in auto-instrumentation, Bun compatibility notes.
- `bun run validate:adr docs/decisions/0020-otel-sdk-manual-assembly.md` passes (exit 0).

## Files Created/Modified

- `docs/decisions/0020-otel-sdk-manual-assembly.md` — Decision record for PROD-03 OTel SDK packaging.

## Self-Check: PASSED

- validate:adr exit 0
- Required greps and frontmatter keys verified

## Deviations

- None
