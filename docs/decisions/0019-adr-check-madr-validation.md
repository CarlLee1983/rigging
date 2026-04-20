---
status: accepted
date: 2026-04-20
deciders: the-team
consulted: docs/decisions/0000-use-madr-for-adrs.md, .github/workflows/adr-check.yml
informed: future AI Agents and future maintainers
---

# 0019. CI validates MADR front matter when a PR requires a new ADR

- Status: Accepted
- Date: 2026-04-20
- Tags: adr, ci, madr, process
- Supersedes: —
- Superseded by: —

## Context and Problem Statement

ADR 0000 defines the MADR 4.0 shape for `docs/decisions/*.md`. The `adr-check` workflow already fails a pull request when the author checks “requires a new ADR” but adds no new decision file. That does not prove the added file is structurally valid: incomplete YAML or a missing title line can still merge.

The harness needs a machine-enforceable gate so “ADR required” PRs cannot land malformed decision records.

## Decision Drivers

- Keep a single validator implementation (`scripts/validate-adr-frontmatter.ts`) usable locally and in CI.
- Run validation only when the PR self-declares an ADR (`- [x] This PR introduces a decision that requires a new ADR`), so unrelated PRs pay no Bun install cost.
- Fail fast with GitHub Actions `::error::` annotations for the first bad file.
- Align required keys with 0000: `status`, `date`, `deciders`, `consulted`, `informed`, plus a four-digit numbered title line.

## Considered Options

- **Option A:** Rely on human review only — rejected; reviewers miss YAML typos.
- **Option B:** Always validate every `docs/decisions/*.md` on every PR — rejected; unnecessary churn and minute cost.
- **Option C:** Conditional validation after “new file added” check, using Bun on `ubuntu-latest` — chosen.

## Decision Outcome

Chose **Option C**. When `adr-check` determines an ADR is required and at least one new `docs/decisions/*.md` exists, CI sets up Bun 1.3.12, runs `bun install --frozen-lockfile`, and runs the validator on each **added** path from the git range `origin/<base>...HEAD`.

## Consequences

### Positive

- Malformed new ADRs fail CI before merge when the ADR checkbox is used.
- Local pre-push: `bun run validate:adr path/to/adr.md`.

### Negative

- PRs that mark the ADR checkbox pay Bun setup + install (cached) on GitHub-hosted runners.

### Neutral

- Operational hardening is recorded as an ADR so ADR-06 traceability stays explicit; 0000 remains the format authority, 0019 records the CI enforcement decision.
