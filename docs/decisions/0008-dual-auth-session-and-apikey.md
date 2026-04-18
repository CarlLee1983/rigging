---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/research/STACK.md, .planning/research/ARCHITECTURE.md, .planning/research/PITFALLS.md
informed: future AI Agents and future maintainers
---

# 0008. Dual auth: session (human) + API Key (agent)

## Context and Problem Statement

Rigging serves both humans and agents, but the domain should not need to know how the caller authenticated. The repo needs one auth shape that can represent either track while keeping the underlying transport details hidden.

## Decision Drivers

- Humans need session-based auth.
- Agents need header-based API key auth.
- The domain should see one AuthContext type.
- The auth tracks must not fragment the domain model.

## Considered Options

- Separate session and API key auth contexts
- One AuthContext with a single resolver that prefers one source over the other
- One AuthContext with distinct tracks resolved to the same type

## Decision Outcome

Chosen option: one AuthContext with distinct session and API key tracks resolved to the same type, because it preserves a single domain view while supporting both human and agent callers.

### Consequences

- Good: the domain only knows about identity kind, not transport details.
- Good: the repo can support both browser sessions and agent API keys without duplicating service logic.
- Good: the resolver can centralize precedence rather than letting routes invent their own rules.
- Bad: resolver precedence must be documented and tested.
- Bad: if the resolver ever changes, the change has to be deliberate and visible.
- Note: the precedence rule is intentionally deferred to ADR 0011 so the order is explicit and not left to implementation accident.

## Pros and Cons of the Options

### Distinct tracks, same AuthContext

- Good: clean domain surface and flexible transport support.
- Good: keeps handler code simple.
- Bad: requires a separate precedence decision.

### Separate auth contexts

- Good: explicit transport separation.
- Bad: makes the domain aware of implementation detail and creates branching complexity.

### Single auth path only

- Good: simplest implementation.
- Bad: would exclude one of the two core user modes the repo is designed to support.
