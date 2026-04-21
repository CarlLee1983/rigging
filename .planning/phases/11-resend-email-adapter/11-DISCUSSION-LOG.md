# Phase 11: Resend Email Adapter - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 11-resend-email-adapter
**Areas discussed:** Config 驗證策略, Adapter 選擇邏輯位置, Resend SDK vs fetch, Email 內容格式

---

## Config 驗證策略

| Option | Description | Selected |
|--------|-------------|----------|
| 加 Optional 至主 Schema | 在 ConfigSchema 加兩個 Type.Optional() 欄位，loadConfig() 統一驗證 | ✓ |
| 獨立 ResendConfig schema | 主 ConfigSchema 不動，另開 schema 只在 RESEND_API_KEY 存在時才驗證 | |
| 只在 Adapter 建構時驗 | Config 完全不管 Resend 變數，ResendEmailAdapter constructor 自己讀 process.env | |

**User's choice:** 加 Optional 至主 Schema（推薦）
**Notes:** 符合現有 `loadConfig()` 統一驗證模式，Config type 有型別標記，零重複代碼。

---

## Adapter 選擇邏輯位置

| Option | Description | Selected |
|--------|-------------|----------|
| createAuthModule 內直接建構 | 在 createAuthModule 內判斷 config 並 new 對應 adapter | ✓ |
| 獨立 Factory Function | 建 createEmailAdapter(config, logger) factory，createAuthModule 呼它 | |
| emailAdapter 作為 deps 從外注入 | AuthModuleDeps 加 emailAdapter?: IEmailPort，由外層 bootstrap 傳入 | |

**User's choice:** createAuthModule 內直接建構（推薦）
**Notes:** 改動最小，符合現有「模組內部自包」風格；authInstance 已是 optional dep 供測試繞過，email adapter 的測試不需要此模式（直接 mock resend）。

---

## Resend SDK vs fetch

| Option | Description | Selected |
|--------|-------------|----------|
| 官方 resend npm 套件 | npm install resend，typed client，error handling 內建 | ✓ |
| Raw fetch 呼 REST API | 零依賴，直接 fetch('https://api.resend.com/emails')，需自行處理 HTTP error | |

**User's choice:** 官方 resend npm 套件（推薦）
**Notes:** Resend 官方維護，乾淨 API（`emails.send()` 回傳 `{ data, error }`）。新增一個 pinned dep，與現有慣例一致。

---

## Email 內容格式

| Option | Description | Selected |
|--------|-------------|----------|
| 純文字 text | `text: params.body`，body 就是 URL 字串，行為與 ConsoleEmailAdapter 完全一致 | ✓ |
| 最簡 HTML | 發 HTML email，額外加一行按鈕 `<a href="{url}">Verify Email</a>`，同時保留 text fallback | |

**User's choice:** 純文字 text（推薦）
**Notes:** 最簡單，不需要模板。現有 IEmailPort.send() 的 body 欄位就是 URL，直接傳入 text: params.body。

---

## the agent's Discretion

- 「只設一個 env var 時」是 silent fallback 或 startup error——planner 決定（建議加 guard 以符合 SC-02）
- `resend` 套件的 pinned version 號——bun add 時取最新穩定版
- ResendEmailAdapter 是否 log 成功發信——planner 決定 log level

## Deferred Ideas

- HTML email 模板（帶按鈕）——v1.4+
- 其他 email provider（Postmark / SendGrid）——未來 adapter
- Bounce handling / delivery webhook——獨立 phase
