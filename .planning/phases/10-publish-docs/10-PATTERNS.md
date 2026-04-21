# Phase 10: Publish & Docs - Pattern Map

**Mapped:** 2026-04-20
**Files analyzed:** 3 (files to be modified)
**Analogs found:** 3 / 3 (all files are self-analogs — read current state to understand what to change)

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/create-rigging/package.json` | config | N/A | `packages/create-rigging/package.json` (current) | exact — single field edit |
| `README.md` | docs | N/A | `README.md` (current) + `docs/quickstart.md` heading style | exact |
| `docs/quickstart.md` | docs | N/A | `docs/quickstart.md` (current) + CLI next-steps from `bin/create-rigging.js` | exact |

---

## Pattern Assignments

### `packages/create-rigging/package.json` (config — version bump)

**Change:** Single field. `"version": "0.0.1"` → `"version": "0.1.0"`.

**Current file** (`packages/create-rigging/package.json`, lines 1-22):
```json
{
  "name": "create-rigging",
  "version": "0.0.1",
  "description": "Scaffold a new Rigging DDD project (Bun + Elysia + BetterAuth + Drizzle)",
  "type": "commonjs",
  "bin": {
    "create-rigging": "./bin/create-rigging.js"
  },
  "scripts": {
    "build-template": "node ../../scripts/build-template.js",
    "prepublishOnly": "node ../../scripts/build-template.js"
  },
  "files": [
    "bin/",
    "lib/",
    "template/"
  ],
  "engines": {
    "node": ">=18.0.0"
  },
  "license": "MIT"
}
```

**Target state** — only `version` changes:
```json
{
  "name": "create-rigging",
  "version": "0.1.0",
  ...
}
```

**Publish command sequence** (D-02 — manual, run from `packages/create-rigging/`):
```bash
cd packages/create-rigging
npm login                    # authenticate once
# version bump already done in package.json
npm publish                  # triggers prepublishOnly → node ../../scripts/build-template.js
```

**prepublishOnly hook** (line 11 — must succeed before registry push):
```json
"prepublishOnly": "node ../../scripts/build-template.js"
```
The planner must note that `npm publish` must be run from `packages/create-rigging/` so the relative path `../../scripts/build-template.js` resolves correctly.

---

### `README.md` (docs — section prepend + bullet removal)

**Analog:** `README.md` itself (current structure) read in full above.

**Current section order** (lines 1-58):
1. H1 title + tagline (lines 1-5)
2. `## Why Rigging` (line 8)
3. `## Quickstart` (line 17) — one sentence linking to docs/quickstart.md
4. `## Stack` (line 21)
5. `## What NOT Included` (line 31)
6. `## Architecture` (line 44)
7. `## Decisions` (line 47)
8. `## Contributing` (line 51)
9. `## License` (line 55)

**Change D-03 — prepend `## Getting Started` as the very first section** (before `## Why Rigging`):

Pattern to follow: `## Quickstart` section style (lines 17-19) — short, imperative, links out to docs. The new section must be more prominent: command first, 2-3 bullet context lines max.

```markdown
## Getting Started

```bash
npx create-rigging <project-name>
```

Then:

- `cd <project-name>` → `bun install` → `docker compose up -d` → `bun test`
- See [docs/quickstart.md](docs/quickstart.md) for the full walkthrough (session auth, API Key, dogfood story)
- **Prerequisites:** Node 18+, Bun 1.3+, Docker
```

**Change D-04 — remove the stale `What NOT Included` bullet** (README.md line 34):

Current bullet to remove:
```markdown
- A scaffolding CLI (`npx create-rigging` is v2)
```

The `## What NOT Included` section spans lines 31-41. After removal the list shrinks by one bullet. All other bullets in that section remain unchanged.

**Resulting section order after both changes:**
1. H1 title + tagline
2. `## Getting Started` ← NEW, first
3. `## Why Rigging`
4. `## Quickstart` (kept — still links to docs/quickstart.md)
5. `## Stack`
6. `## What NOT Included` (minus the "v2" bullet)
7. `## Architecture`
8. `## Decisions`
9. `## Contributing`
10. `## License`

---

### `docs/quickstart.md` (docs — scaffold-first restructure)

**Analog A:** `docs/quickstart.md` itself (current — full content read above, lines 1-159).

**Analog B:** CLI next-steps output from `packages/create-rigging/bin/create-rigging.js` lines 96-102 — the **exact strings** SCAF-07 requires:
```javascript
// SCAF-07: next-steps guidance (exact strings required)
console.log('\nDone! Your project is ready.\n');
console.log('  cd ' + projectName);
console.log('  bun install');
console.log('  docker compose up -d');
console.log('  bun test');
```

**Change D-05 — new scaffold onboarding path at the top** (insert after Prerequisites section, before existing Setup section):

The new path mirrors the CLI output exactly. Pattern: use the same bash code-block style as existing Setup section (lines 16-23):

```markdown
## Scaffold (fastest path)

New project? Use the CLI — one command, no clone needed:

```bash
npx create-rigging <project-name>
cd <project-name>
bun install
docker compose up -d
bun test
```

That's it. The scaffold includes a working `.env.example`, migrations, and CI workflow.
See the [Path A / Path B curl flows](#path-a--human-session-3-min) below to dogfood the full Rigging surface.
```

**Change D-06 — demote existing `git clone` path to a secondary section:**

Current `## Setup (2 min)` section (lines 14-24) becomes a subsection under a new top-level section. Recommended heading based on D-06 agent discretion: `## Developing Rigging Itself` (clearest — signals contributor context, not user context).

```markdown
## Developing Rigging Itself

Contributing to Rigging or working on the scaffold source? Clone the reference app directly:

```bash
git clone <this-repo> rigging && cd rigging
cp .env.example .env
docker-compose up -d
bun install
bun run db:migrate
```
```

**Resulting section order after restructure:**
1. Title + intro paragraph (lines 1-5) — unchanged
2. `## Prerequisites` (lines 7-12) — unchanged
3. `## Scaffold (fastest path)` ← NEW, first setup section
4. `## Dev server (30 sec)` — unchanged (lines 27-40)
5. `## Path A — Human session (3 min)` — unchanged (lines 42-82)
6. `## Path B — Create + read your own Agent (2 min, dogfood story)` — unchanged (lines 84-123)
7. `## What just happened (1 min)` — unchanged (lines 125-134)
8. `## Error shape — one example` — unchanged (lines 136-147)
9. `## Next steps` — unchanged (lines 149-154)
10. `## Developing Rigging Itself` ← REPLACES old `## Setup (2 min)` with contributor framing, placed last before the footer

**Critical constraint:** The scaffold path command sequence must be verbatim from the CLI output (lines 98-101 of `bin/create-rigging.js`):
- `cd <project-name>`
- `bun install`
- `docker compose up -d`  (two words, no hyphen — matches CLI output)
- `bun test`

Note: existing quickstart uses `docker-compose` (hyphenated, line 19) — the scaffold path must use `docker compose` (no hyphen) to match the CLI's printed output exactly.

---

## Shared Patterns

### Markdown Section Style
**Source:** `README.md` lines 17-19 and `docs/quickstart.md` lines 14-23
**Apply to:** All new markdown sections

Short H2, one-sentence context, then code block. No H3 sub-sections in Getting Started or Scaffold sections — keep flat.

```markdown
## Section Title

One sentence of context.

```bash
command here
```

Optional 1-2 bullets of follow-up context.
```

### Bash Code Block Format
**Source:** `docs/quickstart.md` lines 16-23
**Apply to:** All new code blocks in README and quickstart

Use triple-backtick with `bash` language tag. Each command on its own line. No inline comments unless explaining a non-obvious step.

---

## No Analog Found

None. All three files are self-analogs (modify existing content) and the CLI next-steps strings are locked by SCAF-07 in `packages/create-rigging/bin/create-rigging.js` lines 96-102.

---

## Metadata

**Analog search scope:** `packages/create-rigging/`, root `README.md`, `docs/quickstart.md`, `packages/create-rigging/bin/create-rigging.js`
**Files scanned:** 5 (package.json, README.md, quickstart.md, create-rigging.js, 09-CONTEXT.md)
**Pattern extraction date:** 2026-04-20
