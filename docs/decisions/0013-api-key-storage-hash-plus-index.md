---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/phases/03-auth-foundation/03-CONTEXT.md D-21, .planning/research/PITFALLS.md
informed: future AI Agents and future maintainers
---

# 0013. API Key storage: prefix + hash + indexed

## Context and Problem Statement

Rigging's API Key resolver must verify a raw key against persisted storage on every authenticated request. Three requirements collide:

1. **Performance**: resolver latency must be O(log n) as the `apiKey` table grows — otherwise the D-10 timing-alignment guarantee degrades with row count.
2. **Security**: the raw key must be non-recoverable from the database; a stolen DB dump must not yield valid keys.
3. **Forensics**: leaked keys must be identifiable in logs without disclosing the full secret.

BetterAuth 1.6.5's built-in apiKey plugin generates a `start` hint column but does NOT add an index. Without an explicit index on the prefix column the SELECT inside `verifyApiKey` degrades to a sequential scan, invalidating the D-10 latency baseline.

## Decision Drivers

- D-10: malformed and valid-format-wrong-hash paths BOTH execute one DB SELECT; the SELECT MUST hit an index for uniform per-path latency.
- D-19: all keys carry a recognizable `rig_live_` prefix (first 8 chars stored in `prefix` column); full hash in `key` column (SHA-256 output).
- `tests/integration/auth/timing-safe-apikey.regression.test.ts`: 1000-iteration timing test asserts ratio < 0.2 — passes only when both paths exercise the same index-backed query.

## Considered Options

- **Option A — prefix (first 8 chars, indexed) + SHA-256 hash (separate column)**
- Option B — BetterAuth default: `start` field only, no index; full-key hash lookup
- Option C — Hash-only storage, hash column indexed, no prefix column

## Decision Outcome

Chosen option: **A — prefix + hash + `index('api_keys_prefix_idx').on(table.prefix)`**, because:

- Index on `prefix` enables O(log n) lookup by the first 8 chars before the more expensive SHA-256 compare.
- SHA-256 hash in `key` column is non-reversible for the threat model (API key is high-entropy random, 32 bytes; SHA-256 output is sufficient — see ADR 0014).
- `rig_live_` prefix pattern (D-19) is safe to surface in logs and metric labels without disclosing the secret.
- Applied as a one-line post-CLI patch on `api-key.schema.ts` after `bunx @better-auth/cli generate`; drift locked by `tests/contract/drizzle-schema.contract.test.ts`.

### Consequences

Good
- Resolver latency stable as table grows; D-10 guarantee holds at scale.
- Log-leak detection: `grep -r 'rig_live_' logs/` identifies affected keys by prefix without exposing secrets.
- `index('api_keys_prefix_idx')` appears in `drizzle/0001_auth_foundation.sql` and is verified by the schema drift contract.

Bad
- One-line index patch required after every `bunx @better-auth/cli generate` re-run. Contract test `tests/contract/drizzle-schema.contract.test.ts` catches if patch is missing.

Note
- v2 multi-environment key formats (`rig_test_` / `rig_prod_`) require a second prefix variant; deferred to PROD-* phase.

## Pros and Cons of the Options

### Option A — prefix + hash + index (chosen)
- Good: O(log n) lookup; timing-uniform paths; forensics-friendly prefix.
- Bad: manual index patch after CLI generation.

### Option B — BetterAuth default (no index)
- Good: no schema patch.
- Bad: sequential scan grows linearly; D-10 timing degrades with row count.

### Option C — Hash-only + hash index
- Good: simplest schema.
- Bad: no prefix forensics; resolver code must do extra parsing to distinguish malformed from valid-format-wrong-hash paths; D-10 paths diverge in code structure.

## References

- `.planning/phases/03-auth-foundation/03-CONTEXT.md` D-19, D-21
- ADR 0014 (SHA-256 hashing algorithm decision)
- prefix.dev engineering blog: How we implemented API keys (prefix + hash pattern)
- Google Cloud API Keys reference implementation
