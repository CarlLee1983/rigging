---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/phases/03-auth-foundation/03-CONTEXT.md D-16, .planning/research/PITFALLS.md
informed: future AI Agents and future maintainers
---

# 0015. Rate limit: memory store v1 / persistent store v2

## Context and Problem Statement

Rigging must prevent brute-force login attempts, password-reset floods, and verification-email spam to be "community usable" (PROJECT.md). BetterAuth 1.6.5 ships a built-in `rateLimit` config with `storage: 'memory' | 'database'`.

Two constraints pull in opposite directions:

1. **Dev DX**: a memory store requires zero additional setup — dev starts with `bun run dev` and gets rate-limiting for free with no Redis or extra Postgres schema.
2. **Production correctness**: memory store counters are per-process; a multi-process deployment bypasses them.

Additionally, Pitfall #7 (BetterAuth GitHub #2112) identifies that `/send-verification-email` is NOT covered by the built-in rate-limit. A per-email application-layer wrapper is required regardless of storage choice.

## Decision Drivers

- PROJECT.md Out of Scope v1: production observability + ops infrastructure.
- D-16: memory store v1 with explicit v2 migration path to database store (PROD-02 deferred).
- The per-email wrapper (inside `RegisterUserUseCase` + `RequestPasswordResetUseCase`) must be storage-agnostic so it works under both implementations.
- `{ window: 60, max: 100 }`: 100 attempts per 60 seconds — catches flood patterns without blocking dev iteration.

## Considered Options

- **Option A — Memory store v1 (`storage: 'memory'`, `window: 60`, `max: 100`) + per-email wrapper**
- Option B — Database store v1
- Option C — No rate-limit in v1; defer entirely

## Decision Outcome

Chosen option: **A — Memory store v1 + per-email application-layer wrapper**, because:

- Zero ops for dev and CI: no Redis, no extra Postgres table, no migration.
- Per-email wrapper in the application layer (not BetterAuth config) is portable: swapping `storage: 'memory'` to `storage: 'database'` in v2 does not require changing the use case layer.
- v2 migration is a single-line config change plus a `PROD-02` Drizzle migration for the `rate_limit` table (BetterAuth auto-generates the DDL).
- `log.warn` on rate-limit-hit (D-16) gives operator signal without requiring a dashboard.

### Consequences

Good
- Dev experience: start fresh, get rate-limiting; restart clears counters (acceptable in dev).
- Code locality: per-email wrapper testable in isolation without a live rate-limit store.
- v2 migration path is a known, one-line swap — no architectural rework required.

Bad
- Multi-process deployment (e.g. PM2 cluster, k8s replicas) bypasses memory-store counters. **Must be documented in deployment runbook before first production deploy.**
- Memory growth if many unique IPs hit endpoints before window expiry. Bounded by BetterAuth's built-in window eviction; acceptable for community-scale.

Note
- Phase 5 (PROD-*) task PROD-02 owns the migration to database store. No action required in Phase 3.

## Pros and Cons of the Options

### Option A — Memory store v1 (chosen)
- Good: zero ops; portable per-email wrapper; clear v2 path.
- Bad: single-process limitation; no cross-replica coordination.

### Option B — Database store v1
- Good: multi-process correct; production-ready from day one.
- Bad: extra Drizzle migration in Phase 3; `rate_limit` table becomes ops concern; conflicts with PROJECT.md Phase 3 scope.

### Option C — No rate-limit
- Good: simplest.
- Bad: violates "community usable" PROJECT.md requirement; brute-force login and reset-flood open.

## References

- `.planning/phases/03-auth-foundation/03-CONTEXT.md` D-16
- `.planning/research/PITFALLS.md` #7 (BetterAuth rate-limit gap on /send-verification-email, GitHub #2112)
- BetterAuth rate-limit documentation https://better-auth.com/docs/concepts/rate-limit
