---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/phases/05-quality-gate/05-CONTEXT.md D-01, D-12-A
informed: future AI Agents and future maintainers
---

# 0018. testcontainers for v1 satisfied via docker-compose + GitHub Actions services

- Status: Accepted
- Date: 2026-04-19
- Tags: tests, ci, postgres, qa-02
- Supersedes: —
- Superseded by: —

## Context and Problem Statement

REQUIREMENTS.md QA-02 reads: "Integration tests run against an isolated, ephemeral Postgres via [testcontainers](https://testcontainers.com)." Taken literally, this requires the `testcontainers` npm dependency and per-test-file container lifecycle management.

For Rigging v1's "community-usable" target, we evaluated three options:

1. **Adopt `testcontainers` literally** — adds ~100 MB dependency footprint, +5-15s cold start per test file, requires Docker as a runtime dependency for tests, and rewrites the existing 26 integration tests' `_helpers.ts` setup.
2. **Use the existing docker-compose Postgres locally + GitHub Actions `services: postgres:16-alpine` in CI** — zero new dependencies, instant startup, identical `DATABASE_URL` shape on local and CI, pin matching `postgres:16-alpine` image both places.
3. **Defer integration testing entirely** — unacceptable; QA-02 must be satisfied this phase.

The literal reading of "testcontainers" is the *implementation*. The *intent* is "an isolated, ephemeral Postgres each test run can use without polluting a shared dev database."

## Decision Drivers

- **Onboarding friction:** External contributors should not need to install a `testcontainers` toolchain that is not part of the standard Bun + Drizzle stack.
- **CI minute budget:** Per-test-file container startup adds ≥5s × ~30 test files = ≥150s; current docker-compose setup runs all tests against a single connection in <60s.
- **Stack purity:** Rigging is opinionated — we don't add libraries we won't use elsewhere. `testcontainers` would be the only test-specific runtime dependency.
- **Image parity:** Both local (docker-compose) and CI (GH Actions service) pin `postgres:16-alpine` — schema behavior is identical.
- **Test isolation goal:** Solved by `email`/`userId` namespace per-test-file (timestamp + random slug), enforced via `setupUser`/`cleanupUser` helpers — does not require container-per-test isolation.

## Considered Options

- **Option A:** Adopt `testcontainers` literally
- **Option B:** docker-compose locally + GitHub Actions `services` in CI (chosen)
- **Option C:** Defer integration testing

## Decision Outcome

Chose **Option B** — Phase 5 ships:

- **Local:** `docker-compose up -d` boots `postgres:16-alpine` reachable at `localhost:5432`. Test runner uses `DATABASE_URL=postgres://rigging:rigging_dev_password@localhost:5432/rigging`.
- **CI:** `.github/workflows/ci.yml` `test` job declares `services.postgres` with `postgres:16-alpine`, healthcheck `pg_isready`, port mapping `5432:5432`, env `POSTGRES_DB: rigging_test`. Test runner uses `DATABASE_URL=postgres://postgres:postgres@localhost:5432/rigging_test`.
- **Pre-test step:** `bun run db:migrate` always runs before `bun test` (codified in `package.json` `test` script: `bun run db:migrate && bun test`).
- **Test isolation:** Per-file email namespace (`${prefix}-${Date.now()}-${random}@example.test`) + `afterAll cleanupUser(harness, userId, email)` removes test-created rows in the canonical 6-DELETE order.

REQ QA-02 is **satisfied in intent** (isolated, ephemeral Postgres) without satisfying it in *literal implementation* (no `testcontainers` npm dep). This ADR records that the wording stands; the v1 satisfaction strategy diverges by design.

### Consequences

**Positive:**

- Zero net-new dependencies (no `testcontainers` package).
- CI test job runs in <3 minutes (verified Plan 05-03).
- Local + CI Postgres image identical (`postgres:16-alpine`); behavior parity.
- External contributors clone, `docker-compose up`, run tests immediately.

**Negative / accepted trade-offs:**

- All test files share one Postgres instance (parallel tests rely on email namespace, not container isolation). If a future test forgets `cleanupUser`, it pollutes the shared instance — mitigated by helper convention enforcement (PR review).
- No per-test database-level isolation; if Drizzle introduces schema-level transaction boundaries that need testing, this ADR will need re-evaluation.
- "testcontainers" wording in QA-02 remains in REQUIREMENTS.md without literal satisfaction — this ADR is the cross-reference.

**Future evolution:**

- v2 PROD-* may revisit: if production scenarios require per-test-file complete isolation (multi-tenant DB-per-test, schema migration probes), supersede this ADR with one adopting `testcontainers` then.

## Pros and Cons of the Options

### Option A — Adopt `testcontainers` literally

- + Per-test-file container isolation (no cleanup helper bug surface).
- + Matches QA-02 wording.
- − ~100 MB dependency added (npm); not part of standard Bun + Drizzle stack.
- − +5-15s cold start per test file → CI minute budget impact.
- − Existing `_helpers.ts` rewrite required (~26 integration tests).

### Option B — docker-compose + GitHub Actions services (chosen)

- + Zero new deps.
- + Instant startup (Postgres already running locally; service container in CI starts in parallel with checkout).
- + Local + CI image parity (`postgres:16-alpine`).
- + Existing helpers + cleanup convention work unmodified.
- − Shared Postgres instance — relies on email namespace for parallel safety.
- − QA-02 wording satisfied by intent, not literal — ADR record needed (this document).

### Option C — Defer integration testing

- − QA-02 unmet; CVE regression suite cannot run; unacceptable.

## More Information

- Local config: [docker-compose.yml](../../docker-compose.yml) postgres service
- CI config: [.github/workflows/ci.yml](../../.github/workflows/ci.yml) `test` job `services.postgres`
- Test helpers: [tests/integration/auth/_helpers.ts](../../tests/integration/auth/_helpers.ts), [tests/e2e/_helpers.ts](../../tests/e2e/_helpers.ts)
- Cleanup convention: [docs/architecture.md §5 Testing Conventions](../architecture.md#5-testing-conventions)
- Original requirement: [.planning/REQUIREMENTS.md §Quality Gate / QA-02](../../.planning/REQUIREMENTS.md)
