---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/research/STACK.md, .planning/research/ARCHITECTURE.md, .planning/research/PITFALLS.md
informed: future AI Agents and future maintainers
---

# 0005. ORM: Drizzle 0.45.2 (NOT 1.0-beta)

## Context and Problem Statement

Rigging needs an ORM that keeps schema, migration, and query code close to TypeScript while staying light enough for a harness. The choice must avoid locking the repo into a churn-heavy beta line.

## Decision Drivers

- Strong TypeScript inference.
- Schema-first migrations.
- Stable release line rather than a beta branch.
- Fit with Bun and PostgreSQL.
- Future migration tooling through `drizzle-kit`.

## Considered Options

- Drizzle 0.45 stable
- Drizzle 1.0 beta
- Prisma
- Kysely

## Decision Outcome

Chosen option: Drizzle `^0.45.2` with `drizzle-kit ^0.31.10`, because it gives Rigging a stable TS-native ORM and avoids the churn and migration risk of the 1.0 beta line.

### Consequences

- Good: the repo gets typed relational queries and schema-driven migrations.
- Good: the stack stays aligned with the rest of the Bun-first tooling.
- Good: the stable line is easier to adopt in a greenfield harness than a beta release.
- Bad: Rigging must resist the temptation to chase the beta line before it stabilizes.
- Bad: future Drizzle releases may require a new migration ADR.
- Note: the revisit condition is explicit, so a future 1.x switch should be a new ADR rather than an ad hoc version bump.

## Pros and Cons of the Options

### Drizzle 0.45 stable

- Good: stable enough for a foundation decision.
- Good: strong fit for TS-first schema and migration workflows.
- Bad: still requires deliberate migration discipline.

### Drizzle 1.0 beta

- Good: newer surface area.
- Bad: beta churn creates too much risk for a harness core dependency.

### Prisma

- Good: mature developer experience.
- Bad: heavier and less aligned with the repo's TS-native, lightweight goals.

### Kysely

- Good: clean query-builder ergonomics.
- Bad: does not give the same migration-centered path the repo wants.
