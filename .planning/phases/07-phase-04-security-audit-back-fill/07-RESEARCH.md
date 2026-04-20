# Phase 7: Phase 04 Security Audit Back-fill — Research

**Researched:** 2026-04-20
**Domain:** Security documentation delta — retroactive audit evidence alignment for `04-SECURITY.md`
**Confidence:** HIGH

---

## Summary

Phase 7 is a **docs + verification delta**, not a greenfield audit. The edit target (`04-SECURITY.md`) already exists at `phases/04-demo-domain/04-SECURITY.md` with a fully-closed 19-row threat register, two audit trail entries, and three accepted risks. The file has `status: verified` in its frontmatter.

The three SEC-01 gaps vs ROADMAP success criteria are precisely identified: (1) no dedicated CVE-2025-61928 subsection citing the regression test at v1.1 HEAD, (2) no timing-safe API Key verification subsection with benchmark evidence, and (3) a cross-user 404 matrix that covers GET/PATCH/DELETE/POST but lacks an explicit entry for the **list-prompts verb** (`GET /agents/:id/prompts`). All four evidence test files exist in the repo and were last confirmed passing at commit `a50ead3` (Plan 05-01, 2026-04-20).

The key D-07 gap decision is well-bounded: `list-prompt-versions.usecase.ts` **does** perform the same ownership gate (`agent.ownerId !== ctx.userId → ResourceNotFoundError`) as the single-read path, so the code-level proof branch is available as an alternative to adding a new integration test.

**Primary recommendation:** Edit `04-SECURITY.md` in-place (three new subsections), run the four evidence test suites once at HEAD to record pass status + commit SHA, and commit. Add one `cross-user-list-prompts` integration test only if the planner chooses the "new test" branch for D-07; otherwise, cite the use-case source lines as the code-level proof.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Deliverable strategy**
- D-01: Phase 7 is a docs + verification delta, not greenfield audit. Start from existing `04-SECURITY.md`, edit in-place. Re-run `$gsd-secure-phase 04` only if executor discovers threat-model drift. Default path is State A spot-check + `bun test` for cited suites at current HEAD.
- D-02: Single plan by default. One Phase 7 plan: (1) run/record `bun test` for regression suites, (2) update `04-SECURITY.md` with three ROADMAP-mandated evidence blocks, (3) commit. Split into two plans only if implementation work appears (e.g., new integration test per D-06/D-07).

**CVE-2025-61928 (SEC-01 §b / ROADMAP criterion 3)**
- D-03: Document as Phase 04 + harness context, evidence in Phase 3. Phase 04 does not duplicate a second CVE integration test; SECURITY.md must state that regression coverage is `tests/integration/auth/cve-2025-61928.regression.test.ts` and that Phase 04 APIs remain protected because global auth plugin + AuthContext apply at v1.1.
- D-04: SECURITY.md must add a dedicated short section with: link to ZeroPath CVE write-up, test file path, run command, and explicit note that evidence was re-checked at v1.1 HEAD (commit SHA recorded at execute time).

**API Key hash timing-safe compare (SEC-01 §c / ROADMAP criterion 4)**
- D-05: Document `tests/integration/auth/timing-safe-apikey.regression.test.ts`: 1000-iteration ratio gate (`|t_malformed - t_wrong_hash| / t_wrong_hash < 0.2`). Reference `crypto.timingSafeEqual` on API Key verify path in `BetterAuthIdentityService` (exact path from codebase).
- D-06: If HEAD changes touch `src/auth/**` or identity adapter, re-run this test file once and record pass + optional logged ratio line in SECURITY.md audit trail. No new benchmark unless the existing test is deleted or materially weakened.

**Cross-user 404 matrix — read / update / delete / list (SEC-01 §d / ROADMAP criterion 5)**
- D-07: Use this verb mapping for SECURITY.md evidence table:
  - Read (single resource): `tests/integration/agents/cross-user-404.test.ts` — User B GET /agents/:userAAgentId → 404
  - Read (nested "latest"): `tests/integration/agents/dogfood-self-prompt-read.test.ts` — Variant 3: User B API Key → GET /agents/.../prompts/latest → 404 RESOURCE_NOT_FOUND
  - Update: `cross-user-404.test.ts` — PATCH /agents/:id
  - Delete: `cross-user-404.test.ts` — DELETE /agents/:id
  - List: ROADMAP implies collection read. **Gap:** no dedicated `GET /agents/:userAAgentId/prompts` (list prompts) cross-user test. Lock: During execute, either **add one integration test** asserting 404 + RESOURCE_NOT_FOUND for that route, **or** justify in SECURITY.md with code-level proof that the list handler shares the same ownership gate (cite use case + controller) and point to the two read tests above as sufficient. Planner must choose one branch.

### Claude's Discretion
- Exact subsection titles and table formatting inside `04-SECURITY.md` (merge into "Security Audit Trail" vs new "SEC-01 compliance" appendix) — executor chooses for readability as long as ROADMAP criteria are visibly satisfied.
- Whether to duplicate one paragraph of Phase 3 CONTEXT into Phase 04 SECURITY vs cross-link only — prefer cross-link + one summary paragraph to avoid drift.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within Phase 7 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | `$gsd-secure-phase 04` executed, producing `phases/04-demo-domain/SECURITY.md` with (a) Phase 04 threat register mitigation evidence, (b) CVE-2025-61928 regression status at v1.1, (c) API Key hash timing-safe compare verification, (d) cross-user 404 matrix coverage on Phase 04 code (4 verbs) | File exists at correct path; (a) already complete; (b)/(c)/(d) are the three gaps — all verified resolvable from existing code + tests |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CVE-2025-61928 regression documentation | Documentation (planning) | Auth infrastructure (`src/auth/**`) | Defense lives in Phase 3 auth layer; Phase 7 documents and cross-references |
| Timing-safe API Key verification | Auth Infrastructure (`identity-service.adapter.ts`) | Documentation | Implementation already shipped; Phase 7 documents the evidence |
| Cross-user 404 ownership gate | Application layer (use cases) | Presentation (controllers) | `ListPromptVersionsUseCase` owns the ownership check — same gate as single-read |
| Test evidence recording | Integration test runner | CI | `bun test` + `bun run test:regression` are the evidence commands |

---

## Standard Stack

This phase uses no new packages. The existing toolchain is the entire stack:

| Tool | Version | Purpose |
|------|---------|---------|
| `bun:test` | built-in (Bun 1.3.10) | Run evidence test suites [VERIFIED: package.json test scripts] |
| `04-SECURITY.md` | — | Edit target; markdown with YAML frontmatter [VERIFIED: file read] |

**Evidence commands (from package.json):**
```bash
bun run test:regression   # runs tests/integration/auth/*.regression.test.ts
bun test tests/integration/agents/cross-user-404.test.ts
bun test tests/integration/agents/dogfood-self-prompt-read.test.ts
```

---

## Evidence File Inventory

All four files exist at HEAD commit `a131a872`. [VERIFIED: `ls tests/integration/auth/` and `ls tests/integration/agents/`]

### File 1: `tests/integration/auth/cve-2025-61928.regression.test.ts`
[VERIFIED: file read directly]

**Describe block:** `[Regression] CVE-2025-61928 - unauth API key creation via body.userId`

| Test name | What it asserts |
|-----------|----------------|
| `unauthenticated POST /api-keys with body.userId -> 401 + zero keys for victim` | Unauthenticated request with `body.userId = victimId` returns 401 UNAUTHENTICATED; confirms zero API keys created for victim |
| `authenticated attacker cannot create API key for victim via body.userId -> 403 USER_ID_MISMATCH` | Attacker with valid session but victim's userId in body → 403 USER_ID_MISMATCH; confirms zero API keys created for victim |

**Last commit adding/modifying this file:** `9882c42` (feat: [03-04] auth presentation + createAuthModule + regression suite, 2026-04-19)

---

### File 2: `tests/integration/auth/timing-safe-apikey.regression.test.ts`
[VERIFIED: file read directly]

**Describe block:** `[Regression AUX-04 / D-10] API key timing alignment`

| Test name | What it asserts |
|-----------|----------------|
| `1000-iteration latency: |t_malformed - t_valid_wrong_hash| / t_valid_wrong_hash < 0.2` | Runs 1000-iteration latency measurement for malformed key path vs valid-format wrong-hash path; ratio of absolute delta to wrong-hash mean must be `< 0.2` (20% tolerance) |

**Warms up with 100 iterations before measurement.** Logs ratio to stdout: `console.log(JSON.stringify({ test: 'timing-safe-apikey', malMean, wrongHashMean, ratio }))`.

**Last commit:** `a50ead3` (feat(05-01): 測試基礎設施 + API Key hash 格式修正, 2026-04-20)

---

### File 3: `tests/integration/agents/cross-user-404.test.ts`
[VERIFIED: file read directly]

**Describe block:** `[Plan 04-04] Cross-user access returns 404 RESOURCE_NOT_FOUND (D-09)`

| Test name | Verb | Route | Assertion |
|-----------|------|-------|-----------|
| `User B GET /agents/:userAAgentId → 404 RESOURCE_NOT_FOUND` | GET | `/agents/:id` | 404 + `code === 'RESOURCE_NOT_FOUND'` |
| `User B PATCH /agents/:userAAgentId → 404` | PATCH | `/agents/:id` | 404 + `code === 'RESOURCE_NOT_FOUND'` |
| `User B DELETE /agents/:userAAgentId → 404` | DELETE | `/agents/:id` | 404 |
| `User B POST /agents/:userAAgentId/prompts → 404 (ownership fails before scope would)` | POST | `/agents/:id/prompts` | 404 + `code === 'RESOURCE_NOT_FOUND'` |

**Note:** POST (write) is covered; GET /list is **not covered** in this file. This is the D-07 gap.

**Last commit:** `91eed76` (feat(phase-04): demo domain agents API, integration tests, and hardening)

---

### File 4: `tests/integration/agents/dogfood-self-prompt-read.test.ts`
[VERIFIED: file read directly]

**Describe block:** `[Plan 04-04] DEMO-04: Agent reads own latest prompt via API Key (4 variants)`

| Test name | Verb | Route | Assertion |
|-----------|------|-------|-----------|
| Variant 1: full-scope API Key reads own latest prompt → 200 + content | GET | `/agents/:id/prompts/latest` | 200, version=1, content match |
| Variant 2: read-only API Key reads own latest prompt → 200 | GET | `/agents/:id/prompts/latest` | 200 |
| Variant 3: User B full-scope API Key reads User A agent → 404 RESOURCE_NOT_FOUND (D-09) | GET | `/agents/:id/prompts/latest` | 404 + `code === 'RESOURCE_NOT_FOUND'` |
| Variant 4: read-only API Key POSTs to own agent → 403 INSUFFICIENT_SCOPE (DEMO-05) | POST | `/agents/:id/prompts` | 403 + `code === 'INSUFFICIENT_SCOPE'` |

**Variant 3 is the cross-user evidence for the nested "read latest" path** used by D-07 mapping.

**Last commit:** `91eed76` (feat(phase-04), then `a50ead3` for hash fix)

---

## `timingSafeEqual` Implementation

[VERIFIED: grep + direct file read]

**File:** `src/auth/infrastructure/better-auth/identity-service.adapter.ts`
**Class:** `BetterAuthIdentityService`
**Method:** `verifyApiKey(rawKey: string)`

**Import:** `import { createHash, timingSafeEqual } from 'node:crypto'` (line 2)

**Usage pattern — three rejection paths all include timing alignment:**

| Rejection path | Lines | Timing action |
|---------------|-------|---------------|
| Malformed key (bad prefix / wrong length / non-ASCII) | 43–53 | `timingSafeEqual(DUMMY_HASH, DUMMY_HASH)` + dummy `findByKeyHash` + `timingSafeEqual(DUMMY_HASH, DUMMY_HASH)` + dummy `findByPrefix` |
| Valid format, hash not found in DB | 58–62 | `timingSafeEqual(DUMMY_HASH, DUMMY_HASH)` + dummy `findByPrefix` |
| Hash found but key revoked or expired | 64–70 | `timingSafeEqual(DUMMY_HASH, DUMMY_HASH)` |

**`DUMMY_HASH`:** `createHash('sha256').update('dummy').digest()` — pre-computed Buffer, not a per-call allocation.

**Implementation intent:** All three fast-reject paths walk dummy DB ops to align latency baseline with the valid-format-wrong-hash path. This satisfies D-10 (Phase 3) and is what the timing benchmark (file 2 above) tests.

---

## D-07 List-Verb Gap Analysis

[VERIFIED: source code read, grep for cross-user list test]

### Gap confirmed
No integration test exists for `User B GET /agents/:userAAgentId/prompts` (list-prompts cross-user 404). Confirmed by:
- `ls tests/integration/agents/` — no dedicated file
- `grep` in all agents integration test files — no `GET.*\/prompts\b` test with two-user setup

### Code-level proof available
`list-prompt-versions.usecase.ts` lines 17–21:
```ts
async execute(ctx: AuthContext, input: ListPromptVersionsInput): Promise<PromptVersion[]> {
  const agent = await this.agentRepo.findById(input.agentId)
  if (!agent || agent.ownerId !== ctx.userId) {
    throw new ResourceNotFoundError('Resource not found')
  }
  return this.promptVersionRepo.listByAgent(input.agentId)
}
```
This is **identical ownership gate** to `GetLatestPromptVersionUseCase` and `GetPromptVersionUseCase`. The controller at `prompt-version.controller.ts:114–133` calls `deps.listPromptVersions.execute(authContext, { agentId })` with `requireAuth: true`.

### Planner decision required (D-07)
Choose one of two branches:

**Branch A — New integration test:**
- Add `tests/integration/agents/cross-user-list-prompts.test.ts` (or a new `describe` block inside `cross-user-404.test.ts`)
- Assert `User B GET /agents/:userAAgentId/prompts → 404 RESOURCE_NOT_FOUND`
- This requires a second plan (or an implementation wave in Plan 1) per D-02

**Branch B — Code-level proof in SECURITY.md:**
- Cite `list-prompt-versions.usecase.ts:17–21` as proof of identical ownership gate
- Note that `prompt-version-crud.test.ts` covers the happy-path list route (same-user `GET /prompts` → 200)
- State in SECURITY.md that the two existing read-path cross-user tests (Variant 3 of dogfood + `cross-user-404.test.ts` GET) are sufficient enumeration-safety evidence for the entire read path
- No new test file; D-07 justification in SECURITY.md prose

**Research recommendation:** Branch B is faster (pure docs, single plan) and technically sound — the ownership gate is not duplicated logic per controller; it lives in the use case and is identical. Branch A is more conservative and satisfies the "test" literal of ROADMAP criterion 5. Both are valid per D-07 lock.

---

## Current `04-SECURITY.md` State

[VERIFIED: file read directly]

**File:** `.planning/phases/04-demo-domain/04-SECURITY.md`
**Frontmatter:** `status: verified`, `threats_open: 0`, `asvs_level: 1`, `phase: 04`

### What exists
- 8-row Trust Boundaries table
- 19-row Threat Register (T-04-01 through T-04-19), all `closed`
- 3 Accepted Risks (AR-04-01/02/03)
- Security Audit Trail with 2 entries (State B run + State A re-verification, both 2026-04-20)
- Sign-Off section (all checkboxes checked)

### T-04-08 (closest to cross-user gap)
T-04-08 mentions `cross-user-404.test.ts` covers GET/PATCH/DELETE/POST matrix. The "POST" coverage note references prompt creation, not the list endpoint. No mention of the list verb.

### What is MISSING (the three SEC-01 gaps)

| Gap | ROADMAP criterion | Required section |
|-----|------------------|-----------------|
| CVE-2025-61928 regression at v1.1 HEAD | #3 | Dedicated subsection: test path, command, SHA, ZeroPath link |
| Timing-safe API Key verification benchmark | #4 | Subsection: `timingSafeEqual` implementation ref, test file, 1000-iter ratio gate |
| Cross-user 404 list-verb coverage | #5 | Table row for GET (list) with either test ref or code-level proof |

---

## `bun test` Run Status for Evidence Suites

**Local execution result:** All 4 evidence test files fail to connect to Postgres (`role "rigging" does not exist`) because `DATABASE_URL` is not set in the current shell. This is **environment setup**, not a test logic failure.

**DB state confirmed:** `docker exec rigging-postgres psql -U rigging -d rigging -c "\dt"` shows all 8 expected tables exist (`agent`, `apikey`, `eval_dataset`, `prompt_version`, `session`, `user`, `verification`, `account`). The local DB has run migrations.

**Last confirmed passing:** Commit `a50ead3` (2026-04-20) — commit message confirms "140 unit tests pass, 59 integration tests pass (含 7 regression), typecheck + lint 綠燈". The regression suite files were last changed in that commit or earlier.

**Changes to `src/auth/**` since v1.0:** None. `git log -- src/auth/` shows last change at `9882c42` (2026-04-19 v1.0 Phase 3 ship). No D-06 re-run trigger applies.

**Executor must:** Source `.env` and run `bun run test:regression` plus the two agents test files. Record HEAD SHA (`a131a872`) and pass/fail status in the SECURITY.md audit trail entry.

---

## Common Pitfalls

### Pitfall 1: Over-editing — replacing the existing register
**What goes wrong:** Editor discards the 19-row register and audit trail, replacing with a new structure.
**How to avoid:** D-01 locks "edit in-place". Add three new sections; preserve all existing content. The threat register is the primary product of the prior secure-phase runs.

### Pitfall 2: Missing commit SHA in CVE section
**What goes wrong:** Section says "evidence re-checked at v1.1 HEAD" but no SHA recorded — audit is not repeatable.
**How to avoid:** Executor records `git rev-parse HEAD` at execution time. Current HEAD is `a131a872` but may advance by plan time — executor fills this at execution.

### Pitfall 3: Claiming tests "pass" without running them
**What goes wrong:** SECURITY.md says "test passes at HEAD" but executor never ran `bun test` — silently wrong documentation.
**How to avoid:** Plan must include an explicit step: source `.env`, run the suites, capture exit code and any logged timing ratio. Only then update SECURITY.md.

### Pitfall 4: D-07 Branch A creates DB state issue
**What goes wrong:** New integration test in `cross-user-404.test.ts` (adding to existing `describe`) causes `afterAll` cleanup to fail if User A or User B agent data interferes.
**How to avoid:** If Branch A, add as a separate `describe` with its own `beforeAll`/`afterAll`, or use `makeAgentsTestHarness()` fresh instance. Do not reuse existing `describe` block's `userAAgentId` from shared state.

### Pitfall 5: Frontmatter not updated
**What goes wrong:** After edits, the `created` date stays at `2026-04-20` but content reflects a second audit pass — no confusion, but audit trail date mismatch.
**How to avoid:** Add an entry to the Security Audit Trail table (new row) rather than editing the frontmatter `created` date. The audit trail is the temporal record.

---

## Architecture Patterns

### Pattern: Editing in-place
The SECURITY.md uses a flat markdown structure with `##` sections. The three new evidence blocks should be added as new `##` subsections between the existing "Accepted Risks Log" and "Security Audit Trail" sections (or as new subsections at the bottom before Sign-Off). Suggested titles (executor's discretion per D-07 agent's discretion):

```markdown
## SEC-01 Compliance Evidence

### CVE-2025-61928 Regression (SEC-01 §b)
...

### API Key Timing-Safe Verification (SEC-01 §c)
...

### Cross-User 404 Matrix — All Verbs (SEC-01 §d)
...
```

### Pattern: Cross-user matrix table
Evidence table format (to be added in §d subsection):

```markdown
| Verb | Route | Test File | Test Name | Status |
|------|-------|-----------|-----------|--------|
| GET (single) | /agents/:id | cross-user-404.test.ts | User B GET ... → 404 | pass at {SHA} |
| GET (nested latest) | /agents/:id/prompts/latest | dogfood-self-prompt-read.test.ts | Variant 3: User B ... → 404 | pass at {SHA} |
| GET (list) | /agents/:id/prompts | [test ref OR code-level proof] | ... | ... |
| PATCH | /agents/:id | cross-user-404.test.ts | User B PATCH ... → 404 | pass at {SHA} |
| DELETE | /agents/:id | cross-user-404.test.ts | User B DELETE ... → 404 | pass at {SHA} |
| POST (nested) | /agents/:id/prompts | cross-user-404.test.ts | User B POST ... → 404 | pass at {SHA} |
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `bun:test` (built-in Bun 1.3.10) |
| Config file | `bunfig.toml` (coverage settings; no special test config needed) |
| Quick run command | `bun run test:regression` |
| Full suite command | `bun test tests/integration/auth/cve-2025-61928.regression.test.ts tests/integration/auth/timing-safe-apikey.regression.test.ts tests/integration/agents/cross-user-404.test.ts tests/integration/agents/dogfood-self-prompt-read.test.ts` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 §b | CVE-2025-61928 regression at v1.1 HEAD | integration regression | `bun test tests/integration/auth/cve-2025-61928.regression.test.ts` | Yes |
| SEC-01 §c | Timing-safe API Key verify (ratio < 0.2) | integration regression | `bun test tests/integration/auth/timing-safe-apikey.regression.test.ts` | Yes |
| SEC-01 §d (read/update/delete/post) | Cross-user 404 matrix | integration | `bun test tests/integration/agents/cross-user-404.test.ts` | Yes |
| SEC-01 §d (list — Branch A) | Cross-user list-prompts 404 | integration | `bun test tests/integration/agents/cross-user-404.test.ts` (or new file) | **No — Wave 0 gap if Branch A** |
| SEC-01 §d (read nested) | Cross-user nested latest 404 | integration | `bun test tests/integration/agents/dogfood-self-prompt-read.test.ts` | Yes |

### Wave 0 Gaps
- If planner chooses **Branch A** for D-07: `tests/integration/agents/cross-user-404.test.ts` needs a new `describe` block or new file for `GET /prompts` cross-user 404
- If planner chooses **Branch B** (code-level proof): None — existing infrastructure covers all requirements

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | BetterAuth session + `requireAuth` macro (already shipped) |
| V4 Access Control | yes | Use case ownership gate (`agent.ownerId !== ctx.userId → ResourceNotFoundError`) |
| V5 Input Validation | yes | TypeBox DTOs at controller boundary |
| V6 Cryptography | yes | `crypto.timingSafeEqual` from `node:crypto` for API Key hash compare |

### Known Threat Patterns for this phase

| Pattern | Relevance | Standard Mitigation |
|---------|-----------|---------------------|
| CVE-2025-61928: unauthenticated API key creation via body.userId | Phase 04 APIs protected by global `authContextPlugin` + use case AUTH-15 check | `requireAuth: true` on all routes + `CreateApiKeyUseCase` userId mismatch guard |
| Timing attack on API Key verification | Malformed-path timing reveals key format info | `timingSafeEqual` + dummy DB ops on all reject paths |
| Cross-user resource enumeration via HTTP differences | 403 reveals resource existence; 404 doesn't | Single-branch `ResourceNotFoundError` on cross-user access (D-09) |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | Test runner | Yes | 1.3.10 | — |
| PostgreSQL (Docker) | Integration tests (requires live DB) | Yes (container `rigging-postgres` up) | 16.11 | — |
| `.env` / DATABASE_URL | `bun test` integration suites | Yes (file exists; executor sources it) | — | — |
| `docker` | DB container management | Yes | — | — |

**Note:** Tests fail with `role "rigging" does not exist` when `DATABASE_URL` env is not sourced. The `.env` file exists at project root. Executor must run `bun test` in an environment with `.env` loaded (or `bun run test` which calls `db:migrate && bun test` after sourcing env).

---

## Open Questions

1. **Branch A vs Branch B for D-07 list-verb gap**
   - What we know: `list-prompt-versions.usecase.ts` has identical ownership gate; no integration test for list cross-user exists
   - What's unclear: Whether ROADMAP criterion 5 ("測試檔 + 行號舉證" / test file + line-level evidence) requires a test file specifically for list, or if code-level proof satisfies it
   - Recommendation: Planner should re-read ROADMAP criterion 5 literally. It says "測試檔 + 行號舉證" — the line numbers can be from the use case source (not necessarily a test), so Branch B is likely acceptable. But if the planner is conservative, Branch A is clean and the new test is ~15 lines.

2. **`bun run test` vs individual file runs**
   - What we know: `bun run test` calls `db:migrate && bun test` — it runs all tests, not just regression
   - What's unclear: Whether executor should run full suite (`bun run test`) or targeted suite (`bun run test:regression` + individual files)
   - Recommendation: Run targeted (4 files explicitly) for evidence recording — faster, focused, easier to capture output for SECURITY.md. Full suite `bun run test` is overkill for this docs delta.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tests were passing at v1.0 ship and no code changes have been made to `src/auth/**` or `src/agents/**` since `a50ead3` | Evidence File Inventory / bun test status | If code changed, tests may fail — executor must actually run them |
| A2 | The `timing-safe-apikey.regression.test.ts` benchmark ratio `< 0.2` will still pass on the local machine at execution time | Timing-safe section | Timing tests are environment-sensitive; a loaded system could produce a higher ratio. If it fails, the test itself (not the security) needs investigation. |

**All other claims in this document are VERIFIED via direct file reads, grep, or git commands in this research session.**

---

## Sources

### Primary (HIGH confidence)
- `04-SECURITY.md` — direct file read — current content, all 19 rows
- `tests/integration/auth/cve-2025-61928.regression.test.ts` — direct file read — test names + assertions
- `tests/integration/auth/timing-safe-apikey.regression.test.ts` — direct file read — test names + ratio gate
- `tests/integration/agents/cross-user-404.test.ts` — direct file read — verb/route/assertion matrix
- `tests/integration/agents/dogfood-self-prompt-read.test.ts` — direct file read — 4 variants
- `src/auth/infrastructure/better-auth/identity-service.adapter.ts` — direct file read — `timingSafeEqual` usage locations
- `src/agents/application/usecases/list-prompt-versions.usecase.ts` — direct file read — ownership gate
- `git log`, `git rev-parse HEAD` — verified commit SHAs and file histories
- `docker exec rigging-postgres psql` — verified DB tables exist

### Secondary (MEDIUM confidence)
- `07-CONTEXT.md` — Phase 7 discuss-phase decisions — locked constraints
- `04-CONTEXT.md` — Phase 4 decisions — D-07/D-09/D-10 context
- `03-CONTEXT.md` — Phase 3 decisions — AUTH-15/D-10/timing decisions

---

## Metadata

**Confidence breakdown:**
- Evidence file content: HIGH — all 4 files read directly
- `timingSafeEqual` implementation location: HIGH — grep + file read
- D-07 list-verb gap: HIGH — confirmed no test exists, confirmed code-level proof exists
- Test pass status at execution time: MEDIUM — depends on environment; last known good at `a50ead3`
- Branch A vs Branch B recommendation: MEDIUM — depends on ROADMAP criterion 5 interpretation

**Research date:** 2026-04-20
**Valid until:** Until any file in `src/auth/**` or `src/agents/**` changes (re-verify timing test if `identity-service.adapter.ts` changes)
