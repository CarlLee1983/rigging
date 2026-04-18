---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/research/STACK.md, .planning/research/ARCHITECTURE.md, .planning/research/PITFALLS.md
informed: future AI Agents and future maintainers
---

# 0006. AuthContext as mandatory domain boundary

## Context and Problem Statement

Rigging's core value is that domain operations must not run without a validated AuthContext. The domain layer must therefore be impossible to wire incorrectly through ordinary handler code or ad hoc class construction.

## Decision Drivers

- AuthContext must be the only legal entry to domain services.
- Domain services should be obtained through factories, not exported as mutable classes.
- The boundary must survive future handler and plugin churn.
- The pattern must be visible to AI Agents and maintainers alike.

## Considered Options

- Pass primitive user identifiers directly into services
- Export domain service classes and trust convention
- Require `AuthContext` and factory entry points only

## Decision Outcome

Chosen option: require `AuthContext` and factory entry points only, because it makes the domain boundary explicit, keeps service instantiation controlled, and prevents handlers from bypassing authentication state.

### Consequences

- Good: every domain call path must pass through a typed auth boundary.
- Good: factory names make the security model visible in code review.
- Good: the pattern complements the runtime guard strategy in ADR 0007.
- Bad: handler code has one more thing to thread through.
- Bad: service classes stay internal, which can feel less convenient to new contributors.
- Note: `Elysia` `.macro({ requireAuth: { resolve } })` is the intended source of `AuthContext`; no other path should create one for domain work.

## Pros and Cons of the Options

### AuthContext + factory only

- Good: strongest enforcement of the repo's identity boundary.
- Good: easy to audit and grep.
- Bad: slightly more ceremony.

### Primitive user identifiers

- Good: simple at call sites.
- Bad: weak at expressing auth invariants and too easy to misuse.

### Exported service classes

- Good: convenient.
- Bad: encourages bypassing the boundary the repo is trying to protect.
