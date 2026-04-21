# Phase 11: Resend Email Adapter - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 11 交付：以環境變數為開關，讓 `ResendEmailAdapter` 在生產環境取代 `ConsoleEmailAdapter`。

`IEmailPort` 介面已存在（`src/auth/application/ports/email.port.ts`）——這是純粹的 **adapter swap**，不需要改動任何 use case 或 domain 層。

**In scope:**
- 新增 `ResendEmailAdapter` implements `IEmailPort`
- 以 `RESEND_API_KEY` + `RESEND_FROM_ADDRESS` 兩個環境變數為開關
- 將兩欄位加入 `ConfigSchema`（`Type.Optional()`）
- 擴充 `AuthModuleDeps.config` Pick 型別
- `createAuthModule` 內部根據 config 判斷實例化哪個 adapter
- 啟動缺失 config 時給出清楚的 startup 錯誤（非 runtime 錯誤）
- 新增 `resend` npm 套件（pinned exact version）
- 既有測試套件不需 Resend API key 仍可全部通過

**Out of scope:**
- HTML email 模板
- 其他 email provider（Postmark、SendGrid 等）
- 電子郵件 bounce handling、webhook 處理
- Per-email rate limiter
- 測試用 Resend sandbox / mock server

</domain>

<decisions>
## Implementation Decisions

### Config 驗證策略

- **D-01:** `RESEND_API_KEY` 與 `RESEND_FROM_ADDRESS` 以 `Type.Optional()` 加入現有 `ConfigSchema`——不開獨立 schema、不在 adapter constructor 讀 `process.env`。
  - `RESEND_API_KEY: Type.Optional(Type.String())`
  - `RESEND_FROM_ADDRESS: Type.Optional(Type.String({ format: 'email' }))`
  - `loadConfig()` 統一驗證，兩欄位 `undefined` when not set，Config type 有型別標記。

- **D-02:** 如果設定了 `RESEND_API_KEY` 但沒設 `RESEND_FROM_ADDRESS`（或反之），adapter selection 邏輯的 `&&` 判斷會 fallback 到 `ConsoleEmailAdapter`，**不會拋出錯誤**。
  - 若要明確「兩個都要有」的 fail-fast，可在 `createAuthModule` 加一個 guard（planner 決定）。
  - 或接受「只設一個時 silent fallback」的行為（也符合 SC-02：「留 either unset」→ clear error；「兩個都設」→ Resend）。

### Adapter 選擇邏輯

- **D-03:** 選擇邏輯放在 `createAuthModule` 內部，**不抽獨立 factory function、不由外層注入**。
  - `AuthModuleDeps.config` 的 Pick 型別擴充加入 `'RESEND_API_KEY' | 'RESEND_FROM_ADDRESS'`。
  - 內部 wiring pattern：
    ```ts
    const emailPort =
      deps.config.RESEND_API_KEY && deps.config.RESEND_FROM_ADDRESS
        ? new ResendEmailAdapter(deps.config.RESEND_API_KEY, deps.config.RESEND_FROM_ADDRESS, deps.logger)
        : new ConsoleEmailAdapter(deps.logger)
    ```

### Resend 實作

- **D-04:** 使用官方 `resend` npm 套件（pinned exact version，與現有 `package.json` 鎖定慣例一致）。
  - `ResendEmailAdapter` constructor 接收 `apiKey: string`、`from: string`、`logger: Logger`，在 constructor 內建立 `new Resend(apiKey)`。
  - `send()` 呼叫 `this.client.emails.send({...})`，回傳 `{ data, error }` pattern，error 時 log + throw `Error`。

### Email 內容格式

- **D-05:** 發送**純文字** email——`text: params.body`（body 就是 BetterAuth 傳入的 URL 字串）。
  - 不加 HTML 模板，行為與現有 `ConsoleEmailAdapter` 完全一致，差別只在「輸出管道」。
  - `from` 欄位使用 `RESEND_FROM_ADDRESS` 環境變數。

### 測試策略

- **D-06:** 既有測試套件透過 DI 直接傳入 `ConsoleEmailAdapter`（已有 `authInstance?: AuthInstance` 的 optional dep 模式），不受 env var 影響——無需額外 mock 或 skip flag。
  - `ResendEmailAdapter` 本身需要單元測試：mock `resend` 套件的 `emails.send` 方法，驗證正確參數與 error throw 行為。

### the agent's Discretion

- 「只設一個 env var 時」的行為——silent fallback vs. startup error：planner 可決定是否加 guard（建議加，更符合 SC-02 的 clear error 精神）。
- `resend` 套件的 exact pinned version 號——在 `bun add resend` 時取得最新穩定版並 pin。
- `ResendEmailAdapter` 的 logger 是否 log 每次成功發信——planner 可決定 log level。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 現有實作（直接讀取）
- `src/auth/application/ports/email.port.ts` — IEmailPort 介面定義（3 行，send 參數型別）
- `src/auth/infrastructure/email/console-email.adapter.ts` — 現有 adapter 實作，ResendEmailAdapter 要模仿其結構
- `src/auth/auth.module.ts` — createAuthModule 函式，adapter wiring 的落點（第 32 行）
- `src/bootstrap/config.ts` — ConfigSchema + loadConfig() 模式，Type.Optional() 要加在這裡

### Phase 11 需求
- `.planning/ROADMAP.md` Phase 11 段落 — 5 條 Success Criteria（SC-01..SC-05）

### 無外部 spec 文件
IEmailPort 介面完整自描述，Resend SDK 文件以 `mcp__context7__*` 或官網查詢即可；無需額外 ADR（純 adapter 實作不涉及架構決策，若 planner 判斷需要可開 ADR 0020）。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `IEmailPort`（`src/auth/application/ports/email.port.ts`）：唯一需要 implement 的介面，只有一個 `send()` method
- `ConsoleEmailAdapter`（`src/auth/infrastructure/email/console-email.adapter.ts`）：直接作為 `ResendEmailAdapter` 的結構模板
- TypeBox `Type.Optional()`：已在 `ConfigSchema` 中其他欄位使用過（`LOG_LEVEL` 等），pattern 已建立

### Established Patterns
- `createAuthModule` deps 的 `Pick<Config, ...>` pattern：擴充只需加兩個 key 到 Pick union
- Adapter 作為 infrastructure 層實作：放在 `src/auth/infrastructure/email/` 資料夾下
- Pino logger 注入至 infrastructure layer：`ConsoleEmailAdapter` 已示範此 pattern
- `deps.authInstance?: AuthInstance` optional dep：測試可繞過某些 infrastructure——email adapter 的測試不需要這樣，直接 mock `resend`

### Integration Points
- `createAuthModule`（`src/auth/auth.module.ts` 第 32 行）：唯一需要修改的 wiring 點
- `ConfigSchema`（`src/bootstrap/config.ts`）：加兩個 `Type.Optional()` 欄位
- `AuthModuleDeps.config` Pick 型別：擴充兩個 key

</code_context>

<specifics>
## Specific Ideas

- 實作風格完全對齊現有 `ConsoleEmailAdapter`：constructor 注入 logger，`send()` 是唯一 public method，class implements `IEmailPort`
- `ResendEmailAdapter` 的 error handling：Resend SDK 回傳 `{ data, error }` union，error 時 `logger.error()` + `throw new Error(...)`

</specifics>

<deferred>
## Deferred Ideas

- HTML email 模板（帶按鈕的驗證信）——v1.4+ 或 PROD-01 後續迭代
- Postmark / SendGrid 等其他 provider——可在 IEmailPort 上再加 adapter，不影響現有設計
- Bounce handling / delivery webhook——需要獨立 phase
- Resend sandbox / mock server 的整合測試——v1.4+ 考量

</deferred>

---

*Phase: 11-resend-email-adapter*
*Context gathered: 2026-04-21*
