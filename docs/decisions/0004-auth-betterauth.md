---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/research/STACK.md, .planning/research/ARCHITECTURE.md, .planning/research/PITFALLS.md
informed: future AI Agents and future maintainers
---

# 0004. Auth: BetterAuth 1.6.5 (exact pin)

## Context and Problem Statement

Rigging needs an auth system that supports human sessions, future API key access, and a clean Elysia integration without forcing the repo into a framework-specific auth stack. The auth layer also needs to stay stable enough that the harness can treat it as infrastructure rather than a moving target.

## Decision Drivers

- Framework-agnostic auth with a TypeScript-first implementation.
- Session support for human users.
- Future API key support for agent access.
- Exact version pinning to reduce surprise breakage from a fast-moving auth library.
- The `CVE-2025-61928` precedent makes exact pinning the safer choice than drift.
- BetterAuth's Drizzle adapter alignment.

## Considered Options

- BetterAuth
- Lucia
- Auth.js

## Decision Outcome

Chosen option: BetterAuth `1.6.5` with `@better-auth/drizzle-adapter@1.6.5`, because it is the best fit for a Bun/Elysia harness and lets Rigging support both sessions and API keys without writing auth infrastructure from scratch.

### Consequences

- Good: the auth layer stays framework-agnostic and fits the locked stack.
- Good: the adapter version tracks the core version, which keeps the integration coherent.
- Good: API key support can come from the auth layer instead of a custom implementation.
- Bad: the exact pin means upgrades require deliberate review.
- Bad: the project must watch advisories and version churn closely.
- Note: subscribe to GHSA/advisory notifications for BetterAuth so the exact pin does not become silent risk accumulation.
- Note: the decision intentionally prefers stability over automatic upgrades because auth bugs are high-impact.

## Pros and Cons of the Options

### BetterAuth

- Good: framework-agnostic, TS-first, and compatible with the planned session and API key flows.
- Good: a direct fit for the Elysia integration path.
- Bad: fast-moving enough to justify exact pinning and advisory tracking.

### Lucia

- Good: familiar to some teams.
- Bad: maintenance-mode status makes it a poor foundation for a new harness.

### Auth.js

- Good: widely known.
- Bad: Next-centric and heavier than the repo needs.
