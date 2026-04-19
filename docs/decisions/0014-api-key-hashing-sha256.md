---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/phases/03-auth-foundation/03-CONTEXT.md D-23, .planning/research/PITFALLS.md
informed: future AI Agents and future maintainers
---

# 0014. API Key hashing: SHA-256 explicit

## Context and Problem Statement

BetterAuth 1.6.5's apiKey plugin supports multiple hashing configurations, including `disableKeyHashing: true`. Without an explicit pin in `auth-instance.ts`, two failure modes are possible:

1. **Agent misconfiguration**: an Agent debugging a failed `verifyApiKey` could "try `disableKeyHashing: true`" as a quick fix — a CVE-class configuration mistake that stores raw keys in the database.
2. **Default drift**: a future BetterAuth release could silently change the default hashing algorithm; without an explicit literal in config, Rigging inherits the change without any audit trail.

Additionally, the `ApiKeyHash` value object in `src/auth/domain/values/api-key-hash.ts` assumes a fixed-length output (SHA-256 = 64 hex chars). An algorithm change would silently break the length invariant.

## Decision Drivers

- Rigidity Tier 1 (ADR 0009): `disableKeyHashing: true` is explicitly prohibited; ADR supersede is required to change hashing behavior.
- D-23: explicit SHA-256 literal in `auth-instance.ts` so grep surfaces the algorithm in one place.
- `tests/integration/auth/key-hash-storage.regression.test.ts`: regression test scans every TEXT column of every `apiKey` row for the raw key substring — catches any path that persists plaintext.

## Considered Options

- **Option A — `apiKey({ enableMetadata: true })` with BetterAuth's SHA-256 default (explicit acknowledgment via ADR)**
- Option B — Rely on BetterAuth default implicitly with no documentation
- Option C — Use `Bun.password` with argon2id for API key hashing

## Decision Outcome

Chosen option: **A — BetterAuth's SHA-256 default with explicit ADR pin**, because:

- SHA-256 is the correct primitive for this threat model: API keys are high-entropy random values (not low-entropy passwords), so the slow KDF properties of argon2id are unnecessary overhead.
- BetterAuth 1.6.5 applies SHA-256 by default for the apiKey plugin; `enableMetadata: true` is the only required config for Rigging's scope storage.
- This ADR serves as the explicit pin: any change to hashing behavior requires a new superseding ADR, satisfying Rigidity Tier 1.
- `key-hash-storage.regression.test.ts` provides the runtime proof: it verifies no raw key substring exists in any DB column.

### Consequences

Good
- Algorithm stable; configuration drift caught by ADR supersede requirement (Tier 1).
- `ApiKeyHash` length invariant (64 hex chars) is stable across BetterAuth upgrades.
- Regression test `key-hash-storage.regression.test.ts` provides automated proof on every CI run.

Bad
- If a future BetterAuth release renames or removes the SHA-256 option, `auth-instance.ts` must be updated explicitly. The regression test catches this before merge.

## Pros and Cons of the Options

### Option A — SHA-256 via BetterAuth default + ADR pin (chosen)
- Good: correct primitive for API keys; audit trail via ADR; regression test enforces.
- Bad: one more document to maintain when BetterAuth's hashing API changes.

### Option B — implicit default
- Good: less config.
- Bad: algorithm invisible to audit; `disableKeyHashing: true` path not blocked; agent-driven configuration mistake not caught by review.

### Option C — argon2id
- Good: stronger primitive.
- Bad: ~100 ms per verify makes resolver latency unacceptable; wrong threat model (API keys are high-entropy random, not user passwords); D-10 timing-alignment test would need recalibration.

## References

- `.planning/phases/03-auth-foundation/03-CONTEXT.md` D-23
- ADR 0009 (Rigidity Map — Tier 1 prohibitions)
- ADR 0013 (prefix + hash storage shape this algorithm feeds into)
- NIST SP 800-107 Rev. 1 (hash function recommendations)
- `tests/integration/auth/key-hash-storage.regression.test.ts` (runtime enforcement)
