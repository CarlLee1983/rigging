---
phase: 09-scaffold-engine
reviewed: 2026-04-20T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - packages/create-rigging/package.json
  - packages/create-rigging/lib/helpers.js
  - packages/create-rigging/bin/create-rigging.js
  - scripts/build-template.js
  - tests/unit/scaffold/substitution.test.ts
  - tests/unit/scaffold/extension-whitelist.test.ts
  - tests/unit/scaffold/cli-validation.test.ts
  - tests/integration/scaffold/cli-e2e.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-04-20
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

The scaffold engine implementation is structurally sound. The Node version guard, path
traversal defense-in-depth (helper validation + CLI `path.resolve` check), extension
whitelist, and template build pipeline all follow the design notes correctly.

Three issues of meaningful consequence were found:

1. `substituteProjectName` produces corrupted output when the project name itself contains
   the substring `Rigging` (capital R) — a correctness bug that silently produces wrong
   output in generated files.
2. `scripts/` is missing from `EXCLUDE_PREFIXES` in `build-template.js`, meaning
   `scripts/build-template.js` (and related scripts) are copied verbatim into the generated
   project, where they reference `packages/create-rigging/` which does not exist — broken
   tooling in every generated project.
3. `validateProjectName` does not block `.` as a project name. The CLI's `existsSync` guard
   catches this coincidentally, but the helper's contract is incomplete.

No security vulnerabilities or hardcoded secrets were found.

---

## Warnings

### WR-01: Double-substitution corrupts output when project name contains "Rigging"

**File:** `packages/create-rigging/lib/helpers.js:41`

**Issue:** `substituteProjectName` applies two sequential `replaceAll` calls. The first
replaces all occurrences of the literal string `rigging` (lowercase) with `projectName`.
If `projectName` itself contains the substring `Rigging` (capital R) — e.g. `myRigging`,
`Riggingv2` — the second `replaceAll('Rigging', toTitleCase(projectName))` then
re-processes the injected text, producing double-substitution:

```
content:     'name: "rigging"'
projectName: 'myRigging'

After replaceAll('rigging', 'myRigging'):  'name: "myRigging"'
After replaceAll('Rigging', 'MyRigging'):  'name: "myMyRigging"'   ← wrong
```

This is confirmed runnable:
```js
sub('name: rigging', 'myRigging')  // → 'name: myMyRigging'
sub('name: rigging', 'Riggingv2') // → 'name: Riggingv2v2'
```

`validateProjectName` does not reject names containing uppercase letters, so these names
pass all guards and silently corrupt `package.json`, `docker-compose.yml`, and any other
text file in the generated project.

**Fix:** Use a single-pass replacement with a regex that handles both cases atomically,
or apply replacements from most-specific to least-specific without overlap:

```js
function substituteProjectName(content, projectName) {
  const titleName = toTitleCase(projectName);
  // Replace 'Rigging' first (capital) so the second pass over lowercase
  // 'rigging' cannot re-match text already substituted.
  return content
    .replaceAll('Rigging', titleName)
    .replaceAll('rigging', projectName);
}
```

Alternatively, use a single regex with a callback:
```js
function substituteProjectName(content, projectName) {
  const titleName = toTitleCase(projectName);
  return content.replace(/Rigging|rigging/g, (match) =>
    match === 'Rigging' ? titleName : projectName
  );
}
```

The test suite in `substitution.test.ts` does not cover a project name that contains
`Rigging` — add a test case such as `('rigging and Rigging', 'myRigging', 'myRigging and MyRigging')`.

---

### WR-02: `scripts/` not excluded — build tooling copied verbatim into generated project

**File:** `scripts/build-template.js:34`

**Issue:** `EXCLUDE_PREFIXES` does not include `scripts/`. All four git-tracked files in
`scripts/` (`build-template.js`, `coverage-gate.ts`, `smoke-health.ts`,
`validate-adr-frontmatter.ts`) are copied into the template and therefore into every
generated project. `scripts/build-template.js` inside the generated project references
`packages/create-rigging/` which does not exist in the generated project, making the
script non-functional. `coverage-gate.ts` and similar scripts may assume the monorepo
context and fail in the same way.

Running `bun run build-template` from inside a generated project would silently produce
no-op output or an error, misleading the user into thinking `scripts/` is a valid part
of their project.

**Fix:** Add `'scripts/'` to `EXCLUDE_PREFIXES`:

```js
const EXCLUDE_PREFIXES = [
  '.planning/',
  'packages/',
  'scripts/',                          // ← add this
  'tests/unit/scaffold/',
  'tests/integration/scaffold/',
];
```

Also add a corresponding SCAF-05 assertion in the integration test:
```ts
test('scripts/ is absent from generated output', () => {
  expect(existsSync(path.join(DEST, 'scripts'))).toBe(false)
})
```

---

### WR-03: `validateProjectName` does not reject `.` (dot) as a project name

**File:** `packages/create-rigging/lib/helpers.js:57`

**Issue:** The string `.` does not contain `/` or `..` and is not equal to `'rigging'`,
so `validateProjectName('.')` returns `{ valid: true }`. In the CLI, `path.resolve(cwd, '.')`
resolves to `cwd` itself. The secondary guard (`resolvedDest !== cwd`) would reject it,
but this relies on the CLI guard rather than the helper that is documented as the
validation contract.

More concretely, the helper's JSDoc lists the exhaustive set of rejected names but omits
`.`. If the helper is ever reused outside the CLI (e.g. a future programmatic API), `.`
would slip through undetected.

The existing guard in the CLI also has a subtle condition error:

```js
// Line 50 — condition fires when resolvedDest escapes cwd:
if (!resolvedDest.startsWith(cwd + path.sep) && resolvedDest !== cwd) {
```

When `projectName = '.'`, `resolvedDest === cwd`, so `resolvedDest !== cwd` is `false`
and the entire condition is `false` — the error branch is NOT taken. The `existsSync`
guard on the next line catches it coincidentally because `cwd` always exists.

**Fix:** Block single-dot (and potentially double-dot as an explicit string, although
`..` is already caught by `includes('..')`) in the helper:

```js
function validateProjectName(projectName) {
  if (!projectName || projectName.trim() === '') {
    return { valid: false, error: 'Usage: create-rigging <project-name>' };
  }
  if (projectName === '.' || projectName === '..') {
    return { valid: false, error: 'Error: project name cannot be "." or "..".' };
  }
  if (projectName === 'rigging') { ... }
  if (projectName.includes('/') || projectName.includes('..')) { ... }
  return { valid: true };
}
```

Add a test case in `cli-validation.test.ts`:
```ts
test('"." → invalid (dot resolves to cwd)', () => {
  const result = validateProjectName('.')
  expect(result.valid).toBe(false)
})
```

---

## Info

### IN-01: Integration test CLI run does not suppress inherited stderr

**File:** `tests/integration/scaffold/cli-e2e.test.ts:24`

**Issue:** The `execSync` call that runs the CLI (lines 24-27) does not set `stdio`.
The default behaviour of `execSync` returns stdout as a Buffer but lets stderr inherit
the test runner's stderr. If the CLI emits any warning to stderr during a successful run,
it will appear in the test output without being captured for assertion. This is
inconsistent with the `build-template` call on line 21 which correctly uses
`{ stdio: 'pipe' }`.

**Fix:**
```ts
const result = execSync(
  `node packages/create-rigging/bin/create-rigging.js ${PROJECT_NAME}`,
  { cwd: REPO_ROOT, stdio: 'pipe' }   // ← add stdio: 'pipe'
)
```

---

### IN-02: `toTitleCase` returns non-string for falsy non-empty inputs

**File:** `packages/create-rigging/lib/helpers.js:29`

**Issue:** `toTitleCase(null)` and `toTitleCase(undefined)` return the original falsy
value unchanged (`null` / `undefined`) rather than a string, because the early-return
`if (!s) return s` passes through anything falsy. The function is typed in JSDoc as
accepting a `string`, so this is a contract violation. In practice `substituteProjectName`
is only called after `validateProjectName` ensures a non-empty string, so there is no
runtime risk in the current call paths — but the exported function is unsafe if called
directly with unexpected input.

**Fix:** Narrow the guard to string-specific falsy:
```js
function toTitleCase(s) {
  if (typeof s !== 'string' || s.length === 0) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```

---

### IN-03: Substitution test suite missing coverage for project names containing "Rigging"

**File:** `tests/unit/scaffold/substitution.test.ts:22`

**Issue:** The test table in `substitution.test.ts` covers only `projectName = 'my-app'`
(a lowercase, no-overlap name). WR-01 above shows that names containing the substring
`Rigging` (capital R) trigger a double-substitution bug. The absence of such a test case
means the bug would not be caught by the unit test suite.

**Fix:** Add the following case to the `substituteProjectName` test table:
```ts
['rigging and Rigging', 'myRigging', 'myRigging and MyRigging'],
['name: "rigging"', 'Riggingv2', 'name: "Riggingv2"'],
```

These tests will fail under the current implementation, demonstrating WR-01 and guiding
the fix.

---

_Reviewed: 2026-04-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
