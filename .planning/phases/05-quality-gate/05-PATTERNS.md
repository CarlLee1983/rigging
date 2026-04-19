# Phase 5: Quality Gate — Pattern Map

**Mapped:** 2026-04-20
**Phase:** 05-quality-gate
**Files in scope:** 28 (9 new + 14-17 new unit tests + 5 modified + 1 deleted)
**Analogs found:** 27 / 28 (only `scripts/coverage-gate.ts` has no direct codebase analog — LCOV parser is custom-first)

---

## File Classification

### New files

| New file | Role | Data flow | Closest analog | Match quality |
|----------|------|-----------|----------------|---------------|
| `scripts/coverage-gate.ts` | script (build/CI tool) | file-I/O (reads `coverage/lcov.info`, enumerates `src/**/domain` via `Bun.Glob`, exits 0/1) | `scripts/ensure-agent-schema.ts` (only other script file; provides shebang + postgres + `process.exit` shape) | partial — same `#!/usr/bin/env bun` shape & file-I/O discipline, but LCOV parsing is novel |
| `tests/e2e/_helpers.ts` | test helper (re-export shim) | module-composition (imports from `tests/integration/auth/_helpers.ts`, adds multi-user helpers) | `tests/integration/agents/_helpers.ts` | **exact** — same re-export + `realApp` wrapper + cleanup-per-user pattern |
| `tests/e2e/dogfood-happy-path.test.ts` | test-e2e (journey 1) | request-response (`realApp.handle(Request)` × 4 steps sharing state via outer `let`) | `tests/integration/agents/dogfood-self-prompt-read.test.ts` | **exact** — identical 4-step POST agent → POST prompt → POST api-key → GET latest pattern |
| `tests/e2e/password-reset-session-isolation.test.ts` | test-e2e (journey 2) | request-response (session A + apiKey K → reset → session A 401 / apiKey K 200) | `tests/integration/auth/session-fixation.regression.test.ts` + `tests/integration/auth/password-reset-happy.test.ts` | strong — covers AUTH-11 with added apiKey-independence assertion |
| `tests/e2e/cross-user-404-e2e.test.ts` | test-e2e (journey 3) | request-response (2 users × cookie + api-key = 4 404 assertions) | `tests/integration/agents/cross-user-404.test.ts` | **exact** — same multi-user setup, e2e version adds x-api-key variant |
| `tests/unit/agents/get-agent.usecase.test.ts` | test-unit (new, backfill) | request-response (mocked ports, scope check, cross-user 404) | `tests/unit/agents/create-agent.usecase.test.ts` + `tests/unit/agents/update-agent.usecase.test.ts` | **exact** — same mocked `IAgentRepository` + `ctxWithScopes` fixture shape |
| `tests/unit/agents/get-prompt-version.usecase.test.ts` | test-unit (backfill) | same | `tests/unit/agents/get-latest-prompt-version.usecase.test.ts` | **exact** |
| `tests/unit/agents/list-agents.usecase.test.ts` | test-unit (backfill) | same | `tests/unit/agents/create-agent.usecase.test.ts` | **exact** |
| `tests/unit/agents/list-prompt-versions.usecase.test.ts` | test-unit (backfill) | same | same | **exact** |
| `tests/unit/agents/list-eval-datasets.usecase.test.ts` | test-unit (backfill) | same | `tests/unit/agents/create-eval-dataset.usecase.test.ts` | **exact** |
| `tests/unit/agents/get-eval-dataset.usecase.test.ts` | test-unit (backfill) | same | same | **exact** |
| `tests/unit/agents/delete-agent.usecase.test.ts` | test-unit (backfill) | same | `tests/unit/agents/update-agent.usecase.test.ts` | **exact** |
| `tests/unit/agents/delete-eval-dataset.usecase.test.ts` | test-unit (backfill) | same | same | **exact** |
| `tests/unit/agents/domain/agent.test.ts` | test-unit (domain entity, backfill) | value-construction | `tests/unit/shared/kernel/brand.test.ts` | role-match — domain-type tests, instantiate entity & assert readonly shape |
| `tests/unit/agents/domain/eval-dataset.test.ts` | test-unit (domain entity, backfill) | same | same | role-match |
| `tests/unit/agents/domain/prompt-version.test.ts` | test-unit (domain entity, backfill) | same | same | role-match |
| `tests/unit/agents/domain/errors.test.ts` | test-unit (error class, backfill) | constructor coverage | `tests/unit/auth/domain/errors.test.ts` | **exact** |
| `tests/unit/auth/application/usecases/request-password-reset.usecase.test.ts` | test-unit (backfill) | request-response (mocked `AuthInstance`) | `tests/unit/auth/application/usecases/reset-password.usecase.test.ts` | **exact** |
| `tests/unit/auth/application/usecases/verify-email.usecase.test.ts` | test-unit (backfill) | same | same | **exact** |
| `tests/unit/auth/application/usecases/list-api-keys.usecase.test.ts` | test-unit (backfill) | same | `tests/unit/auth/application/usecases/create-api-key.usecase.test.ts` | **exact** |
| `tests/unit/auth/application/usecases/revoke-api-key.usecase.test.ts` | test-unit (backfill) | same | same | **exact** |
| `docs/quickstart.md` | doc-narrative | external-reader flow (sequential curl commands, cookie-jar + apiKey) | — (no prior quickstart); content comes from `.env.example` + `docker-compose.yml` + `src/auth/presentation/controllers/auth.controller.ts` | no analog — first of its kind |
| `docs/architecture.md` | doc-narrative (prose + mermaid + tables) | reader navigation (3 chapters + regression map + test convention) | ADR body section structure (ADR 0003, 0006, 0008, 0011) for tone reference; mermaid syntax spelled out in RESEARCH §10 | partial — chapter-per-topic follows ADR rhythm but overall format is new |
| `docs/decisions/0018-testcontainers-deviation-via-docker-compose.md` | doc-adr | ADR MADR 4.0 | `docs/decisions/0015-rate-limit-memory-v1-persistent-v2.md` | **exact** — both are v1-vs-v2 deviation records with identical MADR shape |

### Modified files

| File | Sections to change | Analog / reference |
|------|---------------------|--------------------|
| `package.json` | `scripts.test` rewrite (drop `ensure-agent-schema`, add `db:migrate`); add 4 scripts (`test:regression`, `test:ci`, `test:coverage`, `coverage:gate`) | Current `package.json` (L7-18 of file is the only `scripts` block in repo) |
| `bunfig.toml` | Replace placeholder `[test]` with full coverage block (per RESEARCH §2) | Current `bunfig.toml` (2-line placeholder); external reference: Bun docs (see RESEARCH §2) |
| `.github/workflows/ci.yml` | Rewrite single `check` job → 3 parallel jobs (`lint` / `typecheck` / `test`) + postgres service + coverage-gate step + migration-drift step + concurrency group | Current `.github/workflows/ci.yml` (single job, 25 lines); GitHub Actions conventions already used in `.github/workflows/adr-check.yml` |
| `README.md` | Delete "Phase 1 underway" status block + minimal Quickstart section; rewrite to narrative-first (tagline → Core Value → Why Rigging → Quickstart link → Stack → What NOT / Architecture / Decisions / Contributing / License) | Current `README.md` (28 lines; tagline at L3 is keep-as-is per RESEARCH §11) + `.planning/PROJECT.md` Core Value (source for Why Rigging bullets) + `AGENTS.md` L242-258 (Anti-features → "What NOT Included" re-use) |
| `AGENTS.md` | Insert TOC block between L1 (`# AGENTS.md`) and L2 (`<!-- GSD:project-start` ... no GSD drift); rename heading at L197 from `## Rigging Rigidity Map (AI Agent: read this first)` to ASCII-anchored form using explicit `<a id="ai-agent-onboarding"></a>` (RESEARCH §8 Option A) | Current `AGENTS.md` L1, L196-197, L242-243 (structural landmarks — do NOT edit inside `<!-- GSD:* -->` blocks) |
| `docs/decisions/README.md` | Append 0018 row; spot-check 0000-0017 `status` column (mechanical `grep -l 'Status: proposed' docs/decisions/*.md` expected → 0 files) | Current `docs/decisions/README.md` L9-26 (index table); all existing rows already say `accepted` |
| `docker-compose.yml` | Already uses `postgres:16-alpine` (verified L3) — **no change needed** unless planner wants to also add `POSTGRES_DB: rigging_test` alias; researcher confirms alignment is already present | `docker-compose.yml` L3 |

### Deleted files

| File | Why | Replacement |
|------|-----|-------------|
| `scripts/ensure-agent-schema.ts` | P4 technical debt workaround (manual `CREATE TABLE IF NOT EXISTS` readFileSync parse of `drizzle/0002_demo_domain.sql`); contradicts Drizzle single-source-of-truth (ADR 0005). D-05 replaces with `bun run db:migrate` in `test` script | `"test": "bun run db:migrate && bun test"` (D-05-A) — idempotent because `drizzle-kit migrate` detects "already applied" state |

---

## Shared Patterns (cross-cutting)

### Pattern A — `bun:test` describe/beforeAll/afterAll + makeTestApp harness

**Source:** `tests/integration/auth/_helpers.ts` L329-475 (`makeTestApp()` factory)

**Applies to:** all 3 e2e journey tests + all new unit tests (the latter instantiate only the use case under test, not the full harness)

**Excerpt — harness construction:**
```typescript
export function makeTestApp(): TestHarness {
  const dbClient = createDbClient({ DATABASE_URL: TEST_CONFIG.DATABASE_URL })
  const emailOutbox = { verification: [] as string[], reset: [] as string[] }
  const auth = makeAuth(dbClient.db, emailOutbox)
  // ... use cases instantiated with real deps
  return {
    app, auth, db, sql, emailOutbox, identity, apiKeys, users,
    createApiKey, listApiKeys, revokeApiKey, registerUser, verifyEmail,
    requestPasswordReset, resetPassword, resolveAuthContext, requireAuthContext,
    dispose: async () => { await dbClient.sql.end({ timeout: 5 }) },
  } as unknown as TestHarness
}
```

### Pattern B — Per-user cleanup in afterAll (userId-scoped DELETE)

**Source:** `tests/integration/agents/_helpers.ts` L68-79 (`cleanupTestUser`)

**Applies to:** all 3 e2e journey tests (D-09-A)

**Excerpt:**
```typescript
export async function cleanupTestUser(sql, userId, email) {
  await sql`DELETE FROM "agent" WHERE owner_id = ${userId}`
  await sql`DELETE FROM "apikey" WHERE reference_id = ${userId}`
  await sql`DELETE FROM "account" WHERE user_id = ${userId}`
  await sql`DELETE FROM "session" WHERE user_id = ${userId}`
  await sql`DELETE FROM "verification" WHERE identifier = ${email}`
  await sql`DELETE FROM "user" WHERE id = ${userId}`
}
```
*Identical delete-order used by `tests/integration/auth/cve-2025-61928.regression.test.ts` L23-43 (inlined form).*

### Pattern C — `ctxWithScopes` fixture for use-case unit tests

**Source:** `tests/unit/agents/create-agent.usecase.test.ts` L8-18

**Applies to:** all 11 new agents use-case unit tests + 4 new auth use-case unit tests

**Excerpt:**
```typescript
const CLOCK = { now: () => new Date('2026-04-19T12:00:00.000Z') }
const USER_A = 'user-a-uuid' as UserId

function ctxWithScopes(scopes: ReadonlyArray<'*' | 'read:*'>): AuthContext {
  return {
    userId: USER_A,
    identityKind: 'human',
    scopes,
    sessionId: 'sess-1',
  }
}
```

### Pattern D — Mocked repository port (inline object literal)

**Source:** `tests/unit/agents/create-agent.usecase.test.ts` L20-28

**Applies to:** all 14-17 new unit tests

**Excerpt:**
```typescript
function makeAgentRepo(): IAgentRepository {
  return {
    findById: async () => null,
    listByOwner: async () => [],
    create: async (a: Agent) => a,
    update: async (a: Agent) => a,
    delete: async () => true,
  }
}
```
*No mocking library needed — plain object literals satisfying the port interface.*

### Pattern E — Error body contract assertion

**Source:** `tests/integration/agents/cross-user-404.test.ts` L42-51

**Applies to:** every `.handle(Request)` error assertion in all 3 e2e tests

**Excerpt:**
```typescript
expect(res.status).toBe(404)
const body = (await res.json()) as { error: { code: string } }
expect(body.error.code).toBe('RESOURCE_NOT_FOUND')
```
*Extended form — `cve-2025-61928.regression.test.ts` L60-65 adds `message` + `requestId` checks.*

### Pattern F — MADR 4.0 ADR skeleton (front-matter + sections)

**Source:** `docs/decisions/0000-use-madr-for-adrs.md` + `docs/decisions/0015-rate-limit-memory-v1-persistent-v2.md`

**Applies to:** `0018-testcontainers-deviation-via-docker-compose.md` + (indirectly) architecture.md chapter rhythm

**Excerpt — ADR front matter + section headings:**
```markdown
---
status: accepted
date: 2026-04-20
deciders: the-team
consulted: .planning/phases/05-quality-gate/05-CONTEXT.md D-01, .planning/REQUIREMENTS.md QA-02
informed: future AI Agents and future maintainers
---

# 0018. Testcontainers deviation via docker-compose + GitHub Actions services

## Context and Problem Statement
## Decision Drivers
## Considered Options
## Decision Outcome
### Consequences
## Pros and Cons of the Options
## References
```

---

## Code Excerpts by File

### `scripts/coverage-gate.ts` (NEW)

**Analog:** `scripts/ensure-agent-schema.ts` (only sibling — for shebang + imports + `process.exit` shape). LCOV parsing is custom (RESEARCH §1 provides full skeleton).

**Analog excerpt — shebang + bun import + process.exit:**
```typescript
#!/usr/bin/env bun
/**
 * ...
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'

const url = process.env.DATABASE_URL ?? '...'
const sql = postgres(url)
try {
  const rows = await sql`SELECT 1 AS ok FROM information_schema.tables ...`
  if (rows.length > 0) {
    process.exit(0)
  }
  // ...
} finally {
  await sql.end()
}
```

**Delta:**
- Replace `postgres` import with `Bun.Glob` + `node:fs/existsSync` (filesystem enumeration)
- Replace DB query with `readFileSync('coverage/lcov.info', 'utf8')` + LCOV block parser
- Parse 5 LCOV prefixes (`SF:`, `LF:`, `LH:`, `FNF:`, `FNH:`); treat files absent from LCOV as 0% (Pitfall 1 in RESEARCH §Pitfall)
- Threshold constants: `THRESHOLD = 80`, `TIER_GLOBS = ['src/**/domain/**/*.ts', 'src/**/application/**/*.ts', 'src/shared/kernel/**/*.ts']`, `EXCLUDE_PATTERNS = [/\.test\.ts$/, /\/index\.ts$/, /\.port\.ts$/]`
- `process.exit(0)` on pass, `process.exit(1)` on fail with per-file failure list, `process.exit(2)` if `coverage/lcov.info` absent
- Full skeleton is spelled out verbatim in RESEARCH §1 (lines 181-277 of 05-RESEARCH.md) — planner copies that

---

### `tests/e2e/_helpers.ts` (NEW)

**Analog:** `tests/integration/agents/_helpers.ts` (lines 1-34 — **identical re-export + realApp wrapper pattern**)

**Analog excerpt:**
```typescript
import { randomUUID } from 'node:crypto'
import { createApp } from '../../../src/bootstrap/app'
import type { DbClient } from '../../../src/shared/infrastructure/db/client'
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
export {
  followLatestVerificationEmail, insertTestApiKey, makeTestApp,
  serializeSessionCookie, signInAndGetHeaders, signUpAndSignIn, TEST_CONFIG,
}

export interface AgentsTestHarness extends TestHarness {
  realApp: ReturnType<typeof createApp>
}

export function makeAgentsTestHarness(): AgentsTestHarness {
  const base = makeTestApp()
  const realApp = createApp(TEST_CONFIG, { authInstance: base.auth })
  return { ...base, realApp }
}

export async function cleanupTestUser(sql, userId, email): Promise<void> { /* L68-79 — 6 DELETEs */ }
```

**Delta:**
- Rename `AgentsTestHarness` → `E2eHarness`, `makeAgentsTestHarness` → `makeE2eHarness`
- Re-export path changes from `'../auth/_helpers'` to `'../integration/auth/_helpers'` (one more `../`)
- Add `setupUser(harness, prefix)` helper that generates timestamp+random email + signs up + signs in + returns `{ userId, email, password, headers, cookie }` (RESEARCH §6 L603-608 gives exact body)
- Rename `cleanupTestUser` → `cleanupUser` (RESEARCH §6 L611-618); same 6-DELETE order
- Do NOT extract to `tests/_shared/helpers.ts` — RESEARCH §6 recommends keeping the re-export-from-auth pattern (3rd reuser, established convention)

---

### `tests/e2e/dogfood-happy-path.test.ts` (NEW — Journey 1)

**Analog:** `tests/integration/agents/dogfood-self-prompt-read.test.ts` (4-variant dogfood test; E2E version turns variant-1 into a sequential 4-step journey)

**Analog excerpt — multi-step HTTP journey with state sharing:**
```typescript
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { type AgentsTestHarness, cleanupTestUser, insertTestApiKey,
         makeAgentsTestHarness, signUpAndSignIn } from './_helpers'

describe('[Plan 04-04] DEMO-04: Agent reads own latest prompt via API Key (4 variants)', () => {
  let harness: AgentsTestHarness
  let userAId: string
  let agentAId: string
  let userAFullKey: string
  const emailA = `dogfood-a-${Date.now()}@test.local`

  beforeAll(async () => {
    harness = makeAgentsTestHarness()
    const a = await signUpAndSignIn(harness, emailA, 'Password123!')
    userAId = a.userId
    const agentRes = await harness.realApp.handle(
      new Request('http://localhost/agents', {
        method: 'POST',
        headers: { ...Object.fromEntries(a.headers.entries()), 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'dogfood-agent' }),
      }),
    )
    agentAId = ((await agentRes.json()) as { id: string }).id
    // ... POST prompt, insertTestApiKey
  })

  afterAll(async () => {
    await cleanupTestUser(harness.sql, userAId, emailA)
    await harness.dispose()
  })

  test('Variant 1: full-scope API Key reads own latest prompt → 200 + content', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${agentAId}/prompts/latest`, {
        headers: { 'x-api-key': userAFullKey },
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { version: number; content: string }
    expect(body.version).toBe(1)
    expect(body.content).toBe('system: you are helpful')
  })
  // ...
})
```

**Delta:**
- Import from `./_helpers` (e2e helpers) not `./_helpers` (agents integration); same short path since both are `./_helpers`
- describe title: `'e2e: dogfood happy path (DEMO-04 + Success Criterion #1)'`
- Instead of `insertTestApiKey` (DB insert bypass), e2e MUST use the real `POST /api-keys` HTTP endpoint via `realApp.handle(...)` — journey story demands the mint endpoint is exercised end-to-end; extract `apiKey = body.rawKey` from response and assert `toMatch(/^rig_live_/)`
- Use outer `let agentId: string; let apiKey: string` shared between `test()` blocks (Bun runs `test()` inside a `describe()` sequentially — safe; do NOT use `test.concurrent()`)
- 4 `test()` blocks: create Agent (cookie) → create PromptVersion (cookie) → mint API Key (cookie) → read latest via x-api-key → assert 200 + content + `identityKind='agent'` via separate probe (or trust `resolver-precedence.regression.test.ts` and just assert 200+content per RESEARCH §Pattern)
- Full skeleton spelled in RESEARCH §"Pattern: E2E test" lines 981-1041

---

### `tests/e2e/password-reset-session-isolation.test.ts` (NEW — Journey 2)

**Analog:** `tests/integration/auth/session-fixation.regression.test.ts` (AUTH-11 core assertion) + `tests/integration/auth/password-reset-happy.test.ts` (reset mechanics)

**Analog excerpt — session-fixation.regression.test.ts L10-54:**
```typescript
describe('[Regression AUTH-11] password reset session fixation', () => {
  const harness = makeTestApp()
  const email = `fixation-${Date.now()}@example.test`
  let sessionA = new Headers()
  let userId = ''

  beforeAll(async () => {
    const signed = await signUpAndSignIn(harness, email, 'FixationPassword!123')
    userId = signed.userId
    sessionA = signed.headers
  })

  afterAll(async () => {
    await harness.sql`DELETE FROM "apikey" WHERE reference_id = ${userId}`
    await harness.sql`DELETE FROM "account" WHERE user_id = ${userId}`
    // ... 4 more deletes
    await harness.dispose()
  })

  test('resetPassword invalidates the stale session cookie after reset', async () => {
    await harness.auth.api.requestPasswordReset({ body: { email } })
    await followLatestResetEmail(harness, 'FixationPassword!456')

    const resA = await harness.app.handle(new Request('http://localhost/me', { headers: sessionA }))
    expect(resA.status).toBe(401)
  })
})
```

**Delta:**
- Swap `harness.app` → `harness.realApp` (e2e uses full `createApp` chain, not `_helpers.ts`-local Elysia app)
- Add apiKey K minted BEFORE reset (via `POST /api-keys` through `realApp.handle`, capturing `body.rawKey`)
- After reset assertion `resA.status === 401`, add **new** assertion: `GET /me` with `x-api-key: K` header → 200 (proves apiKey lifecycle is independent of session reset — the DEMO value P5 wants to showcase)
- Use reset endpoint via BetterAuth API surface (`harness.auth.api.requestPasswordReset` already works in this test — reuse as-is; don't go through `POST /api/auth/forget-password` HTTP just because it's e2e — the BetterAuth API surface is already what the HTTP endpoint wraps)
- Read reset URL via `harness.emailOutbox.reset.at(-1)` — existing `followLatestResetEmail` helper already does this
- Replace 5-DELETE inline cleanup with `cleanupUser(harness, userId, email)` from e2e helpers
- Drop the `03-01-spike-result.json` readFile gate (spike-result assertion is specific to the P3 regression; not needed in e2e)

---

### `tests/e2e/cross-user-404-e2e.test.ts` (NEW — Journey 3)

**Analog:** `tests/integration/agents/cross-user-404.test.ts` (4 sub-tests: GET/PATCH/DELETE/POST-prompt all 404 via cookie)

**Analog excerpt — cross-user-404.test.ts L18-51:**
```typescript
describe('[Plan 04-04] Cross-user access returns 404 RESOURCE_NOT_FOUND (D-09)', () => {
  let harness: AgentsTestHarness
  let userAId: string
  let userBId: string
  let userAAgentId: string
  let userBHeaders: Headers

  beforeAll(async () => {
    harness = makeAgentsTestHarness()
    const a = await signUpAndSignIn(harness, emailA, 'Password123!')
    userAId = a.userId
    const b = await signUpAndSignIn(harness, emailB, 'Password123!')
    userBId = b.userId
    userBHeaders = b.headers
    const res = await harness.realApp.handle(new Request('http://localhost/agents', {
      method: 'POST',
      headers: { ...Object.fromEntries(a.headers.entries()), 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'user-a-agent' }),
    }))
    userAAgentId = ((await res.json()) as { id: string }).id
  })

  test('User B GET /agents/:userAAgentId → 404 RESOURCE_NOT_FOUND', async () => {
    const res = await harness.realApp.handle(
      new Request(`http://localhost/agents/${userAAgentId}`, { headers: userBHeaders }),
    )
    expect(res.status).toBe(404)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('RESOURCE_NOT_FOUND')
  })
})
```

**Delta:**
- describe title: `'e2e: cross-user 404 across cookie AND api-key tracks (D-09 × resolver precedence)'`
- User B mints an API Key too (`POST /api-keys` via cookie); store as `userBApiKey`
- Two `test()` blocks only (vs integration's 4):
  1. User B cookie `GET /agents/:userAAgentId` → 404 RESOURCE_NOT_FOUND (covers cookie path)
  2. User B x-api-key `GET /agents/:userAAgentId` → 404 RESOURCE_NOT_FOUND (covers api-key path + resolver precedence D-09-of-P3)
- The point of journey 3 is **both auth tracks yield the same 404** — not the full CRUD matrix; integration already covers that. Keep e2e crisp per RESEARCH §Code Examples lines 1170-1178.
- `afterAll` calls `cleanupUser` for BOTH userA and userB

---

### `tests/unit/agents/{get-agent, get-prompt-version, list-*, delete-*}.usecase.test.ts` (11 NEW unit tests — agents backfill)

**Analog:** `tests/unit/agents/create-agent.usecase.test.ts` (simple 2-test skeleton) + `tests/unit/agents/update-agent.usecase.test.ts` (3-test skeleton with `findCalls` spy)

**Analog excerpt — create-agent.usecase.test.ts (full file, 46 lines):**
```typescript
import { describe, expect, test } from 'bun:test'
import type { IAgentRepository } from '../../../src/agents/application/ports/agent-repository.port'
import { CreateAgentUseCase } from '../../../src/agents/application/usecases/create-agent.usecase'
import type { Agent } from '../../../src/agents/domain'
import type { AuthContext, UserId } from '../../../src/auth/domain'
import { InsufficientScopeError } from '../../../src/auth/domain'

const CLOCK = { now: () => new Date('2026-04-19T12:00:00.000Z') }
const USER_A = 'user-a-uuid' as UserId

function ctxWithScopes(scopes: ReadonlyArray<'*' | 'read:*'>): AuthContext {
  return { userId: USER_A, identityKind: 'human', scopes, sessionId: 'sess-1' }
}

function makeAgentRepo(): IAgentRepository {
  return {
    findById: async () => null,
    listByOwner: async () => [],
    create: async (a: Agent) => a,
    update: async (a: Agent) => a,
    delete: async () => true,
  }
}

describe('CreateAgentUseCase', () => {
  test('rejects when scope omits *', async () => {
    const uc = new CreateAgentUseCase(makeAgentRepo(), CLOCK)
    await expect(uc.execute(ctxWithScopes(['read:*']), { name: 'x' })).rejects.toBeInstanceOf(
      InsufficientScopeError,
    )
  })

  test('happy path trims name and sets owner from ctx', async () => {
    const uc = new CreateAgentUseCase(makeAgentRepo(), CLOCK)
    const result = await uc.execute(ctxWithScopes(['*']), { name: '  hi  ' })
    expect(result.name).toBe('hi')
    expect(result.ownerId).toBe(USER_A)
  })
})
```

**Delta (per use case — 3 test shapes needed):**

1. **Read use cases** (`get-agent`, `get-prompt-version`, `get-eval-dataset`, `get-latest-prompt-version` already done):
   - test 1: `ResourceNotFoundError` when `findById` returns `null`
   - test 2: `ResourceNotFoundError` when `agent.ownerId !== ctx.userId` (cross-user 404 — see `src/agents/application/usecases/get-agent.usecase.ts` L15)
   - test 3: happy path returns entity
   - No scope gate (read operations accept `['*']` OR `['read:*']` — see existing `get-latest-prompt-version.usecase.test.ts`)

2. **List use cases** (`list-agents`, `list-prompt-versions`, `list-eval-datasets`):
   - test 1: returns `listByOwner(ctx.userId)` result
   - test 2: empty list when repo returns `[]`
   - (list ops typically have no scope gate beyond requireAuth)

3. **Delete use cases** (`delete-agent`, `delete-eval-dataset`):
   - test 1: `InsufficientScopeError` when scope omits `*`/`write:*`
   - test 2: `ResourceNotFoundError` when `findById` returns `null` OR `agent.ownerId !== ctx.userId`
   - test 3: happy path calls `repo.delete(id)` and returns `true`

Each test file: ~30-60 lines following `create-agent.usecase.test.ts` skeleton. Total backfill ≈ 400-500 LoC across 11 files.

---

### `tests/unit/agents/domain/{agent,eval-dataset,prompt-version}.test.ts` (3 NEW domain entity tests)

**Analog:** `tests/unit/shared/kernel/brand.test.ts` (value-object construction pattern)

**Rationale:** Agent/EvalDataset/PromptVersion are plain data interfaces (see `src/agents/domain/agent.ts` — 10 lines, no constructor/factory). Tests must ensure the entity shape is consumable — mostly trivial assertions.

**Excerpt for `agent.test.ts`:**
```typescript
import { describe, expect, test } from 'bun:test'
import type { Agent, AgentId } from '../../../../src/agents/domain'
import type { UserId } from '../../../../src/auth/domain'

describe('Agent entity', () => {
  test('constructs with readonly fields from correctly branded ids', () => {
    const agent: Agent = {
      id: 'a-uuid' as AgentId,
      ownerId: 'u-uuid' as UserId,
      name: 'test',
      createdAt: new Date('2026-04-19T00:00:00.000Z'),
      updatedAt: new Date('2026-04-19T00:00:00.000Z'),
    }
    expect(agent.id).toBe('a-uuid')
    expect(agent.name).toBe('test')
  })
})
```

**Delta:** for `eval-dataset.ts` tests add the jsonb `cases` shape assertion (see `docs/decisions/0017-eval-dataset-shape-jsonb-immutable.md`); for `prompt-version.ts` tests add monotonic version field.

**Coverage caveat:** these files are pure type interfaces — Bun's `--coverage` will show them but line/function counts may be 0 since there is no executable body. If gate falsely fails, add to `EXCLUDE_PATTERNS` (interface-only files — same rule as `.port.ts`).

---

### `tests/unit/agents/domain/errors.test.ts` (NEW — agents error class backfill)

**Analog:** `tests/unit/auth/domain/errors.test.ts` (lines 1-40 — exact shape)

**Analog excerpt:**
```typescript
import { describe, expect, test } from 'bun:test'
import {
  EmailNotVerifiedError,
  InsufficientScopeError,
  // ...
} from '../../../../src/auth/domain/errors'

describe('auth domain errors', () => {
  test('UserIdMismatchError uses the dedicated code and status', () => {
    const error = new UserIdMismatchError('mismatch')
    expect(error.code).toBe('USER_ID_MISMATCH')
    expect(error.httpStatus).toBe(403)
  })
  // ... 4 more
})
```

**Delta:**
- Import from `../../../../src/agents/domain/errors` (not `auth/domain/errors`)
- `src/agents/domain/errors.ts` only exports `PromptVersionConflictError` — single test:
  ```typescript
  test('PromptVersionConflictError uses the dedicated code and status', () => {
    const error = new PromptVersionConflictError('conflict')
    expect(error.code).toBe('PROMPT_VERSION_CONFLICT')
    expect(error.httpStatus).toBe(500)
  })
  ```

---

### `tests/unit/auth/application/usecases/{request-password-reset,verify-email,list-api-keys,revoke-api-key}.usecase.test.ts` (4 NEW)

**Analog:** `tests/unit/auth/application/usecases/reset-password.usecase.test.ts` (for auth-facade wrappers) + `tests/unit/auth/application/usecases/create-api-key.usecase.test.ts` (for identity-port wrappers)

**Delta per use case (from reading source):**
- `verify-email.usecase.ts` (14 lines — thin AuthInstance wrapper): 1 test — calls `auth.api.verifyEmail({ query: { token } })` with spy
- `request-password-reset.usecase.ts`: similar 1-2 test shape (AuthInstance + email port wrapper)
- `list-api-keys.usecase.ts`: scope gate + returns `identity.listApiKeysByUser(ctx.userId)` — 2 tests
- `revoke-api-key.usecase.ts` (see `src/auth/application/usecases/revoke-api-key.usecase.ts` L1-20):
  - test 1: `InsufficientScopeError` when scope omits `*`/`write:*`
  - test 2: happy path calls `identity.revokeApiKey(id, ctx.userId)` + returns void

---

### `package.json` (MODIFIED)

**Analog:** Current file (L1-40) — 13 scripts already present, 4 scripts to add, 1 script to rewrite

**Current excerpt (scripts block L6-19):**
```json
"scripts": {
  "dev": "bun --watch src/main.ts",
  "start": "bun src/main.ts",
  "lint": "biome check .",
  "lint:fix": "biome check --write .",
  "format": "biome format --write .",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:push": "drizzle-kit push",
  "db:studio": "drizzle-kit studio",
  "typecheck": "tsc --noEmit",
  "test": "bun scripts/ensure-agent-schema.ts && bun test",
  "test:contract": "bun test tests/biome-contract tests/contract"
}
```

**Delta:**
```json
"scripts": {
  "dev": "bun --watch src/main.ts",
  "start": "bun src/main.ts",
  "lint": "biome check .",
  "lint:fix": "biome check --write .",
  "format": "biome format --write .",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:push": "drizzle-kit push",
  "db:studio": "drizzle-kit studio",
  "typecheck": "tsc --noEmit",
  "test": "bun run db:migrate && bun test",
  "test:contract": "bun test tests/biome-contract tests/contract",
  "test:regression": "bun test tests/**/*.regression.test.ts",
  "test:coverage": "bun test --coverage --coverage-reporter=lcov && bun run scripts/coverage-gate.ts",
  "test:ci": "bun test --coverage --coverage-reporter=lcov",
  "coverage:gate": "bun run scripts/coverage-gate.ts"
}
```

**Rationale per change (D-reference):**
- `test` L17: drop `bun scripts/ensure-agent-schema.ts` prefix (D-05-B delete), add `bun run db:migrate` prefix (D-05-A)
- `test:regression`: D-02-A — grep-friendly pattern `*.regression.test.ts`
- `test:ci`: D-13-C — CI-only; NO coverage-gate call (gate is separate step so fail location is distinct — RESEARCH "Pattern: Coverage gate runs after" L1045-1050)
- `test:coverage`: local developer convenience — run tests with coverage + gate in one invocation
- `coverage:gate`: D-13-C / D-13-D — standalone script invocation (CI invokes this separately after `test:ci`)

---

### `bunfig.toml` (MODIFIED)

**Analog:** Current file (2 lines — placeholder)

**Current excerpt:**
```toml
[test]
# P1 zero-config; Phase 5 may add coverage thresholds
```

**Delta (verified against Bun 1.3.x docs in RESEARCH §2):**
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

**Key deltas vs CONTEXT D-03-A literal:**
- `coverageReporter` drops `"json-summary"` (does not exist in Bun 1.3.x — verified by RESEARCH §1 / §2 against `bun test --help`); use `"lcov"` instead
- `coveragePathIgnorePatterns` expanded beyond D-03-A to exclude tiers **D-06-A** says the gate should not enforce on (infra/presentation/bootstrap/main/types/scripts) — keeps LCOV file smaller and reports cleaner

---

### `.github/workflows/ci.yml` (MODIFIED — FULL REWRITE)

**Analog:**
1. Current `.github/workflows/ci.yml` (25-line single job) — shows starting point
2. `.github/workflows/adr-check.yml` — shows repo's `actions/checkout@v4` + `oven-sh/setup-bun@v2` + conditional-fail convention

**Current excerpt (full file, 25 lines):**
```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.12
      - name: Install dependencies (frozen)
        run: bun install --frozen-lockfile
      - name: Lint (biome check .)
        run: bun run lint
      - name: Typecheck (tsc --noEmit)
        run: bun run typecheck
      - name: Test (bun test)
        run: bun run test
```

**Delta (full rewrite — RESEARCH §3 provides verbatim skeleton at L337-449):**
- Replace single `check:` job with 3 jobs: `lint` / `typecheck` / `test` (D-11)
- Add top-level `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }` (D-11-D)
- `lint` + `typecheck` jobs: identical 6-step skeleton (checkout, setup-bun, cache bun deps via `actions/cache@v4` keyed on `bun.lock` hash, install frozen, run single script, 2-minute wall)
- `test` job: adds `services: postgres:16-alpine` (D-12, RESEARCH §3 exact config at L391-403), env vars (DATABASE_URL, BETTER_AUTH_SECRET fallback, BETTER_AUTH_URL, NODE_ENV=test, LOG_LEVEL=error), and 4 test steps:
  1. `bun run db:migrate`
  2. `bun run test:ci` (runs tests with `--coverage --coverage-reporter=lcov`)
  3. `bun run coverage:gate` (separate step — RESEARCH §"Pattern: Coverage gate runs" at L1045-1050)
  4. Migration drift check (inline shell: `bun run db:generate --name=ci-drift` then `if [ -n "$(git status --porcelain drizzle/)" ]; then exit 1; fi` — D-10, RESEARCH §4 at L455-477)
  5. Upload `coverage/lcov.info` via `actions/upload-artifact@v4` with `if: always()` so failing PRs still expose coverage details for debugging
- The `BETTER_AUTH_SECRET` env MUST be ≥32 chars — use `x_x_x_x_x_x_x_x_x_x_x_x_x_x_x_x` (32 chars) to match `TEST_CONFIG.BETTER_AUTH_SECRET: 'x'.repeat(32)` in `_helpers.ts` L39

---

### `README.md` (MODIFIED — FULL REWRITE per D-14)

**Analog:**
1. Current `README.md` (28 lines) — keep the tagline at L3 (RESEARCH §11 explicitly says this matches PROJECT.md Core Value word-for-word)
2. `.planning/PROJECT.md` L10-12 (Core Value source for the ~3-4 line CN+EN narrative)
3. `AGENTS.md` L242-258 (`## Anti-features`) — reused verbatim as bullet list source for "What NOT Included"

**Current keep-as-is excerpt (L1-5):**
```markdown
# Rigging

**Harness Engineering for TypeScript backends** — an opinionated reference app where AI Agents write code on rails (type system + runtime guards + DI) so wrong patterns literally fail to wire.

> Core Value: any Domain operation must pass through `AuthContext`. Without `AuthContext`, the handler cannot even be wired.
```

**Current DELETE excerpt (L7-21):**
```markdown
## Status

Phase 1 (Foundation) is underway. See `.planning/ROADMAP.md` for the five-phase plan.

## Quickstart (Phase 1 minimum)

```bash
bun install
bun run lint
...
```

Full docker-compose + env setup lands in Plan 05 of this phase.
```

**Delta (D-14-A above-the-fold + D-14-B below — target ~100 lines total):**
1. L1-5: **KEEP** (tagline + Core Value blockquote)
2. Replace L7-21 with:
   - `## Why Rigging` section — 3-5 bullets pulling from PITFALLS.md (#11 harness too tight / #2 scoped plugin undefined / #4 API key plaintext)
   - `## Quickstart` single-line: `See [docs/quickstart.md](docs/quickstart.md) — up and running in 10 minutes.`
3. Append below:
   - `## Stack` — version table lifted from AGENTS.md L33-40 (Bun 1.3.12 / Elysia 1.4.28 / BetterAuth 1.6.5 / Drizzle 0.45.2 / postgres 3.4.9)
   - `## What NOT Included` — 7-line bullet list from AGENTS.md L247-258 Anti-features
   - `## Architecture` — one-line `See [docs/architecture.md](docs/architecture.md).`
   - `## Decisions` — one-line `See [docs/decisions/README.md](docs/decisions/README.md) — 18 ADRs in MADR 4.0 format.`
   - `## Contributing` — one-line `See [AGENTS.md#ai-agent-onboarding](AGENTS.md#ai-agent-onboarding) — AI Agents + human contributors share the same rulebook.` (anchor comes from AGENTS.md D-17 change)
   - `## License` — placeholder `MIT` or `TBD` (researcher discretion, D-14-B)
4. Language policy per RESEARCH §11: English-first; optional one-line CN follow-up to Core Value blockquote (already bilingual-ish)
5. Do NOT add marketing hero / badge grid (D-14-C); CI status badge optional

---

### `AGENTS.md` (MODIFIED — TWO-POINT SURGERY per D-17)

**Analog:** Current `AGENTS.md` structure:
- L1: `# AGENTS.md`
- L2-194: GSD auto-managed blocks (DO NOT EDIT — wrapped in `<!-- GSD:* -->` comments)
- L196-240: `<!-- RIGGING:rigidity-map-start -->` ... `<!-- RIGGING:rigidity-map-end -->` block
- L242-258: `<!-- RIGGING:anti-features-start -->` ... end

**Current L1-2 (insertion point):**
```markdown
# AGENTS.md
<!-- GSD:project-start source:PROJECT.md -->
```

**Current L196-197 (rename target):**
```markdown
<!-- RIGGING:rigidity-map-start source:docs/decisions/0009-rigidity-map.md -->
## Rigging Rigidity Map (AI Agent: read this first)
```

**Delta (RESEARCH §8 Option A — ASCII-stable anchor):**

1. **Insert TOC between L1 and L2** (BEFORE first `<!-- GSD:* -->` block, D-17-D):
```markdown
# AGENTS.md

<a id="ai-agent-onboarding"></a>
> **AI Agent 接手本專案前必讀 / AI Agent Onboarding**
>
> 1. [Core Value + Why Rigging](#project) — 1 min: harness engineering explained
> 2. [Rigidity Map (must-rigid / ADR-escape / convention-only)](#ai-agent-onboarding) — 2 min: three tiers decide what you can change
> 3. [Anti-features (DO NOT propose)](#anti-features-do-not-propose-extending) — 1 min: what Rigging v1 does NOT do
> 4. [GSD workflow role](#gsd-workflow) — how the GSD blocks in this file work
> 5. Further reading: [docs/architecture.md](docs/architecture.md) · [docs/decisions/](docs/decisions/README.md) · [.planning/PROJECT.md](.planning/PROJECT.md)

<!-- GSD:project-start source:PROJECT.md -->
```

2. **Rename L197 heading with explicit ASCII anchor** (RESEARCH §8 Option A):
```markdown
<!-- RIGGING:rigidity-map-start source:docs/decisions/0009-rigidity-map.md -->
<a id="rigidity-map"></a>
## AI Agent 接手本專案前必讀 (Rigidity Map)
```

Note: the anchor `#ai-agent-onboarding` actually points to the TOC blockquote itself (so the README `[AGENTS.md#ai-agent-onboarding]` link lands on the TOC). The `#rigidity-map` second anchor is the chapter anchor. Document this in the TOC line 2 link.

3. **DO NOT touch** any `<!-- GSD:* -->` block (auto-managed — would break GSD tooling)
4. **Bilingual policy** (RESEARCH §11): AGENTS.md stays CN-first / bilingual; TOC is bilingual with CN title + English anchor hint

---

### `docs/decisions/README.md` (MODIFIED)

**Analog:** Current file (35 lines; L9-26 is the table of 18 rows)

**Current table excerpt (L7-26, showing current last row):**
```markdown
| 編號 | 標題 | Status | 日期 | Supersedes |
|---|---|---|---|---|
| [0000](0000-use-madr-for-adrs.md) | Use MADR 4.0 for ADRs | accepted | 2026-04-19 | — |
| ...
| [0017](0017-eval-dataset-shape-jsonb-immutable.md) | EvalDataset Shape Frozen at v1 (jsonb cases, immutable) | accepted | 2026-04-19 | — |
```

**Delta (RESEARCH §7):**
- Append new row:
```markdown
| [0018](0018-testcontainers-deviation-via-docker-compose.md) | Testcontainers deviation via docker-compose + GitHub Actions services | accepted | 2026-04-20 | — |
```
- Spot-check audit per Success Criterion #5 ("Looks Done But Isn't"): run `grep -l 'status: proposed' docs/decisions/*.md` → expected 0 matches. If any file returns, polish its front matter to `status: accepted`.

---

### `docs/decisions/0018-testcontainers-deviation-via-docker-compose.md` (NEW)

**Analog:** `docs/decisions/0015-rate-limit-memory-v1-persistent-v2.md` (same pattern: v1-vs-v2 deviation explanation with explicit PROD-* pointer for the superseding path)

**Analog excerpt — 0015 L1-12:**
```markdown
---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/phases/03-auth-foundation/03-CONTEXT.md D-16, .planning/research/PITFALLS.md
informed: future AI Agents and future maintainers
---

# 0015. Rate limit: memory store v1 / persistent store v2

## Context and Problem Statement

Rigging must prevent brute-force login attempts... BetterAuth 1.6.5 ships a built-in `rateLimit` config...

Two constraints pull in opposite directions:

1. **Dev DX**: a memory store requires zero additional setup...
2. **Production correctness**: memory store counters are per-process...
```

**Delta for ADR 0018:**
- Front matter: `date: 2026-04-20`, `consulted: .planning/phases/05-quality-gate/05-CONTEXT.md D-01, .planning/REQUIREMENTS.md QA-02`
- Title: `# 0018. Testcontainers deviation via docker-compose + GitHub Actions services`
- **Context and Problem Statement:** REQ QA-02 literal says testcontainers; evaluate; deviate to docker-compose (local) + GitHub Actions `services:` (CI) for same "isolated ephemeral Postgres" outcome
- **Decision Drivers:** 26 integration tests already work with `harness.sql` over docker-compose; testcontainers adds ~100MB dep + 5-15s cold start per file; GitHub Actions `services: postgres:16-alpine` achieves equivalent isolation; v2 PROD-* can revisit
- **Considered Options:**
  - Option A — docker-compose (local) + GitHub Actions services (CI) [CHOSEN]
  - Option B — testcontainers (literal QA-02)
  - Option C — bun:sql in-memory Postgres emulation (not viable 2026)
- **Decision Outcome:** Chosen A because it matches 26 shipped tests, zero new deps, zero new cold-start tax, CI parity
- **Consequences:**
  - Good: no new deps; existing harness pattern (`makeTestApp` → `harness.sql`) scales to e2e
  - Bad: external clone requires `docker-compose up -d` in quickstart (documented in `docs/quickstart.md`)
  - Note: CONTEXT D-01 explicitly grants deviation; QA-02 wording unchanged
- **References:** CONTEXT.md §測試策略 D-01; `tests/integration/auth/_helpers.ts`; `docker-compose.yml`; RESEARCH §1 `.github/workflows/ci.yml services:` pattern
- **Supersedes:** None

---

### `docs/quickstart.md` (NEW)

**Analog:** No prior quickstart in repo. Sources:
- `.env.example` (for env var names — researcher verifies file exists)
- `docker-compose.yml` L1-19 (postgres:16-alpine + 5432 port + healthcheck already configured)
- `src/auth/presentation/controllers/auth.controller.ts` (for `/api/auth/sign-up/email` endpoint — researcher confirms path)
- BetterAuth cookie name: `better-auth.session_token` (verified RESEARCH §5)
- `tests/integration/agents/dogfood-self-prompt-read.test.ts` (the dogfood curl sequence in narrative form — lines 22-45 of that test show exact endpoints + payloads)

**Structure (D-15-A):**
1. **Setup (2 min):** `git clone` → `cp .env.example .env` → `docker-compose up -d` → `bun install` → `bun run db:migrate`
2. **Dev server (30s):** `bun run dev` → health check `curl http://localhost:3000/health` → swagger `http://localhost:3000/swagger`
3. **Path A — Human session (3 min):** curl sign-up/email → tail terminal for verification link → curl verify → curl sign-in/email with `-c cookies.txt` cookie jar (RESEARCH §5 L499-517 has the exact curl block)
4. **Path B — Create & read agent (2 min):** `POST /agents` with `-b cookies.txt` → `POST /agents/:id/prompts` → `POST /api-keys` → capture `rawKey` starting with `rig_live_` → `GET /agents/:id/prompts/latest` with `-H "x-api-key: $API_KEY"` (RESEARCH §Specifics CONTEXT.md L583-607 has the exact curl block with `jq -r`)
5. **What just happened (1 min):** explain identity pivot — you just played human then agent on your own data; `identityKind` flipped from `human` (cookie) to `agent` (x-api-key); resolver precedence made the key take priority
6. **Next steps:** link to `docs/architecture.md` (why it works) and `docs/decisions/` (decision trail)

**Key deltas vs CONTEXT D-15-A:**
- Use **cookie jar** (`-c cookies.txt` / `-b cookies.txt`) rather than literal `-H 'Cookie: better-auth.session_token=...'` — RESEARCH §5 Pitfall 3 recommends this for robustness (survives `cookiePrefix` config changes)
- Between `docker-compose up -d` and `bun run db:migrate`, add ~10s wait hint OR use `docker-compose up -d --wait` (compose v2.20+ flag) — RESEARCH Pitfall 6 documents the race
- Error example (D-15-D): show the `{error: {code, message, requestId}}` shape after one deliberate invalid sign-up (e.g., short password) to demonstrate P2 D-12 error body contract

---

### `docs/architecture.md` (NEW)

**Analog:**
- ADR chapter rhythm (Context/Drivers/Outcome/Consequences) for each of the 3 main chapters — but looser prose
- RESEARCH §10 (L795-913) provides **verbatim mermaid code** for all 3 diagrams — planner copies mermaid blocks directly
- Regression map table: CONTEXT D-16-B L233-245 provides the verbatim 8-row table

**Structure (D-16-A/B/C):**
1. **Chapter 1: DDD Four-Layer Architecture** — intro prose (3-5 paragraphs) + mermaid flowchart (RESEARCH §10 L800-836) + `See ADR [0003](decisions/0003-ddd-layering.md) and [0009](decisions/0009-rigidity-map.md).`
2. **Chapter 2: AuthContext Macro Flow** — intro prose + mermaid sequence (RESEARCH §10 L846-878) + `See ADR [0006](decisions/0006-authcontext-boundary.md) and [0007](decisions/0007-runtime-guards-via-di.md).`
3. **Chapter 3: Dual Identity Resolution** — intro prose + mermaid decision graph (RESEARCH §10 L888-911) + `See ADR [0008](decisions/0008-dual-auth-session-and-apikey.md) and [0011](decisions/0011-resolver-precedence-apikey-over-cookie.md).`
4. **Appendix A: Regression Test Matrix** (D-16-B) — 8-row table mapping `.regression.test.ts` → CVE/Pitfall reference
5. **Appendix B: Testing conventions** (D-16-C) — D-04-A regulation documented: email/userId namespace isolation, `afterAll` ownerId-scoped DELETE, parallel-OK default

**Key deltas:**
- GitHub-native mermaid render — DO NOT add `%%{init: {'theme': '...'}}%%` directives (RESEARCH §10 L793-794)
- Mermaid node colors use `fill:#e8f5e9,stroke:#2e7d32` (green for domain) + `fill:#ffebee,stroke:#c62828` (red for 401) per RESEARCH §10 — GitHub light/dark auto-adapts
- Do NOT include code snippets in architecture.md (D-16-E) — teach flows, not implementation
- Regression map: place as Appendix A (D-16-B), not main chapter

---

## Pattern conventions summary

For planner / executor:

- **Result-returning style:** Use cases return success values directly or throw domain errors; they do NOT return `Result<T, E>` in this codebase. Error translation to HTTP happens in `errorHandlerPlugin` (see `tests/integration/auth/cve-2025-61928.regression.test.ts` for assertion shape `{error: {code, message, requestId}}`).
- **`beforeAll` + `afterAll` userId-scoped cleanup:** every integration/e2e test suite follows the 6-DELETE order (`agent` → `apikey` → `account` → `session` → `verification` → `user`). New e2e tests inherit this via `cleanupUser()` in `tests/e2e/_helpers.ts`.
- **Parallel-safe test isolation:** email uses `${feature}-${Date.now()}@example.test` namespace; apiKey rows filter on `reference_id = ${userId}`; no shared state between tests. This is D-04-A enforced convention.
- **Bun test order within `describe`:** sequential (can share outer `let` variables between `test()` blocks). Do NOT use `test.concurrent()` in e2e journey tests — state sharing is the whole point.
- **Mocked ports = plain object literal:** no mocking library. Define a `function make<Port>Repo(): IPort { return { method: async () => ... } }` helper.
- **Scope gate before IO:** use cases check `ctx.scopes.includes('*')` (or write:* / read:*) **before** touching any repository — `tests/unit/agents/update-agent.usecase.test.ts` L31-43 asserts `findCalls === 0` after a scope rejection.
- **ADR front-matter:** `status: accepted` / `date: YYYY-MM-DD` / `deciders: the-team` / `consulted: <ref>` / `informed: future AI Agents and future maintainers` — 5-field MADR 4.0, consistent 0000-0017.
- **ADR filename format:** `NNNN-kebab-case-title.md` — verb-first where possible; avoid "v1" in filename (status field tracks lifecycle).
- **CI step sequencing:** `db:migrate` BEFORE `test:ci` BEFORE `coverage:gate` BEFORE migration-drift — four distinct steps, each a separate failure signal in Actions log.
- **LCOV coverage gate:** enumerate expected files via `Bun.Glob` then look up each in LCOV map; treat absent files as 0% (RESEARCH Pitfall 1). Do NOT rely on LCOV file enumeration alone — Bun omits files with zero test coverage.
- **Cookie name discovery:** use `auth.$context.authCookies.sessionToken.name` (see `_helpers.ts` L201); avoid hardcoding `better-auth.session_token` outside of demo curl examples.
- **No new deps:** Phase 5 adds zero npm packages (not testcontainers, not eden, not c8/istanbul). Bun built-in `--coverage` + LCOV + custom gate script.

---

## Metadata

**Analog search scope:** `tests/unit/**`, `tests/integration/**`, `scripts/**`, `src/**`, `docs/decisions/**`, `.github/workflows/**`, repo root configs
**Files scanned:** 28 primary analogs read (all files within limit — no large-file offset reads needed)
**Pattern extraction date:** 2026-04-20

## PATTERN MAPPING COMPLETE
