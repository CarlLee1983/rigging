# Rigging

**Harness Engineering for TypeScript backends** — an opinionated reference app where AI Agents write code on rails (type system + runtime guards + DI) so wrong patterns literally fail to wire.

> Core Value: any Domain operation must pass through `AuthContext`. Without `AuthContext`, the handler cannot even be wired.

## Getting Started

```bash
npx create-rigging <project-name>
```

Then:

- `cd <project-name>` → `bun install` → `cp .env.example .env` → `docker compose up -d` → `bun test`
- See [docs/quickstart.md](docs/quickstart.md) for the full walkthrough (session auth, API Key, dogfood story)
- **Prerequisites:** Node 18+, Bun 1.3+, Docker

## Why Rigging

AI Agents writing code without rails produce three classes of bugs that audits keep finding:

- **Forgotten auth checks.** A use case takes raw IDs, not an `AuthContext`. Cross-user data leaks happen by accident. Rigging makes Domain services *require* `AuthContext` at the type level — no `AuthContext`, no compile.
- **Plaintext credentials.** API keys land in DB unhashed; sessions written to logs (Pitfall #4). Rigging stores keys as SHA-256 hash + lookup index; logger redacts cookies + tokens by default.
- **Inconsistent error shapes.** Each handler invents its own `{ message }` envelope. Rigging mounts one global error handler that maps every `DomainError` subclass to its declared HTTP status — handlers throw, the boundary translates.

These aren't policies. They're shapes the framework imposes — Biome rules ban `import { db } from 'drizzle-orm'` inside `src/**/domain/`; `requireAuth: true` is the only way `ctx.authContext` enters scope; `apiKey.hash` is the only column the repository can `.select()`.

## Stack

- **Runtime:** Bun 1.3.x ([ADR 0001](docs/decisions/0001-runtime-bun.md))
- **Web:** Elysia 1.4.x ([ADR 0002](docs/decisions/0002-web-framework-elysia.md))
- **DDD layering:** Domain · Application · Infrastructure · Presentation; Biome-enforced ([ADR 0003](docs/decisions/0003-ddd-layering.md), [ADR 0009](docs/decisions/0009-rigidity-map.md))
- **ORM:** Drizzle 0.45.x ([ADR 0005](docs/decisions/0005-orm-drizzle.md)) on `postgres-js` ([ADR 0010](docs/decisions/0010-postgres-driver-postgres-js.md))
- **Auth:** BetterAuth 1.6.x with dual-track identity (session cookie + `x-api-key` header) ([ADR 0004](docs/decisions/0004-auth-betterauth.md), [ADR 0008](docs/decisions/0008-dual-auth-session-and-apikey.md), [ADR 0011](docs/decisions/0011-resolver-precedence-apikey-over-cookie.md))
- **Database:** PostgreSQL 16 (via docker-compose for local + GitHub Actions services for CI — see [ADR 0018](docs/decisions/0018-testcontainers-deviation-via-docker-compose.md))

## What NOT Included

Rigging v1 is intentionally **not**:

- An OAuth / 2FA / Magic Link / Passkey provider (only email + password + API Key in v1)
- A real email gateway (Console adapter writes verification + reset links to stdout — read them in the terminal)
- A multi-tenant / RBAC framework (single-tenant; scopes on API Keys; RBAC is v2)
- An MCP / A2A protocol implementation (v2 AGT-*)
- A production deployment toolkit (no k8s manifests, no observability stack)

See [AGENTS.md anti-features](AGENTS.md#anti-features-do-not-propose-extending) for the full list.

## Architecture

[docs/architecture.md](docs/architecture.md) — DDD four-layer flowchart, AuthContext macro sequence, dual identity resolution decision graph, regression test matrix.

## Decisions

[docs/decisions/README.md](docs/decisions/README.md) — 19 ADRs in MADR 4.0 format covering stack lock, DDD enforcement, auth dual-track, resolver precedence, API key storage, plugin ordering, and the testcontainers / docker-compose deviation.

## Contributing

[AGENTS.md](AGENTS.md#ai-agent-onboarding) — the AI Agent + human onboarding entry point (Rigidity Map, anti-features, GSD workflow role).

## License

MIT
