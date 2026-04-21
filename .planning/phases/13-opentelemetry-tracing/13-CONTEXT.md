# Phase 13: OpenTelemetry Tracing - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

新增一個 Elysia plugin，讓每個 HTTP request 自動產生 OTLP-compatible trace span，包含 route template（如 `/api/agents/:id`）、HTTP method、response status code、latency。Span export 由 `OTEL_EXPORTER_OTLP_ENDPOINT` 環境變數控制，未設定時 TracerProvider 仍運作但不 export（no-op）。

**不在範圍：**
- Drizzle DB query spans（PROD-03b，未來 phase）
- OTLP metrics export（PROD-03c，未來 phase）
- Auto-instrumentation of Node.js built-in modules（選用手動插樁策略）

</domain>

<decisions>
## Implementation Decisions

### OTel SDK 組合

- **D-01:** 手動組裝輕量 SDK，不使用 `@opentelemetry/sdk-node` all-in-one
  - 套件：`@opentelemetry/sdk-trace-node`、`@opentelemetry/exporter-trace-otlp-http`、`@opentelemetry/resources`、`@opentelemetry/semantic-conventions`
  - 理由：Rigging 是 harness template，bundle size 和依賴複雜度直接影響所有用戶；`sdk-node` 約 2-3MB+ 且 auto-patches Node 內建模組，對此用途過重
  - **Exact pinning**（與 ioredis、resend 一致，避免 OTel 快速迭代帶入 breaking change）

### SDK 初始化位置

- **D-02:** 在 `main.ts` 頂部以獨立 `otel-init.ts` 初始化 TracerProvider，在 `createApp` 呼叫之前執行
  - 理由：符合 OTel 規範（需在任何 require 前初始化），且 Bun 採手動插樁不依賴 auto-instrument，對 createApp pattern 無破壞
  - No-op 行為：`OTEL_EXPORTER_OTLP_ENDPOINT` 未設定時，TracerProvider 照常建立但不掛載 OTLP exporter（可接受 in-memory exporter 推入）

### Elysia Plugin 設計

- **D-03:** 新增 `tracing.plugin.ts` 放入 `src/shared/presentation/plugins/`，遵循 ADR 0012 canonical ordering（horizontal plugins 在 feature modules 前）
  - 攔截：`onBeforeHandle` 記錄 request 開始時間，`onAfterHandle` + `onError` 完成 span
  - Route 識別：從 Elysia `context.route` 取 parametrized template（如 `/api/agents/:id`），避免 high cardinality

### Span 屬性（最小集合 per PROD-03）

- **D-04:** 只實作 PROD-03 成功標準所要求的屬性：
  - `http.route`（parametrized template）
  - `http.method`
  - `http.status_code`
  - `http.request.duration`（latency，毫秒）
  - Error status on 4xx/5xx
  - `request_id`、DB query spans 等留給 PROD-03b

### 環境變數

- **D-05:** `OTEL_EXPORTER_OTLP_ENDPOINT` 加入 `ConfigSchema` 為 `Type.Optional`（與 `REDIS_URL`、`RESEND_API_KEY` 同一 pattern）

### 測試策略

- **D-06:** 使用 `@opentelemetry/sdk-trace-base` 的 `InMemorySpanExporter` 在整合測試中推入 TracerProvider，測試後斷言 span 數量、`http.route`、`http.status_code` 正確
  - 現有測試繼續通過（PROD-03 success criteria #5）

### ADR

- **D-07:** 建立 ADR 0020 記錄 OTel SDK 選擇理由（手動組裝 vs all-in-one sdk-node 的權衡），STATE.md 已標記此 ADR 為必要

### Agent's Discretion

- OTel SDK 的確切版本號（在計劃時查最新 stable 版本確認）
- `otel-init.ts` 的具體工廠函式簽名（`initTracing(config: Config): void` 或類似）
- Elysia plugin 內 span name 格式（如 `HTTP GET /api/agents/:id` 或只用 route）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §PROD-03 — 完整 acceptance criteria（5 條成功標準）

### Architecture
- `docs/adrs/` ADR 0012 — Canonical plugin ordering（新 plugin 必須遵循此 ordering）
- `docs/adrs/` ADR 0019 — ADR frontmatter validate（新 ADR 0020 必須符合 MADR 4.0 格式）

### Existing Patterns (必讀)
- `src/bootstrap/app.ts` — createApp plugin ordering + Redis 條件注入模式（OTel 仿此）
- `src/bootstrap/config.ts` — ConfigSchema Optional env var 模式（OTEL_EXPORTER_OTLP_ENDPOINT 仿此）
- `src/shared/infrastructure/redis/client.ts` — infrastructure factory 模式
- `src/shared/presentation/plugins/request-logger.plugin.ts` — 現有 request lifecycle plugin 模式

### Prior Phase Context
- `.planning/phases/12-redis-rate-limit-store/12-01-PLAN.md` — Phase 12 config + optional infra 模式參考

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ConfigSchema`（`src/bootstrap/config.ts`）：加入 `OTEL_EXPORTER_OTLP_ENDPOINT: Type.Optional(Type.String({ format: 'uri' }))` 即可
- `createApp`（`src/bootstrap/app.ts`）：參考 Redis 條件注入模式 wire tracing plugin
- Plugin 目錄：`src/shared/presentation/plugins/` — 已有 4 個 plugin，新增 `tracing.plugin.ts`

### Established Patterns
- Optional infra：env var 未設 → 跳過或 no-op（`REDIS_URL` → `createRedisClient` 不呼叫；`OTEL_EXPORTER_OTLP_ENDPOINT` → 不掛 OTLP exporter）
- Exact pin：`package.json` 所有 infra 依賴無 caret
- `exactOptionalPropertyTypes: true`：TypeScript config，傳 optional prop 時必須用展開語法而非傳 `undefined`

### Integration Points
- `main.ts`：頂部加 `import './bootstrap/otel-init'`（或等效 early init）
- `createApp`：在 horizontal plugins 序列中加入 `tracingPlugin()`，位置在 swaggerPlugin 之後、feature modules 之前
- 整合測試 `createApp` 呼叫：可選擇注入 in-memory exporter 而非 OTLP exporter

</code_context>

<specifics>
## Specific Ideas

- ADR 0020 需要記錄的核心論點：「Rigging 是 template，bundle 大小是 downstream concern；sdk-node auto-instruments http/dns/net 但我們只需要 Elysia level spans」
- Jaeger 本地測試：`docker run -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one` + `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` 即可驗證 success criteria #3

</specifics>

<deferred>
## Deferred Ideas

- **PROD-03b**（Drizzle DB query spans）— 已列入 REQUIREMENTS.md v1.4+ 候選
- **PROD-03c**（OTLP metrics export）— 已列入 REQUIREMENTS.md v1.4+ 候選
- **request_id 關聯**（將 Pino log 的 requestId 加入 span attributes）— 有價值但超出 PROD-03 最小範圍

</deferred>

---

*Phase: 13-opentelemetry-tracing*
*Context gathered: 2026-04-21*
