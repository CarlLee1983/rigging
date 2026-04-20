# Phase 10: Publish & Docs - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 10-publish-docs
**Areas discussed:** npm 版本號, Publish 方式, README 改寫深度, Quickstart 結構

---

## npm 版本號

| Option | Description | Selected |
|--------|-------------|----------|
| 0.1.0 | 有意義的初始發布，但不宣告 stable | ✓ |
| 1.0.0 | 直接宣告 stable，與 Rigging v1 一致 | |
| 0.0.1 | 維持現狀，語意偏 prototype/internal | |

**User's choice:** 0.1.0
**Notes:** Phase 9 已是完整功能，0.1.0 比 0.0.1 更準確；但 npx 工具通常先在 0.x 收集反饋再升 1.0。

---

## Publish 方式

| Option | Description | Selected |
|--------|-------------|----------|
| 手動一次性 | 本機 npm publish，步驟文件化 | ✓ |
| GitHub Actions 自動發布 | Git tag 觸發，需 NPM_TOKEN secret | |

**User's choice:** 手動一次性
**Notes:** Phase 10 範圍不包含 CI publish workflow；手動發布步驟寫入 plan 即可。

---

## README 改寫深度

| Option | Description | Selected |
|--------|-------------|----------|
| 加 Getting Started 頁首 section | 最少改動，滿足成功標準 | ✓ |
| 重組結構 | 整體重新排版，更大工程但非必要 | |

**User's choice:** 加 Getting Started 頁首 section
**Notes:** 移除「v2 not yet built」免責聲明，其餘結構不動。

---

## Quickstart 結構

| Option | Description | Selected |
|--------|-------------|----------|
| Scaffold 頁首 + 保留 clone 路徑 | 兩條路徑共存，clone 降格為 Contributing | ✓ |
| 完全替換 | 移除 git clone 路徑，scaffold-only | |

**User's choice:** Scaffold 頁首 + 保留 clone 路徑
**Notes:** 現有詳細 curl walkthrough (Path A/B) 對貢獻者仍有價值，降格為 Contributing/Development section。

---

## Agent's Discretion

- Getting Started section 在 README 的確切措辭
- 是否在 Getting Started 下加 Prerequisites（Node 18+、Bun、Docker）
- quickstart.md 降格 section 的標題名稱

## Deferred Ideas

- GitHub Actions publish workflow — v1.3 候選
- npm org scoping — 不需要，`create-rigging` 無前綴遵循慣例
