# Phase 4: Demo Domain - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 04-demo-domain
**Areas discussed:** EvalDataset shape & ADR, PromptVersion 語意, Agent ownership 與 API 形狀, Harness friction 量測 & DEMO-06 ADR

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| EvalDataset shape & ADR | jsonb cases vs normalized eval_case table、Dataset ↔ Agent vs ↔ PromptVersion、case shape、ADR P4-01 候選 | ✓ |
| PromptVersion 語意 | server vs client version、content type、是否可 DELETE、latest 取得方式 | ✓ |
| Agent ownership 與 API 形狀 | cross-user 404 vs 403、ownership check 哪一層、REST 路徑、cascade delete | ✓ |
| Harness friction 量測 & DEMO-06 ADR | friction 計數機制、ADR 觸發條件、log 檔案位置與生命週期、ADR 內容 | ✓ |

**User's choice:** 全部四區
**Notes:** 一次討論到底，不分批

---

## EvalDataset shape & ADR

### Q1: 儲存 shape

| Option | Description | Selected |
|--------|-------------|----------|
| jsonb cases (Recommended) | 單一 eval_dataset row 有 cases jsonb；aggregate 邊界乾淨；v1 冗餘低 | ✓ |
| 正規化 eval_case table | per-case stats / case-level 查詢便利；v1 冗餘高、migration 複雜 | |
| 只有 EvalCase entity | 偏離 DEMO-03 字面（EvalDataset entity） | |

**User's choice:** jsonb cases
**Notes:** v1 dogfood 不在 case-level analytics

### Q2: Dataset 關聯

| Option | Description | Selected |
|--------|-------------|----------|
| Dataset ↔ Agent (Recommended) | 任何 PromptVersion 可被該 dataset 評；與 prompt 迭代解耦 | ✓ |
| Dataset ↔ PromptVersion | 評估與 prompt 生命週期同步；換 version 要複製 dataset | |
| Dataset ↔ Agent + optional promptVersionId | 靈活但 v1 多一個 shape 判斷、預設 behavior 不明 | |

**User's choice:** Dataset ↔ Agent
**Notes:** 評估器 / scoring 屬 v2 / out of scope

### Q3: EvalCase shape

| Option | Description | Selected |
|--------|-------------|----------|
| string 兩欄 (Recommended) | input/expectedOutput: string；簡單、harness 不加意見 | ✓ |
| jsonb 兩欄 | input/expectedOutput: unknown；過早結構化 LLM call shape | |
| string + metadata jsonb | 微低複雜度 + 未來掛附加註釋 | |

**User's choice:** string 兩欄

### Q4: Mutability

| Option | Description | Selected |
|--------|-------------|----------|
| Immutable (Recommended) | POST 建 dataset 帶完整 cases；之後只能 DELETE；要改 = 建新 dataset | ✓ |
| Mutable cases | PATCH 可 add/remove/edit；需 versioning；超出 v1 | |
| Append-only cases | 只能 POST add；折衷但收益不明 | |

**User's choice:** Immutable

---

## PromptVersion 語意

### Q1: Version 連號機制

| Option | Description | Selected |
|--------|-------------|----------|
| Server auto-increment (Recommended) | server max(version)+1；UNIQUE (agentId,version) + retry on race | ✓ |
| Client-provided + monotonic check | client 須先查 latest；多一趟 round trip | |
| Content hash | sha256(content) 為 version；不可變地址；DEMO-02「單調遞增」字面不符 | |

**User's choice:** Server auto-increment
**Notes:** retry 上限 3 次，超過 throw PromptVersionConflictError

### Q2: content 型別

| Option | Description | Selected |
|--------|-------------|----------|
| string (plain text) (Recommended) | 最簡；harness 不替使用者決定 LLM call shape；v2 可 supersede | ✓ |
| jsonb structured ({system?, user?, vars?}) | 預先鎖 structure；超出 harness 必要 opinion | |
| {template, variables} | Jinja-like；引進 render 語意；v1 demo 不需要 | |

**User's choice:** Plain string

### Q3: PromptVersion 是否可 DELETE

| Option | Description | Selected |
|--------|-------------|----------|
| Immutable / append-only (Recommended) | 沒有 DELETE 單一版本；要「取消」請發新版本；歷史 audit 完整 | ✓ |
| DELETE 單一版本（硬刪） | monotonic 有 hole；audit 裂庭 | |
| Soft delete (deletedAt) | 多一個 mutable state；v1 不需要 | |

**User's choice:** Immutable / append-only
**Notes:** 唯一移除 PromptVersion 的途徑是 DELETE 整個 Agent → cascade

### Q4: Latest version 取得

| Option | Description | Selected |
|--------|-------------|----------|
| always max(version) per agent (Recommended) | 即時計算；無 mutable state；append-only 保證 | ✓ |
| Agent.currentVersionId pointer | 多一條 mutable state；可「狀態回滾」；v1 不需要 | |
| 兩者都提供 + max 為預設 | 多概念；超出 v1 | |

**User's choice:** always max(version)
**Notes:** index (agentId, version DESC)

---

## Agent ownership 與 API 形狀

### Q1: Cross-user 取錯

| Option | Description | Selected |
|--------|-------------|----------|
| 404 NotFound (Recommended) | 避免 enumeration vector；不洩漏存在性；ResourceNotFoundError 統一 | ✓ |
| 403 Forbidden + USER_ID_MISMATCH | 變相洩漏該 id 存在；CRUD enumeration 弱點 | |
| 看資源類型混合 (Agent 404, child 403) | 不一致；安全收益不明 | |

**User's choice:** 404 NotFound

### Q2: Ownership 檢查在哪一層

| Option | Description | Selected |
|--------|-------------|----------|
| Use case 層 (Recommended) | 與 P3 D-02 同精神；repository 保持 stateless；單元測試易 | ✓ |
| Repository auto-scoping | Repository 吃 ctx；變 stateful per-request；偏離 P3 慣例 | |
| Repository 帶 ownerId 參數 | 三參數 query；冗餘 | |

**User's choice:** Use case 層

### Q3: REST 路徑

| Option | Description | Selected |
|--------|-------------|----------|
| 嵌套 sub-resources (Recommended) | /agents/:id/prompts、/eval-datasets；路徑含 ownership context；Swagger 分組清楚 | ✓ |
| 扁平 + agentId in body/query | API contract 不明示 parent；ownership 隱藏 | |
| 混合 | 不一致 | |

**User's choice:** 嵌套

### Q4: Cascade delete

| Option | Description | Selected |
|--------|-------------|----------|
| ON DELETE CASCADE (Recommended) | DB layer FK；簡單；demo dogfood 不在 audit history 範圍 | ✓ |
| Soft delete Agent (deletedAt) | 與 P3 D-24 對齊但 v1 demo 不需要 | |
| 409 CONFLICT 要求先刪 children | dogfood UX 摩擦不必要 | |

**User's choice:** ON DELETE CASCADE
**Notes:** 與 P3 D-24 API Key soft delete 不同 motivation — API Key 屬安全 audit；Agent 屬 demo data

---

## Harness friction 量測 & DEMO-06 ADR

### Q1: 計數機制

| Option | Description | Selected |
|--------|-------------|----------|
| executor 邊做邊填 04-HARNESS-FRICTION.md (Recommended) | append-only timestamped log；real-time signal；自我覺察 | ✓ |
| PR review 事後 tally | 漏掉「想下手但勉強完成」的內心戰 | |
| 不記錄 | 違背 harness 驗證主軸 | |

**User's choice:** executor 邊做邊填

### Q2: ADR 觸發條件

| Option | Description | Selected |
|--------|-------------|----------|
| >3 events OR 任一 structural event (Recommended) | 量化門檻 + structural 不可妥協雙觸發 | ✓ |
| >3 events 唯一條件 | 進度可能變成「哪些記哪些不記」dispute | |
| >5 events / structural 裡頭規則 | 偏坐「不事」；harness UX 顁不填 | |

**User's choice:** >3 events OR structural

### Q3: Log 位置與生命週期

| Option | Description | Selected |
|--------|-------------|----------|
| .planning/phases/04-demo-domain/04-HARNESS-FRICTION.md (Recommended) | 跟 phase artifacts 一起 commit；P5 docs 可引用 | ✓ |
| GitHub issue label harness-friction | 多一層 GitHub 工作流；v1 不需要 | |
| .planning/phases/04-demo-domain/notes/ | 多一層目錄；冗餘 | |

**User's choice:** 04-HARNESS-FRICTION.md

### Q4: ADR 規畫

| Option | Description | Selected |
|--------|-------------|----------|
| ADR 0017 EvalDataset shape (Recommended) | ROADMAP risk-flag 必開；釘 D-01..D-05 | ✓ |
| ADR 0017 + 0018（無條件 ship） | 0018 ownership scoping；不是 rigidity 決策、可不 ADR | |
| 0017 必 + 0018 條件性 ship（friction 觸發） | 等於 (Recommended) + 條件性 0018；其實同義 | |

**User's choice:** ADR 0017 EvalDataset shape
**Notes:** 0018 條件性 ship 由 D-16 觸發決定（與 ADR 0018 計畫已寫進 D-17）

---

## the agent's Discretion

無；本次討論皆由使用者主動決策。Researcher / planner 可依 ARCHITECTURE.md / STACK.md / 前 phase CONTEXT 決定的項目記錄於 CONTEXT.md `<decisions>` §the agent's Discretion 子段。

## Deferred Ideas

詳見 CONTEXT.md `<deferred>` 段；本日討論中浮現但屬後續 phase / v2 範疇者皆已歸納。

---

*Discussion log generated: 2026-04-19*
