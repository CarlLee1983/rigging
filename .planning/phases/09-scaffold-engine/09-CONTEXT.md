# Phase 9: Scaffold Engine - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Build `create-rigging` CLI that wraps the existing reference app as a template source. A developer runs `node packages/create-rigging/bin/create-rigging.js my-app` (or `npx create-rigging my-app` after Phase 10 publish) and receives a fully working, correctly named project directory.

Scope: CLI machinery + template packaging + name substitution + exclusion logic.
Not in scope: npm publish (Phase 10), interactive feature selection, multiple template variants.

</domain>

<decisions>
## Implementation Decisions

### CLI Runtime (SCAF-01, SCAF-07)
- **D-01:** CLI script uses **pure Node.js built-in APIs only** — `fs`, `path`, `child_process`. No extra npm dependencies (no `fs-extra`, `chalk`, `ora`, etc.)
- **D-02:** Minimum Node.js version: **18+** (enables `fs.cpSync`, stable `fs/promises`)
- **D-03:** If Node version < 18 at runtime → print error message with version requirement + `process.exit(1)`

### Template Packaging (SCAF-03, SCAF-04, SCAF-05, SCAF-06)
- **D-04:** Template files are **bundled inline** — `packages/create-rigging/template/` directory ships with the npm package. This is the same approach used by `create-next-app`. Works offline, no network dependency.
- **D-05:** Template is **not tracked in git** — `packages/create-rigging/template/` added to `.gitignore`. A **pre-publish build script** (`scripts/build-template.ts` or equivalent) copies the reference app into `template/` applying the exclusion list before each publish.
- **D-06:** CLI locates template via **`__dirname` relative path** — `path.join(__dirname, '../template/')`. No environment variable override needed.

### Name Substitution (SCAF-04)
- **D-07:** **Full text string replacement** across all text files in the template — same strategy as `create-next-app`. The string "rigging" is sufficiently unique that broad replacement is safe.
- **D-08:** Two case variants replaced simultaneously:
  - `rigging` → `<project-name>` (e.g., `my-app`)
  - `Rigging` → `<Project-name>` (e.g., `My-app`) — for README title and documentation
- **D-09:** Replacement is **file-extension whitelist scoped** — only process `.ts`, `.tsx`, `.js`, `.json`, `.md`, `.yml`, `.yaml`, `.toml`, `.sql`, `.env*`, `.txt`. Binary files and other extensions are copied as-is without substitution.

### Exclusion List (SCAF-05, SCAF-06)
- **D-10:** Excluded from generated output (not copied):
  - `.planning/`
  - `packages/` (entire directory — includes `create-rigging` itself)
  - `.git/`
  - `node_modules/`
  - `coverage/`
  - `.env` (the actual env file with secrets)
- **D-11:** Included in generated output:
  - `drizzle/` — migration SQL files (generated project can run `bun run db:migrate` immediately)
  - `bun.lock` — locks exact dependency versions for reproducibility
  - `.env.example` — template for environment setup (required by SCAF-06)

### Agent's Discretion
- Exact file-extension whitelist may be expanded if the reference app adds new text file types
- Error message wording for Node version check
- Whether to add a `--version` flag to the CLI binary

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — SCAF-01 through SCAF-07 (Phase 9 scope)
- `.planning/ROADMAP.md` §Phase 9 — Success criteria (5 items, including exact invocation format)

### Reference App Structure (template source)
- `package.json` — root package (name: "rigging", scripts, dependencies)
- `docker-compose.yml` — "rigging" appears in container_name, POSTGRES_USER, POSTGRES_DB, volume
- `src/` — full DDD four-layer source
- `src/_template/` — DDD module factory (internal use in generated project, NOT the scaffold template)
- `tests/` — full test suite that must pass in generated project
- `.github/workflows/` — CI workflow included in generated output
- `drizzle/` — migration files (included in generated output)

### No external specs — requirements fully captured in decisions above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/_template/{domain,application,infrastructure,presentation}/` — DDD module factory (stays in generated project, used for adding new modules)
- `scripts/` directory pattern — existing scripts (`coverage-gate.ts`, `smoke-health.ts`, `validate-adr-frontmatter.ts`) show the convention for CLI-style Bun scripts; the build-template script follows this pattern but targets Node.js
- `.github/workflows/` — full CI pipeline included as-is in generated project

### Established Patterns
- Package structure: single flat package at root (no existing monorepo), so `packages/create-rigging/` introduces a new subdirectory — build script must not include it in template output
- Bun scripts pattern: existing scripts use `bun run scripts/*.ts` — the `create-rigging` CLI differs in that it targets Node.js (npx use case)

### Integration Points
- `packages/create-rigging/bin/create-rigging.js` — CLI entry point (new file)
- `packages/create-rigging/package.json` — defines the npm package with `"bin"` field
- `scripts/build-template.ts` (or `packages/create-rigging/scripts/build-template.js`) — pre-publish copy script
- Root `.gitignore` — needs `packages/create-rigging/template/` added

</code_context>

<specifics>
## Specific Ideas

- Invocation format from ROADMAP: `node packages/create-rigging/bin/create-rigging.js my-app`
- Phase 10 target: `npx create-rigging my-app` (same output, different invocation)
- CLI post-scaffold output must print: `cd my-app`, `bun install`, `docker compose up -d`, `bun test` (verbatim from SCAF-07 / success criteria #5)

</specifics>

<deferred>
## Deferred Ideas

- Interactive mode (SCAF-09, v1.3+) — prompts for optional features (demo domain yes/no)
- Minimal harness variant (SCAF-10, v1.3+) — DDD skeleton without demo domain
- Environment variable override for template path (`RIGGING_TEMPLATE_PATH`) — not needed for v1.2

</deferred>

---

*Phase: 09-scaffold-engine*
*Context gathered: 2026-04-20*
