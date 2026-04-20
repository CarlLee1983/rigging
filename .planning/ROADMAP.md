# Roadmap: Rigging

## Milestones

- ✅ **v1.0 Reference App (MVP)** — Phases 1-5 (shipped 2026-04-20) · [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Release Validation** — Phases 6-8 (shipped 2026-04-20) · [archive](milestones/v1.1-ROADMAP.md)
- 🚧 **v1.2 Create Rigging** — Phases 9-10 (active)

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

### v1.2 Create Rigging — Phases 9-10

- [ ] **Phase 9: Scaffold Engine** — Build CLI + template generation machinery with full project output
- [ ] **Phase 10: Publish & Docs** — Ship `create-rigging` to npm and update documentation entry points

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
- [ ] 09-01-PLAN.md — Package foundation: packages/create-rigging/package.json + lib/helpers.js + .gitignore
- [ ] 09-02-PLAN.md — Unit tests: substitution, extension-whitelist, cli-validation (TDD)
- [ ] 09-03-PLAN.md — Build script: scripts/build-template.js (git ls-files → template/)
- [ ] 09-04-PLAN.md — CLI entry: packages/create-rigging/bin/create-rigging.js (wires helpers + copyDir)
- [ ] 09-05-PLAN.md — Integration test + human verification checkpoint

### Phase 10: Publish & Docs
**Goal**: `create-rigging` is publicly available on npm and all documentation directs developers to `npx create-rigging` as the primary entry point
**Depends on**: Phase 9
**Requirements**: SCAF-02, SCAF-08
**Success Criteria** (what must be TRUE):
  1. `npx create-rigging my-app` works from any machine with Node/Bun without any local clone, producing the same output as the Phase 9 local invocation
  2. `npm show create-rigging` returns package metadata confirming the package is publicly available on the npm registry
  3. `README.md` opens with a "Getting Started" section whose first instruction is `npx create-rigging <project-name>` (not a `git clone`)
  4. `docs/quickstart.md` reflects the scaffold-first workflow — scaffold invocation precedes any environment setup steps
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
| 9. Scaffold Engine | v1.2 | 0/5 | Not started | - |
| 10. Publish & Docs | v1.2 | 0/? | Not started | - |

---

_Roadmap created: 2026-04-19_
_v1.0 milestone closed: 2026-04-20 — see `milestones/v1.0-ROADMAP.md`_
_v1.1 milestone closed: 2026-04-20 — see `milestones/v1.1-ROADMAP.md`_
_v1.2 roadmap added: 2026-04-20_
