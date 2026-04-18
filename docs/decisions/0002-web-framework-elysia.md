---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/research/STACK.md, .planning/research/ARCHITECTURE.md, .planning/research/PITFALLS.md
informed: future AI Agents and future maintainers
---

# 0002. Web framework: Elysia 1.4.28

## Context and Problem Statement

Rigging needs a web framework that works with Bun, exposes real dependency injection primitives, and can host runtime guards without inventing a separate container. The framework must also preserve session cookies correctly for BetterAuth.

## Decision Drivers

- Bun-native integration.
- `.derive()`, `.decorate()`, and `.macro()` as first-class primitives.
- Elysia must be at least 1.4 so `.mount()` preserves `Set-Cookie` for auth sessions.
- Correct session-cookie behavior for auth flows.
- TypeBox-compatible handler boundaries.
- A framework surface that can support AuthContext enforcement.

## Considered Options

- Elysia
- Hono
- A Node-first framework such as Express or Fastify

## Decision Outcome

Chosen option: Elysia `^1.4.28`, because it is Bun-native, gives Rigging the DI surface it needs, and is the first supported version family that preserves `Set-Cookie` through `.mount()`.

### Consequences

- Good: `.macro()` and `.derive()` give the repo a direct path to AuthContext enforcement.
- Good: Elysia aligns with the locked Bun runtime and BetterAuth integration.
- Good: the TypeBox peer-dependency range remains aligned with the chosen Elysia line.
- Good: handler validation can stay on the TypeBox path already exposed by Elysia.
- Bad: the project becomes more coupled to Bun and Elysia's release line.
- Bad: scoped-plugin edge cases can still surface if the app is wired carelessly.
- Note: if a scoped-plugin undefined cascade appears, the runtime guard strategy in ADR 0007 is the mitigation, not type narrowing alone.

## Pros and Cons of the Options

### Elysia

- Good: Bun-native, DI-friendly, and auth-mount compatible.
- Good: best fit for a harness that wants runtime guards instead of a second container.
- Bad: the project inherits Elysia-specific lifecycle and plugin behavior.

### Hono

- Good: portability across runtimes.
- Bad: less aligned with the Bun-first harness design and weaker fit for the chosen DI style.

### Node-first framework

- Good: mature ecosystem breadth.
- Bad: fights the locked runtime and adds more abstraction than Rigging needs.
