---
phase: 04-demo-domain
plan: 03
subsystem: agents-presentation
requirements-completed: [DEMO-01, DEMO-02, DEMO-03, DEMO-06]
tags: [elysia, presentation, controller, typebox, module-factory, wire]
provides:
  - "5 TypeBox DTOs validating POST/PATCH bodies 與共享 response schemas (create-agent / update-agent / create-prompt-version / create-eval-dataset / agent-responses)"
  - "3 controllers: agent.controller (flat /agents), prompt-version.controller (prefix /agents/:agentId, 含 /prompts/latest before /prompts/:version), eval-dataset.controller (prefix /agents/:agentId)"
  - "createAgentsModule({ db, logger?, clock? }) factory — 組裝 3 repos + 13 use cases + 3 controllers，不重掛 authContextPlugin"
  - "createApp wire — 於 canonical plugin ordering 中插入 agents module（auth → agents → health）"
  - "integration smoke test — tests/integration/agents/module-smoke.test.ts 透過真實 createApp 驗證 requireAuth macro fire + Swagger 路徑曝光"
affects: [04-04, 05]
patterns: [feature-module-factory, typebox-dto-at-boundary, requireAuth-macro-usage, controller-nested-prefix, framework-aware-presentation]
key-files:
  created:
    - src/agents/presentation/dtos/create-agent.dto.ts
    - src/agents/presentation/dtos/update-agent.dto.ts
    - src/agents/presentation/dtos/create-prompt-version.dto.ts
    - src/agents/presentation/dtos/create-eval-dataset.dto.ts
    - src/agents/presentation/dtos/agent-responses.dto.ts
    - src/agents/presentation/controllers/agent.controller.ts
    - src/agents/presentation/controllers/prompt-version.controller.ts
    - src/agents/presentation/controllers/eval-dataset.controller.ts
    - src/agents/agents.module.ts
    - tests/integration/agents/module-smoke.test.ts
  modified:
    - src/bootstrap/app.ts
key-decisions:
  - "EvalCase TypeBox shape 鎖定為 { input: Type.String(), expectedOutput: Type.String() }；於 create-eval-dataset.dto.ts 匯出 EvalCaseSchema 作為 D-04 single-source-of-truth，被 response DTO 跨檔引用"
  - "PromptVersion / EvalDataset controllers 採 new Elysia({ prefix: '/agents/:agentId' })，而非重複宣告完整路徑 — RESEARCH Pattern 6 nested-prefix routing"
  - "每個 handler 使用 canonical cast `(context as unknown as { authContext: AuthContext }).authContext`，禁用 @ts-ignore / as any — 違反即 D-15 structural friction"
  - "createAgentsModule 不 re-mount authContextPlugin — P3 macro 已 global scope，重掛屬 anti-pattern"
  - "createApp plugin order 保持 auth → agents → health — agents 必須在 auth 後（macro 已解析），health 維持最後以最小化 diff"
  - "prompt-version.controller 內 /prompts/latest 宣告於 /prompts/:version 之前 — Elysia route matcher 按宣告順序匹配，反序會讓 'latest' 被解析為 version 字串"
duration: unknown (executed out-of-band 2026-04-19)
completed: 2026-04-19
---

# Phase 04-03: Presentation + Module Wire Summary

**交付 agents domain 的 HTTP presentation 層（5 DTOs + 3 controllers）、createAgentsModule 工廠，以及 createApp 一行 wire-up，並以 composability smoke test 驗證第二個 feature module 能安全接入 P3 global requireAuth macro。**

## Performance
- **Duration:** unknown (executed out-of-band 2026-04-19)
- **Tasks:** 3 plan tasks（DTOs / controllers+module / wire+smoke）合併為單一 commit
- **Files modified:** 11（10 new + 1 modified）；+599 insertions

## Accomplishments
- **TypeBox DTO set** — POST/PATCH body 於 controller 邊界驗證；EvalCase `{input, expectedOutput}` 以 `Type.Array(EvalCaseSchema, { minItems: 1, maxItems: 1000 })` 強制 jsonb payload shape，補足 schema `.$type<>()` 僅為 phantom type 的 runtime gap
- **3 controllers with nested routes** — agent.controller 負責 flat `/agents` CRUD；prompt-version / eval-dataset 透過 `prefix: '/agents/:agentId'` 自然巢狀，避免每條 route 重複寫完整路徑
- **createAgentsModule factory** — 複用 /health 的 factory pattern（比 /auth 更簡、不含 `.mount()`）、組裝 3 repos + 13 use cases + 3 controllers 為單一 Elysia plugin
- **createApp 一行 wire-up** — `src/bootstrap/app.ts` 僅新增 1 個 import + 1 個 `.use(createAgentsModule({ db, logger }))`，證明 feature-module factory 可合成性為真
- **Smoke test** — 以真實 `createApp(TEST_CONFIG, { authInstance: createFakeAuthInstance() })` 驗證 anonymous POST/GET 皆回 401（global macro 在新 routes fire）、Swagger JSON 曝光 `/agents` / `/prompts` / `/eval-datasets` 群組

## Task Commits
1. **presentation + module factory + createApp wire + smoke test**（合併提交）— `618939b`

## Files Created/Modified

### `src/agents/presentation/dtos/` — 5 TypeBox DTO 檔
- `create-agent.dto.ts` — `CreateAgentBodySchema = { name: string(1..128) }`
- `update-agent.dto.ts` — `UpdateAgentBodySchema = { name: string(1..128) }`
- `create-prompt-version.dto.ts` — `CreatePromptVersionBodySchema = { content: string(1..65536) }`（65 KB upper bound）
- `create-eval-dataset.dto.ts` — `EvalCaseSchema` + `CreateEvalDatasetBodySchema`（D-04 EvalCase source-of-truth）
- `agent-responses.dto.ts` — 共享 response schemas（Agent / PromptVersion / EvalDataset + 三個 list 版本）；全部使用 `Type.String({ format: 'date-time' })`，禁用 `Type.Date()`

### `src/agents/presentation/controllers/` — 3 controllers
- `agent.controller.ts` — 5 routes（POST/GET list/GET :agentId/PATCH/DELETE），flat 無 prefix
- `prompt-version.controller.ts` — 4 routes，`prefix: '/agents/:agentId'`，`/prompts/latest` 宣告於 `/prompts/:version` 之前
- `eval-dataset.controller.ts` — 4 routes，`prefix: '/agents/:agentId'`，`POST /eval-datasets` / `GET /eval-datasets` / `GET /eval-datasets/:datasetId` / `DELETE /eval-datasets/:datasetId`

### `src/agents/agents.module.ts` — factory
- 匯出 `AgentsModuleDeps` (`{ db, logger?, clock? }`) 與 `createAgentsModule(deps)`
- 內部實例化 3 repos + 13 use cases + 3 controllers，回傳 `new Elysia({ name: 'rigging/agents' }).use(...)`
- 明確**不** re-mount `authContextPlugin`

### `src/bootstrap/app.ts` — createApp wire
- 新增 `import { createAgentsModule } from '../agents/agents.module'`
- plugin chain: `requestLogger → cors → errorHandler → swagger → createAuthModule → createAgentsModule → createHealthModule`（確認 agents 位於 auth 後、health 前）

### `tests/integration/agents/module-smoke.test.ts` — composability smoke
- 使用現有 P3 harness（`TEST_CONFIG` + `createFakeAuthInstance()`），不依賴 Plan 04-04 尚未建立的 `_helpers.ts`
- 4 assertions：anonymous POST `/agents` → 401、GET `/agents/xyz/prompts/latest` → 401、GET `/agents/xyz/eval-datasets` → 401、`GET /swagger/json` → 200 且 paths 包含 `/agents`、`/prompts`、`/eval-datasets`

## Decisions & Deviations

### 重要決策
- **EvalCase schema 單一來源** — `EvalCaseSchema` 定義於 `create-eval-dataset.dto.ts` 並被 `agent-responses.dto.ts` 跨檔 import，避免兩處 drift（D-04 鎖定）
- **Nested prefix over repeated path** — prompt-version / eval-dataset controllers 選用 `prefix: '/agents/:agentId'`（RESEARCH Pattern 6），相較於每條 route 寫 `/agents/:agentId/prompts` 減少重複與路徑 typo 風險
- **不 re-mount authContext macro** — P3 `createAuthModule` 內 `.use(authContextPlugin({ identity }))` 已 global scope，Plan 04-03 controllers 僅需 `requireAuth: true` 即自動解析；`createAgentsModule` 刻意省略 auth plugin import
- **Canonical plugin ordering 保留** — createApp 僅在既有 chain 中插入 agents module，`createHealthModule` 保持鏈尾位置以最小化 diff
- **Handler cast idiom 無退讓** — 13 個 handler 全部使用 `(context as unknown as { authContext: AuthContext }).authContext`，無 `@ts-ignore` / `as any`（grep 驗證）

### 與 PLAN.md `files_modified` 差異
- PLAN 原預計拆成 3 個 atomic commits（DTOs / controllers+module / wire+smoke），實際 out-of-band 執行時合併為單一 commit `618939b`（commit subject `feat(04): [agents] presentation + createAgentsModule + createApp wire + smoke test`）— 非結構性偏離，檔案清單與 PLAN `files_modified` 完全一致（11 files）
- 無其他檔案或介面偏離

## Next Phase Readiness

- **04-04 integration tests** 現可鎖定真實 `createApp` wire 測試：已有 createAgentsModule 於 plugin chain、requireAuth macro 於新 routes fire、Swagger 曝光 route groups；04-04 只需補上 DB-backed `tests/integration/agents/_helpers.ts` 與實際行為測試（CRUD happy path / ownership 跨 actor / EvalCase validation / prompt-version atomic insert）
- **Phase 5 quickstart** 已具備完整 OpenAPI 3.x 文件（`/swagger/json` 包含 agents、agents/prompts、agents/eval-datasets 三個 tag 群組與 `cookieAuth` + `apiKeyAuth` security schemes）
- **P3 regression sanity** — 依 PLAN acceptance criteria，`tests/integration/auth/macro-scope-global.test.ts` 應仍為 green；若 04-04 執行發現 P3 regress，即為 agents wire-up 破壞 plugin chain 的 early-warning
