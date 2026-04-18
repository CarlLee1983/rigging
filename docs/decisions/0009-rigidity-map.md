---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/research/STACK.md, .planning/research/ARCHITECTURE.md, .planning/research/PITFALLS.md
informed: future AI Agents and future maintainers
---

# 0009. Rigidity Map: three-tier strictness

## Context and Problem Statement

Opinionated frameworks fail when they are rigid in the wrong places and loose in the wrong places. Rigging needs a visible strictness model so future AI Agents know which rules are non-negotiable, which ones can be escaped by ADR, and which ones are conventions only.

## Decision Drivers

- The repo must protect core security and architecture boundaries first.
- The repo needs a controlled escape hatch for non-core decisions.
- The strictness model should be easy to explain in AGENTS.md and ADRs.
- Violation detection must be a mix of CI and runtime checks, not a pre-commit hook.

## Considered Options

- No explicit rigidity model
- A two-tier model
- A three-tier model

## Decision Outcome

Chosen option: a three-tier rigidity map, because it gives Rigging a precise vocabulary for what is locked, what can be superseded by ADR, and what is convention only.

### Tier 1

- AuthContext is mandatory for domain services.
- Domain code stays framework-free.
- Core stack versions are pinned.

### Tier 2

- Validators, driver choice, logger choice, migration strategy, and resolver precedence may change only through a superseding ADR.

### Tier 3

- Naming, commit format, and branch naming are conventions only.

### Consequences

- Good: future changes can be classified before implementation begins.
- Good: the repo can keep the most important constraints rigid without turning every preference into a hard rule.
- Good: AGENTS.md and ADR 0009 can cross-reference the same model.
- Bad: the map itself may need superseding in a later phase if the strictness lines need adjustment.
- Bad: maintaining the distinction between tiers requires discipline.
- Note: Tier 1 covers AuthContext, domain framework-free boundaries, and the core stack pins; Tier 2 covers ADR-escapable choices like validators, driver selection, logger choice, migration strategy, and resolver precedence; Tier 3 covers conventions such as naming and commit format.

### Detection

- CI uses Biome, TypeScript, and tests to catch Tier 1 and Tier 2 violations.
- Runtime guards catch AuthContext misses at the factory boundary.
- There is intentionally no pre-commit hook gate.

## Pros and Cons of the Options

### Three-tier rigidity map

- Good: precise enough for AI Agents and maintainers to use.
- Good: leaves room for change without weakening the core.
- Bad: requires a small amount of documentation upkeep.

### Two-tier model

- Good: simpler on paper.
- Bad: too coarse for Rigging's mix of hard rules and reversible decisions.

### No explicit model

- Good: zero ceremony.
- Bad: guarantees drift and confusion about what is actually locked.
