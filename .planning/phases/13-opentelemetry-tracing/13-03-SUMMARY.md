---
phase: 13-opentelemetry-tracing
plan: 03
subsystem: presentation
tags: [opentelemetry, elysia, tracing, prod-03]

requires:
  - phase: 13-opentelemetry-tracing
    provides: Plan 02 otel-init + config
provides:
  - tracingPlugin HTTP span lifecycle
  - main.ts initTracing before createApp
  - Plugin order adjusted for Elysia onError semantics
affects:
  - plan-13-04
  - create-rigging template

tech-stack:
  added: []
  patterns:
    - "tracingPlugin before errorHandlerPlugin so tracing onError runs when handlers throw"
    - "Mutable span holders (_span / _spanStart) for Elysia readonly derive context"

key-files:
  created:
    - src/shared/presentation/plugins/tracing.plugin.ts
  modified:
    - src/bootstrap/app.ts
    - src/main.ts
    - packages/create-rigging/template/src/bootstrap/app.ts

key-decisions:
  - "Place tracingPlugin immediately after cors and before errorHandlerPlugin so thrown errors still run tracing onError and finish spans."

requirements-completed:
  - PROD-03

duration: 0min
completed: 2026-04-21
---

# Phase 13 Plan 03: HTTP tracing plugin + wiring Summary

**Added `tracingPlugin` with ATTR_* semantic attributes, wired `initTracing` in `main.ts`, and reordered horizontal plugins so error paths end spans reliably.**

## Self-Check: PASSED

- `bun run typecheck` passes

## Deviations

- Plugin order vs plan sketch: `tracingPlugin` is **before** `errorHandlerPlugin` (not after `swaggerPlugin`) so Elysia does not short-circuit tracing `onError` when the error handler returns a body.
