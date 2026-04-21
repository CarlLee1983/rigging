# Phase 9: Scaffold Engine - Pattern Map

**Mapped:** 2026-04-20
**Files analyzed:** 6 new files
**Analogs found:** 4 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/create-rigging/bin/create-rigging.js` | utility (CLI entry) | file-I/O | `scripts/validate-adr-frontmatter.ts` | role-match |
| `packages/create-rigging/package.json` | config | — | `package.json` (root) | partial (different type field) |
| `scripts/build-template.js` | utility (build script) | file-I/O | `scripts/coverage-gate.ts` | role-match |
| `tests/unit/scaffold/substitution.test.ts` | test | — | `tests/unit/shared/kernel/errors.test.ts` | exact |
| `tests/unit/scaffold/extension-whitelist.test.ts` | test | — | `tests/unit/shared/kernel/errors.test.ts` | exact |
| `tests/unit/scaffold/cli-validation.test.ts` | test | — | `tests/unit/shared/kernel/errors.test.ts` | exact |
| `tests/integration/scaffold/cli-e2e.test.ts` | test (integration) | file-I/O | `tests/integration/app-skeleton-smoke.test.ts` | role-match |
| `.gitignore` (modify) | config | — | `.gitignore` (existing) | exact |

---

## Pattern Assignments

### `packages/create-rigging/bin/create-rigging.js` (utility, file-I/O)

**Analog:** `scripts/validate-adr-frontmatter.ts`

Note: The analog is a Bun/TypeScript script; `create-rigging.js` must be CommonJS (CJS) Node.js instead. The structural pattern — shebang, early validation, `process.exit(1)` on failure, single `main()` call at bottom — is identical.

**Shebang + strict mode** (validate-adr-frontmatter.ts line 1):
```javascript
#!/usr/bin/env node
'use strict';
```

**Imports pattern** — CJS equivalents of the analog's `import { readFileSync } from 'node:fs'` (validate-adr-frontmatter.ts line 8):
```javascript
const { existsSync, mkdirSync, readdirSync, statSync,
        readFileSync, writeFileSync, copyFileSync } = require('fs');
const path = require('path');
```

**Early-exit guard pattern** (validate-adr-frontmatter.ts lines 75-78 — arg validation):
```typescript
const paths = process.argv.slice(2).filter((a) => a.length > 0)
if (paths.length === 0) {
  fail('usage: validate-adr-frontmatter.ts <path> [path...]')
}
```
Copy this pattern for the Node version guard and project-name validation:
```javascript
// Node version guard (D-03)
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  process.stderr.write(
    `create-rigging requires Node.js >= 18. You have: v${process.versions.node}\n` +
    `Please upgrade Node.js: https://nodejs.org\n`
  );
  process.exit(1);
}

const projectName = process.argv[2];
if (!projectName) {
  console.error('Usage: create-rigging <project-name>');
  process.exit(1);
}
if (projectName === 'rigging') {
  console.error('Error: "rigging" conflicts with the template source name. Choose a different name.');
  process.exit(1);
}
```

**Error exit helper pattern** (validate-adr-frontmatter.ts lines 13-16):
```typescript
function fail(message: string): never {
  console.error(`::error::${message}`)
  process.exit(1)
}
```
Translate to CJS:
```javascript
function fail(message) {
  console.error(message);
  process.exit(1);
}
```

**File existence check pattern** (validate-adr-frontmatter.ts lines 47-51):
```typescript
try {
  raw = readFileSync(path, 'utf8')
} catch {
  fail(`${path}: cannot read file`)
}
```
Copy pattern for template directory check:
```javascript
if (!existsSync(templateDir)) {
  fail('Error: template directory not found. Run: node scripts/build-template.js');
}
```

**Extension whitelist + text substitution** — no analog exists; use RESEARCH.md patterns directly:
```javascript
const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.json', '.md',
                                  '.yml', '.yaml', '.toml', '.sql', '.txt']);
function isTextFile(filePath) {
  if (path.basename(filePath).startsWith('.env')) return true;
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function toTitleCase(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function substituteProjectName(content, name) {
  return content.replaceAll('rigging', name).replaceAll('Rigging', toTitleCase(name));
}
```

**Path traversal guard** (security — no analog, use RESEARCH.md):
```javascript
const resolvedDest = path.resolve(process.cwd(), projectName);
const cwd = process.cwd();
if (!resolvedDest.startsWith(cwd + path.sep) && resolvedDest !== cwd) {
  fail('Error: project name cannot contain path separators.');
}
if (existsSync(resolvedDest)) {
  fail(`Error: directory "${projectName}" already exists.`);
}
```

**Next-steps banner** (SCAF-07 verbatim from CONTEXT.md specifics):
```javascript
console.log(`\nDone! Your project is ready.\n`);
console.log(`  cd ${projectName}`);
console.log('  bun install');
console.log('  docker compose up -d');
console.log('  bun test');
console.log('');
```

---

### `packages/create-rigging/package.json` (config)

**Analog:** Root `package.json` (lines 1-46) — but the new package must differ in two critical ways:

1. `"type": "commonjs"` — the root declares `"type": "module"` (line 4); the CLI subpackage MUST override this to CJS so `require` and `__dirname` work.
2. `"private"` omitted — this package is published to npm.

**Pattern** (from RESEARCH.md Pattern 5 — verified against npm package.json spec):
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
  "files": ["bin/", "template/"],
  "engines": { "node": ">=18.0.0" },
  "license": "MIT"
}
```

---

### `scripts/build-template.js` (utility, file-I/O)

**Analog:** `scripts/coverage-gate.ts` (lines 1-144)

The analog is the closest existing build script: reads the filesystem, applies filtering logic, exits with a status code, runs standalone via `bun run scripts/...`. The new script follows the same pattern but uses `child_process.execSync` instead of `Bun.Glob`.

**Shebang + imports pattern** (coverage-gate.ts lines 1, 13-14):
```typescript
#!/usr/bin/env bun
import { existsSync, readFileSync } from 'node:fs'
```
Translate to CJS Node.js:
```javascript
#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const { mkdirSync, copyFileSync, existsSync, rmSync } = require('fs');
const path = require('path');
```

**Filtering pattern** (coverage-gate.ts lines 24-35 — EXCLUDE_PATTERNS array + `.some()` filter):
```typescript
const EXCLUDE_PATTERNS = [
  /\.test\.ts$/,
  /\/index\.ts$/,
  // ...
]
// Usage:
if (!EXCLUDE_PATTERNS.some((rx) => rx.test(f))) files.add(f)
```
Translate to prefix-based exclusion:
```javascript
const EXCLUDE_PREFIXES = ['.planning/', 'packages/'];
const toInclude = tracked.filter(f =>
  !EXCLUDE_PREFIXES.some(prefix => f.startsWith(prefix))
);
```

**File existence check before proceeding** (coverage-gate.ts lines 88-93):
```typescript
if (!existsSync(LCOV_PATH)) {
  console.error(`✗ ${LCOV_PATH} not found — ...`)
  process.exit(2)
}
```
Translate to template destination clean-up:
```javascript
if (existsSync(templateDest)) {
  rmSync(templateDest, { recursive: true, force: true });
}
```

**Progress/count reporting pattern** (coverage-gate.ts lines 126-129):
```typescript
console.log(`Coverage rollup (${expected.length} files ...):`)
```
Translate to:
```javascript
console.log(`build-template: copied ${count} files to ${templateDest}`);
```

**`git ls-files` source enumeration** — no analog, use RESEARCH.md Pattern 4:
```javascript
const repoRoot = path.join(__dirname, '..');  // scripts/ -> repo root
const tracked = execSync('git ls-files', { cwd: repoRoot })
  .toString().split('\n').filter(Boolean);
```

---

### `tests/unit/scaffold/substitution.test.ts` (test, unit)

**Analog:** `tests/unit/shared/kernel/errors.test.ts` (lines 1-38)

**Imports pattern** (errors.test.ts lines 1-11):
```typescript
import { describe, expect, test } from 'bun:test'
import {
  ConflictError,
  // ...
} from '@/shared/kernel/errors'
```
Translate for scaffold — import the pure functions from the CLI:
```javascript
import { describe, expect, test } from 'bun:test'
// Pure functions extracted from create-rigging.js for unit testability
import { substituteProjectName, isTextFile, toTitleCase } from '../../../packages/create-rigging/bin/create-rigging.js'
```
Note: The pure helper functions must be exported from `create-rigging.js` to allow unit testing, or extracted into a separate `lib.js` module.

**Table-driven test pattern** (errors.test.ts lines 15-26):
```typescript
const cases = [
  [ValidationError, 400, 'VALIDATION_ERROR'],
  // ...
] as const

for (const [Ctor, status, code] of cases) {
  test(`${Ctor.name} maps to ${status}`, () => {
    // ...
  })
}
```
Apply to substitution tests:
```javascript
const cases = [
  ['rigging', 'my-app', '"name": "my-app"', '"name": "rigging"'],
  ['rigging', 'my-app', 'container_name: my-app-postgres', 'container_name: rigging-postgres'],
]
for (const [, projectName, expected, input] of cases) {
  test(`substituteProjectName: "${input}" → "${expected}"`, () => {
    expect(substituteProjectName(input, projectName)).toBe(expected)
  })
}
```

---

### `tests/unit/scaffold/extension-whitelist.test.ts` (test, unit)

**Analog:** `tests/unit/shared/kernel/errors.test.ts` (lines 1-38)

Same imports pattern as above. Table-driven tests covering `isTextFile()`:

```javascript
import { describe, expect, test } from 'bun:test'

const textFiles = ['.ts', '.tsx', '.js', '.json', '.md', '.yml', '.yaml', '.toml', '.sql', '.txt']
const binaryFiles = ['.lock', '.png', '.woff2', '.ico', '.pdf']
const envFiles = ['.env.example', '.env.local', '.env.test']

for (const ext of textFiles) {
  test(`isTextFile: file${ext} → true`, () => {
    expect(isTextFile(`src/foo${ext}`)).toBe(true)
  })
}
for (const ext of binaryFiles) {
  test(`isTextFile: file${ext} → false`, () => {
    expect(isTextFile(`bun${ext}`)).toBe(false)
  })
}
for (const name of envFiles) {
  test(`isTextFile: ${name} → true (env whitelist)`, () => {
    expect(isTextFile(name)).toBe(true)
  })
}
```

---

### `tests/unit/scaffold/cli-validation.test.ts` (test, unit)

**Analog:** `tests/unit/shared/kernel/errors.test.ts` (lines 1-38)

Tests for pure validation logic (extracted from CLI as standalone functions):

```javascript
import { describe, expect, test } from 'bun:test'

describe('validateProjectName', () => {
  test('empty string → invalid', () => { ... })
  test('"rigging" → invalid (reserved)', () => { ... })
  test('"my-app" → valid', () => { ... })
  test('"../evil" → invalid (path traversal)', () => { ... })
})

describe('nodeVersionCheck', () => {
  test('v17.x → returns false', () => { ... })
  test('v18.0.0 → returns true', () => { ... })
  test('v22.x → returns true', () => { ... })
})
```

---

### `tests/integration/scaffold/cli-e2e.test.ts` (test, integration, file-I/O)

**Analog:** `tests/integration/app-skeleton-smoke.test.ts` (lines 1-135)

The smoke test is the closest integration analog: it invokes `createApp` end-to-end and asserts on the output rather than individual functions. The CLI E2E test follows the same lifecycle: setup (build template + run CLI), assert on filesystem output, teardown.

**Lifecycle pattern** (app-skeleton-smoke.test.ts lines 1-8, but adapted from human-happy-path.test.ts lines 1-15 which uses beforeAll/afterAll):
```typescript
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
```
Translate to CLI E2E:
```javascript
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { execSync } from 'child_process'
import { existsSync, rmSync, readFileSync } from 'fs'
import path from 'path'

const REPO_ROOT = path.join(import.meta.dir, '../../..')
const PROJECT_NAME = 'test-scaffold-output'
const DEST = path.join(REPO_ROOT, PROJECT_NAME)

describe('create-rigging CLI (integration)', () => {
  beforeAll(() => {
    // Step 1: build template (Pitfall 2 from RESEARCH.md)
    execSync('node scripts/build-template.js', { cwd: REPO_ROOT })
    // Step 2: run CLI
    execSync(`node packages/create-rigging/bin/create-rigging.js ${PROJECT_NAME}`, { cwd: REPO_ROOT })
  })

  afterAll(() => {
    if (existsSync(DEST)) rmSync(DEST, { recursive: true, force: true })
  })

  // ... assertions
})
```

**Assertion pattern** (app-skeleton-smoke.test.ts lines 28-44):
```typescript
test('/health → 200 on DB up + x-request-id UUID v4 echoed', async () => {
  const app = createApp(TEST_CONFIG, { ... })
  const res = await app.handle(new Request('http://localhost/health'))
  expect(res.status).toBe(200)
  // ...
})
```
Translate to filesystem assertions:
```javascript
test('SCAF-03: src/ directory exists in output', () => {
  expect(existsSync(path.join(DEST, 'src'))).toBe(true)
})

test('SCAF-04: package.json name is substituted', () => {
  const pkg = JSON.parse(readFileSync(path.join(DEST, 'package.json'), 'utf8'))
  expect(pkg.name).toBe(PROJECT_NAME)
  expect(pkg.name).not.toContain('rigging')
})

test('SCAF-05: .planning/ absent from output', () => {
  expect(existsSync(path.join(DEST, '.planning'))).toBe(false)
})

test('SCAF-06: .env.example present', () => {
  expect(existsSync(path.join(DEST, '.env.example'))).toBe(true)
  const content = readFileSync(path.join(DEST, '.env.example'), 'utf8')
  expect(content).toContain('DATABASE_URL')
  expect(content).toContain('BETTER_AUTH_SECRET')
})
```

---

### `.gitignore` (modify)

**Analog:** Existing `.gitignore` (lines 1-40).

**Pattern:** Append a new section at the bottom following the existing `#comment\nentry` style (lines 38-40 show `#omx\n.omx`):
```
# Scaffold engine — template/ is built by scripts/build-template.js, not tracked
packages/create-rigging/template/
```
The path `packages/create-rigging/template/` is unambiguous (RESEARCH Pitfall 4 — avoids collision with `src/_template/`).

---

## Shared Patterns

### Shebang + Strict Mode
**Source:** `scripts/validate-adr-frontmatter.ts` line 1, `scripts/coverage-gate.ts` line 1
**Apply to:** `packages/create-rigging/bin/create-rigging.js`, `scripts/build-template.js`

Bun scripts use `#!/usr/bin/env bun`. Node.js scripts use:
```javascript
#!/usr/bin/env node
'use strict';
```

### Process Exit Pattern
**Source:** `scripts/validate-adr-frontmatter.ts` lines 13-16, `scripts/smoke-health.ts` lines 39-42
**Apply to:** Both `create-rigging.js` and `build-template.js`
```typescript
// validate-adr-frontmatter.ts — typed fail helper
function fail(message: string): never {
  console.error(`::error::${message}`)
  process.exit(1)
}

// smoke-health.ts — catch-all at main() call site
main().catch((err) => {
  console.error('✗ Smoke threw:', err)
  process.exit(1)
})
```
CJS translation:
```javascript
function fail(message) {
  console.error(message);
  process.exit(1);
}
// ...
main();
```

### Existence Check Before Proceeding
**Source:** `scripts/coverage-gate.ts` lines 88-93, `scripts/validate-adr-frontmatter.ts` lines 47-51
**Apply to:** `create-rigging.js` (check dest dir), `build-template.js` (check/clean template dir)
```typescript
if (!existsSync(LCOV_PATH)) {
  console.error(`✗ ${LCOV_PATH} not found ...`)
  process.exit(2)
}
```

### bun:test Import Pattern
**Source:** `tests/unit/shared/kernel/errors.test.ts` line 1
**Apply to:** All four test files
```typescript
import { describe, expect, test } from 'bun:test'
// For integration tests with lifecycle:
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
```

### Relative Import Paths in Tests
**Source:** `tests/unit/shared/kernel/errors.test.ts` lines 2-10 (uses `@/` alias for src imports), `tests/unit/health/health.controller.test.ts` lines 3-5 (uses `../../../src/`)
**Apply to:** Unit scaffold tests

The `@/` alias only resolves for `src/**` paths. Test files importing from `packages/` must use relative paths:
```javascript
// For unit tests that import helpers extracted from the CLI:
import { substituteProjectName, isTextFile } from '../../../packages/create-rigging/bin/create-rigging.js'
```

### biome.json scope exclusion
**Source:** `biome.json` lines 8-10 — `"files": { "includes": ["src/**", "tests/**"] }`
**Apply to:** `packages/create-rigging/` — this directory is already excluded from Biome's scope because the `includes` allowlist covers only `src/**` and `tests/**`. No modification to `biome.json` needed for the CJS CLI package.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/create-rigging/bin/create-rigging.js` (substitution + walk logic) | utility | file-I/O | No file-walk-with-substitution scripts exist in codebase; Node.js CJS scripts also absent (all existing scripts are Bun/TypeScript) |
| `scripts/build-template.js` (git ls-files enumeration) | utility | file-I/O | No scripts that invoke `child_process.execSync` or use `git` programmatically exist in the codebase |

For these sections, use the verified patterns from RESEARCH.md §Code Examples directly.

---

## Metadata

**Analog search scope:** `scripts/`, `tests/unit/`, `tests/integration/`, root config files
**Files scanned:** 9 (coverage-gate.ts, smoke-health.ts, validate-adr-frontmatter.ts, health.controller.test.ts, errors.test.ts, app-skeleton-smoke.test.ts, human-happy-path.test.ts, create-agent.usecase.test.ts, package.json)
**Pattern extraction date:** 2026-04-20
