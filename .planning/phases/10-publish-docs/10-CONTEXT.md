# Phase 10: Publish & Docs - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship `create-rigging` to npm as a public package (SCAF-02) and update all documentation so `npx create-rigging <project-name>` is the developer's first action (SCAF-08).

Scope: npm publish (version bump + manual publish steps) + README Getting Started section + docs/quickstart.md scaffold-first restructure.
Not in scope: GitHub Actions publish automation, interactive CLI mode, multiple template variants, any changes to the scaffold CLI itself (Phase 9 is done).

</domain>

<decisions>
## Implementation Decisions

### npm Publish (SCAF-02)
- **D-01:** Bump version to **`0.1.0`** before publish. The `0.0.1` placeholder in `packages/create-rigging/package.json` signals "internal only" — `0.1.0` communicates a meaningful first public release without claiming stable.
- **D-02:** **Manual one-time `npm publish`** from `packages/create-rigging/`. No GitHub Actions publish workflow in Phase 10. The `prepublishOnly` hook (`node ../../scripts/build-template.js`) runs automatically on publish — verify it succeeds from that working directory before pushing to registry. Publish steps should be documented in the plan (npm login, version bump, npm publish).

### README Update (SCAF-08)
- **D-03:** **Add a `Getting Started` section at the top of README.md** — first instruction is `npx create-rigging <project-name>`. Keep all other existing sections intact (Why Rigging, Stack, Architecture, Decisions, Contributing, License).
- **D-04:** **Remove the "v2 not yet built" disclaimer** from the "What NOT Included" section (`A scaffolding CLI ('npx create-rigging' is v2)`). Replace with current reality or remove the bullet entirely.

### docs/quickstart.md Update (SCAF-08)
- **D-05:** **Scaffold-first restructure** — add a new scaffold onboarding path at the top of quickstart.md: `npx create-rigging <project-name>` → `cd <project-name>` → `bun install` → `docker compose up -d` → `bun test`. This path mirrors the CLI's printed next-steps guidance (SCAF-07).
- **D-06:** **Preserve the existing git clone path** — demote it to a `Contributing / Development` section (secondary, not primary). The existing detailed walkthrough (Path A / Path B curl flows) stays under that section for contributors and developers working on the scaffold itself.

### Agent's Discretion
- Exact wording of the Getting Started section in README (keep it short — `npx create-rigging <project-name>` + 2-3 bullet context max)
- Whether to add a brief `## Prerequisites` note under Getting Started (Node 18+, Bun, Docker)
- Section header name for the demoted clone path in quickstart.md ("Contributing / Development" or "Developing Rigging Itself" — pick the clearest)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — SCAF-02 (npm publish) and SCAF-08 (docs update)
- `.planning/ROADMAP.md` §Phase 10 — Success criteria (4 items, including exact README and quickstart expectations)

### Files to Modify
- `packages/create-rigging/package.json` — version bump to 0.1.0 here
- `README.md` — root README (Getting Started section + disclaimer removal)
- `docs/quickstart.md` — scaffold-first restructure

### Phase 9 Context (already decided)
- `.planning/phases/09-scaffold-engine/09-CONTEXT.md` — all scaffold CLI decisions (D-01..D-11); especially D-07 (SCAF-07 next-steps output) for quickstart phrasing alignment

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/create-rigging/bin/create-rigging.js` — CLI entry; prints exactly `cd <name>`, `bun install`, `docker compose up -d`, `bun test` after scaffold — quickstart update should mirror this verbatim
- `packages/create-rigging/package.json` — `prepublishOnly` runs `node ../../scripts/build-template.js`; must be run from `packages/create-rigging/` working directory
- `scripts/build-template.js` — the pre-publish template packager; verify path resolution works when invoked via prepublishOnly hook

### Established Patterns
- README structure: narrative-first with short sections linking out to docs/ — keep this pattern in Getting Started section
- No existing publish workflow in `.github/workflows/` — `ci.yml` and `adr-check.yml` are the only workflows

### Integration Points
- `packages/create-rigging/package.json` `"files"` field already covers `bin/`, `lib/`, `template/` — no changes needed to publish manifest
- `packages/create-rigging/template/` is gitignored and built fresh on each publish by `prepublishOnly`

</code_context>

<specifics>
## Specific Ideas

- CLI next-steps output (from Phase 9 / SCAF-07): `cd <project-name>`, `bun install`, `docker compose up -d`, `bun test` — quickstart scaffold path must use this exact sequence
- Success criterion #3: README "Getting Started" section must be the first section (before Why Rigging, Stack, etc.)
- Success criterion #4: quickstart scaffold invocation precedes any environment setup steps

</specifics>

<deferred>
## Deferred Ideas

- GitHub Actions publish workflow — considered but deferred; Phase 10 uses manual publish. Candidate for v1.3 when release cadence justifies automation.
- npm org scoping (`@rigging/create-rigging`) — not needed; `create-rigging` unscoped name follows `create-next-app` / `create-vite` convention.

</deferred>

---

*Phase: 10-publish-docs*
*Context gathered: 2026-04-20*
