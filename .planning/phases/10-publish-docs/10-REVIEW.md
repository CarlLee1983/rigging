---
phase: 10-publish-docs
reviewed: 2026-04-20T15:45:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - packages/create-rigging/package.json
  - README.md
  - docs/quickstart.md
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-04-20T15:45:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

This phase covers documentation and package metadata changes for the v0.1.0 publish target. The three files are: `packages/create-rigging/package.json` (version bump + npm publish fields), `README.md` (Getting Started section added, stale v2 disclaimer removed), and `docs/quickstart.md` (scaffold-first restructuring).

No critical security or correctness issues were found. The package.json is structurally sound for npm publish — bin, files, engines, and license fields are all present and correct. The bin file exists, has a proper `#!/usr/bin/env node` shebang, and is executable (`-rwxr-xr-x`). The template directory is populated with the expected content (`.env.example`, migrations, `.github/workflows`, source).

Three warnings concern real usability gaps in the scaffold path that will cause user friction on first run: a missing `cp .env.example .env` step, inconsistent `docker-compose` vs `docker compose` usage within the same file, and a license mismatch between `package.json` (`"MIT"`) and `README.md` ("TBD"). Three info items cover a redundant README section, a stale description in the Quickstart section, and missing npm `keywords`.

## Warnings

### WR-01: Missing `cp .env.example .env` in Scaffold section

**File:** `docs/quickstart.md:22-24`
**Issue:** The Scaffold section presents this command sequence as complete:
```bash
npx create-rigging <project-name>
cd <project-name>
bun install
docker compose up -d
bun test
```
However, `docker compose up -d` and `bun test` (which internally runs `bun run db:migrate && bun test`) both require `DATABASE_URL` from a `.env` file. The CLI copies `.env.example` into the project but does NOT create `.env` automatically. Users will hit a `DATABASE_URL` connection error before `docker compose` even starts the app. The "Developing Rigging Itself" section at line 165 correctly includes `cp .env.example .env`, confirming the omission is an oversight in the Scaffold path.

**Fix:** Add the copy step between `bun install` and `docker compose up -d`:
```bash
npx create-rigging <project-name>
cd <project-name>
bun install
cp .env.example .env
docker compose up -d
bun test
```
The same four-line sequence in `README.md` (line 15) should receive the same fix.

---

### WR-02: `docker-compose` and `docker compose` used inconsistently within `docs/quickstart.md`

**File:** `docs/quickstart.md:10, 22, 166, 171`
**Issue:** The file mixes two invocation styles:
- Line 10 (Prerequisites): `docker-compose` (legacy v1 CLI)
- Line 22 (Scaffold section): `docker compose` (modern v2 plugin)
- Line 166 (Developing Rigging Itself): `docker-compose` (legacy)
- Line 171 (troubleshooting note): `docker-compose` (legacy)

Docker Compose v1 (`docker-compose`) is end-of-life as of June 2023. The Scaffold section correctly uses the v2 form (`docker compose`), but three other locations still use the hyphenated legacy form. This creates confusion: users on modern Docker installs may not have the legacy `docker-compose` binary.

**Fix:** Normalise all occurrences to `docker compose` (v2):
- Line 10: `[Docker](https://www.docker.com) + Docker Compose v2 (or Colima / Rancher Desktop)`
- Line 166: `docker compose up -d`
- Line 171: `If \`docker compose up -d\` fails...`

---

### WR-03: License mismatch between `package.json` and `README.md`

**File:** `packages/create-rigging/package.json:21` and `README.md:68`
**Issue:** `package.json` declares `"license": "MIT"` — a concrete, enforceable value that will be published to the npm registry. `README.md` line 68 says `"TBD — placeholder until v1 ship; expect MIT or Apache-2.0."` These are contradictory. Once published to npm with `"license": "MIT"`, the package is legally MIT. The README implies the decision has not been made, which is misleading to potential adopters and contributors.

**Fix:** If MIT is the confirmed choice (which `package.json` asserts), update `README.md` line 68:
```
MIT
```
If the decision is genuinely still open, remove `"license": "MIT"` from `package.json` or set it to `"UNLICENSED"` until the decision is finalised.

---

## Info

### IN-01: Redundant "Quickstart" section in `README.md` duplicates "Getting Started"

**File:** `README.md:29-31`
**Issue:** The README now has two sections that both direct users to `docs/quickstart.md`:
- `## Getting Started` (lines 7-18) — added in this phase, contains the actual scaffold command
- `## Quickstart` (lines 29-31) — pre-existing section, now superseded

The "Quickstart" section's prose ("clone, env, docker-compose up, migrate, dev") also describes the git-clone workflow that has been demoted to the "Developing Rigging Itself" section in `docs/quickstart.md`, making the description stale in addition to being redundant.

**Fix:** Remove the `## Quickstart` section (lines 29-31) entirely. The `## Getting Started` section now serves this purpose.

---

### IN-02: `README.md` "Quickstart" section description still references the old git-clone workflow

**File:** `README.md:31`
**Issue:** The body of the `## Quickstart` section reads: `"clone, env, docker-compose up, migrate, dev"`. This describes the contributor workflow (git clone path), not the scaffolded user path — the opposite of the restructuring goal in this phase. Even if the Quickstart section is retained, this prose misleads new users into thinking they need to clone the repo to get started.

**Fix:** If the section is kept, update the description to match the new scaffold-first framing:
```
See [docs/quickstart.md](docs/quickstart.md) — `npx create-rigging`, env, docker compose up, test — and you're issuing your first authenticated request in 10 minutes (both session and API Key paths).
```
(Resolves with IN-01 if the section is removed.)

---

### IN-03: `packages/create-rigging/package.json` is missing `keywords` for npm discoverability

**File:** `packages/create-rigging/package.json`
**Issue:** The package has no `keywords` field. npm's search ranking and discovery depend heavily on keywords. A `create-*` package without keywords will be harder to find for users searching for `ddd`, `elysia`, `bun`, `scaffold`, `typescript`, etc.

**Fix:** Add a `keywords` field after `description`:
```json
"keywords": ["create", "scaffold", "ddd", "bun", "elysia", "betterauth", "drizzle", "typescript"],
```

---

_Reviewed: 2026-04-20T15:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
