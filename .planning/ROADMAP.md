# Roadmap: Rigging

## Milestones

- ✅ **v1.0 Reference App (MVP)** — Phases 1-5 (shipped 2026-04-20) · [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Release Validation** — Phases 6-8 (shipped 2026-04-20) · [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 Create Rigging** — Phases 9-10 (shipped 2026-04-20)
- 🔄 **v1.3 Production Hardening** — Phases 11-13 (in progress)

## Phases

<details>
<summary>✅ v1.0 Reference App — Phases 1-5 — SHIPPED 2026-04-20</summary>

- [x] Phase 1: Foundation (5/5 plans) — completed 2026-04-19
- [x] Phase 2: App Skeleton (3/3 plans) — completed 2026-04-19
- [x] Phase 3: Auth Foundation (5/5 plans) — completed 2026-04-19
- [x] Phase 4: Demo Domain (4/4 plans) — completed 2026-04-19
- [x] Phase 5: Quality Gate (4/4 plans) — completed 2026-04-20

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 Release Validation — Phases 6-8 — SHIPPED 2026-04-20</summary>

- [x] Phase 6: CI Pipeline Green-Run & Smoke Validation (2/2 plans) — completed 2026-04-20
- [x] Phase 7: Phase 04 Security Audit Back-fill (1/1 plan) — completed 2026-04-20
- [x] Phase 8: ADR Process Self-Check (2/2 plans) — completed 2026-04-20

Full details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

<details>
<summary>✅ v1.2 Create Rigging — Phases 9-10 — SHIPPED 2026-04-20</summary>

- [x] **Phase 9: Scaffold Engine** — Build CLI + template generation machinery with full project output — completed 2026-04-20
- [x] **Phase 10: Publish & Docs** — Ship `create-rigging` to npm and update documentation entry points — completed 2026-04-20

</details>

### v1.3 Production Hardening — Phases 11-13

- [ ] **Phase 11: Resend Email Adapter** — Replace ConsoleEmailAdapter with a real Resend-backed adapter, configured via environment variables
- [ ] **Phase 12: Redis Rate Limit Store** — Upgrade the in-memory rate limit store to a Redis-backed persistent store, configured via environment variables
- [ ] **Phase 13: OpenTelemetry Tracing** — Add an Elysia middleware that emits OTLP-compatible trace spans for every HTTP request

## Phase Details

### Phase 9: Scaffold Engine
**Goal**: A developer can run `npx create-rigging <project-name>` locally and receive a fully working, correctly named project directory
**Depends on**: Nothing (builds on existing reference app as source template)
**Requirements**: SCAF-01, SCAF-03, SCAF-04, SCAF-05, SCAF-06, SCAF-07
**Success Criteria** (what must be TRUE):
  1. Running `node packages/create-rigging/bin/create-rigging.js my-app` (or equivalent local invocation) creates a `./my-app/` directory containing the full DDD four-layer project with AuthContext, demo domain, tests, and CI workflow
  2. The generated `package.json` contains `"name": "my-app"` and all other project-name references in the codebase (identifiers, import paths that carry the project name) are substituted with the given name
  3. `.planning/`, `packages/create-rigging/`, and any scaffold-internal files do not appear in the generated output directory
  4. The generated directory includes `.env.example` listing every required environment variable (DATABASE_URL, BETTER_AUTH_SECRET, etc.) with inline documentation
  5. After scaffolding completes the CLI prints next-steps guidance: `cd my-app`, `bun install`, `docker compose up -d`, `bun test`
**Plans**: 5 plans

Plans:
- [x] 09-01-PLAN.md — Package foundation: packages/create-rigging/package.json + lib/helpers.js + .gitignore
- [x] 09-02-PLAN.md — Unit tests: substitution, extension-whitelist, cli-validation (TDD)
- [x] 09-03-PLAN.md — Build script: scripts/build-template.js (git ls-files → template/)
- [x] 09-04-PLAN.md — CLI entry: packages/create-rigging/bin/create-rigging.js (wires helpers + copyDir)
- [x] 09-05-PLAN.md — Integration test + human verification checkpoint

### Phase 10: Publish & Docs
**Goal**: `create-rigging` is publicly available on npm and all documentation directs developers to `npx create-rigging` as the primary entry point
**Depends on**: Phase 9
**Requirements**: SCAF-02, SCAF-08
**Success Criteria** (what must be TRUE):
  1. `npx create-rigging my-app` works from any machine with Node/Bun without any local clone, producing the same output as the Phase 9 local invocation
  2. `npm show create-rigging` returns package metadata confirming the package is publicly available on the npm registry
  3. `README.md` opens with a "Getting Started" section whose first instruction is `npx create-rigging <project-name>` (not a `git clone`)
  4. `docs/quickstart.md` reflects the scaffold-first workflow — scaffold invocation precedes any environment setup steps
**Plans**: 3 plans

Plans:
- [x] 10-01-PLAN.md — Version bump (0.0.1 → 0.1.0) + README Getting Started section + What NOT Included cleanup
- [x] 10-02-PLAN.md — docs/quickstart.md scaffold-first restructure (Scaffold section first, git clone demoted)
- [x] 10-03-PLAN.md — npm publish checkpoint (pre-publish verification + manual human publish)

### Phase 11: Resend Email Adapter
**Goal**: A developer deploying to production can configure real email delivery by setting two environment variables, and email verification and password reset flows immediately deliver to real inboxes
**Depends on**: Nothing (IEmailPort interface already exists; this is a pure adapter swap)
**Requirements**: PROD-01
**Success Criteria** (what must be TRUE):
  1. Setting `RESEND_API_KEY` and `RESEND_FROM_ADDRESS` in the environment causes the application to use `ResendEmailAdapter` instead of `ConsoleEmailAdapter` at startup — no code change required
  2. A developer who leaves either variable unset receives a clear startup error identifying the missing configuration, not a runtime failure mid-request
  3. An email verification request (`POST /api/auth/sign-up`) results in a real email arriving at the recipient inbox (verifiable via Resend dashboard or inbox)
  4. A password reset request (`POST /api/auth/forget-password`) results in a real reset-link email arriving at the recipient inbox
  5. The existing test suite continues to pass without a real Resend API key — `ConsoleEmailAdapter` remains the default in test environments
**Plans**: 2 plans

Plans:
- [ ] 11-01-PLAN.md — Install resend@6.12.2 + extend ConfigSchema + create ResendEmailAdapter + wire createAuthModule with conditional selection and fail-fast guard
- [ ] 11-02-PLAN.md — Unit tests for ResendEmailAdapter (mock resend package) + update config drift guard test

### Phase 12: Redis Rate Limit Store
**Goal**: A developer deploying multiple instances (or restarting a single instance) can configure Redis as the rate limit backend, ensuring rate limiting state is shared and persists across restarts
**Depends on**: Nothing (rate limit plugin already exists; this upgrades its backing store)
**Requirements**: PROD-02
**Success Criteria** (what must be TRUE):
  1. Setting `REDIS_URL` in the environment causes the rate limiter to use a Redis-backed store — no code change required
  2. Rate limit counters survive application restarts: a client who has consumed N requests before restart still sees those N requests counted after restart
  3. Two application instances sharing the same Redis URL enforce a single shared rate limit budget, not two independent budgets
  4. Leaving `REDIS_URL` unset causes the application to fall back to the in-memory store (preserving existing behavior for local development)
  5. The existing test suite continues to pass without a Redis instance — the in-memory store remains the default for tests
**Plans**: TBD

### Phase 13: OpenTelemetry Tracing
**Goal**: Every HTTP request processed by the application automatically produces an OpenTelemetry trace span, collectable by any OTLP-compatible backend without any configuration from the application developer
**Depends on**: Nothing (new middleware layer on top of existing Elysia app)
**Requirements**: PROD-03
**Success Criteria** (what must be TRUE):
  1. Starting the application with `OTEL_EXPORTER_OTLP_ENDPOINT` set causes trace spans to be exported to that endpoint — no code change required
  2. Each exported span includes the HTTP route (e.g. `/api/agents/:id`), HTTP method, response status code, and request latency as span attributes
  3. A developer running a local Jaeger or Grafana Tempo instance can see individual request traces in the UI after exercising any endpoint
  4. Requests that result in errors (4xx, 5xx) produce spans with appropriate `error` status so they are distinguishable in any OTLP UI
  5. The existing test suite continues to pass with OTel instrumentation loaded — spans export is a no-op when no exporter endpoint is configured
**Plans**: TBD

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Foundation | v1.0 | 5/5 | Complete | 2026-04-19 |
| 2. App Skeleton | v1.0 | 3/3 | Complete | 2026-04-19 |
| 3. Auth Foundation | v1.0 | 5/5 | Complete | 2026-04-19 |
| 4. Demo Domain | v1.0 | 4/4 | Complete | 2026-04-19 |
| 5. Quality Gate | v1.0 | 4/4 | Complete | 2026-04-20 |
| 6. CI Pipeline Green-Run & Smoke Validation | v1.1 | 2/2 | Complete | 2026-04-20 |
| 7. Phase 04 Security Audit Back-fill | v1.1 | 1/1 | Complete | 2026-04-20 |
| 8. ADR Process Self-Check | v1.1 | 2/2 | Complete | 2026-04-20 |
| 9. Scaffold Engine | v1.2 | 5/5 | Complete | 2026-04-20 |
| 10. Publish & Docs | v1.2 | 3/3 | Complete | 2026-04-20 |
| 11. Resend Email Adapter | v1.3 | 0/2 | Not started | - |
| 12. Redis Rate Limit Store | v1.3 | 0/? | Not started | - |
| 13. OpenTelemetry Tracing | v1.3 | 0/? | Not started | - |

---

_Roadmap created: 2026-04-19_
_v1.0 milestone closed: 2026-04-20 — see `milestones/v1.0-ROADMAP.md`_
_v1.1 milestone closed: 2026-04-20 — see `milestones/v1.1-ROADMAP.md`_
_v1.2 roadmap added: 2026-04-20_
_v1.2 milestone closed: 2026-04-20 — create-rigging@0.1.0 shipped to npm_
_v1.3 roadmap added: 2026-04-20_
