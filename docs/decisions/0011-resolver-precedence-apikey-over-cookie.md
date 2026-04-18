---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/research/STACK.md, .planning/research/ARCHITECTURE.md, .planning/research/PITFALLS.md
informed: future AI Agents and future maintainers
---

# 0011. Resolver precedence: API Key over cookie

## Context and Problem Statement

When a request carries both an API key and a session cookie, Rigging needs an explicit resolver precedence. The choice affects how the repo interprets mixed-mode requests during development and agent usage, so it must be documented rather than left to implementation order.

## Decision Drivers

- Agents typically arrive with a header, not a browser cookie.
- Humans typically arrive with a cookie, not an API key.
- Mixed requests should resolve in a way that matches the more intentional identity signal.
- The repo wants a testable spike before the implementation path hardens.
- A P3 spike should falsify the mixed-credential assumption before the implementation is treated as settled.

## Considered Options

- API Key over cookie
- Cookie over API Key
- Reject requests that present both

## Decision Outcome

Chosen option: API Key over cookie, because the API key is the more explicit agent signal and the repo should prefer the agent track when both credentials are present.

### Consequences

- Good: mixed requests resolve consistently toward the agent path.
- Good: the precedence rule is explicit and easy to document in one place.
- Good: the P3 spike plan can falsify the assumption before the implementation is finalized.
- Bad: humans testing agent endpoints in browser tools may need to clear cookies or use an incognito profile.
- Bad: a future change to precedence requires a new superseding ADR.
- Note: the P3 spike should verify three cases: both credentials present, API key only, and an invalid mixed credential pair. If the spike disagrees with this decision, the fix is a new `0011a-*.md` ADR rather than editing the decision outcome here.

## Pros and Cons of the Options

### API Key over cookie

- Good: best matches agent-first intent.
- Good: predictable for mixed requests.
- Bad: creates a small amount of browser-tool friction.

### Cookie over API Key

- Good: would favor the browser session path.
- Bad: weakens the agent signal in mixed requests.

### Reject both when both are present

- Good: very explicit.
- Bad: too punitive for the repo's intended mixed-mode developer workflow.
