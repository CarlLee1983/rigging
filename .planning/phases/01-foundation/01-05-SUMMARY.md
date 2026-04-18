# Phase 1 Plan 05 Summary

## What Changed

This plan finished the foundation boot path end-to-end: the dependency set is installed, env validation is boot-time enforced, Docker has a local Postgres service, Drizzle has a CLI config, the entrypoint fails fast on bad env, and CI now gates PRs on install, lint, typecheck, and tests.

## Package State

`package.json` now includes the full core stack needed for the foundation:

- `elysia@^1.4.28`
- `@elysiajs/cors@^1.4.1`
- `@elysiajs/swagger@^1.3.1` because `^1.4` was not published in this environment
- `@bogeychan/elysia-logger@^0.1.10`
- `pino@^10.3.1`
- `drizzle-orm@^0.45.2`
- `postgres@^3.4.9`
- `better-auth@1.6.5`
- `@better-auth/drizzle-adapter@1.6.5`

Dev dependencies now include:

- `drizzle-kit@^0.31.10`
- `pino-pretty@^13.1.3`

Scripts added for database workflows:

- `db:generate`
- `db:migrate`
- `db:push`
- `db:studio`

The BetterAuth packages are exact-pinned as required.

## Docker, Env, and Drizzle

`docker-compose.yml` now defines a single `postgres` service:

- `postgres:16-alpine`
- `container_name: rigging-postgres`
- `5432:5432`
- `rigging_dev_password` as a dev-only credential
- `pg_isready` healthcheck
- named volume `rigging-pg-data`

`.env.example` now defines exactly these six runtime variables:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `PORT`
- `NODE_ENV`
- `LOG_LEVEL`

The file is annotated as dev-only, and the BetterAuth secret placeholder is not a real secret.

`drizzle.config.ts` uses:

- `dialect: 'postgresql'`
- `schema: './src/**/infrastructure/schema/*.ts'`
- `dbCredentials.url: process.env.DATABASE_URL ?? ''`

The config deliberately omits the Drizzle driver field per the Phase 05 Pitfall #4 mitigation, and it references ADR 0010 for the runtime driver decision.

## Bootstrap Config

`src/bootstrap/config.ts` now exports:

- `ConfigSchema`
- `Config`
- `loadConfig()`

The schema validates:

- `DATABASE_URL` with a `postgresql://` prefix
- `BETTER_AUTH_SECRET` with minimum length 32
- `BETTER_AUTH_URL` with an `https?://` pattern
- `PORT` as a 1-65535 integer
- `NODE_ENV` as `development | production | test`
- `LOG_LEVEL` as `debug | info | warn | error`

`Value.Errors` and `Value.Decode` are used for fail-fast startup validation.

## Entrypoint

`src/main.ts` now calls `loadConfig()` immediately on startup and prints the Phase 1 banner only after env validation succeeds.

## Tests

`tests/unit/bootstrap/config.test.ts` covers 9 cases:

- 1 happy path
- 7 fail-fast invalid env cases
- 1 `.env.example` drift guard

The drift guard keeps `.env.example` and `ConfigSchema` keys in sync.

## CI

`.github/workflows/ci.yml` now runs on:

- `pull_request` to `main`
- `push` to `main`

The job:

- checks out the repo
- installs Bun `1.3.12` with `oven-sh/setup-bun@v2`
- runs `bun install --frozen-lockfile`
- runs `bun run lint`
- runs `bun run typecheck`
- runs `bun run test`

## Verification

- `bun install --frozen-lockfile` passed
- `bun run lint` passed
- `bun run typecheck` passed
- `bun test tests/unit/bootstrap/config.test.ts` passed
- `bun run test` passed
- `docker compose config` passed
- `docker compose up -d postgres` reached healthy state and `pg_isready` accepted connections
- `BETTER_AUTH_SECRET= bun src/main.ts` failed fast with `Invalid environment variables`
- `env DATABASE_URL=... BETTER_AUTH_SECRET=... BETTER_AUTH_URL=... PORT=3000 NODE_ENV=development LOG_LEVEL=debug bun run dev` printed:
  - `[rigging] P1 foundation ready.`
  - `env loaded: NODE_ENV=development, PORT=3000`

## Notes

The Docker smoke initially hit a local 5432 port collision in the developer environment. The conflict was cleared for verification, the Postgres smoke passed, and the stack was torn back down after the check.

## Phase 1 Closure Readiness

- [x] Success Criteria #1: boot path validated with valid env and startup banner output
- [x] Success Criteria #2: domain import guard remains covered by the existing biome contract suite
- [x] Success Criteria #3: ADR index and README index remain in place from prior foundation work
- [x] Success Criteria #4: AGENTS rigidity map and anti-features remain in place from prior foundation work
- [x] Success Criteria #5: shared kernel remains framework-free and importable

## Hand-off to Phase 2

- `src/bootstrap/app.ts` should consume `loadConfig()` next
- `src/shared/infrastructure/db/client.ts` should use `loadConfig().DATABASE_URL`
- CI should add the migration drift check in the later phase
