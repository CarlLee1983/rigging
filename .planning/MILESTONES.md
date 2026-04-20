# Milestones: Rigging

Historical record of shipped versions. Detailed archives live in `.planning/milestones/`.

## v1.0 — Reference App (MVP)

**Shipped:** 2026-04-20
**Timeline:** 2026-04-18 → 2026-04-20 (~2 days, 80 commits)
**Phases:** 1 → 5 (all 5 phases / 21 plans complete)
**LOC:** ~3,421 lines of `src/**/*.ts` + 2,4xx lines of `tests/**/*.ts`
**Git range:** `8a93a1d` (init) → `50c32e1` (milestone_complete)
**Requirements:** 55 v1 requirements（完整覆蓋；細節見 `milestones/v1.0-REQUIREMENTS.md`）

### Delivered

一個 opinionated、API-first 的 TypeScript backend Reference App,用 Harness Engineering 思維把 AuthContext 強制邊界寫進框架本身。從零到「外部開發者 10 分鐘內能發出第一個 authenticated request」的完整軌道。

### Key Accomplishments

1. **Harness foundation landed** — Bun + Elysia + Drizzle + BetterAuth 技術棧鎖定（exact pin）；DDD 四層目錄被 Biome lint 規則保護（domain 層禁 import framework）；shared kernel (`Result` / `Brand` / `UUID` / `DomainError`) framework-free 實證；12 條起始 ADR（MADR 4.0）+ AGENTS.md Rigidity Map + PR adr-check workflow 就位。
2. **App skeleton with canonical plugin ordering** — `createApp(config, deps?)` synchronous factory + 4 global plugins（requestLogger / cors / errorHandler / swagger）+ `/health` DDD 四層 walkthrough；ADR 0012 lock plugin ordering，整合測試走真 `createApp` chain，任何 reorder CI 立刻紅燈。
3. **Auth atomic ship（Rigging 論述核心）** — BetterAuth + 雙軌 AuthContext macro（API Key 優先於 cookie）+ Runtime Guards + CVE-2025-61928 regression + session fixation mitigation（AUTH-11 Scenario B，Rigging 自己 wrap `revokeSessions`）+ timing-safe API Key 比對（1000-iter ratio 0.006）+ 4 條 Phase 3 ADRs（0013-0016）。atomic unsplittable phase 如諾交付。
4. **Demo dogfood validates harness reuse** — Agent / PromptVersion / EvalDataset 元專案用 feature module factory pattern 落地；ADR 0017 凍結 EvalDataset shape（jsonb immutable）；整合測試覆蓋 cross-user 404 matrix / scope-before-ownership / monotonic version under concurrency / FK cascade；執行期暴露的 4 類 hardening（auth mount path / API Key hash lookup / VALIDATION→422 / destructive spike gate）atomic 修補。
5. **Quality gate shipped to community-ready** — 221 tests pass（140 unit + 59 integration + 11 e2e + 11 contract/regression）/ 0 fail；coverage gate 100% lines / 100% functions（33 files in domain+application+kernel）；GitHub Actions CI 3 parallel jobs + postgres service + coverage gate + migration drift；README narrative-first 重寫、`docs/quickstart.md` 10-min 雙軌 dogfood 物語、`docs/architecture.md` 三章 + 3 mermaid + regression 對照表、ADR 0018 testcontainers deviation、AGENTS.md 頂部 TOC。

### Architecture Decisions (18 ADRs landed)

`docs/decisions/0000 … 0018` — MADR 4.0 格式。重要決策：

- **0010** postgres-js driver（非 `bun:sql`）
- **0011** Resolver precedence: API Key 優先於 cookie
- **0012** Canonical global plugin ordering（requestLogger → cors → errorHandler → swagger → features）
- **0013** API Key storage: prefix + SHA-256 hash + indexed
- **0014** API Key hashing: SHA-256 explicit（blocks `disableKeyHashing: true`）
- **0015** Rate limit: memory store v1 / persistent store deferred to v2
- **0016** Trust BetterAuth session cookie defaults + AUTH-11 wrap-required
- **0017** EvalDataset shape frozen at v1 (jsonb immutable)
- **0018** Integration tests 採共用 Postgres 而非 testcontainers（adopted deviation，quickstart 文件化配套）

### Known Gaps（milestone closed with deferred items — acknowledged 2026-04-20）

- **Phase 04 SECURITY audit not run** — `$gsd-secure-phase 04` 尚未執行；Phase 04 ships auth-gated API routes + API Key verify path hardening，threat-mitigation audit 屬建議但未阻擋 v1.0 close。後續以 standalone secure-phase 補票。
- **REQUIREMENTS.md traceability table stale at close** — 僅 `WEB-01..04` 四項標為 `Complete`，其餘 51 項在表中仍是 `Pending`（實際對應 phase 全部 `Complete`）。歸檔時在 `milestones/v1.0-REQUIREMENTS.md` 統一以完成狀態固化。
- **Phase 5 plan summaries partial** — 有 phase-level `05-SUMMARY.md` + plan-level `05-04-SUMMARY.md`，但 `05-01 / 05-02 / 05-03` 沒單獨 plan summary（reconcile-in-place 將 drift 切為 3 個 atomic commits `a50ead3 / efa25e6 / f546f2e`；內容以 `05-SUMMARY.md` 的 Plan Completion Matrix 涵蓋）。
- **CI 首跑為 manual follow-up** — G22「Looks Done But Isn't」第 10 項 pending；需 push branch + PR 後 GitHub Actions 首次實跑綠燈驗證。

### Archives

- Roadmap: `milestones/v1.0-ROADMAP.md`
- Requirements: `milestones/v1.0-REQUIREMENTS.md`
- Phase directories: 保留於 `.planning/phases/01-foundation` → `05-quality-gate`（可用 `$gsd-cleanup` 後續歸檔）

### Retrospective Highlights

- **Velocity pattern:** Phases 1-4 在 2026-04-19 單日 out-of-band + atomic-per-phase commit 策略下落地；Phase 5 採 reconcile-in-place（先跑測試驗綠再切原子 commit）。兩種交付模式都記錄在 SUMMARY.md 的 `Adopted Scope Deviations` 段落。
- **Adopted scope 規範化：** Phase 4 首次以「PLAN.md files_modified 外的 hardening 範圍擴張」為 atomic-phase commit 的已知模式落地，Phase 5 延續同樣紀錄方式（如 05-01 API Key hash 格式由 hex → base64url、RAW_KEY_LENGTH 52 → 73）。未來 phase execution 可沿用。
- **Harness 論述 self-enforcing：** Phase 3 atomic unsplittable 的「任一拆出即破壞雙軌論述或留 CVE-class 漏洞」在 Phase 4 dogfood 時被驗證——API Key verify 從 prefix-match 改為 hash-match 是在整合測試開跑才暴露的 harness 缺陷，若早一 phase 拆掉會漏。

---

_Last updated: 2026-04-20 after v1.0 milestone close_
