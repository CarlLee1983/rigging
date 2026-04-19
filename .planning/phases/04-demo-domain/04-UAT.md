---
status: complete
phase: 04-demo-domain
source:
  - 04-01-SUMMARY.md
  - 04-02-SUMMARY.md
  - 04-03-SUMMARY.md
  - 04-04-SUMMARY.md
started: 2026-04-19T15:21:42.000Z
updated: 2026-04-19T15:27:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: |
  Stop any running server. `bun run dev` boots clean, no errors. `curl http://localhost:3000/health`
  returns 200 with JSON `{ status: "ok", db: "up" | "down" }`. (src/bootstrap/app.ts changed in
  this phase — this guards against plugin-ordering or wire regressions.)
result: pass

### 2. Full Test Suite Green
expected: |
  Run `bun test` from the repo root. All tests pass — specifically the 8 integration tests under
  `tests/integration/agents/` (agent-crud, prompt-version-crud, prompt-version-monotonic,
  eval-dataset-crud, cross-user-404, cascade-delete, dogfood-self-prompt-read,
  scope-check-read-only-key) plus unit tests in `tests/unit/agents/` and `tests/unit/auth/`.
  No skipped tests except the destructive spike probe (gated behind `RIGGING_RUN_DESTRUCTIVE_SPIKE=1`).
result: pass

### 3. Swagger Exposes Phase 4 Routes
expected: |
  With the dev server running, open `http://localhost:3000/swagger` in a browser (or
  `curl http://localhost:3000/swagger/json`). The OpenAPI spec lists route groups for:
    - `/agents` — POST / GET / PATCH :agentId / DELETE :agentId
    - `/agents/{agentId}/prompts` — POST / GET / GET :version / GET latest
    - `/agents/{agentId}/eval-datasets` — POST / GET / GET :datasetId / DELETE :datasetId
  All routes show the `requireAuth` security marker.
result: pass

### 4. Friction Tally Verifier
expected: |
  Run `bash .planning/phases/04-demo-domain/verify-friction-tally.sh; echo $?`. The script
  exits with status 0 (either no friction trigger OR an ADR 0018 exists satisfying the
  DEMO-06 discipline). Stderr/stdout should not report "trigger + no ADR → exit 1".
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
