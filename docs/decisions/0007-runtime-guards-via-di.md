---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/research/STACK.md, .planning/research/ARCHITECTURE.md, .planning/research/PITFALLS.md
informed: future AI Agents and future maintainers
---

# 0007. Runtime guards via DI (Elysia .macro)

## Context and Problem Statement

TypeScript narrowing is not enough to guarantee that a domain factory is only used after auth is resolved. Elysia plugin behavior can drift, and the repo needs a runtime guard that fails immediately instead of trusting compile-time assumptions.

## Decision Drivers

- The guard must fail fast at runtime.
- The guard must live at the factory boundary, not in scattered handler code.
- The implementation must tolerate Elysia plugin and scoped-resolution edge cases.
- The failure mode must be easy to test.

## Considered Options

- Trust TypeScript narrowing alone
- Add per-handler checks everywhere
- Add a runtime guard at each domain factory entry point

## Decision Outcome

Chosen option: add a runtime guard at each domain factory entry point, because a single early `if (!ctx?.userId) throw ...` check is more reliable than type narrowing when the plugin graph or inference path changes.

### Consequences

- Good: an auth miss fails immediately instead of producing a latent security bug.
- Good: the guard is close to the domain boundary, where it belongs.
- Good: tests can assert the unauthenticated path explicitly.
- Bad: every factory gets one more line of boilerplate.
- Bad: the guard is runtime logic, so it must stay covered by integration tests.
- Note: the guard should be the first line in the factory so the failure mode is unambiguous and consistent.

## Pros and Cons of the Options

### Runtime guard in the factory

- Good: direct, explicit, and testable.
- Good: robust against scoped-plugin or inference surprises.
- Bad: repetitive.

### Trust TypeScript narrowing

- Good: minimal runtime code.
- Bad: too fragile for an auth boundary.

### Per-handler checks

- Good: locally obvious.
- Bad: duplicates logic and still leaves the factory boundary weak.
