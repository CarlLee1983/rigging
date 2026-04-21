---
phase: 13-opentelemetry-tracing
plan: 02
subsystem: infra
tags: [opentelemetry, config, bootstrap, prod-03]

requires:
  - phase: 13-opentelemetry-tracing
    provides: ADR 0020 (D-07)
provides:
  - Exact-pinned OTel trace + OTLP + resources + semantic-conventions dependencies
  - ConfigSchema OTEL_EXPORTER_OTLP_ENDPOINT optional URI
  - initTracing(endpoint?) in src/bootstrap/otel-init.ts
affects:
  - plan-13-03

tech-stack:
  added:
    - "@opentelemetry/sdk-trace-node@2.7.0"
    - "@opentelemetry/exporter-trace-otlp-http@0.215.0"
    - "@opentelemetry/resources@2.7.0"
    - "@opentelemetry/semantic-conventions@1.40.0"
  patterns:
    - "OTel 2.x NodeTracerProvider with constructor spanProcessors + SimpleSpanProcessor"

key-files:
  created:
    - src/bootstrap/otel-init.ts
  modified:
    - package.json
    - bun.lock
    - src/bootstrap/config.ts
    - .env.example

key-decisions:
  - "Use resourceFromAttributes + NodeTracerProvider branch without spanProcessors when no OTLP endpoint."

patterns-established: []

requirements-completed:
  - PROD-03

duration: 0min
completed: 2026-04-21
---

# Phase 13 Plan 02: OTel bootstrap (deps + config + otel-init) Summary

**Pinned OpenTelemetry trace stack packages, added optional OTLP endpoint to config, and implemented `initTracing` with SDK 2.x APIs and exactOptionalPropertyTypes-safe branching.**

## Accomplishments

- Installed four OTel packages with exact versions (no carets).
- Extended `ConfigSchema` with `OTEL_EXPORTER_OTLP_ENDPOINT` as optional URI.
- Added `src/bootstrap/otel-init.ts` exporting `initTracing(endpoint?)`.
- Documented env var in `.env.example`.
- `bun run typecheck` passes.

## Self-Check: PASSED

- Acceptance greps per PLAN 02
- typecheck exit 0

## Deviations

- None
