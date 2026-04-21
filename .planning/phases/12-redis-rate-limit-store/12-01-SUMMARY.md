---
phase: 12-redis-rate-limit-store
plan: 01
subsystem: infra
tags: [redis, ioredis, better-auth, elysia-rate-limit, rate-limiting]

requires:
  - phase: 11-resend-email-adapter
    provides: stable createAuthModule / config patterns
provides:
  - Redis client factory with redacted URLs and structured logging
  - BetterAuth secondaryStorage + rate limit storage when REDIS_URL is set
  - Global Elysia rate limit via RedisRateLimitContext when Redis is available; in-memory fallback when not
affects:
  - phase-13-opentelemetry
  - deployment (optional REDIS_URL)

tech-stack:
  added: [ioredis, "@better-auth/redis-storage", elysia-rate-limit]
  patterns:
    - "Infrastructure Redis adapter + optional DI through AppDeps / AuthModuleDeps"
    - "exactOptionalPropertyTypes-safe rateLimit() wiring (separate branches for Redis vs memory)"

key-files:
  created:
    - src/shared/infrastructure/redis/client.ts
    - src/shared/infrastructure/redis/rate-limit-context.ts
    - tests/unit/shared/infrastructure/redis/client.test.ts
    - tests/unit/shared/infrastructure/redis/rate-limit-context.test.ts
  modified:
    - package.json
    - src/bootstrap/config.ts
    - src/bootstrap/app.ts
    - src/auth/auth.module.ts
    - src/auth/infrastructure/better-auth/auth-instance.ts
    - docker-compose.yml
    - .env.example

key-decisions:
  - "Use custom RedisRateLimitContext implementing elysia-rate-limit Context for app-wide limits (not only BetterAuth internal rate limiter)."
  - "Skip global rateLimit plugin when NODE_ENV=test to avoid cross-test leakage (see bbd1e05)."

patterns-established:
  - "Optional Redis: createRedisClient only when REDIS_URL present; same client shared into auth + global rate limit."
  - "BetterAuth rateLimit.storage = secondary-storage when redis configured; memory otherwise."

requirements-completed:
  - PROD-02

duration: 0min
completed: 2026-04-21
---

# Phase 12 Plan 01: Redis Rate Limit Store Summary

**Optional `REDIS_URL` enables shared Redis-backed counters for BetterAuth rate limits and the global Elysia rate-limit plugin, with in-memory behavior preserved when Redis is absent.**

## Performance

- **Duration:** n/a (implementation landed in prior commits; this run finalized typecheck + planning closure)
- **Started:** 2026-04-21
- **Completed:** 2026-04-21
- **Tasks:** 5 (per PLAN)
- **Files modified:** see key-files

## Accomplishments

- `ioredis` + `@better-auth/redis-storage` + `elysia-rate-limit` integrated with config and docker-compose Redis service.
- `createRedisClient` centralizes connection options, retry backoff, and log redaction.
- `createAuthInstance` uses `secondaryStorage` and `rateLimit.storage: 'secondary-storage'` when Redis is provided.
- `createApp` applies global `rateLimit` with `RedisRateLimitContext` when `REDIS_URL` is set; memory fallback otherwise; disabled in `NODE_ENV=test`.

## Task Commits (historical)

1. **Task 1 — Dependencies and configuration** — `113e102` (`feat(infra): add redis dependencies and configuration`)
2. **Task 2 — Redis client factory** — `5afe618` (`feat(infra): add redis client factory with redaction and logging`)
3. **Task 3 — BetterAuth Redis** — `776b64a` (`feat(auth): integrate redis secondary storage and hoist client`)
4. **Task 4 — Global rate limiting** — `cfc4dc9` (`feat(app): add global api rate limiting with redis and memory fallback`)
5. **Task 5 — Tests / isolation** — `bbd1e05` (`fix(test): isolate test suite from rate limit side effects and fix global mocking`)

**Follow-up (this session):** TypeScript fixes for `tsc --noEmit` (app rateLimit optional props, redis client `reconnecting` typing, test/scaffold typings, `helpers.d.ts`).

## Files Created/Modified

- See YAML `key-files` — primary runtime paths under `src/bootstrap/`, `src/auth/`, `src/shared/infrastructure/redis/`.

## Decisions Made

- Custom `RedisRateLimitContext` for `elysia-rate-limit` to align with the existing stack.
- Global rate limit skipped in test env to prevent shared in-memory state across parallel tests.

## Deviations from Plan

None — behavior matches `12-01-PLAN.md` intent. PLAN snippets showed `rateLimit({ storage: 'redis', redis })`; implemented via `Context` adapter (equivalent outcome).

## Issues Encountered

- `gsd-sdk` not available in this environment — executed phase inline per workflow fallback.
- `tsc --noEmit` had drift — corrected in this session.

## User Setup Required

- Optional: `docker compose up -d redis` and set `REDIS_URL=redis://localhost:6379` (see `.env.example`).

## Next Phase Readiness

- Ready for Phase 13 (OpenTelemetry): app factory and plugin ordering remain the extension point (ADR 0012).

## Self-Check: PASSED

- `bun run typecheck` — PASS
- `bun test` — PASS

---
*Phase: 12-redis-rate-limit-store*
*Completed: 2026-04-21*
