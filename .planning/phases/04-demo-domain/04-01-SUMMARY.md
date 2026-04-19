---
phase: 04-demo-domain
plan: 01
subsystem: domain
tags: [ddd, drizzle, domain, schema, migration]
provides:
  - ResourceNotFoundError in shared kernel (D-09, distinct code from NOT_FOUND)
  - Agent / PromptVersion / EvalDataset domain entities with branded IDs + readonly invariants
  - PromptVersionConflictError (agents-local 500, D-06 retry-exhaustion signal)
  - Three repository port interfaces (framework-free, domain-layer contracts)
  - Three Drizzle schemas with FK cascade + composite UNIQUE + DESC index + jsonb cases
  - Drizzle migration 0002_demo_domain generated via drizzle-kit and applied to dev DB
  - 04-HARNESS-FRICTION.md friction-log template (D-15/D-16 dogfood tracking)
affects: [04-02, 04-03, 04-04, 05]
tech-stack:
  added: []
  patterns: [brand-type IDs, DDD 4-layer, port interfaces as domain contracts, generated-not-hand-written migration]
key-files:
  created:
    - src/agents/domain/values/ids.ts
    - src/agents/domain/agent.ts
    - src/agents/domain/prompt-version.ts
    - src/agents/domain/eval-dataset.ts
    - src/agents/domain/errors.ts
    - src/agents/domain/index.ts
    - src/agents/application/ports/agent-repository.port.ts
    - src/agents/application/ports/prompt-version-repository.port.ts
    - src/agents/application/ports/eval-dataset-repository.port.ts
    - src/agents/infrastructure/schema/agent.schema.ts
    - src/agents/infrastructure/schema/prompt-version.schema.ts
    - src/agents/infrastructure/schema/eval-dataset.schema.ts
    - drizzle/0002_demo_domain.sql
    - drizzle/meta/0002_snapshot.json
    - .planning/phases/04-demo-domain/04-HARNESS-FRICTION.md
  modified:
    - src/shared/kernel/errors.ts
    - drizzle/meta/_journal.json
key-decisions:
  - "D-09: ResourceNotFoundError 使用獨立 code 'RESOURCE_NOT_FOUND'，不重用 NOT_FOUND — 讓 cross-user 404 與一般 NOT_FOUND 在 controllers/tests 內可精準斷言"
  - "D-05: 三個 ID 採用 brand type (AgentId / PromptVersionId / EvalDatasetId) 透過 shared kernel UUID<K> 產生，消除型別混用"
  - "D-06: PromptVersion 採 append-only + atomic INSERT ON CONFLICT DO NOTHING，port 回傳 null 讓 use case 執行 retry-3；PromptVersionConflictError 僅保留在 agents 本地而非 shared kernel"
  - "D-12: 三條 FK 全部使用 ON DELETE cascade (agent→user / prompt_version→agent / eval_dataset→agent)，杜絕孤兒列"
  - "Task 3: migration 透過 drizzle-kit generate 產生而非手寫，避免 P5 CI drift check 失敗"
requirements-completed: [DEMO-01, DEMO-02, DEMO-03, DEMO-06]
duration: unknown
completed: 2026-04-19
---

# Phase 04-01: Demo Domain 基礎層 Summary

**Phase 4 Demo Domain 的 domain + ports + schema + migration 四層骨架落地，三個 aggregate (Agent / PromptVersion / EvalDataset) 的型別契約、儲存結構與 DB 遷移已全部就位，後續 04-02 / 04-03 / 04-04 可直接在這個 foundation 上擴充 use cases、presentation、與整合測試。**

## Performance
- **Duration:** unknown (executed out-of-band 2026-04-19，採用 atomic commits 策略)
- **Tasks:** 4 / 4 complete
- **Files modified:** 17 files across 4 commits (1 shared kernel + 12 agents + 3 drizzle + 1 planning)

## Accomplishments
- `ResourceNotFoundError` 進入 shared kernel (httpStatus 404, code `RESOURCE_NOT_FOUND`)，為後續 cross-user ownership-aware 404 提供統一錯誤型別
- `src/agents/domain/` 三個 entity + value object (`EvalCase`) + 三個 branded ID + `PromptVersionConflictError` + barrel 全數建立，並通過 Biome `noRestrictedImports` 的 framework-free 檢查
- `src/agents/application/ports/` 三個 repository interface 以純 domain 型別描述契約：`IAgentRepository` (CRUD)、`IPromptVersionRepository` (append-only + `createAtomic` 回傳 nullable)、`IEvalDatasetRepository` (immutable, 無 update)
- `src/agents/infrastructure/schema/` 三張 pgTable 含 cascade FK、`prompt_version_agent_id_version_uq` 複合 UNIQUE、`prompt_version_agent_id_version_idx` DESC 索引、`jsonb('cases').$type<PersistedEvalCase[]>()` 支援
- `drizzle/0002_demo_domain.sql` 由 drizzle-kit generate 產生並套用至 dev DB，snapshot 與 journal 同步更新；`04-HARNESS-FRICTION.md` 空模板就位，等待 04-02 / 04-03 / 04-04 於過程中 dogfood 追加條目

## Task Commits
1. **Task 1: ResourceNotFoundError 追加至 shared kernel** — `ae41a92` feat(04): [shared] 新增 ResourceNotFoundError for cross-user 404 (D-09)
2. **Task 2: agents domain + ports + schema 骨架** — `b71663a` feat(04): [agents] 建立 domain + ports + schema 骨架 (D-01..D-08, D-12)
3. **Task 3: 產生並套用 drizzle 0002 migration** — `7849f94` chore(04): 產生並套用 drizzle/0002_demo_domain migration
4. **Task 4: 04-HARNESS-FRICTION.md 模板** — `656a6d6` docs(04): 新增 04-HARNESS-FRICTION.md 模板 (D-15/D-16 dogfood log)

(Phase-level context commit `20a3f58` 在本 plan 之前落地，非本 plan 範圍)

## Files Created/Modified

### shared/kernel (Task 1)
- `src/shared/kernel/errors.ts` — 追加 `ResourceNotFoundError extends DomainError` (+7 行)

### agents/domain (Task 2)
- `src/agents/domain/values/ids.ts` — `AgentId` / `PromptVersionId` / `EvalDatasetId` brand types + constructors
- `src/agents/domain/agent.ts` — `Agent` interface (readonly fields, owner FK type)
- `src/agents/domain/prompt-version.ts` — `PromptVersion` interface (append-only shape)
- `src/agents/domain/eval-dataset.ts` — `EvalDataset` + `EvalCase` value object
- `src/agents/domain/errors.ts` — `PromptVersionConflictError` (code `PROMPT_VERSION_CONFLICT`, httpStatus 500)
- `src/agents/domain/index.ts` — barrel export (types + ID ctors + error)

### agents/application/ports (Task 2)
- `src/agents/application/ports/agent-repository.port.ts` — `IAgentRepository` (findById/listByOwner/create/update/delete)
- `src/agents/application/ports/prompt-version-repository.port.ts` — `IPromptVersionRepository` + `CreatePromptVersionCommand` (`createAtomic` 回傳 null 於 UNIQUE 衝突)
- `src/agents/application/ports/eval-dataset-repository.port.ts` — `IEvalDatasetRepository` (immutable — 無 update)

### agents/infrastructure/schema (Task 2)
- `src/agents/infrastructure/schema/agent.schema.ts` — `pgTable('agent')`，owner_id FK → user ON DELETE cascade
- `src/agents/infrastructure/schema/prompt-version.schema.ts` — `pgTable('prompt_version')` + composite UNIQUE + DESC index + agent FK cascade
- `src/agents/infrastructure/schema/eval-dataset.schema.ts` — `pgTable('eval_dataset')` + `jsonb('cases')` + agent FK cascade

### drizzle (Task 3)
- `drizzle/0002_demo_domain.sql` — 29 行 generated migration (3 CREATE TABLE + 3 ALTER TABLE ADD CONSTRAINT cascade + UNIQUE + INDEX)
- `drizzle/meta/0002_snapshot.json` — 788 行 snapshot
- `drizzle/meta/_journal.json` — +7 行 (新增 0002 entry)

### planning (Task 4)
- `.planning/phases/04-demo-domain/04-HARNESS-FRICTION.md` — 55 行空白 friction log 模板 (Events + Tally + References 三區)

## Decisions & Deviations

### Decisions (來自 PLAN.md must_haves + 04-CONTEXT/PATTERNS)
- **D-09 separate error code**: `ResourceNotFoundError` 與 `NotFoundError` 同 httpStatus 404 但 code 不同 — 讓 owner-scope 誤讀 vs 純粹資源不存在可被區分，避免 controllers 做 instanceof 鏈
- **D-05 brand-type IDs**: 三個 aggregate 的 ID 皆為 `UUID<'AgentId'>` 等 brand type，防止 `AgentId` 與 `PromptVersionId` 在 port / use case 層意外互換
- **D-06 agents-local error**: `PromptVersionConflictError` 刻意留在 `src/agents/domain/errors.ts` 而非 shared kernel — 此錯誤只會在 concurrent version bump retry-3 後產生，不跨 feature 重用
- **D-12 cascade FK × 3**: agent→user / prompt_version→agent / eval_dataset→agent 全 cascade，刪除 user 或 agent 不留孤兒列
- **Task 3 generated migration**: `bunx drizzle-kit generate --name=demo_domain` 產生後直接 commit，不做任何手動編輯，避免 P5 CI drift check 觸發

### Deviations
None — plan scope matches committed files. `files_modified` 列出的 16 條路徑在四個 commits 中全部落地 (1 shared + 12 agents + 3 drizzle + 1 planning = 17；多一個 `drizzle/meta/0002_snapshot.json` 是 drizzle-kit 自動產物，plan 以 `drizzle/meta/` 萬用字元涵蓋)。無結構性 friction 需補登於 `04-HARNESS-FRICTION.md`。

## Next Phase Readiness

04-02 (agents application + infrastructure 實作) 現在可以：
- 直接 `import type { IAgentRepository } from '../application/ports/agent-repository.port'` 建立 Drizzle 實作
- 直接 `import { PromptVersionConflictError, newPromptVersionId } from '../domain'` 建立 `CreatePromptVersionUseCase` retry-3 流程
- 整合測試可連到 dev DB 上的 `agent` / `prompt_version` / `eval_dataset` 三張實體表執行 end-to-end 驗證
- 04-03 presentation 可透過 `import { ResourceNotFoundError } from '../../shared/kernel'` 回應 cross-user 404
- 04-02 / 04-03 / 04-04 executor 可在遇到 harness 摩擦時追加條目至 `04-HARNESS-FRICTION.md`，並於 Plan 04-04 由 verifier 腳本自動核對 tally
