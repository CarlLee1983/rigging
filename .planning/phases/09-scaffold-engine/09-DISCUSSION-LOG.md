# Phase 9: Scaffold Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 09-scaffold-engine
**Areas discussed:** CLI 執行環境, Template 打包策略, 名稱替換範圍, 排除清單

---

## CLI 執行環境

| Option | Description | Selected |
|--------|-------------|----------|
| 純 Node.js（無額外 npm 依賴） | `fs`, `path`, `child_process` 內建 API，`npx` 直接可用 | ✓ |
| Node.js + npm 工具（chalk, ora） | UX 精緻（spinner、彩色輸出）但增加 install 體積 | |
| Bun-native | 語法簡潔但需使用者先裝 Bun，違反 SCAF-02 | |

**Q: Node.js 最低版本？**
User's choice: Node 18+
Reason: `fs.cpSync` 可用，2025 年仍在支援期

**Q: 版本不符處理方式？**
User's choice: 顯示錯誤訊息並退出（exit code 1）

---

## Template 打包策略

| Option | Description | Selected |
|--------|-------------|----------|
| Inline bundle | template 目錄隨 npm 套件一起發布，離線可用 | ✓ |
| Git clone at runtime | 執行時 clone 指定 tag，需要網路 | |
| Separate npm package | template 獨立發布，多一發布步驟 | |

**Q: Template 同步機制？**
User's choice: Build script 複製（`template/` 不進 git）
Reason: 發布前執行腳本複製，避免 template 目錄與 reference app 雙重維護

**Q: CLI 定位 template 方式？**
User's choice: `__dirname` 相對路徑

---

## 名稱替換範圍

| Option | Description | Selected |
|--------|-------------|----------|
| 全文字串替換 | 所有文字檔掃描替換，create-next-app 模式 | ✓ |
| Template token | 預先把 template 裡的 `rigging` 改為 `{{PROJECT_NAME}}` | |
| 指定檔案清單 | 只替換 package.json、docker-compose.yml 等 | |

**Q: 大小寫變體？**
User's choice: 多個變體（`rigging` + `Rigging` 同時替換）

**Q: 二進位檔案處理？**
User's choice: 跳過非文字檔（副檔名白名單）

---

## 排除清單

**Q: `drizzle/` 目錄？**
User's choice: 包含（生成的專案帶有已有的 migration，可直接執行）

**Q: `bun.lock`？**
User's choice: 包含（鎖定精確依賴版本，確保可重現性）

---

## Agent's Discretion

- Exact whitelist extension list
- Error message wording for Node version check
- `--version` flag on CLI binary

## Deferred Ideas

- Interactive mode (SCAF-09, v1.3+)
- Minimal harness variant (SCAF-10, v1.3+)
- `RIGGING_TEMPLATE_PATH` env override
