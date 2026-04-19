---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/phases/04-demo-domain/04-CONTEXT.md (D-01..D-05, D-17)
informed: future AI Agents and future maintainers
---

# 0017. EvalDataset Shape Frozen at v1 (jsonb cases, immutable after creation)

## Context and Problem Statement

Phase 4 introduces the `EvalDataset` entity as part of the Agent 元專案 dogfood. The entity stores a
name plus a collection of test cases — each case being `{ input: string; expectedOutput: string }`.
Two axes of design freedom existed:

1. **Storage shape** — single jsonb column `cases` vs. normalized `eval_case` child table with per-row
   FK back to `eval_dataset`.
2. **Mutability** — allow PATCH / append / per-case edit endpoints vs. immutable after POST (DELETE-only).

Without an ADR, future contributors may add PATCH endpoints or normalize the table to gain per-case
filtering, silently diverging from what Phase 4 shipped. This ADR locks v1 shape so that v2
supersession is explicit.

## Decision Drivers

- D-03 — EvalDataset as child entity with jsonb cases
- D-04 — EvalCase shape frozen at `{ input, expectedOutput }` (no metadata)
- D-05 — Dataset cases immutable; POST one-shot, DELETE-only mutation
- D-17 — CONTEXT requires this ADR shipped in Plan 04-04
- Project Core Value — harness does not prescribe LLM evaluation details
- Anti-features (PROJECT.md) — no eval runner, no LLM integration, no real-time events in v1
- RESEARCH.md §Pattern 3 — `.$type<>()` is compile-time-only; runtime integrity must come from TypeBox at boundary

## Considered Options

- **Option A — jsonb cases, immutable, DELETE-only (chosen)**
- Option B — normalized `eval_case` table with FK to `eval_dataset`
- Option C — jsonb cases + PATCH / append-case endpoint

## Decision Outcome

Chosen option: **A — jsonb cases column with `.$type<Array<{input, expectedOutput}>>()`; immutable after
creation; DELETE-only mutation**. Rationale:

- **Aggregate boundary clarity** — The entire dataset is an atomic unit (one row = one complete test set).
  This matches Agent aggregate thinking from P4 CONTEXT D-01 (Agent owns PromptVersion + EvalDataset as
  children).
- **Simplest possible v1** — POST writes the whole dataset; GET returns the whole dataset; DELETE removes
  the whole dataset. Three endpoints total. No partial-mutation complexity.
- **Reproducibility by construction** — Immutability means the same `datasetId` always identifies the
  same case set. External eval runners can reference a dataset id without defending against drift.
- **Harness non-prescription** — The harness does NOT dictate per-case stats, metadata, or tagging.
  Users who need those add them in v2 with an ADR that supersedes this one.

### Consequences

**Good**
- Three endpoints instead of ten (no per-case CRUD surface to maintain).
- Schema simplicity — one jsonb column, one FK, one UNIQUE-free table.
- TypeBox at the boundary (Plan 04-03 `CreateEvalDatasetBodySchema`) is the single runtime guard;
  Plan 04-02 mapper `parseCases` is defensive belt-and-suspenders.
- ADR supersession path is clear: v2 normalization requires a new ADR that this ADR explicitly allows
  to supersede it.

**Bad**
- "Add one case to an existing dataset" workflow = construct new dataset with old cases + new case.
  Users who want an append-case convenience must wait for v2 or build it client-side.
- Per-case filtering (e.g., "show me all cases where input contains X") requires jsonb operators, not
  indexed columns. For v1 demo-scale this is irrelevant; production use might need normalization.
- Schema evolution of EvalCase shape is an ADR-superseding operation. A silent schema push that
  reshapes cases from `{input, expectedOutput}` to `{input, expected, tags?}` would be caught at read
  time by the defensive `parseCases` filter (dropping malformed entries) but NEVER silently migrates
  existing data. Fix path: ship a supersession ADR and a migration script.

**Note**
- v2 supersession path — if per-case stats / metadata / sharing is required, ship
  `docs/decisions/0XXX-eval-dataset-normalized-cases.md` with `supersedes: [0017]`. That ADR
  must include a data-migration plan for moving jsonb rows into the normalized table (e.g., a batch
  script operating through `bun run scripts/migrate-eval-cases.ts`).
- The `.$type<Array<{input, expectedOutput}>>()` cast on the Drizzle column is compile-time only; it
  does NOT gate runtime writes. All writes go through `CreateEvalDatasetBodySchema` at the HTTP
  boundary. Attempts to bypass (e.g., direct SQL `INSERT` in tests) will store whatever shape the SQL
  provides — expected and acceptable (tests may seed broken data to exercise defensive read paths).

## Pros and Cons of the Options

### Option A — jsonb cases, immutable, DELETE-only (chosen)

- Good: Single write endpoint. Single DB column for all cases. Aggregate boundary clear.
- Good: Reproducible — same `datasetId` forever means same case set.
- Good: v2 supersession path is explicit (new ADR).
- Bad: No per-case filtering without jsonb path expressions.
- Bad: "Append case" workflow requires client-side dataset reconstruction.

### Option B — normalized `eval_case` table

- Good: Per-case queries / stats / filtering are first-class.
- Good: Append / edit / delete individual cases is natural.
- Bad: Five endpoints instead of three (POST dataset, GET dataset, DELETE dataset, PATCH/POST case,
  DELETE case). Each endpoint needs its own ownership check + scope check. More surface.
- Bad: More schema (one extra table + FK + UNIQUE on (datasetId, caseOrder) if ordering matters).
- Bad: v1 demo does not need any of this — YAGNI.

### Option C — jsonb cases + PATCH / append-case endpoint

- Good: Storage stays simple (still jsonb).
- Bad: Mutability defeats the "dataset id = immutable snapshot" reproducibility guarantee. External
  eval runners must handle case-set drift.
- Bad: Append-case semantics (ordered? unordered?) becomes a design question the harness does not
  want to answer in v1.

## References

- `.planning/phases/04-demo-domain/04-CONTEXT.md` D-01..D-05, D-17
- `.planning/phases/04-demo-domain/04-RESEARCH.md` §Pattern 3 (jsonb + TypeBox boundary validation)
- `.planning/phases/04-demo-domain/04-PATTERNS.md` §18 (this ADR shape reference)
- ADR 0003 — DDD layering
- ADR 0005 — ORM Drizzle (pinned 0.45.2)
- ADR 0013 — API Key storage hash+index (comparable feature-level schema ADR)
- PostgreSQL jsonb docs — https://www.postgresql.org/docs/16/datatype-json.html
- Anthropic "Demystifying evals for AI agents" (2025) — evaluation dataset shape guidance cited in
  RESEARCH.md informs the locked shape
- LangChain Agent Evaluation Readiness Checklist (2025) — input/expectedOutput is the minimal viable
  shape across modern eval frameworks
