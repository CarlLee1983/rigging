---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/research/STACK.md, .planning/research/ARCHITECTURE.md, .planning/research/PITFALLS.md
informed: future AI Agents and future maintainers
---

# 0000. Use MADR 4.0 for ADRs

## Context and Problem Statement

Rigging needs decision records that an AI Agent can read, index, and supersede without guessing. The record format must be stable, markdown-native, and friendly to tooling so that the repo can treat architecture decisions as living source material rather than scattered prose.

## Decision Drivers

- The format must be readable by future AI Agents and human maintainers.
- The format must support status lifecycle metadata such as accepted and superseded.
- The filenames must sort lexicographically and be easy to reference from other docs.
- The structure must be tool-friendly and simple enough to index automatically.

## Considered Options

- MADR 4.0 full variant
- Nygard-style ADRs
- Embedded decision notes in design docs
- Decision notes only in commit messages

## Decision Outcome

Chosen option: MADR 4.0 full variant, because it gives Rigging a standard markdown structure, explicit metadata, and a clear workflow for accepted and superseded decisions, including a `docs/decisions/README.md` index with columns for 編號 / 標題 / Status / 日期 / Supersedes.

### Consequences

- Good: the repo gets a consistent decision log with machine-readable front matter.
- Good: the `docs/decisions/README.md` index can reliably list status, date, and supersedes.
- Good: future ADRs can supersede earlier ones without rewriting history.
- Bad: every ADR must carry YAML front matter and repeated section headings.
- Bad: this adds a small amount of authoring overhead for each decision.
- Note: the bootstrap set of 12 ADRs all share the same date as an intentional initialization convention; later ADRs should use their own natural dates.

## Pros and Cons of the Options

### MADR 4.0 full variant

- Good: widely recognized, structured, and easy to index.
- Good: preserves enough context, alternatives, and consequences for later review.
- Bad: slightly more verbose than minimal ADR formats.

### Nygard-style ADRs

- Good: familiar to teams already using lightweight ADR prose.
- Bad: less standardized and less tool-friendly for indexing.

### Embedded decision notes in design docs

- Good: keeps decisions near implementation details.
- Bad: decisions become harder to search, supersede, and audit across the repo.

### Decision notes only in commit messages

- Good: low ceremony.
- Bad: commit history is a poor substitute for a living decision index.
