# Phase 5: Quality Gate — Research

**Researched:** 2026-04-20
**Domain:** Test infra (Bun coverage) + GitHub Actions CI + DX docs (README/quickstart/architecture/AGENTS)
**Confidence:** HIGH (Bun coverage flags + bunfig.toml + drizzle drift + cookie name verified live in this repo); HIGH (GitHub Actions postgres services + setup-bun@v2 verified via official docs); MEDIUM (mermaid theme behavior — GitHub auto-adapts but no explicit config recommendation)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QA-01 | Domain + use case unit tests, ≥80% coverage on `src/**/domain/` and `src/**/application/` | "Bun Coverage Baseline" + "Coverage Gate Implementation" sections — current coverage measured, gap quantified, gate script designed |
| QA-02 | Integration tests via testcontainers covering full auth flows | D-01 deviation locked: real docker-compose postgres replaces testcontainers; ADR 0018 records this. CI uses GitHub Actions `services:` for parity. |
| QA-03 | Regression suite covers CVE-2025-61928 / AuthContext bypass / password-reset session invalidation / API Key hashing / plugin undefined cascade | 8 `.regression.test.ts` files already exist; D-02-A `test:regression` script + D-16-B regression map make suite independently runnable + traceable |
| QA-04 | E2E tests via `bun:test` + `app.handle` over demo domain user flows | "E2E Helper Organization" recommends shared helpers; "Three E2E Journeys" specifies test shape using existing `_helpers.ts` patterns |
| QA-05 | `bun install --frozen-lockfile && bun test` passes from clean checkout | "GitHub Actions CI Skeleton" pins `bun.lock` (text format, lockfileVersion 1) + `--frozen-lockfile` |
| CI-01 | `.github/workflows/ci.yml` runs biome / tsc / bun test / migration drift on every PR | "GitHub Actions CI Skeleton" — 3 parallel jobs (lint / typecheck / test) verified pattern |
| CI-02 | Migration drift via `drizzle-kit generate --name=ci-drift` failing on schema diff | Live test in repo confirms drizzle-kit prints "No schema changes, nothing to migrate 😴" and produces NO file when clean — `git status --porcelain drizzle/` is reliable detector |
| CI-03 | CI runs in clean checkout (Bun native-module compat) | `oven-sh/setup-bun@v2` + `bun install --frozen-lockfile` verified pattern |
| DOC-01 | README first-screen = Core Value, not file layout | "README Tagline + Narrative" recommends Tagline option A + 70-line above-the-fold structure |
| DOC-02 | `docs/quickstart.md` 10-minute path: clone → env → docker-compose → migrate → dev → first authenticated request | "Quickstart 10-Minute Path" lists exact curl commands using verified `better-auth.session_token` cookie name |
| DOC-03 | `docs/architecture.md` covers DDD layering + AuthContext macro + dual-track identity resolution | "Mermaid Diagrams (Three Architecture Chapters)" provides ready-to-paste mermaid blocks compatible with GitHub light + dark mode |
| DOC-04 | `docs/decisions/README.md` ADR index with status per ADR | Current index already has status column populated for 0000-0017; adding 0018 row + verifying status accuracy is mechanical |
| DOC-05 | AGENTS.md "AI Agent 接手本專案前必讀" section listing Rigidity Map + anti-features | "AGENTS.md Onboarding TOC" recommends English-fallback anchor for cross-doc compatibility |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

No `./CLAUDE.md` exists in repo root (verified `ls /Users/carl/Dev/CMG/Rigging/CLAUDE.md` → not found). User-level global rules apply: 繁體中文 default language, immutability, no `console.log` in production code, conventional-commit `<type>: <scope> <subject>` format. None of these block any Phase 5 plan; they shape commit messages and code review.

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

The 17 D-xx decisions are organized into 4 areas (測試 / E2E / CI / DX docs):

**測試策略 (D-01..D-06):**
- **D-01** Integration tests stay on docker-compose postgres (NOT testcontainers); ADR 0018 records this deviation from QA-02 literal
- **D-02** Regression suite keeps `.regression.test.ts` suffix (no move); D-02-A adds `"test:regression": "bun test tests/**/*.regression.test.ts"` script; D-02-B adds regression-map table to `docs/architecture.md`
- **D-03** Coverage = `bun test --coverage` + `scripts/coverage-gate.ts` for per-path enforcement (Bun's native `--coverage-threshold` is a single global value, no per-path)
- **D-03-A** `bunfig.toml [test]` block: `coverage = true`, `coverageReporter = ["text", "json-summary"]`, `coveragePathIgnorePatterns = ["tests/", "node_modules/", "drizzle/"]`
- **D-03-B/C/D** Script reads coverage report, filters to domain+application, rolls up lines/branches/functions, exit 1 if <80%; CI runs gate, local optional; infra/presentation report-only
- **D-04** Test parallelism stays at Bun default (parallel) via email/userId namespace isolation (already in use); D-04-A documents test-writing convention
- **D-05** `"test"` script becomes `"bun run db:migrate && bun test"`; D-05-B deletes `scripts/ensure-agent-schema.ts`
- **D-06** Hard 80% gate ONLY on `src/**/domain/` + `src/**/application/`; D-06-B includes `src/shared/kernel/` as domain-tier; D-06-A excludes infra/presentation/bootstrap/main/types/tests/scripts

**E2E (D-07..D-09):**
- **D-07** E2E = cross-feature user journeys; integration = single-feature HTTP path completeness
- **D-08** `bun:test` + `app.handle(Request)` (NO eden Treaty, NO subprocess); D-08-B defers Pitfall #15 to v2
- **D-08-C** New `tests/e2e/_helpers.ts` (dup or share from `tests/integration/auth/_helpers.ts` — researcher decides)
- **D-09** Three journeys: `dogfood-happy-path.test.ts` / `password-reset-session-isolation.test.ts` / `cross-user-404-e2e.test.ts`; D-09-A `afterAll` ownerId-scoped DELETE; D-09-B runtime <30s

**CI (D-10..D-13):**
- **D-10** Migration drift via `git status --porcelain drizzle/` after `drizzle-kit generate --name=ci-drift`; D-10-B handle stray ci-drift artifact (gitignore or git clean — researcher selects)
- **D-11** 3 parallel jobs (lint / typecheck / test); D-11-D concurrency group = `ci-${{ github.ref }}`, cancel-in-progress
- **D-12** GitHub Actions `services: postgres:16-alpine` with healthcheck; D-12-B `DATABASE_URL=postgres://postgres:postgres@localhost:5432/rigging_test`; D-12-C verify docker-compose alignment
- **D-13** `scripts/coverage-gate.ts` per-path; D-13-D CI step sequence: db:migrate → test:ci (with coverage) → coverage:gate → migration drift

**DX Docs (D-14..D-17):**
- **D-14** README narrative-first; D-14-A above-the-fold ~70 lines (H1 → tagline → Core Value → Why Rigging → Quickstart link); D-14-B below: Stack / What NOT Included / Architecture / Decisions / Contributing / License
- **D-15** `docs/quickstart.md` 10-min two-path dogfood: Setup → Dev server → Path A (human session) → Path B (create+read agent) → "What just happened" → Next steps
- **D-16** `docs/architecture.md` prose+mermaid+ADR refs; 3 chapters (DDD / AuthContext macro / Dual identity); D-16-B regression suite map table; D-16-C test convention section
- **D-17** AGENTS.md top TOC + L197 rename to "AI Agent 接手本專案前必讀 (Rigidity Map)"

**Phase Structure (D-18):**
- 4 plans estimated: 05-01 (test infra) / 05-02 (E2E) / 05-03 (CI) / 05-04 (Docs); planner can adjust

### Claude's Discretion

researcher / planner free to decide:
- `scripts/coverage-gate.ts` exact implementation (Bun coverage JSON format)
- `bunfig.toml` exact key names
- Mermaid colors / shape style (GitHub default theme compatible)
- `tests/e2e/_helpers.ts` dup vs shared `tests/_shared/helpers.ts`
- ADR 0018 filename (`0018-testcontainers-v1-via-docker-compose.md` recommended)
- `concurrency` group naming
- Coverage report artifact upload + PR comment bot
- E2E DB cleanup timing (afterAll vs afterEach)
- README CI badge yes/no/where
- quickstart.md curl vs HTTPie alternative
- architecture.md monolithic vs split to `docs/testing.md`
- AGENTS.md TOC anchor format (CJK vs English)
- Plan count adjustment (3 / 4 / 5)
- Plan 05-01 unit-test-补齐 scope

### Deferred Ideas (OUT OF SCOPE)

- `$gsd-secure-phase 04` P4 threat-mitigation audit (separate out-of-band action)
- Production-grade observability (OpenTelemetry / metrics shipping) — v2 PROD-03
- Production-grade rate limit (persistent store / per-email dashboard) — v2 PROD-02
- Real email provider (Resend / SMTP) — v2 PROD-01
- OAuth / 2FA / Magic Link / Passkey — v2 IDN-*
- `npx create-rigging` CLI generator — v2 SCAF-01
- Container image publish (ghcr.io / Docker Hub) — v2
- NPM 套件拆分 (`@rigging/core` 等) — v2 SCAF-03
- `.regression.test.ts` move to `tests/regression/` — deferred (D-02 keeps suffix)
- Eden Treaty 整合 — v2 spike (Pitfall #15)
- docker-compose production-ready config — v2
- Subprocess-based e2e — not adopted (D-07 chooses same-runtime)
- Multi-language docs / i18n — out of scope

</user_constraints>

---

## Executive Summary

Phase 5 is an **audit phase, not a build phase**. P1-P4 already shipped 122 tests, 17 ADRs, 4 working DDD modules (shared/auth/health/agents), and a real BetterAuth integration with dual-track identity. P5's job: convert that into a state where a third-party developer can clone, run `bun install && docker-compose up -d && bun run db:migrate && bun test`, and have everything green within 10 minutes — and where every claim in README/architecture is backed by a real, runnable, named test.

The bulk of the engineering work is `scripts/coverage-gate.ts` (because Bun's native `--coverage-threshold` is a single global value with no per-path support) and the `.github/workflows/ci.yml` rewrite (3 parallel jobs + postgres service + migration drift + coverage gate). Everything else is shaping existing material: 8 regression tests already exist, 26 unit tests already cover most of `src/**/domain/`, the cookie name and AuthContext shape are verified, the dogfood happy path was proven by `tests/integration/agents/cross-user-404.test.ts`. The 3 e2e journeys are integration tests promoted to a higher narrative level — the technical primitives are unchanged.

**Primary recommendation:**

1. **Coverage gate parses LCOV, not JSON.** Bun 1.3.x supports only `text` and `lcov` reporters — there is **no `json-summary` reporter** (verified live: `bun test --help` shows only those two values). Update D-03-A's `bunfig.toml` to drop `json-summary` and have `scripts/coverage-gate.ts` parse `coverage/lcov.info` (LH/LF lines per `SF:` block). This reverses one literal in CONTEXT D-03-A but matches Bun reality and the CONTEXT explicitly granted researcher discretion on this.
2. **Migration drift via `git status` is reliable.** Verified live: `bun run db:generate --name=ci-drift-test` against the current schema produced zero new files and printed `No schema changes, nothing to migrate 😴`. No `.gitignore` or `git clean` cleanup needed in the happy path.
3. **`tests/e2e/_helpers.ts` should re-export from `tests/integration/auth/_helpers.ts` (the same shape `tests/integration/agents/_helpers.ts` already uses).** ~80% of the helper surface (TEST_CONFIG, makeTestApp, signUpAndSignIn, serializeSessionCookie) is already needed by e2e — duplicating creates drift. Adding e2e-specific functions (multi-user setup, full-stack `app.handle` calls) on top is the right shape.
4. **README tagline:** keep the current English-first tagline `"Harness Engineering for TypeScript backends — an opinionated reference app where AI Agents write code on rails (type system + runtime guards + DI) so wrong patterns literally fail to wire."` with one-line CN follow-up. The current README already has the right tagline; the work is replacing the "Phase 1 underway" status block with the Why Rigging + Quickstart CTA.

**Blockers / risks:**
- Bun coverage report omits files with zero coverage (verified: 25 domain/application files have NO unit test and don't appear in the report). Coverage gate must walk the filesystem and treat missing files as 0% — otherwise gate falsely passes when an entire module is untested.
- BetterAuth cookie name `better-auth.session_token` is the verified default but quickstart needs to call this out — naive curl `-c cookies.txt -b cookies.txt` works and is the recommended path.

---

## Architectural Responsibility Map

Phase 5 is single-tier (CI / docs / test infra) — no multi-tier capability mapping needed. The one area where tier discipline matters: the 3 e2e journey tests live in `tests/e2e/` and exercise the **Presentation tier** via `app.handle(Request)` from `src/bootstrap/app.ts`'s `createApp()` factory. They MUST NOT call use cases directly (that's unit-test land); they MUST go through the HTTP boundary.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Coverage gate | Build/CI | — | Reads test output artifact; fails CI step. No runtime tier. |
| Migration drift | Build/CI | DB | Runs `drizzle-kit` against schema files; doesn't touch live DB. |
| E2E journeys | Test infra (HTTP boundary) | All app tiers (presentation→application→infrastructure) | E2E proves the wired app works; integration tests already prove individual feature surfaces. |
| Quickstart curl examples | Documentation | HTTP API | Documentation must reflect the actual `/api/auth/sign-up/email` + `/agents` + `/api-keys` paths shipped in P3/P4. |
| AGENTS.md TOC | Documentation | — | Static markdown navigation. |

---

## Decisions to Verify

### 1. Bun coverage JSON format (D-13-B)

**Verified [VERIFIED: bun test --help on Bun 1.3.10 in this repo, 2026-04-20]:**

```
--coverage                   Generate a coverage profile
--coverage-reporter=<val>    Report coverage in 'text' and/or 'lcov'. Defaults to 'text'.
--coverage-dir=<val>         Directory for coverage files. Defaults to 'coverage'.
```

**Bun 1.3.10 supports ONLY `text` and `lcov` reporters. There is NO `json-summary` reporter.** This contradicts D-03-A's literal which lists `coverageReporter = ["text", "json-summary"]`. CONTEXT D-13-B explicitly says "若 Bun 1.3.x 不支援 `json-summary` reporter, fallback 用 `text` + regex parse(可接受, script 做 parsing layer 隔離)" — so this is the granted fallback path.

**Recommendation: parse `coverage/lcov.info` instead of JSON.** LCOV is structured, line-oriented, and trivial to parse. Sample output verified live in this repo:

```
TN:
SF:src/agents/application/usecases/create-agent.usecase.ts
FNF:2          # functions found
FNH:2          # functions hit
DA:2,124       # line 2, hit 124 times
DA:31,2
LF:20          # lines found
LH:20          # lines hit
end_of_record
```

For each `SF:` (source file) block: `LH/LF` = line coverage ratio, `FNH/FNF` = function coverage ratio. (LCOV does not natively report branch coverage from Bun's output — `BRF/BRH` are absent. Use line + function ratios for the gate.)

**Critical caveat:** Bun's coverage report **omits files with zero test coverage**. Verified live in this repo: 25 domain/application source files have no unit test and DO NOT appear in the LCOV output at all. The coverage-gate script MUST enumerate the expected file set from the filesystem and treat absent files as 0% — otherwise an entire untested module silently passes the gate.

**`scripts/coverage-gate.ts` skeleton (TypeScript, runs under Bun):**

```typescript
#!/usr/bin/env bun
import { readFileSync, existsSync } from 'node:fs'
import { Glob } from 'bun'

const LCOV_PATH = 'coverage/lcov.info'
const THRESHOLD = 80
const TIER_GLOBS = ['src/**/domain/**/*.ts', 'src/**/application/**/*.ts', 'src/shared/kernel/**/*.ts']
const EXCLUDE_PATTERNS = [/\.test\.ts$/, /\/index\.ts$/, /\.port\.ts$/] // ports are interfaces — no body

interface FileCoverage {
  path: string
  linesFound: number
  linesHit: number
  funcsFound: number
  funcsHit: number
}

function parseLcov(content: string): Map<string, FileCoverage> {
  const result = new Map<string, FileCoverage>()
  let current: FileCoverage | null = null
  for (const line of content.split('\n')) {
    if (line.startsWith('SF:')) {
      current = { path: line.slice(3).trim(), linesFound: 0, linesHit: 0, funcsFound: 0, funcsHit: 0 }
    } else if (current && line.startsWith('LF:')) {
      current.linesFound = Number(line.slice(3))
    } else if (current && line.startsWith('LH:')) {
      current.linesHit = Number(line.slice(3))
    } else if (current && line.startsWith('FNF:')) {
      current.funcsFound = Number(line.slice(4))
    } else if (current && line.startsWith('FNH:')) {
      current.funcsHit = Number(line.slice(4))
    } else if (line === 'end_of_record' && current) {
      result.set(current.path, current)
      current = null
    }
  }
  return result
}

async function expectedFiles(): Promise<string[]> {
  const files = new Set<string>()
  for (const pattern of TIER_GLOBS) {
    for await (const f of new Glob(pattern).scan('.')) {
      if (!EXCLUDE_PATTERNS.some(rx => rx.test(f))) files.add(f)
    }
  }
  return Array.from(files).sort()
}

function pct(hit: number, total: number): number {
  return total === 0 ? 100 : (hit / total) * 100
}

async function main() {
  if (!existsSync(LCOV_PATH)) {
    console.error(`✗ ${LCOV_PATH} not found — did you run 'bun test --coverage --coverage-reporter=lcov'?`)
    process.exit(2)
  }
  const lcov = parseLcov(readFileSync(LCOV_PATH, 'utf8'))
  const expected = await expectedFiles()

  const failures: string[] = []
  let totalLF = 0, totalLH = 0, totalFNF = 0, totalFNH = 0

  for (const file of expected) {
    const cov = lcov.get(file) ?? { path: file, linesFound: 0, linesHit: 0, funcsFound: 0, funcsHit: 0 }
    const linePct = pct(cov.linesHit, cov.linesFound)
    const funcPct = pct(cov.funcsHit, cov.funcsFound)
    totalLF += cov.linesFound; totalLH += cov.linesHit
    totalFNF += cov.funcsFound; totalFNH += cov.funcsHit
    if (linePct < THRESHOLD || funcPct < THRESHOLD) {
      failures.push(`  ${file}: lines ${linePct.toFixed(1)}% / funcs ${funcPct.toFixed(1)}%`)
    }
  }

  const totalLinePct = pct(totalLH, totalLF)
  const totalFuncPct = pct(totalFNH, totalFNF)

  console.log(`Coverage rollup (${expected.length} files in src/**/domain/ + src/**/application/ + src/shared/kernel/):`)
  console.log(`  Lines:     ${totalLinePct.toFixed(1)}% (${totalLH}/${totalLF})`)
  console.log(`  Functions: ${totalFuncPct.toFixed(1)}% (${totalFNH}/${totalFNF})`)

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} file(s) below ${THRESHOLD}% threshold:`)
    failures.forEach(f => console.error(f))
    process.exit(1)
  }
  if (totalLinePct < THRESHOLD || totalFuncPct < THRESHOLD) {
    console.error(`\n✗ Aggregate below ${THRESHOLD}%`)
    process.exit(1)
  }
  console.log(`\n✓ Coverage gate passed (≥${THRESHOLD}%)`)
}

main()
```

**Confidence: HIGH** — verified against live `bun test` output and live LCOV in this repo, 2026-04-20.

---

### 2. bunfig.toml [test] coverage syntax (D-03-A / D-06-A)

**Verified [VERIFIED: https://bun.com/docs/runtime/bunfig + bun test --help live]:**

Exact key names (camelCase):

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `coverage` | boolean | `false` | Enables coverage. |
| `coverageReporter` | array of string | `["text"]` | Bun 1.3.x accepts only `"text"` and `"lcov"`. **NOT `"json-summary"`**. |
| `coverageDir` | string | `"coverage"` | Output directory. |
| `coverageThreshold` | number OR object `{ line, function, statement }` | none | Single project-wide threshold. **No per-path support — this is why `coverage-gate.ts` is needed.** |
| `coveragePathIgnorePatterns` | string OR array of glob | none | Excludes from coverage. |
| `coverageSkipTestFiles` | boolean | `false` | Skip test files in coverage stats. |
| `coverageIgnoreSourcemaps` | boolean | `false` | Report against transpiled output. |

**Exact TOML to paste into `bunfig.toml`:**

```toml
[test]
# Phase 5: enable coverage by default; per-path enforcement via scripts/coverage-gate.ts
coverage = true
coverageReporter = ["text", "lcov"]
coveragePathIgnorePatterns = [
  "tests/",
  "node_modules/",
  "drizzle/",
  "scripts/",
  "src/**/infrastructure/**",
  "src/**/presentation/**",
  "src/bootstrap/**",
  "src/main.ts",
  "src/types/**",
]
# NOTE: no `coverageThreshold` here — Bun's threshold is single project-wide value;
# per-tier 80% gate is enforced by scripts/coverage-gate.ts (run after `bun test --coverage`).
```

**Deviation from CONTEXT D-03-A:**
- `coverageReporter` value drops `"json-summary"` (Bun unsupported) and uses `"lcov"` instead — `coverage-gate.ts` parses LCOV.
- `coveragePathIgnorePatterns` expanded to also exclude infrastructure/presentation/bootstrap/main/types/scripts per D-06-A's intent (these tiers are NOT subject to the 80% gate; excluding them from coverage collection makes the LCOV file smaller and the report cleaner).

**Confidence: HIGH** — Bun official docs verified.

---

### 3. GitHub Actions postgres services pattern (D-12-A)

**Verified [VERIFIED: https://docs.github.com/en/actions/using-containerized-services/creating-postgresql-service-containers + https://github.com/oven-sh/setup-bun]:**

- `services: postgres:16-alpine` works with Bun + Drizzle workflow — confirmed standard pattern, runs on the runner host (not container-mode), so reachable at `localhost:5432`.
- `oven-sh/setup-bun@v2` is current stable (v2.2.0 latest as of March 2026). Caching is built-in but only documented for the Bun binary itself. For `bun install` cache, use `actions/cache@v4` keyed on `bun.lock` hash.
- **`bun.lock` (text format, lockfileVersion 1) is the file to use**, NOT `bun.lockb` (deprecated binary format). Verified live: `cat bun.lock | head` shows `{"lockfileVersion": 1, "configVersion": 1, ...}`. `bun install --frozen-lockfile` works with `bun.lock`.

**Complete `.github/workflows/ci.yml` skeleton (3 jobs, fits all CONTEXT decisions):**

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  # D-11-D: cancel previous CI runs when a PR is force-pushed
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint (biome check)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.12
      - name: Cache bun deps
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('bun.lock') }}
          restore-keys: ${{ runner.os }}-bun-
      - run: bun install --frozen-lockfile
      - run: bun run lint

  typecheck:
    name: Typecheck (tsc --noEmit)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.12
      - name: Cache bun deps
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('bun.lock') }}
          restore-keys: ${{ runner.os }}-bun-
      - run: bun install --frozen-lockfile
      - run: bun run typecheck

  test:
    name: Test + coverage gate + migration drift
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: rigging_test
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U postgres -d rigging_test"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/rigging_test
      BETTER_AUTH_SECRET: ${{ secrets.CI_BETTER_AUTH_SECRET || 'x_x_x_x_x_x_x_x_x_x_x_x_x_x_x_x' }}
      BETTER_AUTH_URL: http://localhost:3000
      NODE_ENV: test
      LOG_LEVEL: error
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.12
      - name: Cache bun deps
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('bun.lock') }}
          restore-keys: ${{ runner.os }}-bun-
      - run: bun install --frozen-lockfile

      - name: Apply migrations
        run: bun run db:migrate

      - name: Test (with coverage)
        run: bun run test:ci

      - name: Coverage gate (≥80% on src/**/domain/ + src/**/application/)
        run: bun run coverage:gate

      - name: Migration drift check
        run: |
          bun run db:generate --name=ci-drift
          if [ -n "$(git status --porcelain drizzle/)" ]; then
            echo "::error::Schema drift detected — run 'bun run db:generate' locally and commit the resulting migration."
            git status drizzle/
            git diff drizzle/
            exit 1
          fi

      - name: Upload coverage artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-lcov
          path: coverage/lcov.info
          retention-days: 7
```

**Confidence: HIGH** — postgres service pattern from official docs; setup-bun verified against live action; cache pattern from `actions/cache@v4` standard; concurrency group from official concurrency docs.

---

### 4. Migration drift detection (D-10-A)

**Verified [VERIFIED: ran `bun run db:generate --name=ci-drift-test` against current schema in this repo, 2026-04-20]:**

When schema is clean (no diff vs latest migration), drizzle-kit prints:

```
$ drizzle-kit generate "--name=ci-drift-test"
No config path provided, using default 'drizzle.config.ts'
Reading config file '/Users/carl/Dev/CMG/Rigging/drizzle.config.ts'
8 tables
agent 5 columns 0 indexes 1 fks
...
No schema changes, nothing to migrate 😴
```

**No file is produced. No exit code change. `git status drizzle/` stays clean.** This means the CI step `if [ -n "$(git status --porcelain drizzle/)" ]; then exit 1; fi` reliably detects drift without false positives in the happy path.

**Cleanup question (D-10-B):** Since no file is produced when clean, no cleanup is needed in the happy path. If drift IS detected, the produced `0003_ci-drift.sql` (or similar) becomes the actionable artifact for the developer — DO NOT `git clean -f` or gitignore it. The drift detection step has already exited 1; the produced file in CI's workspace is intentional evidence shown via `git status drizzle/` + `git diff drizzle/`.

**Recommendation: do nothing about cleanup.** The shape of the CI step (run, check git status, exit 1 with `git status` + `git diff` output) is self-cleaning because drift = CI fail = rerun. No `.gitignore` entry needed; no `git clean` step needed.

**Confidence: HIGH** — verified live.

---

### 5. BetterAuth session cookie name (D-15-A / D-09)

**Verified [VERIFIED: live grep of test code in this repo + ANSWER from https://www.answeroverflow.com/m/1347345382878871623]:**

The default cookie name BetterAuth sets after sign-in is:

```
better-auth.session_token=<signed-token>; HttpOnly; Path=/; SameSite=Lax
```

Evidence in this repo:
- `tests/integration/auth/_helpers.ts:201` reads `ctx.authCookies.sessionToken.name` from BetterAuth context (the canonical source — name comes from `auth.$context.authCookies.sessionToken.name`).
- `tests/integration/auth/_helpers.ts:355` regex: `/(?:^|;\s*)(?:better-auth\.)?session_token=([^;]+)/` — accepts both `better-auth.session_token=` (default) and `session_token=` (in case prefix is stripped by some client).
- `tests/integration/auth/401-body-shape.test.ts:52` uses literal `cookie: 'better-auth.session_token=bogus'`.
- `tests/unit/auth/infrastructure/identity-service.adapter.test.ts:49` uses literal `cookie: 'better-auth.session_token=abc'`.

**For e2e helpers + quickstart curl examples — exact format:**

```bash
# Step 1: sign-up (no cookie yet)
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.test","password":"password-123456","name":"You"}' \
  -c cookies.txt

# Step 2: sign-in (cookie jar saves better-auth.session_token)
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.test","password":"password-123456"}' \
  -c cookies.txt

# Step 3: protected request (cookie jar replays better-auth.session_token)
curl http://localhost:3000/me -b cookies.txt

# Or explicit Cookie header (avoid for new users; cookie jar is robust):
curl http://localhost:3000/me \
  -H 'Cookie: better-auth.session_token=<signed-token>'
```

**Confidence: HIGH** — verified live in repo + cross-checked external source.

---

### 6. E2E helper organization (D-08-C / D-09-A)

**Recommendation: re-export from `tests/integration/auth/_helpers.ts` — same shape `tests/integration/agents/_helpers.ts` already uses.**

**Evidence:** `tests/integration/agents/_helpers.ts` lines 1-24 already does this:

```typescript
import {
  followLatestVerificationEmail,
  insertTestApiKey,
  makeTestApp,
  serializeSessionCookie,
  signInAndGetHeaders,
  signUpAndSignIn,
  TEST_CONFIG,
  type TestHarness,
} from '../auth/_helpers'

export type { TestHarness }
export { followLatestVerificationEmail, insertTestApiKey, makeTestApp,
         serializeSessionCookie, signInAndGetHeaders, signUpAndSignIn, TEST_CONFIG }

export interface AgentsTestHarness extends TestHarness {
  realApp: ReturnType<typeof createApp>
}

export function makeAgentsTestHarness(): AgentsTestHarness {
  const base = makeTestApp()
  const realApp = createApp(TEST_CONFIG, { authInstance: base.auth })
  return { ...base, realApp }
}
```

**Overlap analysis:**
- `tests/integration/auth/_helpers.ts` (477 lines): TEST_CONFIG, makeTestApp (the harness factory — wires DB + auth + repos + use cases + plugin chain), signUpAndSignIn, signInAndGetHeaders, serializeSessionCookie, followLatestVerificationEmail, insertTestApiKey, plus several supporting functions (~100% reuse)
- `tests/integration/agents/_helpers.ts` (80 lines): adds insertTestAgent, insertTestPromptVersion, cleanupTestUser, AgentsTestHarness wrapper that builds a real `createApp` for full-stack handle calls

For e2e, the same pattern works perfectly — re-export everything from `auth/_helpers.ts`, add e2e-specific helpers (multi-user setup, full-stack `app.handle` Request building, journey-step assertions). Do NOT extract to `tests/_shared/` because:
1. The refactor adds risk for zero benefit — current pattern works, P4 already proved it.
2. The "_shared" dir is a v2 concern (when there are 3+ test categories needing the same primitives).
3. E2E is the THIRD reuser of `auth/_helpers.ts` — agents was the second. The pattern is established.

**Recommended `tests/e2e/_helpers.ts` shape:**

```typescript
import { createApp } from '../../src/bootstrap/app'
import {
  followLatestVerificationEmail,
  insertTestApiKey,
  makeTestApp,
  serializeSessionCookie,
  signInAndGetHeaders,
  signUpAndSignIn,
  TEST_CONFIG,
  type TestHarness,
} from '../integration/auth/_helpers'

export type { TestHarness }
export {
  followLatestVerificationEmail,
  insertTestApiKey,
  makeTestApp,
  serializeSessionCookie,
  signInAndGetHeaders,
  signUpAndSignIn,
  TEST_CONFIG,
}

export interface E2eHarness extends TestHarness {
  realApp: ReturnType<typeof createApp>
}

export function makeE2eHarness(): E2eHarness {
  const base = makeTestApp()
  const realApp = createApp(TEST_CONFIG, { authInstance: base.auth })
  return { ...base, realApp }
}

/** Creates a unique test user (timestamp-namespaced email) and returns auth materials. */
export async function setupUser(harness: TestHarness, prefix: string) {
  const email = `e2e-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const password = 'password-12345678'
  const { signUp, headers, cookie } = await signUpAndSignIn(harness, email, password)
  return { userId: signUp.user.id, email, password, headers, cookie }
}

/** Cleans up a user's data across all tables (call in afterAll). */
export async function cleanupUser(harness: TestHarness, userId: string, email: string) {
  await harness.sql`DELETE FROM "agent" WHERE owner_id = ${userId}`
  await harness.sql`DELETE FROM "apikey" WHERE reference_id = ${userId}`
  await harness.sql`DELETE FROM "account" WHERE user_id = ${userId}`
  await harness.sql`DELETE FROM "session" WHERE user_id = ${userId}`
  await harness.sql`DELETE FROM "verification" WHERE identifier = ${email}`
  await harness.sql`DELETE FROM "user" WHERE id = ${userId}`
}
```

**Confidence: HIGH** — pattern already proven in `tests/integration/agents/_helpers.ts`.

---

### 7. ADR 0018 filename + position in README index (D-01 / D-12-A)

**Recommended filename:** `0018-testcontainers-deviation-via-docker-compose.md`

Rationale:
- Mirrors existing pattern (e.g., `0010-postgres-driver-postgres-js.md`, `0014-api-key-hashing-sha256.md`) — short, kebab-case, decision summary.
- "deviation" is the key word: this ADR explicitly documents a deviation from QA-02's literal text. The filename should make that visible to anyone scanning the index.
- Drops "v1" prefix (CONTEXT suggested `0018-testcontainers-v1-via-docker-compose.md`) because the ADR's status will track lifecycle — encoding "v1" in filename creates ambiguity if v2 supersedes.

**MADR 4.0 status workflow:** ADR 0018 should land **`accepted`** directly (not Proposed → Accepted). Reasoning:
- The decision is already made (D-01 in CONTEXT, signed off).
- Existing ADRs 0000-0017 all landed accepted in single PRs (verified in `docs/decisions/README.md`).
- "Proposed" workflow is for genuinely uncertain decisions awaiting team review; this one is settled.

**README index position:** Append as row 0018 (numeric order). The current index is sorted numerically; preserve that convention. Recommended row:

```markdown
| [0018](0018-testcontainers-deviation-via-docker-compose.md) | Integration tests use docker-compose Postgres (deviation from QA-02 testcontainers literal) | accepted | 2026-04-20 | — |
```

**Index status polish task:** Verify each row's status reflects truth — the existing index lists all rows as `accepted`, but the audit task per Success Criterion #5 ("Looks Done But Isn't") is to spot-check that each ADR's body actually starts with `Status: accepted` (not a stale `proposed`). Mechanical: `grep -l 'Status: proposed' docs/decisions/*.md` should return zero files at Phase 5 close.

**Confidence: HIGH** — based on existing repo conventions.

---

### 8. AGENTS.md TOC anchor compatibility (D-17-C)

**Verified [VERIFIED: GitHub markdown CJK anchor behavior + cross-checked daangn/cjk-slug + tats-u/markdown-cjk-friendly]:**

GitHub does support CJK characters in anchor IDs — the slug preserves CJK, drops ASCII punctuation, lowercases ASCII letters, and joins with `-`.

For heading `## AI Agent 接手本專案前必讀 (Rigidity Map)`, GitHub generates anchor:

```
ai-agent-接手本專案前必讀-rigidity-map
```

(parens dropped, spaces → hyphens, CJK preserved.)

**Cross-doc compatibility issue:** Some markdown renderers (older CommonMark, certain CMS / IDE preview engines) strip CJK entirely, producing `ai-agent--rigidity-map` or empty `ai-agent-` anchor. GitHub itself works fine, but if anyone embeds README in a non-GitHub context (e.g., npm registry README rendering, docs.rs-style mirror, an internal corporate Confluence import), the link breaks.

**Recommendation: use English-only anchor for cross-doc safety.** Two options:

**Option A (recommended): explicit anchor link in TOC + ASCII-friendly heading**

Change the L197 heading to ASCII-stable form:

```markdown
<a id="ai-agent-onboarding"></a>
## AI Agent 接手本專案前必讀 (Rigidity Map)
```

Then internal links use `#ai-agent-onboarding` (the explicit `<a id>` anchor). GitHub respects HTML anchor tags inside markdown.

This way:
- Heading reads in 繁中 + parenthetical English (consistent with repo style — `AGENTS.md` is bilingual).
- Cross-doc links use ASCII anchor, which all renderers handle.
- README's `## Contributing` link can be `[AGENTS.md](AGENTS.md#ai-agent-onboarding)` — guaranteed stable.

**Option B: pure English heading, CJK in body only**

```markdown
## AI Agent Onboarding (Rigidity Map / 接手本專案前必讀)
```

Less heading-CN-first, but anchor `ai-agent-onboarding-rigidity-map-接手本專案前必讀` is still mostly ASCII. Slightly less elegant for the bilingual repo style.

**Pick Option A.** It preserves the CN-first heading intent while giving cross-doc links a stable anchor.

**Confidence: MEDIUM** — GitHub anchor behavior verified; cross-doc compatibility edge cases inferred from multiple markdown-tooling sources rather than direct test in non-GitHub renderers.

---

### 9. Bun coverage baseline (D-18 / 05-01 unit 补齐策略)

**Verified [VERIFIED: ran `bun test --coverage --coverage-reporter=text tests/unit` in this repo, 2026-04-20]:**

**Current coverage state (104 tests / 26 test files):**

```
File                                                                  | % Funcs | % Lines |
All files                                                             |   88.73 |   97.11 |  ← global, includes infra
```

**Per-file coverage on src/**/domain/ + src/**/application/ tier (rolled up from text report):**

```
src/agents/application/usecases/create-agent.usecase.ts              |  100.00 |  100.00
src/agents/application/usecases/create-eval-dataset.usecase.ts       |  100.00 |  100.00
src/agents/application/usecases/create-prompt-version.usecase.ts     |  100.00 |  100.00
src/agents/application/usecases/get-latest-prompt-version.usecase.ts |  100.00 |  100.00
src/agents/application/usecases/update-agent.usecase.ts              |  100.00 |  100.00
src/agents/domain/errors.ts                                          |    0.00 |  100.00  ← lines 100% but 0 functions
src/agents/domain/index.ts                                           |  100.00 |  100.00
src/agents/domain/values/ids.ts                                      |  100.00 |  100.00
src/auth/application/usecases/create-api-key.usecase.ts              |  100.00 |  100.00
src/auth/application/usecases/register-user.usecase.ts               |  100.00 |  100.00
src/auth/application/usecases/reset-password.usecase.ts              |  100.00 |  100.00
src/auth/domain/auth-context.ts                                      |  100.00 |  100.00
src/auth/domain/errors.ts                                            |    0.00 |  100.00
src/auth/domain/index.ts                                             |  100.00 |  100.00
src/auth/domain/internal/api-key-service.ts                          |  100.00 |  100.00
src/auth/domain/internal/authcontext-missing-error.ts                |    0.00 |  100.00
src/auth/domain/values/api-key-hash.ts                               |  100.00 |  100.00
src/auth/domain/values/email.ts                                      |  100.00 |  100.00
src/health/application/usecases/check-health.usecase.ts              |  100.00 |  100.00
src/health/domain/index.ts                                           |  100.00 |  100.00
src/health/domain/internal/health-status.ts                          |  100.00 |  100.00
src/shared/kernel/brand.ts                                           |  100.00 |  100.00
src/shared/kernel/errors.ts                                          |   50.00 |  100.00
src/shared/kernel/id.ts                                              |  100.00 |  100.00
src/shared/kernel/result.ts                                          |  100.00 |  100.00
```

**Files NOT in coverage report (= 0% — not exercised by any unit test):**

```
src/agents/domain/agent.ts                                            ← unit test gap
src/agents/domain/eval-dataset.ts                                     ← unit test gap
src/agents/domain/prompt-version.ts                                   ← unit test gap
src/agents/application/usecases/delete-agent.usecase.ts               ← unit test gap
src/agents/application/usecases/delete-eval-dataset.usecase.ts        ← unit test gap
src/agents/application/usecases/get-agent.usecase.ts                  ← unit test gap
src/agents/application/usecases/get-eval-dataset.usecase.ts           ← unit test gap
src/agents/application/usecases/get-prompt-version.usecase.ts         ← unit test gap
src/agents/application/usecases/list-agents.usecase.ts                ← unit test gap
src/agents/application/usecases/list-eval-datasets.usecase.ts         ← unit test gap
src/agents/application/usecases/list-prompt-versions.usecase.ts       ← unit test gap
src/auth/application/usecases/list-api-keys.usecase.ts                ← unit test gap
src/auth/application/usecases/request-password-reset.usecase.ts       ← unit test gap
src/auth/application/usecases/revoke-api-key.usecase.ts               ← unit test gap
src/auth/application/usecases/verify-email.usecase.ts                 ← unit test gap
src/auth/domain/identity-kind.ts                                      ← type-only file, NO body
src/auth/application/ports/email.port.ts                              ← interface-only, NO body
src/auth/application/ports/api-key-repository.port.ts                 ← interface-only
src/auth/application/ports/user-repository.port.ts                    ← interface-only
src/auth/application/ports/identity-service.port.ts                   ← interface-only
src/health/application/ports/db-health-probe.port.ts                  ← interface-only
src/agents/application/ports/agent-repository.port.ts                 ← interface-only
src/agents/application/ports/eval-dataset-repository.port.ts          ← interface-only
src/agents/application/ports/prompt-version-repository.port.ts        ← interface-only
src/shared/application/ports/clock.port.ts                            ← interface-only
```

**Gap analysis:**

| Category | Count | Action |
|----------|-------|--------|
| Real use case files with no unit test | **11** | **Need new unit tests** (all `agents/get-*`, `agents/list-*`, `agents/delete-*`, plus 4 auth use cases). Each test ≤30 lines, mocked ports — straight follow of existing patterns in `tests/unit/agents/*.test.ts`. |
| Domain entity files with no unit test | **3** | **Need new unit tests**: `agent.ts`, `eval-dataset.ts`, `prompt-version.ts`. Domain entity tests focus on factory invariants (e.g., `Agent.create({...})` rejects empty name). |
| Type-only files (`.port.ts` interfaces, `identity-kind.ts` union) | **10** | **Excluded from gate via `EXCLUDE_PATTERNS` in coverage-gate.ts** — they have no executable code. Coverage of an interface = 100% trivially or undefined. |
| `*/errors.ts` and `internal/*-error.ts` showing 0% functions | **3** | **Need export-side tests** — instantiate each error class once to exercise the constructor. Each test 5-10 lines. |

**Estimated effort to reach 80% gate:** ~14 new unit test files (11 use cases + 3 entities) + ~3 short error-class instantiation tests. Each file mirrors existing patterns; no new infrastructure. **Plan 05-01 should batch these as a single "unit test backfill" task** — each test ≤30 lines, total ~400-500 LoC, runnable in <2 min.

**Aggregate projection:** Current 104 tests cover ~30 of 55 source files in domain+application+kernel; adding 14-17 tests brings full coverage to ~47/55, with the remaining 8 being interface-only files excluded from the gate. Conservative projection: **gate passes at ~92% line / ~88% function** after backfill.

**Confidence: HIGH** — verified live.

---

### 10. Mermaid diagram syntax for D-16 architecture.md

**Verified [VERIFIED: https://github.blog/developer-skills/github/include-diagrams-markdown-files-mermaid/]:**

GitHub renders mermaid in `.md` files natively. Syntax: triple-backtick code fence with `mermaid` language tag. No theme/preprocessing config needed in markdown source — GitHub auto-applies its theme based on user's GitHub light/dark mode preference.

**Recommendation: do NOT specify a custom theme in mermaid blocks.** Let GitHub handle light/dark mode adaptation natively. Adding `%%{init: {'theme': 'forest'}}%%` directives produces inconsistent results across renderers (GitHub, npm, vscode preview each handle theme directives differently).

**Three diagrams (ready-to-paste mermaid blocks):**

**Diagram 1: DDD Four-Layer Architecture (flowchart)**

````markdown
```mermaid
flowchart TB
  subgraph PRES["Presentation (Elysia plugins + controllers + macros)"]
    C[Controllers]
    M[".macro({ requireAuth })"]
  end
  subgraph APP["Application (use cases + ports)"]
    U["Use cases<br/>(execute(ctx, input))"]
    P["Ports (interfaces)<br/>IUserRepository · IEmailPort · IIdentityService"]
  end
  subgraph DOM["Domain (pure, framework-free)"]
    E[Entities · Value objects]
    AC[AuthContext]
    ER[DomainError hierarchy]
  end
  subgraph INF["Infrastructure (adapters)"]
    R[Drizzle repositories + mappers]
    BA[BetterAuth identity-service adapter]
    CE[ConsoleEmail adapter]
  end

  C --> M
  M --> U
  U --> P
  U -.uses.-> E
  U -.uses.-> AC
  R -.implements.-> P
  BA -.implements.-> P
  CE -.implements.-> P
  R --> DOM
  BA --> DOM

  classDef domain fill:#e8f5e9,stroke:#2e7d32
  classDef rule fill:#fff3e0,stroke:#e65100
  class DOM,E,AC,ER domain
  class M rule
```

**Domain is framework-free (Biome `noRestrictedImports` enforces zero `drizzle-orm` / `elysia` imports under `src/**/domain/`).**
See ADR [0003](decisions/0003-ddd-layering.md) and [0009](decisions/0009-rigidity-map.md).
````

**Diagram 2: AuthContext Macro Flow (sequence)**

````markdown
```mermaid
sequenceDiagram
  autonumber
  participant Client
  participant Elysia as Elysia request pipeline
  participant Plugin as authContextPlugin (.macro requireAuth.resolve)
  participant Identity as IIdentityService (BetterAuth adapter)
  participant Handler as Route handler
  participant UseCase as Use case (execute(ctx, input))

  Client->>Elysia: HTTP request (Cookie or x-api-key)
  Elysia->>Plugin: .resolve() (only if route declares requireAuth: true)
  alt Route does NOT declare requireAuth
    Elysia->>Handler: handler invoked WITHOUT ctx.authContext (compile-time)
  else Route declares requireAuth: true
    Plugin->>Plugin: read x-api-key header
    alt API Key present
      Plugin->>Identity: verifyApiKey(rawKey)
      alt Valid
        Identity-->>Plugin: AuthContext { identityKind: 'agent', apiKeyId, scopes }
      else Invalid (D-09 hard 401, no fallback)
        Identity-->>Plugin: null
        Plugin-->>Client: 401 UNAUTHENTICATED
      end
    else API Key absent
      Plugin->>Identity: verifySession(headers) (cookie path)
      Identity-->>Plugin: AuthContext { identityKind: 'human', sessionId, scopes: ['*'] } | null
    end
    Plugin->>Handler: ctx.authContext set (or 401)
    Handler->>UseCase: execute(ctx.authContext, input)
    UseCase-->>Handler: result
    Handler-->>Client: 200 + body
  end
```

See ADR [0006](decisions/0006-authcontext-boundary.md) and [0007](decisions/0007-runtime-guards-via-di.md).
**Without `requireAuth: true`, `ctx.authContext` is not in scope — TypeScript refuses to compile a handler that destructures it.**
````

**Diagram 3: Dual Identity Resolution (decision graph)**

````markdown
```mermaid
flowchart TD
  Start([Incoming request]) --> HasKey{x-api-key<br/>header present?}
  HasKey -->|Yes| FormatOK{Format valid?<br/>rig_live_ prefix +<br/>length + ASCII}
  FormatOK -->|No| TimingPad1[Timing pad:<br/>dummy hash compare<br/>+ DB lookup]
  TimingPad1 --> Fail1[401 UNAUTHENTICATED]
  FormatOK -->|Yes| HashCheck{Hash matches DB?<br/>timingSafeEqual}
  HashCheck -->|No| Fail2[401 UNAUTHENTICATED<br/>NO fallback to cookie]
  HashCheck -->|Yes| AgentCtx[AuthContext<br/>identityKind: agent<br/>apiKeyId set<br/>scopes from key]
  HasKey -->|No| HasCookie{better-auth.session_token<br/>cookie present?}
  HasCookie -->|No| Fail3[401 UNAUTHENTICATED]
  HasCookie -->|Yes| SessionValid{BetterAuth<br/>session valid?<br/>not expired}
  SessionValid -->|No| Fail4[401 UNAUTHENTICATED]
  SessionValid -->|Yes| HumanCtx[AuthContext<br/>identityKind: human<br/>sessionId set<br/>scopes: '*']

  classDef ok fill:#e8f5e9,stroke:#2e7d32
  classDef err fill:#ffebee,stroke:#c62828
  classDef pad fill:#fff3e0,stroke:#e65100
  class AgentCtx,HumanCtx ok
  class Fail1,Fail2,Fail3,Fail4 err
  class TimingPad1 pad
```

**API Key takes precedence over cookie. Failed API Key does NOT fall back to cookie (D-09 / ADR 0011).**
Timing-pad on malformed keys ensures latency does not leak format-vs-hash failure (D-10 / ADR 0011).
See ADR [0008](decisions/0008-dual-auth-session-and-apikey.md) and [0011](decisions/0011-resolver-precedence-apikey-over-cookie.md).
````

**Confidence: HIGH** — mermaid syntax verified against GitHub blog official source; node fill colors use GitHub-friendly hex pairs (light-mode visible, contrast OK in dark mode auto-invert).

---

### 11. README narrative tagline (D-14-A)

**Cross-reference with `PROJECT.md` Core Value:**

> AI Agent 寫出來的程式碼必須「自動」具備安全性與結構性——靠的不是提示詞約束，而是框架本身的軌道（type system + runtime guards + DI）讓錯誤的寫法根本跑不起來。
> 如果其他都失敗，這一點不能失敗：任何 Domain 操作必須通過 AuthContext，沒有 AuthContext 就連 handler 都 wire 不起來。

**Current `README.md` already has a strong tagline:**

> **Harness Engineering for TypeScript backends** — an opinionated reference app where AI Agents write code on rails (type system + runtime guards + DI) so wrong patterns literally fail to wire.

**This tagline matches PROJECT.md Core Value almost word-for-word in English form.** Recommendation: **keep this tagline**, the work for D-14 is REPLACING the "Phase 1 underway" status block (lines 7-9 of current README) with the Why Rigging + Quickstart CTA structure from D-14-A, NOT changing the tagline.

**Language strategy for new docs:**
- README.md: **English-first** (current state, broader audience reach for "community usable" goal). Keep one CN line as a follow-up to the Core Value statement so it matches PROJECT.md voice.
- AGENTS.md: **CN-first / bilingual** (already established voice; AI agents and human contributors in this project's culture share this).
- docs/quickstart.md: **English-first** (external dev audience; matches README).
- docs/architecture.md: **English-first** with CN technical-term annotations where the term is a project-specific coinage (e.g., 「軌道」 / "rails").
- docs/decisions/0018-*.md: **English** (consistent with existing 0000-0017 ADRs).

**Confidence: HIGH** — based on existing repo style + Core Value text alignment.

---

### 12. Validation Architecture (Nyquist enabled)

See dedicated section below.

---

## Standard Stack

Existing stack — no new additions for Phase 5. Versions verified live in `package.json` (2026-04-20):

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| Bun | 1.3.10 (target ^1.3.12) | Test runner + runtime + coverage | [VERIFIED: bun --version live] |
| Elysia | ^1.4.28 | Web framework (E2E uses `app.handle` from this) | [VERIFIED: package.json] |
| @sinclair/typebox | ^0.34.49 | (e2e tests don't need it directly) | [VERIFIED: package.json] |
| Drizzle ORM | ^0.45.2 | (CI migration drift target) | [VERIFIED: package.json] |
| drizzle-kit | ^0.31.10 | `drizzle-kit generate --name=ci-drift` | [VERIFIED: package.json] |
| BetterAuth | 1.6.5 (exact pin) | (e2e auth setup uses this) | [VERIFIED: package.json] |
| postgres | ^3.4.9 | Driver behind Drizzle | [VERIFIED: package.json] |

**No new dependencies required for Phase 5.** Specifically:
- testcontainers: NOT added (D-01)
- @elysiajs/eden: NOT added (D-08-A)
- Any coverage tooling: NOT added (Bun's built-in `--coverage` is sufficient)

---

## Architecture Patterns

### Pattern: E2E test = real createApp + app.handle(Request) + multi-step journey

**What:** E2E tests build a real `createApp(TEST_CONFIG, { authInstance })` and exercise it via `Request` objects passed to `app.handle()`. Each test represents a user journey across multiple endpoints (sign-up → sign-in → create resource → use resource), with assertions at each transition.

**When to use:** The 3 D-09 journeys. Never for single-endpoint testing (use integration tests for that).

**Example skeleton (dogfood-happy-path.test.ts):**

```typescript
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { cleanupUser, makeE2eHarness, setupUser } from './_helpers'

describe('e2e: dogfood happy path (DEMO-04)', () => {
  let harness: ReturnType<typeof makeE2eHarness>
  let user: Awaited<ReturnType<typeof setupUser>>
  let agentId: string
  let apiKey: string

  beforeAll(async () => {
    harness = makeE2eHarness()
    user = await setupUser(harness, 'dogfood')
  })
  afterAll(async () => {
    await cleanupUser(harness, user.userId, user.email)
    await harness.dispose()
  })

  test('1. user creates an Agent via cookie session', async () => {
    const res = await harness.realApp.handle(new Request('http://localhost/agents', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: user.cookie },
      body: JSON.stringify({ name: 'my-agent' }),
    }))
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string }
    agentId = body.id
  })

  test('2. user creates a PromptVersion v1', async () => {
    const res = await harness.realApp.handle(new Request(`http://localhost/agents/${agentId}/prompts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: user.cookie },
      body: JSON.stringify({ content: 'You are a helpful assistant.' }),
    }))
    expect(res.status).toBe(201)
  })

  test('3. user mints an API Key (one-time plaintext in response)', async () => {
    const res = await harness.realApp.handle(new Request('http://localhost/api-keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: user.cookie },
      body: JSON.stringify({ label: 'dogfood-key', scopes: ['*'] }),
    }))
    expect(res.status).toBe(201)
    const body = (await res.json()) as { rawKey: string }
    expect(body.rawKey).toMatch(/^rig_live_/)
    apiKey = body.rawKey
  })

  test('4. agent uses API Key to read its own latest prompt — identityKind=agent', async () => {
    const res = await harness.realApp.handle(new Request(`http://localhost/agents/${agentId}/prompts/latest`, {
      headers: { 'x-api-key': apiKey },
    }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { content: string }
    expect(body.content).toBe('You are a helpful assistant.')
    // (resolver-precedence.regression.test.ts already covers identityKind=agent — trust it)
  })
})
```

**Key constraint:** all 4 sub-tests share state (`agentId`, `apiKey`) via outer `let` bindings. Bun runs `test()` blocks within a `describe()` sequentially, so this is safe. (Don't use `test.concurrent()` here.)

### Pattern: Coverage gate runs after `bun test --coverage`, in same CI step or separate

**What:** `bun run test:ci` runs tests with `--coverage --coverage-reporter=lcov` (writes `coverage/lcov.info`); `bun run coverage:gate` reads that file and exits 1 on failure. CI runs them as separate steps so the failure shows in the right place.

**When to use:** Always for the gate. Never inline — keeping them separate makes coverage failures distinguishable from test failures in CI logs.

### Pattern: Migration drift = `git status --porcelain drizzle/` after `db:generate`

**What:** After applying migrations and running tests, CI re-runs `bun run db:generate --name=ci-drift`. If the schema is unchanged, drizzle-kit produces no file and git stays clean. If schema diverged from migrations, drizzle-kit creates `drizzle/0003_ci-drift.sql` and `git status --porcelain drizzle/` outputs a non-empty string — exit 1 with a helpful message.

**When to use:** Once per CI run, in the test job (where the DB exists), after coverage gate.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LCOV parsing | Custom regex over LCOV with edge-case handling | Hand-roll IS acceptable HERE because the format is dead-simple (5 prefixes: `SF:`, `LF:`, `LH:`, `FNF:`, `FNH:`) and adding `lcov-parse` npm dep for ~30 lines of code is overkill | Single-purpose script, dependency-free is cleaner |
| Coverage threshold per-path | Bun-native `coverageThreshold` for per-tier enforcement | `scripts/coverage-gate.ts` — Bun's `coverageThreshold` is single project-wide value, no per-path | Already locked by D-03/D-13 |
| Postgres in CI | Custom Docker setup, init scripts | `services: postgres:16-alpine` — GitHub Actions native primitive | Health-checked, port-mapped, reachable at `localhost:5432`, zero maintenance |
| Test app factory | Custom Elysia app builder for tests | `createApp(TEST_CONFIG, { authInstance })` from `src/bootstrap/app.ts` — ALREADY EXISTS, used by `tests/integration/agents/_helpers.ts` | Reusing the real factory means E2E catches plugin-ordering bugs (ADR 0012); custom factory wouldn't |
| Cookie name lookup | Hardcode `better-auth.session_token` everywhere | Read from `auth.$context.authCookies.sessionToken.name` in helpers (already done in `_helpers.ts:201`) | Survives BetterAuth config changes (e.g., `cookiePrefix` setting) |
| Mermaid theming | Custom CSS or theme directives | GitHub default theme (auto light/dark) | Cross-renderer safety; corporate Confluence imports also work |
| Markdown anchor for CJK | Bare CJK heading + hope renderer slugifies right | Explicit `<a id="...">` HTML anchor tags before headings | Cross-doc compatibility (D-17-C) |

---

## Runtime State Inventory

Phase 5 is a docs/CI/test phase — **no runtime state changes**. Specifically:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 5 doesn't touch DB schema (drizzle migrations untouched, `drizzle/` dir read-only by drift check) | None |
| Live service config | None — no external services configured | None |
| OS-registered state | None — CI runs in clean ephemeral runners; no local OS state changes | None |
| Secrets / env vars | New CI secret optional: `CI_BETTER_AUTH_SECRET` (32+ char) — but workflow has 32-char fallback so secret is optional convenience | Document in quickstart that BETTER_AUTH_SECRET=32+ chars is required for local dev |
| Build artifacts | `scripts/ensure-agent-schema.ts` to be DELETED (D-05-B). `coverage/` directory created by `bun test --coverage` — should be gitignored | Add `coverage/` to `.gitignore` if not already present |

**Verification:** `cat .gitignore | grep coverage` should return at least one line at Phase 5 close. If not, Plan 05-01 adds it.

---

## Common Pitfalls

### Pitfall 1: Coverage gate falsely passes when an entire module is untested

**What goes wrong:** Bun's coverage report only lists files that were touched by tests. If `src/agents/domain/agent.ts` has zero unit tests, it doesn't appear in `coverage/lcov.info` at all. A naive coverage gate that only iterates the LCOV file's `SF:` blocks will report "100% on the 3 files we measured" and pass — silently leaving 11 use case files at 0%.

**Why it happens:** Bun's coverage instrumentation hooks into `import` — files never imported during a test run aren't tracked.

**How to avoid:** Coverage gate MUST enumerate the expected file set from the filesystem (via `Bun.Glob`), then for each expected file LOOK UP its entry in the LCOV map. Files absent from LCOV are treated as 0% coverage. The skeleton in §1 above does this correctly.

**Warning signs:**
- Coverage gate passes with output like "Lines: 100%" but there are obvious untested files in `src/`
- Gate doesn't print a per-file failure list
- New file added to `src/**/domain/` doesn't trigger gate failure even with no test

### Pitfall 2: `drizzle-kit generate` artifact pollutes the workspace

**What goes wrong:** Developer runs `bun run db:generate --name=ci-drift` locally to test the drift detection, drizzle-kit creates `drizzle/0003_ci-drift.sql` with junk content, developer commits it.

**Why it happens:** Drift detection only runs in CI; locally there's no automatic cleanup.

**How to avoid:**
- Document in README/AGENTS that `--name=ci-drift` is a CI-only naming convention
- The CI `bun run db:generate --name=ci-drift` step ALREADY runs against a clean checkout, so any artifact only exists in the CI workspace and is discarded
- If a developer accidentally commits a `ci-drift` file, code review catches the suspicious filename

**Warning signs:** A migration named `*_ci-drift.sql` appears in a PR.

### Pitfall 3: BetterAuth cookie name changes silently when `cookiePrefix` config flips

**What goes wrong:** Quickstart documents `Cookie: better-auth.session_token=...`. Someone changes BetterAuth config to `{ advanced: { cookiePrefix: 'rigging' } }` for vanity, and now the cookie name is `rigging.session_token` and quickstart breaks.

**Why it happens:** BetterAuth config change cascades into auth instance behavior; docs don't track config changes.

**How to avoid:**
- Quickstart curl examples use `-c cookies.txt -b cookies.txt` (cookie jar) so the actual cookie name is hidden behind curl's mechanics. This is robust to config changes.
- If you DO show the literal `Cookie: header` form for didactic purposes, add a note: "cookie name comes from BetterAuth config; default is `better-auth.session_token`".

### Pitfall 4: GitHub Actions `services: postgres` host networking confusion

**What goes wrong:** Developer copies the `services:` block but uses `DATABASE_URL=postgres://...@postgres:5432/...` (the service name) instead of `localhost`. CI fails because the test runner runs on the host, not in a container.

**Why it happens:** The "service container vs container job" distinction in GitHub Actions docs is subtle.

**How to avoid:** Use `localhost:5432` in `DATABASE_URL` whenever the job has `runs-on: ubuntu-latest` (host runner). Only use the service name (`postgres:5432`) when `container:` is also declared on the job.

### Pitfall 5: E2E test cleanup missed → next CI run sees stale data

**What goes wrong:** E2E test creates a user `e2e-dogfood-1700000000000@example.test`, but cleanup throws or the test fails before `afterAll`. Next CI run inherits the row, integration assertions on row count drift.

**Why it happens:** `afterAll` doesn't run if the entire describe block fails to even start (e.g., import error).

**How to avoid:**
- Use timestamp + random suffix in test emails (`e2e-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`) so collisions are essentially impossible.
- Cleanup is best-effort: if a test leaves stale data, the next test has its own namespaced data and isn't affected.
- For the test database (`rigging_test` in CI), each CI run is on a fresh service container — no state survives between runs anyway.

### Pitfall 6: README Quickstart command order matters

**What goes wrong:** Quickstart says `bun install` THEN `bun run db:migrate`, but user copies `docker-compose up -d` from a later step → tries `bun run db:migrate` before postgres is ready → connection refused.

**Why it happens:** docker-compose `up -d` returns when the container starts, NOT when postgres is ready to accept connections.

**How to avoid:** Quickstart MUST include a brief healthcheck step OR rely on docker-compose.yml's healthcheck (which IS configured: `pg_isready` interval 5s, retries 10). Recommend: tell user to wait `~10s` after `docker-compose up -d`, OR `docker-compose up -d --wait` (compose v2.20+ flag).

---

## Code Examples

### Coverage gate complete script

See §1 "Bun coverage JSON format" for full implementation.

### bunfig.toml [test] block

See §2 "bunfig.toml [test] coverage syntax" for exact TOML.

### `.github/workflows/ci.yml` complete

See §3 "GitHub Actions postgres services pattern" for full skeleton.

### Three e2e test files

See §6 "E2E helper organization" for `_helpers.ts`; see "Pattern: E2E test" for `dogfood-happy-path.test.ts` skeleton.

The other two follow the same pattern:

**`password-reset-session-isolation.test.ts`** — sign up, sign in (session A + apiKey K), trigger password reset (`POST /api/auth/forget-password`), follow reset link from email outbox (`harness.emailOutbox.reset`), `POST /api/auth/reset-password` with new password, assert session A returns 401, assert apiKey K still returns 200 (apiKey is independent of password reset). Pattern: 5 sequential `test()` blocks sharing harness state.

**`cross-user-404-e2e.test.ts`** — set up user A + user B (two `setupUser` calls), user A creates Agent X, user B requests `GET /agents/X-id` via cookie → 404, user B creates apiKey, user B requests same path with `x-api-key` → 404. Pattern: parallel multi-user setup in `beforeAll`, two assertions in body.

---

## State of the Art

| Old Approach (in current repo) | Current Approach (post-Phase 5) | When Changed | Impact |
|-------------------------------|----------------------------------|--------------|--------|
| `scripts/ensure-agent-schema.ts` (manual `CREATE TABLE IF NOT EXISTS`) | `bun run db:migrate` (drizzle-kit migrate, single source of truth) | Phase 5 D-05 | Removes ~50 lines of P4 technical debt; `test` script becomes idempotent |
| Single CI job (lint + typecheck + test serial) | 3 parallel jobs + postgres service + coverage gate + drift check | Phase 5 D-11/12/13 | CI total time: ~max(2-3 min) instead of current ~4-5 min serial |
| `bunfig.toml` placeholder `[test]` (P1 zero-config) | Full coverage config + ignore patterns | Phase 5 D-03-A | Coverage report becomes meaningful + gate-able |
| README "Phase 1 underway" status block | Narrative-first README with Why Rigging + Quickstart CTA | Phase 5 D-14 | First-screen comprehension for external visitors |
| ADR 0017 = last ADR (no testcontainers deviation recorded) | ADR 0018 documents docker-compose-vs-testcontainers reasoning | Phase 5 ADR 0018 | Audit trail for the QA-02 deviation; future contributors understand why |

**Deprecated / outdated:**
- `bun.lockb` (binary lockfile) — Bun 1.2+ defaults to text `bun.lock`. This repo already uses `bun.lock` (verified: `cat bun.lock | head` shows JSON). Keep as-is.
- `--coverage-reporter=json-summary` — DOES NOT EXIST in Bun 1.3.x. Use `lcov`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A timestamp+random e2e email suffix is collision-free for practical purposes | Pitfall #5 | Effectively zero — `Date.now()*Math.random()` collision in same ms is ~10^-12 |
| A2 | GitHub Actions postgres service health-cmd `pg_isready -U postgres -d rigging_test` is sufficient before migrations run | §3 CI skeleton | Low — health-cmd has 5 retries × 10s = 50s window; adequate for postgres:16-alpine cold start (~3s typical) |
| A3 | Adding `coverage/` to .gitignore is safe (no committed coverage artifacts) | Runtime State Inventory | None — `coverage/` is regenerated by every test run |
| A4 | Plan count of 4 (D-18 estimate) is correct for actual workload | "Implementation Roadmap" below | Low — researcher's roadmap section recommends slight refinement (split 05-01 into a/b if unit backfill is heavy) |
| A5 | The 3 D-09 e2e journeys cover Success Criterion #1 (10-min onboarding via session AND API Key paths) | Validation Architecture | Low — journey 1 explicitly exercises both auth paths in sequence |

**For risks where research could not eliminate uncertainty:** see "Risks & Mitigations" section below.

---

## Open Questions

1. **CI: should coverage upload to Codecov / similar service?**
   - What we know: D-06-C grants researcher discretion; CI artifact upload pattern shown in §3 skeleton (lcov.info as 7-day artifact).
   - What's unclear: whether the project has a Codecov account / wants PR comments with coverage diff.
   - Recommendation: ship with `actions/upload-artifact` only (no third-party SaaS). PR comment bot adds maintenance burden disproportionate to a small contributor pool. Revisit when contributor PRs hit ~weekly cadence.

2. **AGENTS.md TOC: include or omit "Further reading" item?**
   - What we know: D-17-A specifies 5 items including "Further reading" pointing to architecture/decisions/PROJECT.
   - What's unclear: whether linking to `.planning/PROJECT.md` from AGENTS.md is intended (planning artifacts are usually internal-facing).
   - Recommendation: include `[docs/architecture.md](docs/architecture.md) · [docs/decisions/](docs/decisions/README.md)` and OMIT `.planning/PROJECT.md` from AGENTS.md TOC. Project-level positioning should come through AGENTS.md's own body, not a meta-reference.

3. **README: include CI status badge?**
   - What we know: D-14-C allows but doesn't require it.
   - Recommendation: include after first green CI on main. Use the GitHub-native badge URL: `![CI](https://github.com/<org>/<repo>/actions/workflows/ci.yml/badge.svg)`. Place above-the-fold near tagline.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | All test infra | ✓ | 1.3.10 (target ^1.3.12) | Upgrade via `bun upgrade` if needed |
| Docker | docker-compose postgres for local + CI matches via service container | (varies by dev machine) | — | quickstart documents `docker-compose up -d`; CI uses native service container |
| PostgreSQL 16 | Drizzle migrations + integration/e2e tests | (via docker) | 16-alpine | Local docker container; CI service container |
| GitHub Actions runners | CI (lint / typecheck / test jobs) | ✓ via repo | ubuntu-latest | None — CI is GitHub Actions only |
| `oven-sh/setup-bun@v2` | All CI jobs | ✓ | v2.2.0 latest | Pin to v2 (already in current ci.yml) |
| `actions/cache@v4` | CI bun deps caching | ✓ | v4 | Skip cache if action unavailable (slower CI but functional) |
| `actions/checkout@v4` | All CI jobs | ✓ | v4 | None — required |
| `actions/upload-artifact@v4` | Coverage artifact upload | ✓ | v4 | Skip artifact upload (CI still works, just less observable) |
| `drizzle-kit` 0.31.10 | Migration drift check | ✓ | 0.31.10 | Already in package.json |
| `mermaid` rendering | docs/architecture.md diagrams | ✓ (GitHub native) | n/a | If reading docs locally without GitHub, use VSCode mermaid preview extension |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — all required infrastructure is in place.

---

## Validation Architecture

**Phase 5 is a Validation phase by design.** Its entire job is to establish the validation gates that prove P1-P4 actually work end-to-end. Per Nyquist sampling principle: each phase requirement must have at least one automated test that fails when the requirement regresses.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `bun:test` (built-in to Bun 1.3.x) |
| Config file | `bunfig.toml` (extended in Plan 05-01 with `[test] coverage = true`) |
| Quick run command | `bun test tests/unit` (~280ms for 104 tests) |
| Full suite command | `bun run db:migrate && bun test` (~30-60s with integration + e2e) |
| Coverage command | `bun test --coverage --coverage-reporter=lcov` (writes `coverage/lcov.info`) |
| Coverage gate command | `bun run coverage:gate` (reads lcov, exits 1 on <80%) |
| CI test command | `bun run test:ci` (= `bun test --coverage --coverage-reporter=lcov`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| QA-01 | Coverage ≥80% on src/**/domain/ + src/**/application/ | gate-script | `bun run coverage:gate` | ❌ Wave 0 (script + bunfig) |
| QA-02 | Integration tests cover register/verify/login/reset/API Key CRUD | integration | `bun test tests/integration/auth` | ✅ (16 files exist; passes today) |
| QA-03 | Regression suite covers CVE / bypass / session-fix / hashing / cascade | regression | `bun run test:regression` (= `bun test tests/**/*.regression.test.ts`) | ❌ Wave 0 (8 regression files exist; script alias needed) |
| QA-04 | E2E covers demo domain user flows | e2e | `bun test tests/e2e` | ❌ Wave 0 (3 files + helpers needed) |
| QA-05 | `bun install --frozen-lockfile && bun test` passes | clean-checkout | CI job `test` (after `bun install --frozen-lockfile`) | ❌ Wave 0 (CI rewrite) |
| CI-01 | CI runs lint + typecheck + test + drift on every PR | meta | GitHub Actions `ci.yml` workflow | ❌ Wave 0 (rewrite) |
| CI-02 | Migration drift fails CI when schema diverges | shell | CI step `git status --porcelain drizzle/` after `db:generate` | ❌ Wave 0 (CI step) |
| CI-03 | CI runs in clean checkout | meta | GitHub Actions `actions/checkout@v4` + `oven-sh/setup-bun@v2` + `--frozen-lockfile` | ✓ (already does this; will continue) |
| DOC-01 | README first-screen = Core Value not file layout | manual | Visual review of `README.md` first 70 lines | ❌ Wave 0 (rewrite) |
| DOC-02 | quickstart.md 10-min path executable | manual + smoke | New contributor walks through manually; smoke command list verified by hand | ❌ Wave 0 (write) |
| DOC-03 | architecture.md covers DDD + AuthContext + dual identity | manual | Visual review of `docs/architecture.md` + mermaid renders correctly on GitHub | ❌ Wave 0 (write) |
| DOC-04 | docs/decisions/README.md ADR index has status per row | grep | `grep '|' docs/decisions/README.md \| grep -c 'accepted\|proposed\|deprecated'` ≥ 18 | ✓ (already does this for 0000-0017; add 0018 row) |
| DOC-05 | AGENTS.md has "AI Agent 接手本專案前必讀" section + Rigidity Map + anti-features | grep | `grep -c '^## ' AGENTS.md` ≥ 5 (TOC + Rigidity Map + anti-features sections) | ❌ Wave 0 (TOC + rename) |

### Sampling Rate

- **Per task commit (TDD inner loop):** `bun test tests/unit` (~280ms — fast enough to run after every save)
- **Per wave merge:** `bun run db:migrate && bun test` (~30-60s — runs full suite incl. integration + e2e)
- **Phase gate:** Full suite green + coverage gate passes + manual quickstart walkthrough by external observer + `looks-done-but-isnt` checklist (Success Criterion #5) — before `/gsd-verify-work`

### "Looks Done But Isn't" Checklist (Success Criterion #5)

Mechanical checks that should ALL pass before Phase 5 close:

- [ ] `grep -l 'Status: proposed' docs/decisions/*.md` returns NO files (all 18 ADRs are accepted)
- [ ] `bun run test:regression` runs and exits 0 (regression suite is independently runnable)
- [ ] `grep -n '## AI Agent' AGENTS.md` returns at least one line near top
- [ ] `grep -rn '@ts-ignore\|@ts-expect-error' src/auth/ src/agents/` returns no auth-critical hits
- [ ] `bun run coverage:gate` exits 0
- [ ] `cat README.md | head -20` shows Core Value before any file/folder discussion
- [ ] `docs/quickstart.md` exists and includes both `/api/auth/sign-in/email` AND `x-api-key` header
- [ ] `docs/architecture.md` exists with at least 3 ` ```mermaid ` code blocks
- [ ] CI status: most recent run on `main` is green
- [ ] `cat .github/workflows/ci.yml | grep -c '^  jobs:\|^  [a-z]*:$'` shows 3 jobs (lint / typecheck / test)

### Wave 0 Gaps

The following infrastructure must be created in Plan 05-01 (Wave 0) before plans 05-02/03/04 can complete:

- [ ] `bunfig.toml [test]` block extension — covers all gate plans
- [ ] `scripts/coverage-gate.ts` — needed for CI step
- [ ] `package.json` scripts: `test:regression`, `test:coverage`, `test:ci`, `coverage:gate`
- [ ] DELETE `scripts/ensure-agent-schema.ts` + remove from `test` script
- [ ] `tests/e2e/_helpers.ts` — needed for 3 e2e tests in Plan 05-02
- [ ] 11 unit test files for use cases + 3 entity unit tests + 3 error class instantiation tests (Plan 05-01 unit backfill — gate cannot pass without)
- [ ] `.github/workflows/ci.yml` rewrite — CI green is gate for Phase 5 close
- [ ] `coverage/` added to `.gitignore` if missing

*(Test files for QA-02 already exist; for QA-03 they exist; QA-04 is Plan 05-02; rest are CI / docs work.)*

---

## Implementation Roadmap

Recommended plan execution order (refines D-18 estimate):

### Plan 05-01: Test Infrastructure (foundation for everything else)

**Why first:** Coverage gate, scripts, and unit-test backfill have NO external dependencies. Until they exist, plans 05-02 (e2e) and 05-03 (CI) cannot reach a green state.

**Scope:**
- `bunfig.toml [test]` extension (D-03-A modified per §2 — drop json-summary, use lcov)
- `scripts/coverage-gate.ts` (per skeleton in §1)
- `package.json` scripts:
  ```json
  "test": "bun run db:migrate && bun test",
  "test:ci": "bun test --coverage --coverage-reporter=lcov",
  "test:coverage": "bun test --coverage && bun run coverage:gate",
  "test:regression": "bun test tests/**/*.regression.test.ts",
  "coverage:gate": "bun run scripts/coverage-gate.ts"
  ```
- DELETE `scripts/ensure-agent-schema.ts`
- Add `coverage/` to `.gitignore` (verify first; may already exist)
- **Unit test backfill (~14-17 new files):**
  - 8 agents use cases: `delete-agent`, `delete-eval-dataset`, `get-agent`, `get-eval-dataset`, `get-prompt-version`, `list-agents`, `list-eval-datasets`, `list-prompt-versions`
  - 4 auth use cases: `verify-email`, `list-api-keys`, `request-password-reset`, `revoke-api-key` (the last has potential overlap with create — verify)
  - 3 entity tests: `agent.ts`, `eval-dataset.ts`, `prompt-version.ts` (factory invariants)
  - 3 error instantiation tests: `agents/domain/errors.ts`, `auth/domain/errors.ts`, `auth/domain/internal/authcontext-missing-error.ts`
- Verify `bun run test:coverage` passes locally with gate green

**Recommendation: Plan 05-01 may need to split** if unit backfill is heavy:
- **05-01a:** scripts + config + bunfig + ensure-agent-schema deletion (small, ~1 hour)
- **05-01b:** unit test backfill (medium, ~3-4 hours; can be parallel-tasked since each test file is independent)

### Plan 05-02: E2E (independent of 05-03/04)

**Why second:** E2E tests depend ONLY on Plan 05-01's test infrastructure (specifically the bunfig + scripts) being in place. Can run in parallel with 05-03 if CI rewrite is split off.

**Scope:**
- `tests/e2e/_helpers.ts` (per §6 recommendation — re-export from `tests/integration/auth/_helpers.ts` + add `setupUser` / `cleanupUser` / `makeE2eHarness`)
- `tests/e2e/dogfood-happy-path.test.ts` (per skeleton in "Pattern: E2E test")
- `tests/e2e/password-reset-session-isolation.test.ts`
- `tests/e2e/cross-user-404-e2e.test.ts`
- (Optional) `tests/e2e/README.md` documenting "what's an e2e vs integration test" convention

### Plan 05-03: CI Rewrite

**Why third:** CI must run after Plan 05-01 and 05-02 ship — otherwise the `coverage:gate` and `tests/e2e/` paths CI invokes don't exist locally. Coupling these plans risks a green local but red CI.

**Scope:**
- `.github/workflows/ci.yml` rewrite (per §3 skeleton)
- Verify postgres service connection during local push to a test branch (or via `act` if installed)
- Adjust `docker-compose.yml` if needed (D-12-C) — currently uses `rigging`/`rigging_dev_password` not matching CI's `postgres`/`postgres`/`rigging_test`. **Recommendation: keep them different intentionally** — local dev DB ≠ CI test DB by design. Document this in quickstart.

### Plan 05-04: Docs Ship

**Why last:** All previous plans must ship their actual filenames + script names + commands so docs can reference them accurately.

**Scope:**
- `README.md` rewrite (D-14) — per §11
- `docs/quickstart.md` create (D-15) — per "Quickstart 10-Minute Path" command list
- `docs/architecture.md` create (D-16) — per §10 mermaid blocks + D-16-B regression map table + D-16-C test convention section
- `AGENTS.md` top TOC + L197 rename (D-17) — per §8 (HTML anchor approach)
- `docs/decisions/README.md` add 0018 row + status audit (per §7)
- `docs/decisions/0018-testcontainers-deviation-via-docker-compose.md` create (per §7 filename + MADR 4.0 status: accepted)
- (Optional) `tests/README.md` for D-04-A test convention if not folded into architecture.md

### Phase 5 Exit Gate

After all 4 plans merge:
1. Run all "Looks Done But Isn't" checklist items above
2. Manual smoke: external person walks through quickstart.md on a clean machine, completes path A + path B in ≤10 min
3. `/gsd-verify-work` to confirm all REQ-IDs (QA-01..05, CI-01..03, DOC-01..05) have evidence
4. `/gsd-transition` to mark milestone v1.0 complete

---

## Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R1 | Bun coverage format changes in 1.3.x patch release (e.g., LCOV `LH` becomes `LH_p`) | LOW | HIGH (gate breaks silently) | Pin Bun version in CI (`bun-version: 1.3.12` already pinned). Add a smoke test in `coverage-gate.ts` that fails loudly on unrecognized LCOV shape. |
| R2 | Migration drift step false positive (drizzle-kit emits `\n` diff or trivial whitespace change) | LOW | MEDIUM (CI red on clean schema) | Verified live in this repo — drizzle-kit 0.31.10 produces NO file when clean. If a future drizzle-kit version changes this, the CI step's `git diff drizzle/` output gives the developer immediate diagnostic. |
| R3 | CI postgres service starts but isn't ready when `db:migrate` runs | LOW | MEDIUM (flaky CI) | Health-cmd `pg_isready` with retries 5 × interval 10s = 50s window; postgres:16-alpine cold start is ~3s. Margin is 17×. If still flaky, add explicit `pg_isready` wait step. |
| R4 | E2E test runtime budget exceeds CI minute limit | LOW | LOW (CI slow but green) | D-09-B estimates 3 e2e tests × ~5s = 15-30s total. CI test job total budget is 5min; e2e is 10% of budget. Acceptable. |
| R5 | BetterAuth 1.6.5 → 1.6.6 silent cookie name format change | LOW | MEDIUM (quickstart curl breaks) | BetterAuth pinned exact `1.6.5` (no caret) per ADR 0004. Future BetterAuth bump is an explicit ADR-tracked decision, not silent drift. |
| R6 | Mermaid render breaks on a renderer that doesn't support flowchart subgraph syntax | LOW | LOW (visual diagram absent on non-GitHub) | GitHub renders all 3 diagrams correctly (verified syntax against GitHub mermaid blog post). For non-GitHub renderers (e.g., npm registry), text prose around each diagram is self-sufficient. |
| R7 | `tests/e2e/_helpers.ts` re-export creates circular import or module evaluation issue | LOW | MEDIUM (e2e tests don't load) | Pattern already proven in `tests/integration/agents/_helpers.ts`. Re-export is a thin shim; no circular risk. |
| R8 | Plan 05-01 unit backfill takes longer than expected | MEDIUM | LOW (Phase 5 schedule slips by 1 day) | 14 use case files at ≤30 lines each = ~400 LoC total. Each test follows established pattern in `tests/unit/agents/*.test.ts`. Parallelize across multiple sessions if needed. |
| R9 | New CI workflow triggers more concurrent runs than expected, hitting GitHub Actions billing | LOW | LOW | `concurrency: cancel-in-progress: true` per D-11-D limits this. PR force-pushes cancel previous runs. |
| R10 | docker-compose port 5432 conflict with developer's existing postgres install | MEDIUM | LOW | Quickstart documents the conflict + remediation: `docker-compose down` other postgres containers OR change docker-compose.yml port mapping to e.g. `5433:5432`. |
| R11 | LCOV file contains paths with `./` prefix or absolute paths, breaking gate's path matching | LOW | HIGH (gate sees no matches → all files 0%) | Verified live: LCOV `SF:` paths in this repo are repo-relative (`src/agents/...`), no prefix. If this changes, normalize in `parseLcov` with `path.normalize()` + strip leading `./`. |
| R12 | `node:fs.existsSync` race condition in coverage-gate.ts | very LOW | LOW | Single-threaded script; runs after `bun test --coverage` exits. No race window. |

---

## References

### Files in this repository (verified live, 2026-04-20)

- `/Users/carl/Dev/CMG/Rigging/.planning/phases/05-quality-gate/05-CONTEXT.md` — 17 D-xx decisions
- `/Users/carl/Dev/CMG/Rigging/.planning/REQUIREMENTS.md` — 13 P5 REQ-IDs
- `/Users/carl/Dev/CMG/Rigging/.planning/STATE.md` — milestone state
- `/Users/carl/Dev/CMG/Rigging/.planning/ROADMAP.md` — Phase 5 goal + 5 success criteria
- `/Users/carl/Dev/CMG/Rigging/.planning/PROJECT.md` — Core Value
- `/Users/carl/Dev/CMG/Rigging/.planning/research/ARCHITECTURE.md` — DDD layering pattern source
- `/Users/carl/Dev/CMG/Rigging/.planning/research/STACK.md` — Bun/Elysia/Drizzle/BetterAuth versions
- `/Users/carl/Dev/CMG/Rigging/.planning/research/PITFALLS.md` — regression map source (Pitfall #1-#15)
- `/Users/carl/Dev/CMG/Rigging/.planning/phases/01-foundation/01-CONTEXT.md` — P1 16 D-xx (ADR template, Biome rules)
- `/Users/carl/Dev/CMG/Rigging/.planning/phases/02-app-skeleton/02-CONTEXT.md` — P2 16 D-xx (createApp, plugin ordering, error body shape)
- `/Users/carl/Dev/CMG/Rigging/.planning/phases/03-auth-foundation/03-CONTEXT.md` — P3 25 D-xx (BetterAuth, regression naming, ALLOWED_SCOPES)
- `/Users/carl/Dev/CMG/Rigging/.planning/phases/04-demo-domain/04-CONTEXT.md` — P4 17 D-xx (DEMO-04 dogfood, harness friction format)
- `/Users/carl/Dev/CMG/Rigging/AGENTS.md` — onboarding TOC target
- `/Users/carl/Dev/CMG/Rigging/README.md` — current state, rewrite per D-14
- `/Users/carl/Dev/CMG/Rigging/bunfig.toml` — placeholder, extend per D-03-A
- `/Users/carl/Dev/CMG/Rigging/package.json` — scripts to add per D-02-A/D-03-C/D-05-A/D-13-C
- `/Users/carl/Dev/CMG/Rigging/.github/workflows/ci.yml` — single-job, rewrite to 3 parallel
- `/Users/carl/Dev/CMG/Rigging/tests/integration/auth/_helpers.ts` — E2E helper template source (477 lines)
- `/Users/carl/Dev/CMG/Rigging/tests/integration/agents/_helpers.ts` — re-export pattern reference
- `/Users/carl/Dev/CMG/Rigging/docs/decisions/README.md` — ADR index, add 0018 row
- `/Users/carl/Dev/CMG/Rigging/docker-compose.yml` — postgres:16-alpine reference
- `/Users/carl/Dev/CMG/Rigging/src/auth/infrastructure/better-auth/auth-instance.ts` — BetterAuth config; cookie name source

### External documentation (verified 2026-04-20)

**Primary (HIGH confidence):**
- [Bun: bunfig.toml reference](https://bun.com/docs/runtime/bunfig) — `[test]` keys verified
- [Bun: bun test CLI](https://bun.com/docs/cli/test) — `--coverage`, `--coverage-reporter`, `--coverage-dir` flags
- [Drizzle Kit overview](https://orm.drizzle.team/docs/kit-overview) — `drizzle-kit generate --name=` syntax (verified live)
- [GitHub Actions: PostgreSQL service containers](https://docs.github.com/en/actions/using-containerized-services/creating-postgresql-service-containers) — postgres service pattern
- [GitHub Actions: concurrency](https://docs.github.com/en/actions/using-jobs/using-concurrency) — cancel-in-progress
- [GitHub: include diagrams in markdown](https://github.blog/developer-skills/github/include-diagrams-markdown-files-mermaid/) — mermaid native render
- [oven-sh/setup-bun](https://github.com/oven-sh/setup-bun) — v2 latest, version pinning
- [MADR 4.0 canonical](https://adr.github.io/madr/) — ADR 0018 format

**Secondary (MEDIUM confidence):**
- [BetterAuth getSessionCookie discussion](https://www.answeroverflow.com/m/1347345382878871623) — cookie name verification
- [actions/cache@v4](https://github.com/actions/cache) — bun deps caching pattern
- [Bun coverage discussion via WebFetch](https://bun.com/docs/cli/test) — confirmed only `text` and `lcov` reporters

**Tertiary (LOW confidence — flagged for validation if behavior shifts):**
- CJK markdown anchor cross-renderer compatibility — based on multiple GitHub issue threads + slugify libraries; not directly tested in non-GitHub renderers

### CVE / Security advisory (regression map references)
- [CVE-2025-61928](https://zeropath.com/blog/breaking-authentication-unauthenticated-api-key-creation-in-better-auth-cve-2025-61928)
- [OWASP Session Fixation](https://owasp.org/www-community/attacks/Session_fixation)
- [BetterAuth Security Advisories](https://github.com/better-auth/better-auth/security/advisories)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified live in `package.json`; no new deps needed
- Coverage gate design: HIGH — Bun behavior verified live (LCOV format, missing-files behavior, no json-summary support)
- CI skeleton: HIGH — GitHub Actions postgres + setup-bun + concurrency patterns verified against official docs
- Migration drift: HIGH — `drizzle-kit generate --name=ci-drift-test` ran live in this repo, confirmed no-op behavior
- BetterAuth cookie name: HIGH — verified in 3 places in this repo's existing test code + cross-checked external source
- E2E helper organization: HIGH — pattern already proven in `tests/integration/agents/_helpers.ts`
- Mermaid diagrams: HIGH (syntax) / MEDIUM (theme behavior across renderers — GitHub native works; non-GitHub varies)
- AGENTS.md anchor compatibility: MEDIUM — GitHub behavior verified; cross-renderer behavior inferred
- Unit backfill effort estimate: HIGH — 25 untested files enumerated live, each ≤30 LoC by pattern

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (30 days for stable infrastructure topics; revisit if Bun bumps minor version or BetterAuth changes major)

---

## RESEARCH COMPLETE
