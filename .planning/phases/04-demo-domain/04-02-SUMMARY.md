---
phase: 04-demo-domain
plan: 02
subsystem: agents-application
requirements-completed: [DEMO-01, DEMO-02, DEMO-03, DEMO-05]
tags: [ddd, drizzle, usecase, mapper, repository, scope-check, ownership, race-condition]
provides:
  - Three framework-aware Drizzle repositories (DrizzleAgentRepository, DrizzlePromptVersionRepository, DrizzleEvalDatasetRepository) implementing their respective ports
  - Three domain↔row mappers (AgentMapper, PromptVersionMapper, EvalDatasetMapper with defensive jsonb parseCases)
  - Thirteen use cases establishing the canonical scope→ownership prologue pattern across Agent / PromptVersion / EvalDataset resources
  - Atomic INSERT ... ON CONFLICT DO NOTHING RETURNING with bounded retry (N=3) for monotonic prompt version assignment under concurrency (D-06)
  - Five unit tests covering the highest-risk invariants (scope rejection, cross-user 404, retry-on-conflict, retry exhaustion, happy paths)
  - Port widening of CreatePromptVersionCommand to include readonly version field (Option A from PLAN)
affects: [04-03, 04-04, 05]
patterns:
  - scope-check-then-ownership-check prologue
  - mapper-isolated-drizzle-leak
  - atomic-insert-on-conflict-bounded-retry
  - port-implementation-via-mapper
tech-stack:
  added: []
  patterns: [DDD four-layer, Repository + Mapper, AuthContext identity boundary, ON CONFLICT DO NOTHING RETURNING]
key-decisions:
  - "Scope check (D-13) MUST appear BEFORE ownership check (D-10) in every write use case — otherwise a read-only key writing to a cross-user agent would return 404 instead of 403 (RESEARCH Pitfall 5)"
  - "Cross-user access returns 404 (ResourceNotFoundError) rather than 403, to prevent resource-existence enumeration (D-09, T-04-08)"
  - "Atomic INSERT ... ON CONFLICT (agent_id, version) DO NOTHING RETURNING used instead of SELECT-then-INSERT — the UNIQUE constraint closes the TOCTOU window inside PostgreSQL (RESEARCH Pitfall 2)"
  - "Bounded retry N=3; on exhaustion throw PromptVersionConflictError (agents-local, httpStatus 500) to prevent DoS via infinite retry (T-04-09)"
  - "Mappers act as Drizzle-leak firewall — repositories map row→domain before returning, so InferSelectModel never escapes the infrastructure layer"
  - "Port widening (Option A): CreatePromptVersionCommand gains readonly version: number in this plan, completing the contract shipped by 04-01 Task 2 rather than using intersection-type workaround"
completed: 2026-04-19
---

# Phase 04-02: Agents Infra + Application (Mappers / Drizzle Repos / 13 Use Cases / 5 Unit Tests) Summary

**建立 agents 子系統的 infrastructure 映射層與 application 使用案例層，確立「scope→ownership 雙閘門 prologue」與「原子 ON CONFLICT + 有限重試」兩大樣板，並以 5 個關鍵不變量單元測試鎖定風險。**

## Performance
- **Duration:** unknown（out-of-band 執行於 2026-04-19，採原子 commit 提交）
- **Tasks:** 3（皆綠）
- **Files modified:** 25 個檔案（infra 7、application 13、test 5）
- **Inserted lines:** 1,157（infra 234 + usecase 377 + tests 546）

## Accomplishments
- **Infra 層映射 + 倉儲（6 檔 + port 擴充）**：完成 `AgentMapper` / `PromptVersionMapper` / `EvalDatasetMapper`（後者含 `parseCases` 防禦性 jsonb 解析），以及對應三個 Drizzle 倉儲。`DrizzlePromptVersionRepository.createAtomic` 透過 `.onConflictDoNothing({ target: [promptVersion.agentId, promptVersion.version] }).returning()` 原子化配發版本號。
- **Application 層 13 個 use case（scope→ownership prologue 定型）**：
  - Agent 5 個：`CreateAgentUseCase` / `GetAgentUseCase` / `ListAgentsUseCase` / `UpdateAgentUseCase` / `DeleteAgentUseCase`
  - PromptVersion 4 個：`CreatePromptVersionUseCase`（含 retry 迴圈）/ `GetLatestPromptVersionUseCase` / `GetPromptVersionUseCase` / `ListPromptVersionsUseCase`
  - EvalDataset 4 個：`CreateEvalDatasetUseCase` / `GetEvalDatasetUseCase` / `ListEvalDatasetsUseCase` / `DeleteEvalDatasetUseCase`
- **原子版本指派 + 有限重試**：`CreatePromptVersionUseCase` 以 `MAX_RETRY = 3` 為界，每次重讀 `findLatestByAgent`、嘗試 `createAtomic`；連續三次 `null` 即拋出 `PromptVersionConflictError`，避免 DoS。
- **單元測試 5 檔鎖定最高風險不變量**：scope 拒絕、cross-user 404、happy-path、retry-on-null、retry 耗盡三次皆經測試驗證。
- **Port 契約完成**：`CreatePromptVersionCommand` 加入 `readonly version: number`（Option A），讓倉儲簽章保持乾淨無 intersection workaround。
- **框架純淨性**：application 層未匯入 drizzle-orm / elysia / postgres / pino，維持 DDD 四層紀律。

## Task Commits
1. **Task 1: Infra — mappers + Drizzle repositories（含原子 ON CONFLICT）** — `956bcf2`
2. **Task 2: Application — 13 use cases with scope+ownership prologue + retry** — `0ecf3e8`
3. **Task 3: Unit — scope/ownership/retry invariants for 5 key use cases** — `54c57fc`

## Files Created/Modified

### Infrastructure layer — mappers（`src/agents/infrastructure/mappers/`）
- `agent.mapper.ts` — `AgentMapper.toDomain(row)`；brand cast `id` / `ownerId`
- `prompt-version.mapper.ts` — `PromptVersionMapper.toDomain(row)`；brand cast
- `eval-dataset.mapper.ts` — `EvalDatasetMapper.toDomain(row)` + `parseCases(raw)` 防禦式過濾（非陣列→[]、不合格 entry 丟棄）

### Infrastructure layer — repositories（`src/agents/infrastructure/repositories/`）
- `drizzle-agent.repository.ts` — `findById` / `listByOwner` / `create` / `update` / `delete`（回傳 boolean）
- `drizzle-prompt-version.repository.ts` — `findLatestByAgent` / `findByAgentAndVersion` / `listByAgent` / `createAtomic`（ON CONFLICT DO NOTHING RETURNING，conflict 回傳 null）
- `drizzle-eval-dataset.repository.ts` — `findById` / `listByAgent` / `create` / `delete`

### Application layer — ports（`src/agents/application/ports/`）
- `prompt-version-repository.port.ts` — **擴充**：`CreatePromptVersionCommand` 加入 `readonly version: number`（Option A 契約收斂，取代 intersection workaround）

### Application layer — use cases（`src/agents/application/usecases/`，13 檔）
Agent（5）：
- `create-agent.usecase.ts` — scope only；`ownerId = ctx.userId`；`newAgentId()`；`trim()` name
- `get-agent.usecase.ts` — ownership only（讀）
- `list-agents.usecase.ts` — 無 prologue（`listByOwner(ctx.userId)` 隱含 scope）
- `update-agent.usecase.ts` — scope + ownership；`trim()` + `updatedAt = clock.now()`
- `delete-agent.usecase.ts` — scope + ownership；FK 級聯由 DB 處理（D-12）

PromptVersion（4）：
- `create-prompt-version.usecase.ts` — scope + ownership + `MAX_RETRY=3` 迴圈（MAX+1→createAtomic→null 則重試）；耗盡拋 `PromptVersionConflictError`
- `get-latest-prompt-version.usecase.ts` — ownership；無 prompt 時也拋 `ResourceNotFoundError`（D-09 一致性）
- `get-prompt-version.usecase.ts` — ownership + 指定版號查找
- `list-prompt-versions.usecase.ts` — ownership；DESC by version

EvalDataset（4）：
- `create-eval-dataset.usecase.ts` — scope + ownership；`cases` 快照複製
- `get-eval-dataset.usecase.ts` — ownership + URL-agentId 對 stored-agentId 雙重確認（防路徑竄改）
- `list-eval-datasets.usecase.ts` — ownership
- `delete-eval-dataset.usecase.ts` — scope + ownership + URL-agentId 對 stored-agentId 確認

### Tests — unit（`tests/unit/agents/`，5 檔）
- `create-agent.usecase.test.ts` — scope 拒絕、happy-path（trim / ownerId / timestamps）
- `update-agent.usecase.test.ts` — scope 拒絕、agent 不存在 / cross-user 皆 404、happy-path
- `create-prompt-version.usecase.test.ts`（最關鍵）— scope 拒絕、agent null、cross-user 404、首次 v1 happy-path、latest+1 happy-path、retry-on-null 成功、retry 耗盡拋 `PromptVersionConflictError`
- `get-latest-prompt-version.usecase.test.ts` — agent null、cross-user、無 prompt、happy-path
- `create-eval-dataset.usecase.test.ts` — scope 拒絕、cross-user、happy-path（agentId / cases length / createdAt）

## Decisions & Deviations

**關鍵決策**
- **Scope → Ownership → Work 順序（P4 canonical prologue）**：所有 write use case 先 `if (!ctx.scopes.includes('*')) throw InsufficientScopeError`，再 `findById` 做 ownership 比對，最後才執行資料變更。順序顛倒會讓「read-only key 寫 cross-user agent」回 404 而非 403，無法通過 DEMO-05 驗收。
- **404 優於 403（cross-user）**：`!agent || agent.ownerId !== ctx.userId` 合併為單一分支，皆拋 `ResourceNotFoundError`；封住資源存在性列舉（T-04-08）。
- **原子 ON CONFLICT 取代 SELECT-then-INSERT**：`onConflictDoNothing({ target: [agentId, version] }).returning()` 於 PostgreSQL 層關閉 TOCTOU 視窗；倉儲 conflict 回傳 null，交由 use case retry。
- **Retry 上界 N=3**：避免病態並發造成的無限迴圈 DoS（T-04-09）；耗盡即丟 `PromptVersionConflictError`（agents-local、500）。
- **Mapper 作為 Drizzle 外漏防火牆**：每個倉儲回傳前呼叫 `*.Mapper.toDomain(row)`，`InferSelectModel` / 任何 Drizzle 型別不會穿越 infrastructure 邊界。
- **Port Option A（契約收斂）**：`CreatePromptVersionCommand` 於本 plan 擴充 `readonly version: number`，讓 `createAtomic(cmd)` 簽章乾淨；而非 04-01 維持原 port、於此用 intersection type 繞過。
- **5 個單元測試取捨**：僅挑風險最高的 5 個 use case 做單元覆蓋（scope / ownership / retry 不變量）；其餘 end-to-end 行為交由 04-04 整合測試驗證，避免測試成本爆炸。

**偏離**
- PLAN `files_modified` 未列出 `src/agents/application/ports/prompt-version-repository.port.ts`，但 commit `956bcf2` 實際修改了該檔（屬 Option A 合法調整，PLAN 的 `<action>` 區段已預告）。
- 未觀察到其他偏離；13 use case、6 infra 檔、5 test 檔數量與 PLAN 完全一致。
- 無新增 `04-HARNESS-FRICTION.md` 條目（out-of-band 執行，摩擦事件未記錄）。

## Next Phase Readiness
04-03（Presentation / controllers / module wiring）可直接：
- 注入現成的 13 個 use case；controller 僅負責 TypeBox 驗證 → 呼叫 `useCase.execute(ctx, input)` → 映射錯誤到 HTTP 狀態碼。
- 從 DI container 取出 `DrizzleAgentRepository` / `DrizzlePromptVersionRepository` / `DrizzleEvalDatasetRepository` 注入 use case。
- 於 `createAgentsModule` 中組合三類資源的路由，掛到 `createApp` AuthContext 後。

04-04（整合測試）將以 HTTP e2e 驗證：
- Scope 拒絕（read-only key → 403）
- Cross-user 404 矩陣（GET/PATCH/DELETE/POST）
- 10 併發 POST PromptVersion → 版本號 1..10 無洞無重（驗證原子 ON CONFLICT + retry 的端到端行為）
- jsonb 惡意 payload 仍被 TypeBox + `parseCases` 層雙重阻擋

05（下一 milestone）可基於此 prologue 樣板向其他資源複製 DDD 骨架。
