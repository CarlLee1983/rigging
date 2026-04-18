# Rigging

**Harness Engineering for TypeScript backends** — an opinionated reference app where AI Agents write code on rails (type system + runtime guards + DI) so wrong patterns literally fail to wire.

> Core Value: any Domain operation must pass through `AuthContext`. Without `AuthContext`, the handler cannot even be wired.

## Status

Phase 1 (Foundation) is underway. See `.planning/ROADMAP.md` for the five-phase plan.

## Quickstart (Phase 1 minimum)

```bash
bun install
bun run lint
bun run typecheck
bun run test
bun run dev
```

Full docker-compose + env setup lands in Plan 05 of this phase.

## Where things live

See `AGENTS.md` for the Rigidity Map (three-tier strictness) and anti-features list.
See `docs/decisions/` for Architecture Decision Records (MADR 4.0).
See `.planning/` for the GSD planning artefacts.
