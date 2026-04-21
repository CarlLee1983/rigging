---
status: accepted
date: 2026-04-21
deciders: the-team
consulted: .planning/phases/13-opentelemetry-tracing/13-CONTEXT.md D-01, .planning/phases/13-opentelemetry-tracing/13-RESEARCH.md
informed: future AI Agents and future maintainers
---

# 0020. OpenTelemetry SDK: manual assembly over sdk-node all-in-one

## Context and Problem Statement

Rigging is a harness template: every downstream consumer inherits its dependency graph. We need HTTP-level tracing for Elysia without pulling in an oversized OpenTelemetry footprint or unintended runtime side effects.

The problem is choosing an SDK packaging strategy that stays aligned with PROD-03 (HTTP spans only) while keeping bundle size predictable and avoiding auto-instrumentation of Node.js built-ins that this project does not need.

## Decision Drivers

- Rigging is a harness template — bundle size and dependency complexity are downstream concerns for every consumer.
- Only Elysia-level HTTP spans are required; auto-instrumentation of Node.js core modules (`http`, `dns`, `net`) is unnecessary noise.
- Exact version pinning (consistent with `ioredis`, `resend`) limits churn from the fast-moving OTel JS ecosystem.
- Bun compatibility: `@opentelemetry/sdk-node` auto-instrument hooks are not a first-class tested target on Bun (see upstream OTLP/Bun discussions).

## Considered Options

- **Option A — Manual assembly of four lightweight packages** (`@opentelemetry/sdk-trace-node`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/resources`, `@opentelemetry/semantic-conventions`)
- Option B — `@opentelemetry/sdk-node` all-in-one
- Option C — `@elysiajs/opentelemetry` official plugin

## Decision Outcome

Chosen option: **A — manual assembly**, because:

- `sdk-node` is an all-in-one package (~2–3MB+) that auto-patches Node.js built-ins; Rigging users would inherit those side effects even when only Elysia lifecycle hooks need spans.
- We only need spans at the Elysia plugin layer — not module-level auto-instrumentation.
- The official `@elysiajs/opentelemetry` plugin builds on `sdk-node` (see D-01 in CONTEXT), which conflicts with the lightweight, explicit wiring goal.
- Manual assembly allows exact pins per package and upgrades aligned on OTel 2.x majors without taking the entire `sdk-node` surface area.

### Consequences

Good

- Smaller, explicit dependency footprint versus `sdk-node` all-in-one.
- No automatic patching of Node.js built-in modules when not needed.
- Each package can be exact-pinned independently within the same OTel major line.

Bad

- Four packages must be kept version-compatible with each other (OTel 2.x alignment).

Note

- `sdk-trace-base@2.7.0` is a transitive dependency of `sdk-trace-node` and does not need to be listed explicitly in `package.json`.

## Pros and Cons of the Options

### Option A — Manual assembly (chosen)

- Good: minimal surface; no unintended auto-instrumentation; precise pinning.
- Bad: operator must coordinate versions across multiple OTel packages.

### Option B — `sdk-node` all-in-one

- Good: single dependency line; batteries included.
- Bad: larger bundle; auto-instrumentation of Node built-ins; heavier than needed for Elysia-only spans.

### Option C — `@elysiajs/opentelemetry`

- Good: Elysia-native entry point.
- Bad: still relies on `sdk-node`-style stack underneath (per D-01); does not meet the template-size goal.

## References

- `.planning/phases/13-opentelemetry-tracing/13-CONTEXT.md` D-01 ~ D-07
- `.planning/phases/13-opentelemetry-tracing/13-RESEARCH.md` Standard Stack table
- OpenTelemetry JS SDK upgrade guide: https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/upgrade-to-2.x.md
- Bun OTLP timeout discussion: https://github.com/open-telemetry/opentelemetry-js/issues/5260
