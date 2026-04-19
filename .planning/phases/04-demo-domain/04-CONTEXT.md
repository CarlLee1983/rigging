# Phase 4: Demo Domain - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning
**Mode:** Interactive（使用者選四區，全部深度討論 → 16 條決策鎖定 + 1 條 ADR 規畫）

<domain>
## Phase Boundary

Phase 4 用 **Agent 元專案（Agent / PromptVersion / EvalDataset）dogfood** 整條 harness——證明拿到 AuthContext 之後，Agent 自己管 prompt 與 evaluation 是 happy path、`createXxxModule(deps): Elysia` factory pattern 在第二個 feature 複用便宜，並量化「harness 太緊」UX 事件供 P5 docs 與後續 ADR 引用。

**規矩在 P1/P2/P3 立、在 P4 dogfood 驗：**
- P1 鋪 DDD 紀律（shared kernel / Biome rules / 12 ADRs / AGENTS.md Rigidity Map）
- P2 驗 DDD 四層模板（health 走完四層）
- P3 把 AuthContext 邊界從抽象論述變強制物理（macro 單一根層 / Runtime Guard / CVE regression）
- **P4 把 harness 自己做給自己用**——Rigging 拿 Rigging 寫的軌道，建出「AI Agent 管自己 prompt + eval dataset」的元專案；若 harness 真的乾淨，這 phase 應該幾乎沒有「要解釋」事件；若 >3 次或任一 structural friction → 主動開 ADR 修 P1 template

**本 phase 為什麼不能拆**（保留為 standard granularity，不像 P3 atomic 那麼硬）：
- DEMO-04 dogfood verification（Agent 用 API Key 呼 GET /agents/:id/prompts/latest）必須踩過 Agent + PromptVersion + Auth 三條軌道；拆 phase 會讓 dogfood story 殘缺
- DEMO-06 friction 量測必須 cover 整 phase 才有信號；拆 phase 等於切斷 friction tally

**Out of this phase（scope guard）：**
- Eval runner / actual prompt-vs-output 比對 → v2 AGT-* 或外部 runner（Mastra / Claude Agent SDK），P4 只存 dataset、不算分數
- LLM provider 整合（OpenAI / Anthropic SDK 呼叫）→ v2 / out of scope（PROJECT.md anti-feature「不做 agent runtime」）
- Multi-tenant agent ownership（org / team）→ v2 TEN-*
- Prompt template engine（Jinja / handlebars 渲染）→ v2 / out of scope（P4 prompt content 是 plain string）
- PromptVersion diff / branching → v2 convenience；P4 只 append-only linear history
- Dataset 分享 / 公開市集 → v2
- Real-time WebSocket events for prompt updates → out of scope（PROJECT.md anti-feature）
- 完整 testcontainers integration suite / e2e tests → P5 QA-*（P4 plan 自己用 use case unit + happy path integration smoke）
- README / quickstart / architecture docs → P5 DOC-*

</domain>

<decisions>
## Implementation Decisions

### Aggregate / Schema Shape

- **D-01** — `Agent` aggregate root：`{ id: AgentId (UUID), ownerId: UserId, name: string, createdAt: Date, updatedAt: Date }`，其餘 child entity（PromptVersion / EvalDataset）以 `agentId` FK 引用
  - **Why:** 符 DEMO-01 字面 + DDD aggregate 邊界一致；ownership invariant 一處（agent.ownerId）下游 child 透過 agent 過濾
  - **Drizzle schema 落點:** `src/agents/infrastructure/schema/agent.schema.ts`（feature 命名為 `agents` 對齊 ARCHITECTURE.md `src/agents/`）
- **D-02** — `PromptVersion` 為 child entity（不是 aggregate root）：`{ id: PromptVersionId, agentId: AgentId, version: number, content: string, createdAt: Date }`
  - **Why:** Append-only history 屬 Agent aggregate 一部分；version 連號限定「per agent」意味著 boundary 在 Agent
  - **content 型別:** `text` (plain string) — 不假設 prompt 結構（system/user/vars），harness 不替使用者決定 LLM call shape；v2 supersede 為 jsonb 時開新 ADR
- **D-03** — `EvalDataset` 為 child entity：`{ id: EvalDatasetId, agentId: AgentId, name: string, cases: jsonb, createdAt: Date }`
  - **Why:** Dataset 屬 Agent 一部分（dogfood「Agent 自己的 evaluation 材料」）；jsonb cases 讓 v1 storage 一個 row 內封裝完整 dataset，aggregate 邊界乾淨
  - **cases 型別:** `Array<{ input: string, expectedOutput: string }>`，validate via TypeBox at controller 入口
- **D-04** — EvalCase shape 鎖在 **`{ input: string, expectedOutput: string }`**（不含 metadata 欄位）
  - **Why:** harness 不替使用者決定 LLM 評估細節；最小可示範形式；v2 jsonb 兩欄 + metadata 開 ADR
  - **驗證:** TypeBox `t.Object({ input: t.String(), expectedOutput: t.String() })` × N
- **D-05** — Dataset 創建後 cases **immutable**：POST `/agents/:id/eval-datasets` 帶完整 cases 一次性建立；之後只能 DELETE 整個 dataset（無 PATCH cases / append cases endpoint）
  - **Why:** 評估可重現（同 dataset id = 同 case set）；簡化 use case 與 ADR；要改 = 建新 dataset
  - **若需要「加 case」工作流:** 建議使用者建新 dataset 並帶舊 cases + 新 cases；v1 demo dogfood 不提供 convenience endpoint

### PromptVersion 語意

- **D-06** — `PromptVersion.version` 為 **server-side auto-increment**：POST `/agents/:id/prompts` 接 content，server 端 `SELECT MAX(version) + 1 WHERE agentId = ?`，DB 加 UNIQUE `(agentId, version)` constraint，race condition 由 UNIQUE 防 + use case retry-on-conflict（最多 3 次）
  - **Why:** Client 不需預先查 latest（一個 round trip）；不可能 skip number；DEMO-02「version 單調遞增」字面實作
  - **race retry 細節:** UNIQUE violation → catch → re-read max → re-insert；retry 上限 3 次，超過 throw `PromptVersionConflictError`（500，極罕見）
  - **migration 要求:** `unique('prompt_version_agent_id_version_uq').on(table.agentId, table.version)`
- **D-07** — `PromptVersion` **immutable / append-only**：無 PATCH、無 DELETE 單一 version 的 endpoint；要「取消」請發新版本
  - **Why:** 歷史 audit 完整；harness 教「版本 = 事實」；hole-free monotonic（v1, v2, v3...，不會 v1, v2, v4）
  - **cascade:** 唯一移除 PromptVersion 的途徑是 DELETE 整個 Agent → DB FK ON DELETE CASCADE 連帶清掉
- **D-08** — 「latest version」查詢 = **`max(version) per agent`** 即時計算，無 Agent.currentVersionId pointer
  - **Why:** 無多餘 mutable state；append-only 保證 latest 永遠是 max；index `(agentId, version DESC)` 確保 O(log n)
  - **endpoint:** `GET /agents/:id/prompts/latest` 走 `SELECT * WHERE agentId = ? ORDER BY version DESC LIMIT 1`
  - **migration 要求:** `index('prompt_version_agent_id_version_idx').on(table.agentId, table.version)` (DESC sort by query side)

### Ownership 與 API 形狀

- **D-09** — Cross-user 取錯資源 → **404 NotFound**（不洩漏存在性）
  - **Why:** 避免 enumeration vector（403 隱含「該 id 存在但你不能看」）；統一所有 cross-user scenario 為 ResourceNotFoundError 易於 use case 一致實作
  - **error class:** `ResourceNotFoundError extends DomainError`（httpStatus 404, code `'RESOURCE_NOT_FOUND'`），可在 P4 新增於 `src/agents/domain/errors.ts`，或重用 P3 `src/auth/domain/errors.ts` 模式
  - **error body:** `{ error: { code: 'RESOURCE_NOT_FOUND', message: 'Resource not found', requestId } }`（與 P2/P3 D-12 統一）
- **D-10** — Ownership 檢查落在 **use case 層**（與 P3 D-02 scope check at use case 同精神）
  - **Why:** Repository 保持 stateless（不吃 AuthContext），測試簡單；use case 為 AuthContext 邊界唯一存取點，明顯 audit；可單元測試覆蓋
  - **實作模板（use case body 第一段，緊接於 scope check 之後或併入）:**
    ```ts
    async execute(ctx: AuthContext, input: { agentId: AgentId; ... }) {
      const agent = await this.agentRepo.findById(input.agentId)
      if (!agent || agent.ownerId !== ctx.userId) {
        throw new ResourceNotFoundError('Agent not found')
      }
      // ... rest of use case
    }
    ```
  - **同 pattern 用於 PromptVersion / EvalDataset 子資源:** 先 findById Agent 並檢 ownership，再操作 child（child query 已 by agentId 隱性 scoped）
- **D-11** — REST 路徑 = **嵌套 sub-resources**：
  - Agent: `POST/GET/PATCH/DELETE /agents`、`GET /agents/:id`、`PATCH /agents/:id`、`DELETE /agents/:id`
  - PromptVersion（read-mostly + write）: `POST /agents/:agentId/prompts`、`GET /agents/:agentId/prompts`（list, ordered version desc）、`GET /agents/:agentId/prompts/latest`、`GET /agents/:agentId/prompts/:version`
  - EvalDataset: `POST /agents/:agentId/eval-datasets`、`GET /agents/:agentId/eval-datasets`、`GET /agents/:agentId/eval-datasets/:datasetId`、`DELETE /agents/:agentId/eval-datasets/:datasetId`
  - **Why:** Ownership context 編碼在 URL；Swagger 自動分組；DEMO-04「查自己的 prompt 最新版本」直接對應 `/agents/:agentId/prompts/latest`
  - **scope semantics:** 所有 GET 接 `'*'` 或 `'read:*'`；所有 POST/PATCH/DELETE 只接 `'*'`（read-only key 寫操作 → 403 INSUFFICIENT_SCOPE，DEMO-05 直驗）
- **D-12** — Cascade DELETE = **DB layer ON DELETE CASCADE**：DELETE Agent 自動清掉 prompt_version + eval_dataset rows（hard delete，無 soft delete）
  - **Why:** 簡單；demo dogfood 不在 audit history 範圍（與 P3 D-24 API Key soft delete 不同 motivation——API Key revocation 屬安全 audit；Agent 屬 demo data）
  - **schema 要求:** `references(() => agent.id, { onDelete: 'cascade' })` 於 prompt_version.agentId 與 eval_dataset.agentId
  - **API 行為:** `DELETE /agents/:id` 無前置條件、回 204；migration 與 query 兩端皆釘 cascade

### Scope Check（從 P3 衍生鎖到 P4 endpoint）

- **D-13** — P4 write endpoints 的 scope check 公式 = **`if (!ctx.scopes.includes('*')) throw InsufficientScopeError('write requires *')`**
  - **Why:** P3 D-01 鎖 ALLOWED_SCOPES 只有 `'*'` 與 `'read:*'`，P3 D-02 範例引用的 `'write:*'` 是 future placeholder（v2 RBAC 才會 land）；v1 實際只能用「`'*'` 等於 write」
  - **實作位置:** 每個 P4 write use case (`CreateAgentUseCase`, `UpdateAgentUseCase`, `DeleteAgentUseCase`, `CreatePromptVersionUseCase`, `CreateEvalDatasetUseCase`, `DeleteEvalDatasetUseCase`) `execute(ctx, input)` 第一段
  - **錯誤 body:** `{ error: { code: 'INSUFFICIENT_SCOPE', message: 'This operation requires scope *', requestId } }`（沿用 P3 D-06 不洩漏其他 scope 清單）
  - **DEMO-05 直驗:** Agent 用 `['read:*']` API Key 呼 `POST /agents/:id/prompts` → 403 INSUFFICIENT_SCOPE
  - **read endpoints 不做 scope check:** `'*'` 與 `'read:*'` 都能讀

### Dogfood Verification（DEMO-04）

- **D-14** — DEMO-04「Agent 用 API Key 呼 GET /agents/:agentId/prompts/latest」實作 = **Macro `requireAuth: true` + use case ownership check**（D-10），不另設「dogfood-only」endpoint
  - **Why:** Agent dogfood 走的是「正規」path；如果 dogfood path 自己有特殊 endpoint 就不算 dogfood（harness 必須證明自己對 agent 一視同仁）
  - **驗證測試:** `tests/integration/agents/dogfood-self-prompt-read.test.ts`：（1）Human 用 cookie 建 Agent + PromptVersion v1；（2）Human 建 API Key（`scopes: ['*']`）；（3）模擬 Agent 用 `x-api-key: rig_live_...` 呼 `/agents/:agentId/prompts/latest` → 200 + content；（4）變種：用 `['read:*']` API Key 同呼叫 → 200（read 不需 `'*'`）；（5）變種：另一 user 建 Agent，原 API Key 呼該 agentId → 404
  - **autonomous flag:** 此 test 屬 autonomous-runnable（fake DB 可滿足；BetterAuth instance 可 mock 或用 testcontainers）

### Harness Friction 量測（DEMO-06）

- **D-15** — Friction log 採 **executor 邊做邊填 `04-HARNESS-FRICTION.md`**，append-only timestamped log
  - **Why:** Real-time signal、executor 自我覺察、不依賴 PR review fortification；符 P3 D-12 teaching moment 哲學
  - **檔案位置:** `.planning/phases/04-demo-domain/04-HARNESS-FRICTION.md`，phase planning 時建立空 template，executor 每 plan 完 commit 時一併更新
  - **log entry shape:** 每 entry 三行：`- [YYYY-MM-DD HH:MM] [P4-XX-PLAN] symptom: <一句話> | workaround: <一句話> | structural?: yes/no`
  - **symptom 範圍:** 「要解釋給其他開發者 / AI Agent 怎麼擺檔 / 哪層放什麼」、「想下手寫 @ts-ignore」、「createXxxModule signature 不夠用」、「DDD barrel 規則被誤觸要繞」、「測試走橫脖（reach into internal）才能驗」、「複製貼上 P3 P2 同樣 boilerplate」
  - **structural 標記:** `yes` 表示「修 friction 必須改 P1 template / Biome rules / shared kernel」；`no` 表示「local workaround OK，不影響 framework」
- **D-16** — ADR 觸發條件 = **>3 friction events 累計** **OR** **任一 structural=yes friction event**
  - **Why:** 量化門檻 + structural 不可妥協雙觸發；防 over-tally（小事過度敏感）也防 structural 漏接（一次卡死也算重大）
  - **ADR 內容範圍:** 若觸發 → 開「ADR 0018: P1 Feature Module Template Iteration After P4 Dogfood」（或類似命名），記錄 friction symptoms + 提議的 P1 template 調整方向（不在 P4 修，留 P5 或 v1.1 處理）
  - **Phase 4 verifier 責任:** Phase 結束時 verifier 讀 04-HARNESS-FRICTION.md tally，若觸發但 ADR 未開 → flag `must_haves` violation
- **D-17** — Phase 4 確定要開的 ADR = **ADR 0017: EvalDataset Shape Frozen at v1**
  - **Why:** ROADMAP risk-flag 明示；釘定 D-01..D-05 決策（aggregate boundary / jsonb cases / Dataset↔Agent / case shape / immutable）；future v2 升級到 normalized eval_case table 或 jsonb cases 時必開 ADR supersede
  - **ADR 檔案:** `docs/decisions/0017-eval-dataset-shape-jsonb-immutable.md`（MADR 4.0 格式，Plan P4 內 ship）
  - **可能追加 ADR（條件性）:**
    - ADR 0018（若 D-16 觸發）— P1 template iteration
    - ADR 不需新增 for 404-vs-403 ownership（D-09）— P3 D-12「single generic 401 body」已建立 enumeration-resistance precedent，404 為其延伸應用

### the agent's Discretion

以下項目未納入本次討論，researcher / planner 可依 ARCHITECTURE.md + STACK.md + P1/P2/P3 CONTEXT 直接決定：

- **`createAgentsModule(deps): Elysia` factory 詳細 shape** — 與 `createHealthModule` / `createAuthModule` 一致；deps `{ db, clock?, logger? }`；feature module factory pattern P1/P2/P3 已示範
- **Drizzle schema 命名** — `agent` / `prompt_version` / `eval_dataset` table 名（snake_case）；columns `created_at` / `updated_at` 等與 P3 一致
- **`AgentMapper` / `PromptVersionMapper` / `EvalDatasetMapper`** — 依 ARCH-03 + P3 mapper pattern；`toDomain(row)` / `toPersistence(entity)`
- **Repository ports 與位置** — `src/agents/application/ports/{agent-repository,prompt-version-repository,eval-dataset-repository}.port.ts`
- **Use case 拆分粒度** — 預估 7-10 個 use case：CreateAgent / UpdateAgent / DeleteAgent / GetAgent / ListAgents / CreatePromptVersion / GetLatestPromptVersion / GetPromptVersionByNumber / ListPromptVersions / CreateEvalDataset / DeleteEvalDataset / GetEvalDataset / ListEvalDatasets — researcher / planner 視測試與複用粒度合併或拆細
- **Brand types** — `AgentId` / `PromptVersionId` / `EvalDatasetId` 全為 `UUID<'AgentId'>` etc，於 `src/agents/domain/values/ids.ts` 或合一檔案；P1 D-07 brand pattern 直接套
- **Controller dtos 位置** — `src/agents/presentation/dtos/{create-agent,update-agent,create-prompt-version,create-eval-dataset}.dto.ts`；TypeBox schema 引用 D-04 `EvalCase` constants
- **`InsufficientScopeError` 重用** — 已於 P3 `src/auth/domain/errors.ts` 存在；agents feature 直接 import 而非另建
- **`ResourceNotFoundError` 落點** — 建議放 `src/shared/kernel/errors.ts` 與 DomainError 同層（跨 feature 通用）；若研究建議放 `src/agents/domain/errors.ts` agent-local 也可，researcher 自決
- **createApp 整合 wire** — `src/bootstrap/app.ts` 在 `createAuthModule` 之後加 `.use(createAgentsModule({ db, clock, logger }))`，不需重排其他 plugin
- **PromptVersion retry-on-UNIQUE-violation 寫法** — 取決於 Drizzle PostgresError code 偵測，researcher 探 best practice；retry 上限 3 已鎖（D-06），錯誤型別 `PromptVersionConflictError extends DomainError`（httpStatus 500）也由 researcher 決定是否值得別於通用 500
- **Agent.name validation** — researcher 自決長度上限與字元規則（建議 1-128 chars，trim，UTF-8 與 P3 D-25 API Key label 同精神）；是否 unique per owner 由 researcher 評估（可不 unique，名稱衝突由 user 自管）
- **Seed data / fixture / dev quickstart endpoint** — Phase 4 不包含 seed；P5 quickstart docs 可加；本 phase 著重 API + factory pattern 證明
- **04-HARNESS-FRICTION.md template 細節** — 由 planner 決定 markdown 結構（可參考 P3 verification report 格式）；entry shape (D-15) 已鎖

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level（必讀）
- `.planning/PROJECT.md` — Core Value（harness engineering / AuthContext 邊界）、Constraints（DDD + ADR + 雙軌 auth）、Out of Scope（無 LLM provider 整合 / 無 multi-tenant）
- `.planning/REQUIREMENTS.md` §Demo Domain — 6 條 P4 requirements（DEMO-01 到 DEMO-06）+ §Authentication（P3 已實作，P4 read-only consume）
- `.planning/ROADMAP.md` §Phase 4 — Goal、Depends on（P3 整套 AuthContext + AuthModule）、Success Criteria（5 條 must-haves）、Risk Flag（EvalDataset shape 需 ADR）

### Prior phase context（必讀，避免重複決策）
- `.planning/phases/01-foundation/01-CONTEXT.md` — P1 的 16 條 D-xx 決策（特別是 D-07 UUID brand、D-08 DomainError httpStatus、D-09 Biome DDD rules 禁 import、D-11 domain barrel + internal、D-15 ADR README 索引格式）
- `.planning/phases/02-app-skeleton/02-CONTEXT.md` — P2 的 D-04..D-16 決策（特別是 D-04 feature module factory pattern `createXxxModule(deps): Elysia`、D-06 canonical plugin ordering（ADR 0012）、D-12 error body shape `{ error: { code, message, requestId } }`）
- `.planning/phases/03-auth-foundation/03-CONTEXT.md` — P3 的 25 條 D-xx 決策（特別是 D-01 ALLOWED_SCOPES = `['*', 'read:*']`、D-02 scope check at use case layer、D-03 human cookie session = `['*']`、D-09 API Key 失敗硬 401（不 fallback cookie）、D-12 single 401 body、D-19 API Key prefix `rig_live_`、D-24 API Key soft delete + revokedAt）

### Research（P4 規劃必讀）
- `.planning/research/ARCHITECTURE.md` §Pattern 1（AuthContext via `.macro({ requireAuth: { resolve } })`）§Pattern 2（AuthContext shape）§Pattern 3（Use case = `execute(ctx, input)`）§Pattern 4（Repository + Mapper）§Pattern 5（Feature Module Factory）§Project Structure（`src/agents/` 對應 P4 feature directory）§Data Flow
- `.planning/research/STACK.md` §Drizzle ORM（`drizzle-orm/postgres-js` 驅動 + `drizzleAdapter` + Drizzle migration commit）§What NOT to Use（避 Drizzle 1.0-beta、避 bun:sql）
- `.planning/research/PITFALLS.md` — **核心必讀**：
  - #1 AuthContext advisory（P3 已防，P4 use case 必沿用 `getXxxService(ctx)` factory pattern 若 domain service 需 ctx）
  - #2 Elysia scoped plugin undefined cascade（P3 macro 單一根層 + scope global 已防；P4 controllers 沿用相同 pattern）
  - #4 API key plaintext storage（P3 已實作，P4 不重新處理 — 直接信 P3 IIdentityService）
  - #11 Harness 太緊（**P4 主軸**——本 phase 透過 04-HARNESS-FRICTION.md 量化此 pitfall 在 P1 template 上的影響）
  - #14 Bun native-module（P4 不引入新 native dep，無風險）
- `.planning/research/FEATURES.md` §🎯 Demo Domain: Agent 元專案（dogfooding 主論述）§Anti-features（避免在 P4 提議 OAuth / 多 agent runtime 整合 / WebSocket）
- `.planning/research/SUMMARY.md` §Phase 4 — Delivers / Addresses / Avoids

### Phase 1 + 2 + 3 產出物（P4 必 import / extend）
- `src/shared/kernel/errors.ts` — `DomainError` 基底類別（`code` + `httpStatus`）；P4 新 `ResourceNotFoundError extends DomainError`（httpStatus 404, code `'RESOURCE_NOT_FOUND'`）建議放此檔（跨 feature 通用）
- `src/shared/kernel/{result,brand,id}.ts` — `UUID<K>` brand 用於 `AgentId` / `PromptVersionId` / `EvalDatasetId`；`Result<T, E>` 於 use case 回傳（可選）
- `src/shared/kernel/index.ts` — barrel export
- `src/shared/infrastructure/db/client.ts` — `DrizzleDb` type；`createDbClient(config)` 不需新增 — agents schema 與 auth 用同 db instance
- `src/shared/presentation/plugins/error-handler.plugin.ts` — onError 已讀 `err.httpStatus`，P4 新 errors 直接 mapping，**P4 不必改 errorHandler**
- `src/auth/domain/auth-context.ts` — `AuthContext`、`ALLOWED_SCOPES`、`UserId` brand；P4 use case `execute(ctx: AuthContext, input)` 簽名
- `src/auth/domain/errors.ts` — `InsufficientScopeError` 重用於 P4 write use case scope check
- `src/auth/presentation/plugins/auth-context.plugin.ts` — `authContextPlugin` macro `requireAuth`；P4 controllers 用 `requireAuth: true` 標 protected route
- `src/bootstrap/app.ts` — `createApp(config, deps)` 已就位；P4 在 `createAuthModule(authDeps)` 之後加 `.use(createAgentsModule({ db, logger, clock }))`（feature modules 順序：橫切先，feature 後；agents 接 auth）
- `drizzle/0001_auth_foundation.sql` — 已 ship；P4 Drizzle 新 migration `drizzle/0002_demo_domain.sql`（`drizzle-kit generate --name=demo_domain`）
- `drizzle.config.ts` — `schema: './src/**/infrastructure/schema/*.ts'` 已涵蓋 → P4 新 schema 自動掃描
- `docs/decisions/README.md` — ADR 索引；P4 新增 ADR 0017（必）+ 0018（條件）

### External specs（researcher 實作時參考）
- Drizzle ORM 文件 — `https://orm.drizzle.team/docs/sql-schema-declaration`（jsonb 欄位定義、`unique` constraint、`index` desc sort）、`https://orm.drizzle.team/docs/relations`（FK + ON DELETE CASCADE 寫法）
- PostgreSQL JSONB best practices — `https://www.postgresql.org/docs/16/datatype-json.html`（cases jsonb 欄位查詢與 index）
- Elysia 文件 — `https://elysiajs.com/patterns/macro`（D-13 use case 層 scope check 背景）、`https://elysiajs.com/essential/route`（nested route prefix `/agents/:agentId/prompts`）
- MADR 4.0 — `https://adr.github.io/madr/`（ADR 0017 / 0018 格式）
- BetterAuth API Key plugin — `https://better-auth.com/docs/plugins/api-key`（P4 不直接呼叫 BetterAuth — 透過 `IIdentityService` from P3）
- REST API design — Sub-resource convention（`/parents/:id/children`）參考 Google AIP-122 (`https://google.aip.dev/122`) 或 GitHub API（`/repos/:owner/:repo/...`）

### CVE / advisory（必 watchlist — 從 P3 延續）
- CVE-2025-61928 — `https://zeropath.com/blog/breaking-authentication-unauthenticated-api-key-creation-in-better-auth-cve-2025-61928`（P3 regression 已測，P4 不重複測 — 但 P4 build 後須 verify P3 regression suite 仍通過）
- BetterAuth Security Advisories — `https://github.com/better-auth/better-auth/security/advisories`（P4 commit 時 BetterAuth 版本 >= 1.3.26 已 P3 鎖）

### P4 產出物（由本 CONTEXT 鎖定、downstream 必產）
- `src/agents/domain/values/ids.ts`（或拆三檔）— `AgentId` / `PromptVersionId` / `EvalDatasetId` brand types
- `src/agents/domain/agent.ts` — Agent entity（`id`, `ownerId`, `name`, `createdAt`, `updatedAt`）
- `src/agents/domain/prompt-version.ts` — PromptVersion entity（`id`, `agentId`, `version`, `content`, `createdAt`）
- `src/agents/domain/eval-dataset.ts` — EvalDataset entity（`id`, `agentId`, `name`, `cases`, `createdAt`）+ EvalCase value object（`{ input, expectedOutput }`）
- `src/agents/domain/errors.ts` — agents-local errors（若有），通用 `ResourceNotFoundError` 建議於 `src/shared/kernel/errors.ts`
- `src/agents/domain/index.ts` — barrel export（同 P3 `src/auth/domain/index.ts` pattern）
- `src/agents/application/ports/{agent-repository,prompt-version-repository,eval-dataset-repository}.port.ts`
- `src/agents/application/usecases/{create-agent,update-agent,delete-agent,get-agent,list-agents,create-prompt-version,get-latest-prompt-version,get-prompt-version,list-prompt-versions,create-eval-dataset,delete-eval-dataset,get-eval-dataset,list-eval-datasets}.usecase.ts`（researcher / planner 可酌量合併）
- `src/agents/infrastructure/repositories/{drizzle-agent,drizzle-prompt-version,drizzle-eval-dataset}.repository.ts`
- `src/agents/infrastructure/mappers/{agent,prompt-version,eval-dataset}.mapper.ts`
- `src/agents/infrastructure/schema/{agent,prompt-version,eval-dataset}.schema.ts`
- `src/agents/presentation/controllers/{agent,prompt-version,eval-dataset}.controller.ts`
- `src/agents/presentation/dtos/{create-agent,update-agent,create-prompt-version,create-eval-dataset}.dto.ts`
- `src/agents/agents.module.ts` — `createAgentsModule(deps): Elysia` factory
- `drizzle/0002_demo_domain.sql` — Drizzle migration
- `tests/integration/agents/dogfood-self-prompt-read.test.ts` — DEMO-04 dogfood verification（D-14）
- `tests/integration/agents/scope-check-read-only-key.test.ts` — DEMO-05 scope rejection
- `tests/integration/agents/cross-user-404.test.ts` — D-09 ownership 404 verification
- `tests/integration/agents/prompt-version-monotonic.test.ts` — D-06 race-on-concurrent-create
- `tests/integration/agents/cascade-delete.test.ts` — D-12 cascade verification
- `docs/decisions/0017-eval-dataset-shape-jsonb-immutable.md` — ADR for D-01..D-05（必 ship）
- `docs/decisions/0018-p1-template-iteration-after-p4-dogfood.md`（條件 ship — D-16 觸發時）
- `docs/decisions/README.md` — 新增 ADR 索引列
- `.planning/phases/04-demo-domain/04-HARNESS-FRICTION.md` — friction log（每 plan 完 commit 時更新；D-15 / D-16）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/shared/kernel/errors.ts`** — `DomainError` 基底；P4 新增 `ResourceNotFoundError extends DomainError` (httpStatus 404, code `'RESOURCE_NOT_FOUND'`) 建議放此（跨 feature 通用）；error body 由 P2 errorHandler 自動 build
- **`src/shared/kernel/id.ts`** — `UUID<K>` brand pattern；P4 三條 brand 一致使用 `crypto.randomUUID()`
- **`src/shared/kernel/result.ts`** — `Result<T, E>`；use case 回傳是否用 Result 由 researcher 決定（P3 use case 部分用 throw、部分用 Result）
- **`src/auth/domain/auth-context.ts`** — `AuthContext`、`ALLOWED_SCOPES`、`UserId` brand；P4 直接 import
- **`src/auth/domain/errors.ts`** — `InsufficientScopeError` 重用；P4 write use case scope check 直接 throw
- **`src/auth/presentation/plugins/auth-context.plugin.ts`** — `authContextPlugin({ identity })` macro；P4 controllers route options `requireAuth: true`，handler 透過 `(context as { authContext: AuthContext }).authContext` 取（同 P3 controllers pattern）
- **`src/health/health.module.ts` + `src/auth/auth.module.ts`** — `createXxxModule(deps): Elysia` 模板；P4 `createAgentsModule` clone 此 shape
- **`src/bootstrap/app.ts`** — `createApp(config, deps)` 已就位；P4 在 `.use(createAuthModule(...))` 之後加 `.use(createAgentsModule({ db, logger, clock }))`
- **`src/shared/infrastructure/db/client.ts`** — `DrizzleDb` type；P4 schema 用同 db instance
- **`src/shared/presentation/plugins/error-handler.plugin.ts`** — 已讀 `err.httpStatus` + body shape `{ error: { code, message, requestId } }`；P4 新 errors 直接 map，**P4 不改 errorHandler**
- **`src/_template/`** — DDD 空骨架（domain / application / infrastructure / presentation）；P4 `src/agents/` clone 此結構
- **Package dependencies 已全裝（P1-P3 ship）：** `drizzle-orm@0.45.2` / `postgres@3.4.9` / `elysia@1.4.28` / `@sinclair/typebox` / `pino` 等 — P4 無新 npm install

### Established Patterns（from P1 + P2 + P3 + research）
- **Feature module factory** — `createXxxModule(deps): Elysia` 回 plugin（P2 D-04 / ARCHITECTURE Pattern 5）；P4 `createAgentsModule(deps)` 同 shape
- **DDD 四層 vertical slice** — `src/agents/{domain,application,infrastructure,presentation}/` + `agents.module.ts`；P3 `src/auth/` 為 reference template
- **Domain barrel + internal** — `src/agents/domain/index.ts` 為 entry；agents domain service（若有）置於 `src/agents/domain/internal/` 並透過 `getXxxService(ctx)` factory 取得（P3 AUX-05 pattern）
- **Macro 單一根層** — `authContextPlugin` 由 `createAuthModule` 掛在根；P4 不需要再掛 macro，**直接在 controller route options `requireAuth: true`** 即可（macro scope `global` from P3）
- **Repository + Mapper** — Drizzle row → domain entity 透過 mapper 轉換；repository 不洩漏 Drizzle InferSelectModel 到 domain（ARCH-03）
- **Use case = `execute(ctx: AuthContext, input)` class** — 第一段做 scope check（D-13）+ ownership check（D-10），主邏輯隨後
- **Error handler 讀 `err.httpStatus`** — P4 新 error class 只需繼承 DomainError 並設 httpStatus（404 / 403 / etc）
- **Biome DDD rules** — `src/agents/domain/` 禁 import `drizzle-orm` / `elysia` / `postgres` / `pino`；P1 D-09 已設，P4 新 code 直接被 lint 擋
- **Drizzle schema 自動掃描** — drizzle.config.ts `schema: './src/**/infrastructure/schema/*.ts'` 已涵蓋 — P4 schema 落該位即被 generate

### Integration Points
- **`src/agents/` 目錄將新建** — 參照 `src/_template/` 或 `src/auth/` 結構（auth feature 為最完整 reference）
- **`createApp(config, deps)` 加一行** — `.use(createAgentsModule({ db, logger, clock }))`，置於 `.use(createAuthModule(authDeps))` 之後（feature module 接 feature module，符合 P2 D-06 ordering）
- **`drizzle/0002_demo_domain.sql` 為新 migration** — `drizzle-kit generate --name=demo_domain` 自動寫入；committer 不可手寫 SQL（P1 / P3 規矩）
- **ADR 索引 `docs/decisions/README.md`** — P4 新增 ADR 0017（必）+ 0018（條件），索引表照 P1 D-15 欄位（編號 / 標題 / Status / 日期 / Supersedes）追加
- **與 P3 IIdentityService 互動** — P4 use case 不直接呼叫 BetterAuth；身分由 P3 `authContextPlugin` macro resolve 後注入 `ctx.authContext`，use case 只讀 `ctx.userId`
- **Phase 5 dependency point** — P5 quickstart 文件可能引用 `/agents/:id/prompts/latest` 作為 authenticated request 範例；P4 endpoint shape 一旦 ship 就應視為 v1 公開 surface（v2 才能 supersede）

### Risks carried from Phase 1 + 2 + 3 to watch（P4 特別關注）
- **Pitfall #11 harness 太緊** — **P4 主軸**；executor 寫 `src/agents/` 時若不斷出現「為何這要分四層 / 為何不能直接 import」事件 = D-15 friction event；D-16 ADR 觸發
- **Pitfall #2 Elysia scoped plugin undefined cascade** — P3 已用 macro 單一根層 + scope global 防；P4 controller `(context as { authContext: AuthContext }).authContext` cast 需 follow P3 controller pattern（P3 因 macro 跨 plugin type narrowing 有限，採 cast；P4 沿用即可，研究細節由 researcher）
- **Pitfall #5 bun:sql transaction hang** — P1 ADR 0010 postgres-js 驅動已鎖，P4 不影響
- **Pitfall #1 AuthContext advisory** — P3 已用 Runtime Guard `getXxxService(ctx)` factory 防；P4 若 agents domain 需 stateful service，沿用同 pattern；若無（多數 agents use case 直接走 repository → mapper），不需新 factory
- **Drizzle migration drift（P5 CI 防線）** — P4 commit migration 時須 `drizzle-kit generate --name=demo_domain`，產出物直接 commit，不允手改；P5 CI 會跑 `drizzle-kit generate --name=ci-drift` 確認無 schema drift

</code_context>

<specifics>
## Specific Ideas

- **`InsufficientScopeError` 的 message 統一為 `'This operation requires scope *'`**（D-13）— 與 P3 D-06 一致延續；錯誤 body 不洩漏「目前 ctx.scopes 是什麼」，dev 在 server log 可見細節（pino 已 redact `x-api-key` header）

- **PromptVersion server auto-increment retry pattern**（D-06）— 範例實作大綱：
  ```ts
  // src/agents/application/usecases/create-prompt-version.usecase.ts
  async execute(ctx: AuthContext, input: { agentId: AgentId; content: string }) {
    if (!ctx.scopes.includes('*')) throw new InsufficientScopeError('This operation requires scope *')
    const agent = await this.agentRepo.findById(input.agentId)
    if (!agent || agent.ownerId !== ctx.userId) throw new ResourceNotFoundError('Agent not found')

    let attempts = 0
    while (attempts < 3) {
      const latest = await this.promptVersionRepo.findLatestByAgent(input.agentId)
      const nextVersion = (latest?.version ?? 0) + 1
      try {
        return await this.promptVersionRepo.create({
          id: newPromptVersionId(),
          agentId: input.agentId,
          version: nextVersion,
          content: input.content,
          createdAt: this.clock.now(),
        })
      } catch (err) {
        if (isUniqueViolation(err) && err.constraint === 'prompt_version_agent_id_version_uq') {
          attempts++
          continue
        }
        throw err
      }
    }
    throw new PromptVersionConflictError('Concurrent writes prevented version assignment')
  }
  ```
  Researcher 須探 Drizzle/postgres-js UNIQUE violation detection（`postgres.PostgresError.code === '23505'` 或類似）；若 retry 機制太繁雜可改用 PostgreSQL `INSERT ... ON CONFLICT` + `RETURNING` 一次 atomic 寫，取捨由 planner 決定（兩者皆滿足 D-06 spec）

- **DEMO-04 dogfood test 必含 4 個變種**（D-14）—
  ```ts
  // tests/integration/agents/dogfood-self-prompt-read.test.ts
  describe('DEMO-04: Agent reads own latest prompt via API Key', () => {
    it('agent with full-scope key reads latest prompt → 200', async () => { /* ... */ })
    it('agent with read-only key reads latest prompt → 200 (read needs no *)', async () => { /* ... */ })
    it('cross-user API key calls /agents/:id/prompts/latest → 404 (D-09)', async () => { /* ... */ })
    it('agent with read-only key writes prompt → 403 INSUFFICIENT_SCOPE (DEMO-05)', async () => { /* ... */ })
  })
  ```
  Test 命名 `dogfood-self-prompt-read.test.ts` 一檔含主流程；DEMO-05 與 D-09 拆獨立檔以利 P5 grep 整併

- **04-HARNESS-FRICTION.md 初始 template**（D-15 / D-16）— Phase 4 plan 階段須 ship 空 template：
  ```markdown
  # Phase 4 Harness Friction Log

  **Purpose:** Track moments where executor needed to explain harness, fight @ts-ignore urge, or
  detected structural friction in P1 feature module template.

  **ADR Trigger (D-16):** >3 events accumulated OR any single `structural: yes` event → open
  `docs/decisions/0018-p1-template-iteration-after-p4-dogfood.md`.

  ## Events

  <!-- Each event is a single bullet:
  - [YYYY-MM-DD HH:MM] [P4-XX-PLAN] symptom: <一句話> | workaround: <一句話> | structural: yes/no
  -->

  (No events yet)

  ## Tally

  - Total events: 0
  - Structural events: 0
  - ADR threshold reached: NO
  ```

- **Cross-user 404 一致性**（D-09）— 三條範例 cross-user scenario 都應觸發 ResourceNotFoundError：
  1. `GET /agents/:otherUsersAgentId` → 404
  2. `GET /agents/:otherUsersAgentId/prompts/latest` → 404（不洩漏 agent 是否存在）
  3. `DELETE /agents/:otherUsersAgentId` → 404（不洩漏 agent 是否存在）
  4. `POST /agents/:otherUsersAgentId/prompts` → 404（先 ownership check，scope check 與否不重要 — ownership 失敗就 404）

- **Cascade delete migration 寫法**（D-12）— Drizzle schema 範例：
  ```ts
  // src/agents/infrastructure/schema/prompt-version.schema.ts
  export const promptVersion = pgTable('prompt_version', {
    id: text('id').primaryKey(),
    agentId: text('agent_id').notNull().references(() => agent.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').notNull(),
  }, (table) => [
    unique('prompt_version_agent_id_version_uq').on(table.agentId, table.version),
    index('prompt_version_agent_id_version_idx').on(table.agentId, table.version),
  ])
  ```

- **EvalDataset jsonb cases 寫法**（D-03 / D-04）—
  ```ts
  // src/agents/infrastructure/schema/eval-dataset.schema.ts
  import { jsonb } from 'drizzle-orm/pg-core'
  export const evalDataset = pgTable('eval_dataset', {
    id: text('id').primaryKey(),
    agentId: text('agent_id').notNull().references(() => agent.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    cases: jsonb('cases').notNull().$type<Array<{ input: string; expectedOutput: string }>>(),
    createdAt: timestamp('created_at').notNull(),
  })
  ```
  TypeBox controller schema 引用同型（與 P3 D-05 ALLOWED_SCOPES 引用 source-of-truth 一致原則）

- **Phase 4 verifier 必驗 friction tally**（D-15 / D-16）— Phase exit 時 verifier 讀 04-HARNESS-FRICTION.md：
  - tally events ≤3 且無 structural → ADR 0018 不開（但 log 仍 commit）
  - tally events >3 OR 任一 structural=yes → ADR 0018 必 ship；若未 ship 則 verifier flag must_haves violation
  - 此 verification 屬 must_haves 之一，P4 SUMMARY 須回報

</specifics>

<deferred>
## Deferred Ideas

以下想法在 P4 討論中浮現但屬後續 phase / v2 範疇：

- **Eval runner / actual prompt-vs-output 比對** → v2（PROJECT.md anti-feature「不做 agent runtime」）；P4 EvalDataset 純為 fixture，scoring 由外部工具（Mastra / Claude Agent SDK）負責
- **PromptVersion content 為 jsonb structured（{system, user, vars}）** → v2 ADR supersede ADR 0017；P4 plain string
- **PromptVersion template engine（Jinja / Handlebars 變量渲染）** → out of scope（PROJECT.md anti-feature「不做 LLM 整合」）
- **EvalDataset case shape 加 metadata jsonb 欄位** → v2 ADR supersede ADR 0017；P4 純 `{input, expectedOutput}`
- **EvalDataset 拆 normalized eval_case table + per-case stats** → v2 PROD-* 或 SCAF-*；P4 jsonb cases 足以示範
- **Dataset PATCH cases / append cases endpoint** → v2；P4 immutable
- **Agent.name unique per owner constraint** → researcher 自決是否加 unique；建議 v1 不 unique（user 自管）；衝突時 v2 加 ADR
- **PromptVersion diff / branching / compare** → v2 convenience；P4 純 linear append
- **Dataset 公開 / 分享給其他 user** → v2 multi-tenant TEN-*
- **DELETE PromptVersion 單一版本 endpoint** → out of scope（D-07 immutable / append-only）
- **Agent soft delete（與 P3 D-24 API Key soft delete 對齊）** → v2；P4 hard delete + cascade（demo data 性質不同 — API Key 屬 audit 範圍）
- **PATCH /agents/:id/active-version pointer endpoint** → v2 convenience（D-08「always max(version)」設計排除）
- **Real-time WebSocket / SSE for prompt updates** → out of scope（PROJECT.md anti-feature「v1 只做 REST」）
- **Per-user agent count / quota / rate limit** → v2 PROD-*
- **Dataset import / export（CSV、JSONL）** → v2 convenience
- **Dataset 自動 versioning（dataset PATCH 時新增 dataset version）** → out of scope（D-05 immutable，要改 = 建新 dataset）
- **Phase 5 quickstart endpoint 範例** → P5 DOC-02 自決哪個 P4 endpoint 為示範（建議 `/agents/:id/prompts/latest` 用 API Key）
- **Test 整併到 `tests/regression/`** → P5 QA 整併時 grep `*.test.ts` 搬遷
- **GitHub Actions CI 跑 P4 integration tests** → P5 CI-01 範圍
- **04-HARNESS-FRICTION.md 改 GitHub issue label** → 不採（D-15 已鎖檔案 log）

未提及但屬於未來 phase：
- Unit / integration / e2e tests 完整覆蓋與 testcontainers → Phase 5 QA-01..05
- README / quickstart / architecture docs → Phase 5 DOC-01..05
- `.github/workflows/ci.yml` 與 migration drift check → Phase 5 CI-01..03

</deferred>

---

*Phase: 04-demo-domain*
*Context gathered: 2026-04-19（interactive，4 區，16 條決策 + 1 條 ADR 必 ship + 1 條 ADR 條件 ship）*
