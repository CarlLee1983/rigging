# Phase 1 Plan 03 Summary

## Scope

- `biome.json` gained four `overrides` blocks for domain, application, barrel guard, and shared kernel boundaries.
- `tests/biome-contract/` now contains nine deliberate violation fixtures and a Biome contract suite.
- `tests/integration/auth-bypass-contract.test.ts` is present as a skipped AUX-06 stub for Phase 3.

## Overrides

- Domain override blocks `drizzle-orm`, `postgres`, `elysia`, `better-auth`, `@bogeychan/elysia-logger`, and `pino`.
- Application override blocks `drizzle-orm` and `postgres`.
- Barrel guard blocks `**/domain/internal/**` and `**/domain/internal`.
- Shared kernel override blocks `drizzle-orm`, `postgres`, `elysia`, `better-auth`, `@bogeychan/elysia-logger`, and `pino`.

## Contract Test

- The contract suite runs `bunx biome check <single-file>` for each deliberate violation file.
- Each assertion expects a non-zero exit code and checks for the specific fix token from the rule message.
- Expected pass count: 9 cases.

## Message Format

- The rule messages in `biome.json` use the four-part format required by D-12: what, why, ADR link, and fix.
- The ADR references embedded in the rule text are `docs/decisions/0003-ddd-layering.md`, `docs/decisions/0004-auth-betterauth.md`, `docs/decisions/0006-authcontext-boundary.md`, `docs/decisions/0007-runtime-guards-via-di.md`, and `docs/decisions/0009-rigidity-map.md`.

## Handoff

- 04-PLAN must ship the ADR files whose names are already referenced in the Biome messages.
- The summary for the next phase should preserve the exact filenames and wording used here.

## Verification Notes

- Negative smoke was verified by editing one violation file to a legal import and confirming the contract suite fails as expected.
- The contract runner invokes Biome with `--vcs-use-ignore-file=false` so the `.gitignore` exclusion for `tests/biome-contract/**` keeps `bun run lint` green without weakening the explicit single-file checks.
- The AUX-06 integration test remains skipped until Phase 3.
