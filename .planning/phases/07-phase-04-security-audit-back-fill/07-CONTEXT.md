# Phase 7: Phase 04 Security Audit Back-fill - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Retroactive **documentation + evidence alignment** for SEC-01: bring `.planning/phases/04-demo-domain/04-SECURITY.md` into full conformance with `.planning/ROADMAP.md` Phase 7 success criteria and `.planning/REQUIREMENTS.md` SEC-01 — without expanding Phase 04 product scope.

**Already true:** `04-SECURITY.md` exists (status `verified`, 19-row threat register, audit trail, accepted risks). **Gaps vs ROADMAP/SEC-01:** explicit subsections for **CVE-2025-61928 regression at v1.1 head**, **API Key hash timing-safe verification**, and a **cross-user 404 matrix** mapped to concrete tests (and line-level evidence where useful).

**Not in scope:** New domain features, new endpoints, changing auth behavior, or re-auditing Phase 03-only surface except as cross-referenced evidence for Phase 04 + shared auth paths.

</domain>

<decisions>
## Implementation Decisions

### Deliverable strategy

- **D-01 — Phase 7 is primarily a docs + verification delta, not a greenfield audit** — Start from existing `04-SECURITY.md`. Prefer **editing in place** (add sections, tighten canonical refs) over replacing the file. Re-run `$gsd-secure-phase 04` **only if** executor discovers threat-model drift or stale evidence; default path is **State A–style spot-check** + `bun test` for cited suites at current `HEAD`.
- **D-02 — Single plan by default** — One Phase 7 plan that: (1) runs/records `bun test` for the regression suites cited below, (2) updates `04-SECURITY.md` with the three ROADMAP-mandated evidence blocks, (3) commits. Split into two plans only if implementation work appears (e.g., new integration test — see D-06).

### CVE-2025-61928 (SEC-01 §b / ROADMAP criterion 3)

- **D-03 — Document as Phase 04 + harness context, evidence in Phase 3** — The attack pattern is **unauthenticated `POST /api-keys` with victim `userId` in body** (AUTH-15). Defense lives in `CreateApiKey` / API Key controller path (Phase 3). Phase 04 **does not duplicate** a second CVE integration test; SECURITY.md must state clearly that **regression coverage** is `tests/integration/auth/cve-2025-61928.regression.test.ts` and that Phase 04 APIs remain protected because **global auth plugin + AuthContext** still apply at v1.1.
- **D-04 — SECURITY.md must add a dedicated short section** with: link to [ZeroPath CVE write-up](https://zeropath.com/blog/breaking-authentication-unauthenticated-api-key-creation-in-better-auth-cve-2025-61928), test file path, command to run (`bun test tests/integration/auth/cve-2025-61928.regression.test.ts` or project `test:regression` if applicable), and **explicit note that evidence was re-checked at v1.1 head** (commit SHA recorded at execute time — placeholder for planner/executor to fill).

### API Key hash timing-safe compare (SEC-01 §c / ROADMAP criterion 4)

- **D-05 — Cite existing benchmark + implementation** — Document `tests/integration/auth/timing-safe-apikey.regression.test.ts`: 1000-iteration ratio gate (`|t_malformed - t_wrong_hash| / t_wrong_hash < 0.2`). Reference implementation intent per Phase 3 D-10: `crypto.timingSafeEqual` on API Key verify path in `BetterAuthIdentityService` (exact path from codebase at execute time).
- **D-06 — Re-run policy** — If HEAD changes touch `src/auth/**` or identity adapter, re-run this test file once and record pass + optional logged ratio line in SECURITY.md audit trail. No new benchmark unless the existing test is deleted or materially weakened.

### Cross-user 404 matrix — read / update / delete / list (SEC-01 §d / ROADMAP criterion 5)

- **D-07 — Verb mapping to current tests** — Use this mapping for SECURITY.md evidence table:
  - **Read (single resource):** `tests/integration/agents/cross-user-404.test.ts` — `User B GET /agents/:userAAgentId → 404`.
  - **Read (nested “latest”):** `tests/integration/agents/dogfood-self-prompt-read.test.ts` — Variant 3: User B API Key → `GET /agents/.../prompts/latest` → 404 `RESOURCE_NOT_FOUND`.
  - **Update:** `cross-user-404.test.ts` — `PATCH /agents/:id`.
  - **Delete:** `cross-user-404.test.ts` — `DELETE /agents/:id`.
  - **List:** ROADMAP wording implies **collection read** on Phase 04 routes. **Gap:** no dedicated **User B `GET /agents/:userAAgentId/prompts` (list prompts)** cross-user test was found next to the existing matrix. **Lock:** During execute, either **add one integration test** asserting 404 + `RESOURCE_NOT_FOUND` for that route, **or** justify in SECURITY.md with code-level proof that the list handler shares the same ownership gate as single-read (cite use case + controller) **and** point to the two read tests above as sufficient for “read path” enumeration safety. Planner must choose one branch and record the decision in the plan.

### the agent's Discretion

- Exact subsection titles and table formatting inside `04-SECURITY.md` (merge into “Security Audit Trail” vs new “SEC-01 compliance” appendix) — executor chooses for readability as long as ROADMAP criteria are visibly satisfied.
- Whether to duplicate one paragraph of Phase 3 CONTEXT into Phase 04 SECURITY vs cross-link only — prefer **cross-link + one summary paragraph** to avoid drift.

### Folded Todos

None (no `gsd-sdk todo.match-phase` in this environment).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase / requirements
- `.planning/ROADMAP.md` — `### Phase 7` (goal, success criteria 1–5, SEC-01 pointer)
- `.planning/REQUIREMENTS.md` — `SEC-01` (full bullet a–d)
- `.planning/phases/04-demo-domain/04-SECURITY.md` — current threat register + audit trail (edit target)

### Prior phase intent
- `.planning/phases/04-demo-domain/04-CONTEXT.md` — Phase 04 boundary; CVE note “P4 does not re-test CVE — verify P3 regression suite still passes”
- `.planning/phases/03-auth-foundation/03-CONTEXT.md` — AUTH-15 / CVE / timing / dual-rail decisions

### Code / tests (evidence anchors)
- `tests/integration/auth/cve-2025-61928.regression.test.ts` — CVE-2025-61928 regression
- `tests/integration/auth/timing-safe-apikey.regression.test.ts` — timing alignment ratio benchmark
- `tests/integration/agents/cross-user-404.test.ts` — cross-user GET/PATCH/DELETE/POST… matrix (POST covers write path; see D-07 for list gap)
- `tests/integration/agents/dogfood-self-prompt-read.test.ts` — cross-user read on nested latest prompt

### External
- [CVE-2025-61928 — ZeroPath](https://zeropath.com/blog/breaking-authentication-unauthenticated-api-key-creation-in-better-auth-cve-2025-61928)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- **04-SECURITY.md** — 19-row threat register + accepted risks; extend, do not discard.
- **Regression suite** — Phase 5 / `docs/architecture.md` already maps CVE + timing tests; align Phase 04 SECURITY wording with those names.

### Established patterns
- **404 anti-enumeration** — `ResourceNotFoundError` / `RESOURCE_NOT_FOUND` on cross-user access (Phase 04 D-09).
- **API Key** — Phase 3 adapter + `timingSafeEqual` + prefix lookup (D-10).

### Integration points
- **Edits** apply to `.planning/phases/04-demo-domain/04-SECURITY.md` only (plus optional new test file under `tests/integration/agents/` if D-07 list gap is closed with a new test).

</code_context>

<specifics>
## Specific Ideas

- User selected **all** discuss areas in this session: deliverable strategy, CVE section, timing-safe evidence, cross-user matrix (including list-verb gap).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 7 scope.

</deferred>

---

*Phase: 07-phase-04-security-audit-back-fill*
*Context gathered: 2026-04-20*
