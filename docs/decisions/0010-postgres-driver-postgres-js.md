---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/research/STACK.md, .planning/research/ARCHITECTURE.md, .planning/research/PITFALLS.md
informed: future AI Agents and future maintainers
---

# 0010. Postgres driver: postgres-js (NOT bun:sql)

## Context and Problem Statement

Drizzle can speak to PostgreSQL through multiple drivers, but Bun's native SQL path has open reliability issues that matter more than the theoretical speed gain. Rigging needs the driver choice that is least likely to hang a request or leak a connection.

## Decision Drivers

- Avoid production-hang class driver bugs.
- Keep the integration aligned with Drizzle's stable ecosystem.
- Prefer reliability over a small benchmark advantage.
- Preserve a clean revisit condition if Bun's native path becomes trustworthy later.

## Considered Options

- `drizzle-orm/postgres-js` with `postgres@^3.4.9`
- `drizzle-orm/bun-sql`
- `drizzle-orm/node-postgres`

## Decision Outcome

Chosen option: `drizzle-orm/postgres-js` with `postgres@^3.4.9`, because Bun's native SQL path has open issues that make it too risky for a foundation decision.

### Consequences

- Good: the repo avoids the known hang and leak risks tied to the Bun native driver path.
- Good: the driver choice is explicit and easy to audit.
- Good: the decision preserves a clear revisit rule instead of a vague "maybe later".
- Bad: the chosen driver may be a little slower than Bun's native path.
- Bad: a future reconsideration will need a dedicated ADR rather than an informal flip.
- Note: the revisit condition is strict on purpose. Only when bun#21934 and bun#22395 are both closed should the repo re-evaluate the Bun-native driver path.

## Pros and Cons of the Options

### `postgres-js`

- Good: stable, battle-tested, and a safer fit for a harness core.
- Good: better risk profile for request handling and transaction behavior.
- Bad: may give up a small amount of performance compared with Bun's native path.

### `bun:sql`

- Good: native to Bun and potentially fast.
- Bad: open hang and leak issues make it too risky for v1.

### `node-postgres`

- Good: familiar to many backend teams.
- Bad: less aligned with the Bun-first stack than `postgres-js`.
