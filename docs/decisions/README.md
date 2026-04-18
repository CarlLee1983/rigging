# Architecture Decision Records

See `0000-use-madr-for-adrs.md` for the MADR 4.0 template and workflow.

## Index

| 編號 | 標題 | Status | 日期 | Supersedes |
|---|---|---|---|---|
| [0000](0000-use-madr-for-adrs.md) | Use MADR 4.0 for ADRs | accepted | 2026-04-19 | — |
| [0001](0001-runtime-bun.md) | Runtime: Bun 1.3.12 | accepted | 2026-04-19 | — |
| [0002](0002-web-framework-elysia.md) | Web framework: Elysia 1.4.28 | accepted | 2026-04-19 | — |
| [0003](0003-ddd-layering.md) | DDD four-layer structure | accepted | 2026-04-19 | — |
| [0004](0004-auth-betterauth.md) | Auth: BetterAuth 1.6.5 (exact pin) | accepted | 2026-04-19 | — |
| [0005](0005-orm-drizzle.md) | ORM: Drizzle 0.45.2 (NOT 1.0-beta) | accepted | 2026-04-19 | — |
| [0006](0006-authcontext-boundary.md) | AuthContext as mandatory domain boundary | accepted | 2026-04-19 | — |
| [0007](0007-runtime-guards-via-di.md) | Runtime guards via DI (Elysia .macro) | accepted | 2026-04-19 | — |
| [0008](0008-dual-auth-session-and-apikey.md) | Dual auth: session (human) + API Key (agent) | accepted | 2026-04-19 | — |
| [0009](0009-rigidity-map.md) | Rigidity Map: three-tier strictness | accepted | 2026-04-19 | — |
| [0010](0010-postgres-driver-postgres-js.md) | Postgres driver: postgres-js (NOT bun:sql) | accepted | 2026-04-19 | — |
| [0011](0011-resolver-precedence-apikey-over-cookie.md) | Resolver precedence: API Key over cookie | accepted | 2026-04-19 | — |

## Workflow

1. Propose a new ADR in its own pull request and mark the ADR checkpoint accordingly.
2. Review the decision in the PR discussion while the ADR is still under consideration.
3. Merge the PR to flip the ADR to `accepted`.
4. If a decision changes later, write a new ADR that supersedes the old one instead of rewriting history.
5. Keep this index in sync whenever a new ADR lands or a superseding ADR is added.
