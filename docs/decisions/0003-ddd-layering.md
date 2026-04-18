---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/research/STACK.md, .planning/research/ARCHITECTURE.md, .planning/research/PITFALLS.md
informed: future AI Agents and future maintainers
---

# 0003. DDD four-layer structure

## Context and Problem Statement

Rigging is meant to constrain AI-authored code, so the repo needs visible boundaries that stop infrastructure concerns from leaking into the domain. The layout must also make it obvious where framework-free kernel code lives and where feature-specific code belongs.

## Decision Drivers

- Prevent framework imports from reaching the domain layer.
- Keep the shared kernel framework-free.
- Preserve feature-local vertical slices without collapsing into a flat utils pile.
- Make lint rules capable of enforcing the boundary.
- Keep future repository evolution readable to AI Agents.

## Considered Options

- Flat `src/` structure with informal conventions
- Package-per-layer architecture
- `src/{feature}/{domain,application,infrastructure,presentation}/` with shared kernel support

## Decision Outcome

Chosen option: `src/{feature}/{domain,application,infrastructure,presentation}/` with `src/shared/kernel/`, because it gives Rigging a vertical-slice layout while keeping the domain and kernel independently protected from framework leakage.

### Consequences

- Good: feature code stays isolated and easy to reason about.
- Good: the shared kernel can remain framework-free and reusable.
- Good: `src/shared/kernel/**` is treated as framework-free alongside the domain layer.
- Good: Biome can enforce layer restrictions with `noRestrictedImports` overrides.
- Bad: each new feature touches more files and directories than a flat structure would.
- Bad: the rules need careful maintenance so the boundaries do not drift.
- Note: the repo's lint policy should explicitly block domain imports of `drizzle-orm`, `elysia`, `better-auth`, `postgres`, `@bogeychan/elysia-logger`, and `pino`, while application code should not import infrastructure packages directly.

## Pros and Cons of the Options

### Vertical slice with four layers

- Good: strongest fit for a feature-oriented backend with hard boundaries.
- Good: aligns with the shared-kernel approach and the ADR gate.
- Bad: more structure up front.

### Flat structure

- Good: fewer directories.
- Bad: weak at enforcing dependency direction.

### Package-per-layer architecture

- Good: very explicit boundaries.
- Bad: too heavy for a greenfield harness and too early for the repo scale.
