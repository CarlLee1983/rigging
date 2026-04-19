---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/research/PITFALLS.md, .planning/research/ARCHITECTURE.md, .planning/phases/02-app-skeleton/02-CONTEXT.md
informed: future AI Agents and future maintainers
---

# 0012. Global plugin ordering for the Elysia root app

## Context and Problem Statement

Phase 2 mounts four cross-cutting Elysia plugins (requestLogger / cors / errorHandler / swagger) plus feature modules on the root app. Plugin order in Elysia is not cosmetic: lifecycle hooks and scoped deriveds compose by registration order, and Pitfall #2 (Elysia scoped-plugin `undefined` cascade — elysiajs/elysia#1366) documents silent breakage when order is wrong. Rigging needs a single, documented canonical ordering so Phase 3 and Phase 4 can extend the root app without re-deriving the same rationale.

## Decision Drivers

- Avoid Pitfall #2 (Elysia scoped plugin `undefined` cascade) — downstream plugins must be able to rely on `requestId` being present on every context.
- Provide Phase 3 / Phase 4 a canonical position for adding `authModule` and `agentsModule` without touching horizontal plugins.
- Keep `errorHandlerPlugin` as a `scope: 'global'` `.onError` early enough that it captures throws from every later plugin and feature module.
- Let `@elysiajs/swagger` see every registered route (cosmetic since it introspects at request-time, but consistent placement prevents confusion).
- A change to plugin ordering alters the runtime lifecycle and must require a new superseding ADR, not an ad-hoc PR review.

## Considered Options

- **Option A — Canonical order: requestLogger → cors → errorHandler → swagger → feature modules.**
- **Option B — errorHandler first** (before requestLogger), so onError captures *all* throws including ones from requestLogger.
- **Option C — feature modules first, horizontal plugins after**, so routes are registered before request-global middleware.

## Decision Outcome

Chosen option: **Option A (canonical order: requestLogger → cors → errorHandler → swagger → feature modules)**, because it satisfies three constraints simultaneously:

1. `requestLoggerPlugin` derives `requestId` at `scope: 'global'` before any downstream hook runs, so `errorHandlerPlugin` and feature modules can include it in logs and error bodies.
2. `corsPlugin` handles preflight before any route handler sees a request, while still benefiting from `requestId` in log lines.
3. `errorHandlerPlugin` uses `.onError({ as: 'global' })` — its *position* in the chain does not affect which throws it captures (Elysia's global-scope hooks bubble across the whole app tree), so placing it after requestLogger / cors keeps the visual order "horizontal concerns before business concerns" while losing nothing semantically.
4. `swaggerPlugin` and feature modules are placed last because they are leaf concerns: Swagger introspects the route tree at request time, and feature modules *are* the business routes.

### Consequences

- Good: Phase 3 and Phase 4 can append their feature modules in a predictable slot without rearranging the horizontal plugins.
- Good: `requestId` is guaranteed to be present in every error log and error response body (D-08 + D-12 of Phase 2 CONTEXT).
- Good: The ordering rule is explicit and linkable from reviews when someone proposes a change.
- Good: `createApp` is synchronous (see CONTEXT D-05 reconciled with `<specifics>`) — no hidden async boot, no DB pre-warm; `/health` validates DB at request time. Startup time is bounded by import cost, not network latency. This synchronous return reconciliation means `main.ts` can `const app = createApp(config); app.listen(...)` without an `await`, keeping the process entrypoint a straight-line script.
- Bad: Option B (errorHandler first) would catch throws from a buggy requestLogger; this ordering does not. Acceptable risk — requestLogger is ~30 LOC of glue; a bug there manifests at startup, not per-request. See Option B pros/cons below for the specific "requestId is `'unknown'`" failure mode.
- Bad: A future production-grade observability middleware (e.g. OpenTelemetry auto-instrumentation) may want an earlier hook than requestLogger; when we add it (v2 PROD-03), a superseding ADR will be required.
- Note: "production CORS allowlist" and "Swagger prod lockdown" are explicitly deferred to v2 hardening (see PROJECT.md Out of Scope). This ADR locks the *shape* of the ordering; the *policies* inside each plugin are free to evolve under Rigidity Map Tier 2 ("可 ADR 逃生").

## Pros and Cons of the Options

### Option A — Canonical order (chosen)

- Good: clearest mental model — horizontal concerns first, leaf concerns last.
- Good: matches the `.use()` order Phase 3 / Phase 4 can grow by appending.
- Good: `scope: 'global'` on errorHandler means position does not limit its capture surface.
- Bad: relies on Elysia's global-scope semantics not silently changing across minor versions.

### Option B — errorHandler first

- Good: catches a failing requestLogger.
- Bad: `requestId` derive happens in requestLoggerPlugin; if errorHandler is registered before requestLogger, the derive runs last and errors fired during requestLogger's own init path (or before the derive has executed for a given request) have no `requestId` — the error body shows `requestId: 'unknown'` and the observability regression is silent until someone manually correlates a log with an error report.
- Bad: flips the conceptual order — cross-cutting error handling sits before cross-cutting request tagging.

### Option C — feature modules first

- Good: route registration is visually grouped at the top of the file.
- Bad: without the logger in scope before routes register, Elysia's internal init emits un-tagged log lines.
- Bad: CORS preflight applies only to routes registered *after* the cors plugin — this would skip feature routes.

## References

- `.planning/research/PITFALLS.md` — Pitfall #2 (Elysia scoped plugin cascade): https://github.com/elysiajs/elysia/issues/1366
- `.planning/phases/02-app-skeleton/02-CONTEXT.md` §D-04, §D-05, §D-06 (assembly point + ordering rules; D-05 locks synchronous `createApp(config, deps): Elysia`)
- `src/bootstrap/app.ts` (implementation of this decision)
