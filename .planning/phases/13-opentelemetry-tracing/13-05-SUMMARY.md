---
phase: 13-opentelemetry-tracing
plan: 05
subsystem: verification
tags: [opentelemetry, jaeger, manual, prod-03]

requires:
  - phase: 13-opentelemetry-tracing
    provides: Plan 04 automated tests
provides: []
affects: []

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified: []

key-decisions:
  - "PROD-03 success criterion #3 (Jaeger UI) requires human confirmation."

requirements-completed:
  - PROD-03

duration: 0min
completed: 2026-04-21
---

# Phase 13 Plan 05: Jaeger manual verification Summary

## Automated prerequisite (Task 1)

Run locally: `bun run typecheck` and full `bun test` before Jaeger verification.

## Human checkpoint (Task 2)

**Status:** Pending operator confirmation in Jaeger UI (steps in `13-05-PLAN.md`).

Confirm service **rigging** shows spans with expected HTTP attributes after pointing `OTEL_EXPORTER_OTLP_ENDPOINT` at a local collector.

Reply **approved** when satisfied, or describe symptoms if not.

## Self-Check

- Automated gates: verify locally
- Jaeger UI: awaiting human verification
