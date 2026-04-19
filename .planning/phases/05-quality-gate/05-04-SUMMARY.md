---
phase: 05-quality-gate
plan: 04
subsystem: docs
tags: [docs, readme, quickstart, architecture, adr, agents-md, g22-checklist]
requires:
  - 05-01 (測試基礎設施、coverage-gate，供 architecture.md §5 Testing Conventions 對照)
  - 05-02 (3 條 E2E test，供 architecture.md §4 Regression Test Matrix E2E cross-reference)
  - 05-03 (CI workflow shape，供 quickstart.md 的 bun run test:ci / coverage gate 命令)
provides:
  - narrative-first README.md（社群可用第一印象）
  - docs/quickstart.md 10-min two-path dogfood
  - docs/architecture.md 3 mermaid + regression matrix + testing conventions
  - docs/decisions/0018（testcontainers deviation，MADR 4.0 Accepted）
  - AGENTS.md 頂部 AI Agent Onboarding TOC + L197 重命名 + Further reading
affects:
  - README.md（narrative 重寫；取代 Phase 1 underway status block）
  - AGENTS.md（新增檔頭 anchor + TOC + 尾端 Further reading；L197 標題重命名）
  - docs/decisions/README.md（新增 0018 列）
tech-stack:
  added: []
  patterns:
    - mermaid 圖（DDD four-layer flowchart / AuthContext sequence / Dual Identity flowchart）
    - MADR 4.0 full variant ADR（0018）
    - HTML anchor（<a id="ai-agent-onboarding"></a>）作為跨檔穩定連結
    - 10-minute dogfood 雙軌物語（cookie session + API Key）
key-files:
  created:
    - docs/quickstart.md（158 行）
    - docs/architecture.md（198 行）
    - docs/decisions/0018-testcontainers-deviation-via-docker-compose.md（102 行）
  modified:
    - README.md（+45 / −15，narrative 重寫）
    - AGENTS.md（+25 / −1，頂部 TOC + L197 重命名 + Further reading）
    - docs/decisions/README.md（+1，新增 0018 列）
decisions:
  - 採 HTML <a id> anchor（而非單靠 heading slug）以規避 CJK anchor 跨 renderer 不穩
  - ADR 0018 採 MADR 4.0 full variant；頂部 bullet 列 Status: Accepted 同時保留 YAML frontmatter status: accepted 與既有 17 份 ADR 風格一致
  - docs/decisions/README.md 所有 status 統一 lowercase 'accepted'（既有慣例）
  - Testing Conventions 放在 architecture.md §5（而非獨立 tests/README.md）以維持單一測試敘事入口
metrics:
  duration: ~20 min（估算）
  completed_date: 2026-04-20
---

# Phase 5 Plan 04: Docs Ship Summary

One-liner：Phase 5 docs trifecta 完成——narrative README + 10-min quickstart + architecture.md + ADR 0018 + AGENTS.md TOC——Rigging 從「內部參考 app」翻牌為「社群可 clone / 審查 / 貢獻」狀態。

## 執行結果

5 個檔案改動，5 筆 atomic commits，全部 Task 1-5 acceptance criteria 通過，G22「Looks Done But Isn't」10 項 check 中 9 項 PASS、1 項 N/A（CI run 需有 git remote 方能查詢，目前本倉無 remote）。

### File-by-file delta

| File | Lines added | Lines removed | Commit |
|---|---|---|---|
| README.md | +45 | −15 | b404a1f |
| docs/quickstart.md | +158 | 0 | 808799f |
| docs/architecture.md | +198 | 0 | 89d8b37 |
| docs/decisions/0018-testcontainers-deviation-via-docker-compose.md | +102 | 0 | 21a40b4 |
| docs/decisions/README.md | +1 | 0 | 21a40b4 |
| AGENTS.md | +25 | −1 | 076fa9c |
| **合計** | **+529** | **−16** | — |

## Cross-doc link matrix

| From | To | Verified |
|---|---|---|
| README.md `## Quickstart` | docs/quickstart.md | ✓ grep-verified |
| README.md `## Contributing` | AGENTS.md#ai-agent-onboarding | ✓ anchor 存在於 AGENTS.md |
| README.md `## Stack` | 7 條 ADR link（0001/0002/0003/0005/0008/0009/0010/0011/0018） | ✓ |
| README.md `## Architecture` | docs/architecture.md | ✓ |
| README.md `## Decisions` | docs/decisions/README.md | ✓ |
| README.md `## What NOT Included` | AGENTS.md#anti-features-do-not-propose-extending | ✓ heading 存在 |
| architecture.md Ch1 DDD | ADR 0003 + ADR 0009 | ✓ |
| architecture.md Ch2 AuthContext | ADR 0006 + ADR 0007 | ✓ |
| architecture.md Ch3 Dual Identity | ADR 0008 + ADR 0011 | ✓ |
| architecture.md §4 regression map | 8 regression test files | ✓ 全 8 存在 |
| architecture.md §4 e2e layer | 3 e2e test files | ✓ 全 3 存在 |
| ADR 0018 More Information | docker-compose.yml / ci.yml / helpers / architecture.md §5 / REQUIREMENTS.md | ✓ |
| AGENTS.md TOC bullet 5 | README / architecture / decisions | ✓ |
| AGENTS.md Further reading | README / quickstart / architecture / decisions / PROJECT.md | ✓ |

## Regression Map coverage check

| 期待 regression file | 實際存在於 tests/integration/auth/ | Match |
|---|---|---|
| cve-2025-61928.regression.test.ts | ✓ | ✓ |
| no-plugin-401.regression.test.ts | ✓ | ✓ |
| timing-safe-apikey.regression.test.ts | ✓ | ✓ |
| session-fixation.regression.test.ts | ✓ | ✓ |
| resolver-precedence.regression.test.ts | ✓ | ✓ |
| runtime-guard.regression.test.ts | ✓ | ✓ |
| password-hash-storage.regression.test.ts | ✓ | ✓ |
| key-hash-storage.regression.test.ts | ✓ | ✓ |
| **8/8 match** | | |

## E2E cross-reference coverage check

| 期待 e2e file | 實際存在於 tests/e2e/ | Match |
|---|---|---|
| dogfood-happy-path.test.ts | ✓ | ✓ |
| password-reset-session-isolation.test.ts | ✓ | ✓ |
| cross-user-404-e2e.test.ts | ✓ | ✓ |
| **3/3 match** | | |

## ADR Index Audit (19 rows post-update)

| # | Title | Status | 本 plan 是否改動 |
|---|---|---|---|
| 0000 | Use MADR 4.0 for ADRs | accepted | — |
| 0001 | Runtime: Bun 1.3.12 | accepted | — |
| 0002 | Web framework: Elysia 1.4.28 | accepted | — |
| 0003 | DDD four-layer structure | accepted | — |
| 0004 | Auth: BetterAuth 1.6.5 | accepted | — |
| 0005 | ORM: Drizzle 0.45.2 | accepted | — |
| 0006 | AuthContext as mandatory domain boundary | accepted | — |
| 0007 | Runtime guards via DI | accepted | — |
| 0008 | Dual auth: session + API Key | accepted | — |
| 0009 | Rigidity Map: three-tier strictness | accepted | — |
| 0010 | Postgres driver: postgres-js | accepted | — |
| 0011 | Resolver precedence: API Key over cookie | accepted | — |
| 0012 | Global plugin ordering | accepted | — |
| 0013 | API Key storage: prefix + hash + indexed | accepted | — |
| 0014 | API Key hashing: SHA-256 | accepted | — |
| 0015 | Rate limit: memory v1 / persistent v2 | accepted | — |
| 0016 | Trust BetterAuth session cookie defaults | accepted | — |
| 0017 | EvalDataset Shape Frozen at v1 | accepted | — |
| **0018** | **testcontainers for v1 satisfied via docker-compose + GitHub Actions services** | **accepted** | **新增** |

無任何列從 Draft / TBD / Proposed 被 promoted — 既有 17 列在 plan 開始前就都是 accepted，0018 為新增。

## Looks Done But Isn't (G22) — checklist results

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | ADR index status all substantive（無 TBD/Draft/Proposed） | ✓ PASS | 19 列全 `accepted` lowercase |
| 2 | AGENTS.md onboarding anchor + TOC | ✓ PASS | `<a id="ai-agent-onboarding">` + 5 bullet TOC + Further reading |
| 3 | `bun run test:regression` exit 0 | ✓ PASS | 12 pass / 0 fail / 8 regression files 跨 auth 目錄，5.49s |
| 4 | No @ts-ignore in src/auth + src/agents | ✓ PASS | grep 完全無命中 |
| 5 | `bun run typecheck` exit 0 | ✓ PASS | tsc --noEmit exit 0 |
| 6 | `bun run db:migrate && bun test` exit 0 | ✓ PASS | 221 pass / 1 skip / 0 fail / 74 test files / 12.96s |
| 7 | `bun run lint` exit 0 | ✓ PASS | biome check 178 files clean |
| 8 | CI last run on main green | N/A | 本 local repo 無 git remote（`gh run list` 回 "no git remotes found"）；post-merge 於 GitHub 上生效後方可驗證 |
| 9 | docs/quickstart.md + docs/architecture.md exist | ✓ PASS | 兩檔皆已 create |
| 10 | README first 70 lines = Core Value + Why + Quickstart link | ✓ PASS | `# Rigging` + `## Why Rigging` + `[docs/quickstart.md]` 皆落在前 57 行內（總共 57 行） |

**Verdict: 9 of 10 PASS + 1 N/A（pre-merge）— Phase 5 READY TO SHIP，Check 8 待 GitHub 遠端配置後補驗。**

## Commits

| Hash | Subject |
|---|---|
| b404a1f | docs(05-04): 以 narrative-first 風格重寫 README.md |
| 808799f | docs(05-04): 新增 docs/quickstart.md 10 分鐘雙軌 dogfood 物語 |
| 89d8b37 | docs(05-04): 新增 docs/architecture.md — 三張 mermaid 圖 + regression 對照表 + 測試慣例 |
| 21a40b4 | docs(05-04): ADR 0018 testcontainers deviation + 打磨 ADR 索引 status 欄 |
| 076fa9c | docs(05-04): AGENTS.md 頂部 TOC + L197 標題重命名 + Further reading |

## Deviations from plan

### 輕微 deviation（已記錄，未違反計畫意圖）

**1. [Rule 2 - consistency] ADR 0018 同時保留 YAML frontmatter + `- Status: Accepted` bullet**

- Found during: Task 4
- Issue: plan 字面要求 `grep -q "Status: Accepted"` pass，而既有 17 份 ADR 都用 YAML frontmatter `status: accepted`（lowercase）。純照 plan 文字會與既有慣例脫鉤。
- Fix: 頂部放 YAML frontmatter `status: accepted`（既有慣例）+ 標題下方 bullet 列 `- Status: Accepted`（滿足 plan 字面 grep）；兩者同時存在。
- Files modified: docs/decisions/0018-testcontainers-deviation-via-docker-compose.md
- Commit: 21a40b4

**2. [Rule 2 - content accuracy] AGENTS.md TOC bullet 4 anchor 指向 `#gsd-workflow-enforcement`**

- Found during: Task 5
- Issue: plan D-17-A 寫 bullet 4 link 為 `#gsd-workflow`，但既有 AGENTS.md 的 GSD workflow heading 實際為 `## GSD Workflow Enforcement`（GitHub slugify 後為 `#gsd-workflow-enforcement`）。如照 plan 字面寫會 404。
- Fix: TOC bullet 4 link 改為 `#gsd-workflow-enforcement`，對準實際存在的 heading slug。
- Files modified: AGENTS.md
- Commit: 076fa9c

**3. [Rule 2 - content accuracy] AGENTS.md TOC bullet 1 指向 `#project`**

- Found during: Task 5
- Issue: plan 字面寫 bullet 1 link 為 `#core-value`，但既有 AGENTS.md 不存在 `## Core Value` heading——Core Value 內容位於 `## Project` GSD 區塊中。
- Fix: bullet 1 link 指向實際存在的 `#project` heading slug，並在說明文字中標注「見下方 Project 區塊」。
- Files modified: AGENTS.md
- Commit: 076fa9c

### 無 Rule 1 / Rule 3 / Rule 4 deviation

Task 1-5 無 bug 修復、無 blocking issue、無 architectural change。

## Known Stubs

無。本 plan 全為 docs ship，無程式碼 stub / 待接線資料。

## Threat Flags

無。本 plan 未引入新的網路 endpoint / auth path / 檔案存取 / schema 變更——所有變更皆為靜態 markdown doc。

## Self-Check: PASSED

所有宣稱創建的檔案與 commit 均已驗證存在：

- ✓ README.md（commit b404a1f）
- ✓ docs/quickstart.md（commit 808799f）
- ✓ docs/architecture.md（commit 89d8b37）
- ✓ docs/decisions/0018-testcontainers-deviation-via-docker-compose.md（commit 21a40b4）
- ✓ docs/decisions/README.md（commit 21a40b4）
- ✓ AGENTS.md（commit 076fa9c）

五筆 commit 於 `git log --oneline` 均可見。

## Manual-gate followups（post-merge）

1. **External dev quickstart timing test**（Success Criterion #1）— 找 1 位志願者 on clean machine（無任何 Bun / Docker 預先配置）照 `docs/quickstart.md` 跑一次，計時 `git clone` → `curl -H x-api-key ... GET /agents/:id/prompts/latest` 成功。目標 ≤10 min 含閱讀時間。
2. **First-impression convergence test**（Success Criterion #4）— 找 1-2 位外部 reviewer 冷讀 README 前 70 行，在 15 秒內用一句話描述 Rigging 是什麼——期待 converge 到 "harness / AuthContext / AI Agent rails"。
3. **CI green on main**（G22 Check 8）— 等本 commit 推上 GitHub 遠端、Phase 5 merge 進 main 後，確認 `.github/workflows/ci.yml` 3 個 job（lint / typecheck / test）全綠；目前本 local repo 尚無 remote 故無法查詢。

## Gates satisfied

- **G16** README first 70 lines Core Value + Why + Quickstart — ✓
- **G17** docs/quickstart.md Path A + Path B + 10-min budget — ✓
- **G18** docs/architecture.md 3 mermaid + 5 sections — ✓
- **G19** docs/decisions/0018 MADR 4.0 Accepted — ✓
- **G20** ADR index 19 rows 全 substantive status — ✓
- **G21** AGENTS.md anchor + TOC + L197 rename + Further reading — ✓
- **G22** Looks Done But Isn't checklist — 9/10 PASS + 1 N/A（pre-merge）

Phase 5 READY TO SHIP，等 `$gsd-verify-work` orchestrator 收尾。
