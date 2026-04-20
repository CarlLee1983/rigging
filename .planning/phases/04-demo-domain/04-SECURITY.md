---
phase: 04
slug: demo-domain
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-20
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail for the demo-domain phase (Agents / PromptVersion / EvalDataset).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| domain ↔ infrastructure | Agents domain layer MUST NOT import drizzle-orm, elysia, postgres, pino, or better-auth. Enforced by `biome.json` `noRestrictedImports` override for `src/**/domain/**` (6 restricted paths + messages referencing ADR 0003/0006/0009). | Entity objects (Agent / PromptVersion / EvalDataset) mapped via infrastructure mappers; no ORM types cross |
| DB ↔ schema | FK cascade from `agent→user`, `prompt_version→agent`, `eval_dataset→agent` prevents orphan rows (D-12). | owner_id (user.id) and agent_id references; cascade on DELETE |
| use case ↔ infrastructure | Use cases depend only on ports (interfaces); repositories implement ports. Reversed import caught by contract test `bun test:contract`. | Port method signatures — no Drizzle types leak |
| AuthContext ↔ domain mutation | Every write path enforces `ctx.scopes.includes('*')` BEFORE ownership check (D-13). Then `agent.ownerId === ctx.userId` (D-10). | AuthContext (userId, scopes) injected via `requireAuth` macro (ADR 0007, Phase 3) |
| HTTP ↔ use case | TypeBox validates body + params at controller entry. jsonb `cases` cannot receive malformed payload. | Request body / path params → typed DTOs |
| Plugin chain ↔ agents routes | `createAgentsModule` assumes P3 `authContextPlugin` globally mounted; order enforced in `createApp` (ADR 0012). | Elysia derive chain (auth → agents → health) |
| Test harness ↔ real plugin chain | `makeAgentsTestHarness` boots real `createApp` — plugin-ordering regressions fail integration tests. | Full request → response round-trip |
| Friction log ↔ ADR enforcement | `verify-friction-tally.sh` bridges narrative markdown to a CI-gateable exit code (D-16). | Counter strings in `04-HARNESS-FRICTION.md` |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-04-01 | Information Disclosure | Cross-feature error codes | mitigate | `ResourceNotFoundError.code === 'RESOURCE_NOT_FOUND'` — distinct from generic `NOT_FOUND`. Evidence: `src/shared/kernel/errors.ts:47-49`. | closed |
| T-04-02 | Tampering | Hand-edited migration SQL | mitigate | `drizzle/0002_demo_domain.sql` generated via `drizzle-kit generate`. CI drift check (`drizzle-kit generate --name=ci-drift`) fails on hand-edits (Phase 05 CI). | closed |
| T-04-03 | Elevation of Privilege | Orphan rows after parent delete | mitigate | 3× `onDelete: 'cascade'` at `src/agents/infrastructure/schema/{agent,eval-dataset,prompt-version}.schema.ts`. Verified by `tests/integration/agents/cascade-delete.test.ts`. | closed |
| T-04-04 | Spoofing | Framework import in domain layer | mitigate | `biome.json:31-50` blocks drizzle-orm / elysia / postgres / pino / better-auth / @bogeychan/elysia-logger in `src/**/domain/**`. Contract test suite additionally enforces. | closed |
| T-04-05 | Denial of Service | Wild jsonb payloads in `eval_dataset.cases` | accept | Attack surface authenticated (requireAuth) + owner-scoped. TypeBox `maxItems: 1000` at controller boundary (`src/agents/presentation/dtos/create-eval-dataset.dto.ts:11`). Size cap at 1 000 cases deemed sufficient for v1 per D-04 shape lock. | closed |
| T-04-06 | Elevation of Privilege | Read-only API Key writes cross-user agent | mitigate | Scope check BEFORE ownership in 6 write use cases (`create-agent`, `update-agent`, `delete-agent`, `create-prompt-version`, `create-eval-dataset`, `delete-eval-dataset`). Evidence: `update-agent.usecase.ts:20-23` (scope guard precedes `findById`). Integration test `tests/integration/agents/scope-check-read-only-key.test.ts` asserts end-to-end. | closed |
| T-04-07 | Tampering | PromptVersion concurrent race creating holes/duplicates | mitigate | DB `UNIQUE(agent_id, version)` at `prompt-version.schema.ts:16` + `onConflictDoNothing` at `drizzle-prompt-version.repository.ts:52` + bounded retry loop. `tests/integration/agents/prompt-version-monotonic.test.ts` asserts N parallel POSTs → distinct contiguous 1..N versions. | closed |
| T-04-08 | Information Disclosure | 403-vs-404 enumeration on cross-user access | mitigate | Single-branch `!agent \|\| agent.ownerId !== ctx.userId` throws `ResourceNotFoundError`. Evidence: `create-prompt-version.usecase.ts:33`, `update-agent.usecase.ts:24`. `tests/integration/agents/cross-user-404.test.ts` covers GET/PATCH/DELETE/POST matrix. | closed |
| T-04-09 | Denial of Service | Infinite retry loop on pathological concurrency | mitigate | `MAX_RETRY = 24` bounded constant at `create-prompt-version.usecase.ts:19` (raised from 3 during Plan 04-04 dogfood to accommodate N-parallel integration test; documented in `04-04-SUMMARY.md:88,129` as Adopted Scope Deviation). Still bounded — DoS surface closed. | closed |
| T-04-10 | Information Disclosure | Malformed jsonb `cases` crashes reads | mitigate | `parseCases()` defensive filter at `eval-dataset.mapper.ts:11,28` — non-array → `[]`, bad entries dropped. Belt-and-suspenders to T-04-12 write-side TypeBox. | closed |
| T-04-11 | Spoofing | Direct HTTP bypassing requireAuth | mitigate | `requireAuth: true` declared on every Phase-4 route: 5 in `agent.controller.ts`, 4 in `prompt-version.controller.ts`, 4 in `eval-dataset.controller.ts` = 13 total. Smoke test in `module-smoke.test.ts` asserts anonymous POST → 401. | closed |
| T-04-12 | Tampering | Malformed EvalCase bypassing jsonb `.$type<>()` phantom | mitigate | `EvalCaseSchema` + `Type.Array(EvalCaseSchema, { minItems: 1, maxItems: 1000 })` at `create-eval-dataset.dto.ts:4-11`. Controller entry boundary. | closed |
| T-04-13 | Elevation of Privilege | Route matcher picks `/:version` before `/latest` | mitigate | Declaration order at `prompt-version.controller.ts:72` (`/prompts/latest`) BEFORE `:93` (`/prompts/:version`). Integration test `dogfood-self-prompt-read.test.ts` asserts `/latest` resolves correctly. | closed |
| T-04-14 | Information Disclosure | Swagger leaks implementation details | accept | By design — Swagger tags + security + summaries ARE the public OpenAPI contract for Phase-5 quickstart dogfood. Response shapes only; error bodies go through error-handler. No sensitive data exposed. | closed |
| T-04-15 | Tampering | Hand-wired test app masking plugin-chain regression | mitigate | `tests/integration/agents/_helpers.ts` `makeAgentsTestHarness` boots real `createApp(TEST_CONFIG, { authInstance })`. Any move/removal of `createAgentsModule` from bootstrap fails integration tests immediately. | closed |
| T-04-16 | Information Disclosure | Cross-user enumeration via HTTP response differences | mitigate | `cross-user-404.test.ts` + `dogfood-self-prompt-read.test.ts` Variant 3 assert body `code === 'RESOURCE_NOT_FOUND'` (not `FORBIDDEN`) on cross-user access. DEMO-05 scope test confirms 403 path remains valid within-user. | closed |
| T-04-17 | Repudiation | Friction tally bypass (silent exit) | mitigate | `verify-friction-tally.sh` ships in `.planning/phases/04-demo-domain/`; exits non-zero when trigger hit + ADR 0018 missing. Phase-4 exit-gate checkpoint requires running it. | closed |
| T-04-18 | Denial of Service | Concurrent race test accumulates DB rows | mitigate | `cleanupTestUser` in every `afterAll` cascades via FK (T-04-03). Cleanup idempotent on test failure. No long-lived test state leaks. | closed |
| T-04-19 | Elevation of Privilege | ADR 0017 supersession without migration plan | accept | ADR 0017 Note section explicitly requires a v2 ADR with migration script if `eval_case` is normalized. Process failure would be caught at PR review. `.$type<>()` phantom + `parseCases` defensive read provide grace. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-05 | `eval_dataset.cases` jsonb payload is capped at 1 000 entries by TypeBox DTO + protected behind `requireAuth` + owner-scope. Per-item size cap deferred per D-04 shape lock — v1 scope; revisit if ratelimit store moves from memory to persistent (ADR 0015 v2). | carl (human) | 2026-04-20 |
| AR-04-02 | T-04-14 | Swagger is the public OpenAPI contract — intentional disclosure of response shapes is the dogfood path for external developers (Phase-5 quickstart). Error bodies normalized via error-handler. No secrets, tokens, or PII in schemas. | carl (human) | 2026-04-20 |
| AR-04-03 | T-04-19 | ADR 0017 freezes EvalDataset shape at v1 with explicit supersession protocol (Note section). Any normalization of `eval_case` requires a v2 ADR + migration script — enforced by PR review discipline (human process). Defensive `parseCases` in mapper provides read-side grace if process fails. | carl (human) | 2026-04-20 |

*Accepted risks do not resurface in future audit runs.*

---

## SEC-01 Compliance Evidence

> Added 2026-04-20 — Phase 7 SEC-01 back-fill. Addresses ROADMAP Phase 7 success criteria 3–5 and REQUIREMENTS.md SEC-01 §b–§d. Evidence re-verified at HEAD commit `d15fecc623608abadef5025d95dffb0fe2e29085`.

### CVE-2025-61928 Regression (SEC-01 §b)

**Attack pattern:** Unauthenticated `POST /api-keys` with victim `userId` in request body — [ZeroPath advisory](https://zeropath.com/blog/breaking-authentication-unauthenticated-api-key-creation-in-better-auth-cve-2025-61928)

**Defense location (Phase 3):** `CreateApiKeyUseCase` enforces `AUTH-15` — `body.userId` must equal the authenticated session's `userId`. Global `authContextPlugin` + `requireAuth: true` ensures all Phase 04 routes require authentication before any use-case is invoked.

**Phase 04 coverage:** Phase 04 APIs do not duplicate CVE regression tests (Phase 3 owns the auth path). Phase 04 routes remain protected because:
1. `createAgentsModule` assumes Phase 3 `authContextPlugin` is globally mounted (ADR 0012, `createApp` order enforced)
2. All 13 Phase 04 routes declare `requireAuth: true`
3. `AuthContext` is unreachable without a valid identity — routes that skip `requireAuth: true` cannot compile without a cast

**Regression test:**
- **File:** `tests/integration/auth/cve-2025-61928.regression.test.ts`
- **Describe block:** `[Regression] CVE-2025-61928 - unauth API key creation via body.userId`
- **Tests:**
  - `unauthenticated POST /api-keys with body.userId -> 401 + zero keys for victim`
  - `authenticated attacker cannot create API key for victim via body.userId -> 403 USER_ID_MISMATCH`
- **Run command:** `bun test tests/integration/auth/cve-2025-61928.regression.test.ts`  
  (or `bun run test:regression` to run all regression suites)
- **Status at v1.1 HEAD `d15fecc623608abadef5025d95dffb0fe2e29085`:** PASS

---

### API Key Timing-Safe Verification (SEC-01 §c)

**Threat:** Timing side-channel on API Key verification — malformed-path latency differs from valid-format-wrong-hash latency, revealing key format information to an attacker.

**Implementation:** `src/auth/infrastructure/better-auth/identity-service.adapter.ts` — class `BetterAuthIdentityService`, method `verifyApiKey(rawKey: string)`

All three rejection paths walk timing-aligned dummy operations via `crypto.timingSafeEqual` from `node:crypto`:

| Rejection path | Action |
|----------------|--------|
| Malformed key (bad prefix / wrong length / non-ASCII) | `timingSafeEqual(DUMMY_HASH, DUMMY_HASH)` + dummy `findByKeyHash` + `timingSafeEqual(DUMMY_HASH, DUMMY_HASH)` + dummy `findByPrefix` |
| Valid format, hash not found in DB | `timingSafeEqual(DUMMY_HASH, DUMMY_HASH)` + dummy `findByPrefix` |
| Hash found but key revoked or expired | `timingSafeEqual(DUMMY_HASH, DUMMY_HASH)` |

`DUMMY_HASH` is `createHash('sha256').update('dummy').digest()` — pre-computed Buffer, not a per-call allocation.

**Benchmark test:**
- **File:** `tests/integration/auth/timing-safe-apikey.regression.test.ts`
- **Describe block:** `[Regression AUX-04 / D-10] API key timing alignment`
- **Test:** `1000-iteration latency: |t_malformed - t_valid_wrong_hash| / t_valid_wrong_hash < 0.2`
  - 100-iteration warm-up before measurement
  - Gate: ratio must be `< 0.2` (20% tolerance)
  - Logged output: `{ test: 'timing-safe-apikey', malMean, wrongHashMean, ratio }`
- **Run command:** `bun test tests/integration/auth/timing-safe-apikey.regression.test.ts`
- **Status at v1.1 HEAD `d15fecc623608abadef5025d95dffb0fe2e29085`:** PASS (ratio: 0.01585070945657452)

**Phase 3 decision reference:** Phase 3 D-10 (timing alignment requirement) and D-09 (API Key fast-reject 401 without cookie fallback).

---

### Cross-User 404 Matrix — All Verbs (SEC-01 §d)

**Threat:** HTTP response differences on cross-user access reveal resource existence (403 → resource exists; 404 → doesn't). Phase 04 mitigates via single-branch `ResourceNotFoundError` on all cross-user paths (D-09).

**Ownership gate pattern (D-10):** Implemented at use-case layer. All Phase 04 use cases follow:
```typescript
const agent = await this.agentRepo.findById(input.agentId)
if (!agent || agent.ownerId !== ctx.userId) {
  throw new ResourceNotFoundError('Resource not found')
}
```

**Evidence matrix:**

| Verb | Route | Coverage Type | Evidence | Status at `d15fecc623608abadef5025d95dffb0fe2e29085` |
|------|-------|---------------|----------|------------------------|
| GET (single) | `/agents/:id` | integration test | `cross-user-404.test.ts` — `User B GET /agents/:userAAgentId → 404 RESOURCE_NOT_FOUND` | PASS |
| GET (nested latest) | `/agents/:id/prompts/latest` | integration test | `dogfood-self-prompt-read.test.ts` — Variant 3: User B API Key → `GET /agents/:id/prompts/latest` → 404 `RESOURCE_NOT_FOUND` | PASS |
| GET (list) | `/agents/:id/prompts` | code-level proof | `src/agents/application/usecases/list-prompt-versions.usecase.ts:17–21` — identical ownership gate to single-read path (see below) | n/a — code proof |
| PATCH | `/agents/:id` | integration test | `cross-user-404.test.ts` — `User B PATCH /agents/:userAAgentId → 404 RESOURCE_NOT_FOUND` | PASS |
| DELETE | `/agents/:id` | integration test | `cross-user-404.test.ts` — `User B DELETE /agents/:userAAgentId → 404` | PASS |
| POST (nested) | `/agents/:id/prompts` | integration test | `cross-user-404.test.ts` — `User B POST /agents/:userAAgentId/prompts → 404 (ownership fails before scope)` | PASS |

**List verb code-level proof (D-07 Branch B):**

No dedicated integration test exists for `User B GET /agents/:userAAgentId/prompts` (list-prompts cross-user 404). However, the ownership gate in `ListPromptVersionsUseCase` is **identical** to the gates tested above:

```typescript
// src/agents/application/usecases/list-prompt-versions.usecase.ts:17–21
async execute(ctx: AuthContext, input: ListPromptVersionsInput): Promise<PromptVersion[]> {
  const agent = await this.agentRepo.findById(input.agentId)
  if (!agent || agent.ownerId !== ctx.userId) {
    throw new ResourceNotFoundError('Resource not found')
  }
  return this.promptVersionRepo.listByAgent(input.agentId)
}
```

The controller at `src/agents/presentation/controllers/prompt-version.controller.ts` calls `deps.listPromptVersions.execute(authContext, { agentId })` with `requireAuth: true`. The ownership check is not in the controller layer — it is in the use case, which is the same code path called by all routes. The two existing cross-user read-path tests (Variant 3 of `dogfood-self-prompt-read.test.ts` + `cross-user-404.test.ts` GET) confirm the gate fires correctly for the read path; the list path uses the same gate from the same use-case pattern. Additional test cross-referencing: `tests/integration/agents/prompt-version-crud.test.ts` covers the happy-path list route (same-user `GET /prompts` → 200), confirming the route resolves.

**Test run commands:**
```bash
bun test tests/integration/agents/cross-user-404.test.ts
bun test tests/integration/agents/dogfood-self-prompt-read.test.ts
```

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-20 | 19 | 19 | 0 | Claude Code ($gsd-secure-phase 04, State B run-from-artifacts) |
| 2026-04-20 | 19 | 19 | 0 | Claude Code ($gsd-secure-phase 04, State A re-verification) |
| 2026-04-20 | 19 | 19 | 0 | Claude Code (Phase 7 SEC-01 back-fill: CVE + timing + cross-user matrix evidence added; `git rev-parse HEAD` = `d15fecc623608abadef5025d95dffb0fe2e29085`; `bun run test:regression` + agents cross-user suites all green) |

### Audit 2026-04-20 — Run-from-Artifacts (State B)

- Source: 4× PLAN.md threat_model blocks (`04-01` T-04-01..05, `04-02` T-04-06..10, `04-03` T-04-11..14, `04-04` T-04-15..19).
- Classification method: per-threat evidence grep against `src/**`, `drizzle/**`, `tests/**`, and `biome.json`. All 19 threats verified against actual source.
- No open threats — 16 dispositions verified as `mitigate` (control exists in code), 3 as `accept` (documented in Accepted Risks Log above).
- Deviation noted (not security-regressing): T-04-09 `MAX_RETRY` raised 3 → 24 to support monotonic parallel integration test; still bounded; documented in `04-04-SUMMARY.md` Adopted Scope Deviations.
- Step 4 user gate (AskUserQuestion) and Step 5 auditor spawn both skipped per workflow rule: `threats_open: 0 → skip to Step 6 directly`.

### Audit 2026-04-20 — Re-verification (State A)

- Trigger: 使用者再次呼叫 `$gsd-secure-phase 04`；SECURITY.md 已存在，入口進入 State A「audit existing」分支。
- Spot-check sample (5/19)：重新 grep 關鍵證據鏈，確認稽核底稿仍有效——
  - **T-04-01** `RESOURCE_NOT_FOUND` 常數存在於 `src/shared/kernel/errors.ts:47-49` ✓
  - **T-04-03** 3× `onDelete: 'cascade'` 仍在 `src/agents/infrastructure/schema/{agent,eval-dataset,prompt-version}.schema.ts` ✓
  - **T-04-04** `biome.json` 對 `src/**/domain/**` 的 6 條 `noRestrictedImports`（drizzle-orm / postgres / elysia / better-auth / @bogeychan/elysia-logger / pino）皆存在並含 ADR 引用 ✓
  - **T-04-09** `MAX_RETRY = 24` 仍在 `src/agents/application/usecases/create-prompt-version.usecase.ts:19` ✓
  - **T-04-11** `tests/integration/agents/module-smoke.test.ts` 等 9 支整合測試檔案齊備 ✓
- 無新威脅引入（自 2026-04-20 B 輪以來 `src/agents/**`、`drizzle/0002_demo_domain.sql`、`biome.json` 未再變更）。
- 3 項 Accepted Risks (AR-04-01/02/03) 狀態維持不變。
- Step 4 gate 與 Step 5 auditor spawn 再次依 `threats_open: 0 → skip to Step 6` 規則略過。

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-20 (re-verified 2026-04-20 via State A spot-check)
