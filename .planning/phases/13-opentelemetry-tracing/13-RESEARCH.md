# Phase 13: OpenTelemetry Tracing - Research

**Researched:** 2026-04-21
**Domain:** OpenTelemetry JS SDK 2.x / Elysia lifecycle hooks / Bun runtime compatibility
**Confidence:** HIGH (版本和 API 均透過 npm registry 和 Context7 驗證)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 手動組裝輕量 SDK，不使用 `@opentelemetry/sdk-node` all-in-one
  - 套件：`@opentelemetry/sdk-trace-node`、`@opentelemetry/exporter-trace-otlp-http`、`@opentelemetry/resources`、`@opentelemetry/semantic-conventions`
  - Exact pinning（與 ioredis、resend 一致）
- **D-02:** 在 `main.ts` 頂部以獨立 `otel-init.ts` 初始化 TracerProvider，在 `createApp` 呼叫之前
- **D-03:** `tracing.plugin.ts` 放入 `src/shared/presentation/plugins/`，遵循 ADR 0012 canonical ordering；onBeforeHandle 記錄開始時間，onAfterHandle + onError 完成 span
- **D-04:** 最小 span 屬性：`http.route`、`http.method`、`http.status_code`、`http.request.duration`（latency, ms）、Error status on 4xx/5xx
- **D-05:** `OTEL_EXPORTER_OTLP_ENDPOINT` 加入 `ConfigSchema` 為 `Type.Optional`
- **D-06:** `@opentelemetry/sdk-trace-base` 的 `InMemorySpanExporter` 用於整合測試
- **D-07:** 建立 ADR 0020 記錄 OTel SDK 選擇理由

### Claude's Discretion

- OTel SDK 的確切版本號（在計劃時查最新 stable 版本確認）
- `otel-init.ts` 的具體工廠函式簽名
- Elysia plugin 內 span name 格式

### Deferred Ideas (OUT OF SCOPE)

- PROD-03b: Drizzle DB query spans
- PROD-03c: OTLP metrics export
- request_id 關聯（Pino log requestId 加入 span attributes）
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROD-03 | All HTTP requests automatically emit OTel trace spans (route, method, status code, latency) via Elysia middleware, collectable by any OTLP-compatible backend | D-01~D-07 fully researched; 5 success criteria mapped below |

### PROD-03 Success Criteria 對應

| # | Success Criterion | Implementation Strategy |
|---|-------------------|------------------------|
| 1 | `OTEL_EXPORTER_OTLP_ENDPOINT` 設定時 spans 自動 export | otel-init.ts 條件判斷，env 存在才掛載 OTLPTraceExporter |
| 2 | 每個 span 含 route、method、status code、latency | tracingPlugin onBeforeHandle + onAfterHandle，context.route + performance.now() |
| 3 | 本機 Jaeger 可看到 traces | docker run jaegertracing/all-in-one + OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 |
| 4 | 4xx/5xx 產生 error status span | onError hook + span.setStatus({ code: SpanStatusCode.ERROR }) |
| 5 | 現有測試繼續通過 | InMemorySpanExporter 或 no-op（無 exporter 時 provider 仍可運作） |
</phase_requirements>

---

## Summary

Phase 13 為 Rigging 加入 OpenTelemetry HTTP tracing 中介層。核心策略是手動組裝輕量 OTel 2.x SDK（4 個套件），在 `main.ts` 最頂部初始化 TracerProvider，並在 `src/shared/presentation/plugins/tracing.plugin.ts` 中用 Elysia lifecycle hooks 捕捉每個 request 的 span。

**SDK 版本重要提示（2.x 重大 breaking change）：** OTel JS SDK 2.0 於 2025 年底釋出，`BasicTracerProvider.addSpanProcessor()` 已移除——必須使用 constructor `{ spanProcessors: [...] }` 選項。`new Resource({...})` 已改為 `resourceFromAttributes({...})` 函式。`SEMATTRS_*` 常數仍存在但已 deprecated，新版使用 `ATTR_*` 前綴。Context7 驗證的文件全部基於 2.x API。

**Bun 相容性：** 已知有一個 Bun timeout issue（issue #5260，SDK 1.22 時代），但實際 span 仍能成功送達。使用手動 `SimpleSpanProcessor` 而非 `BatchSpanProcessor` 可迴避此問題，且對 Rigging 的 Elysia-level-only tracing 而言 SimpleSpan 足夠。

**Elysia `context.route`：** 已透過 Elysia 1.4 原始碼型別定義確認，`context.route` 是 parametrized path template（例如 `/api/agents/:id`），而 `context.path` 是實際 URL（例如 `/api/agents/123`）。`onRequest` 的 `PreContext` 不含 `route` 屬性，因此必須從 `onBeforeHandle` 開始才能讀到 `route`，這正是 D-03 的設計。

**Primary recommendation:** 使用 `NodeTracerProvider` + `SimpleSpanProcessor` + `OTLPTraceExporter`（條件掛載）；測試用 `InMemorySpanExporter`；對齊 existing config 和 plugin patterns。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| TracerProvider 初始化 | Bootstrap (`src/bootstrap/otel-init.ts`) | — | OTel 需在任何 import 前初始化，屬 bootstrap 階段 |
| OTLP exporter 條件掛載 | Bootstrap | Config | 依 `OTEL_EXPORTER_OTLP_ENDPOINT` env var 決定 |
| HTTP span 建立與結束 | Presentation (Plugin) | — | Elysia lifecycle hook 層，跨所有 feature modules |
| Span attributes 賦值 | Presentation (Plugin) | — | route/method/status/latency 均從 Elysia context 取得 |
| Test exporter 注入 | Tests | Bootstrap | 測試透過 `AppDeps` 或 provider 替換注入 InMemorySpanExporter |
| Config schema 擴充 | Bootstrap (`config.ts`) | — | 與 REDIS_URL、RESEND_API_KEY 同一模式 |

---

## Standard Stack

### Core（需安裝，exact pinning）

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@opentelemetry/sdk-trace-node` | `2.7.0` | NodeTracerProvider（含 context-async-hooks） | 提供 Node/Bun 上的 TracerProvider，含 AsyncLocalStorage context manager；2.7.0 為 2026-04-17 最新 stable |
| `@opentelemetry/exporter-trace-otlp-http` | `0.215.0` | OTLP HTTP exporter（JSON 格式，port 4318） | 對接 Jaeger/Tempo/Collector，0.215.0 為 2026-04-17 最新 |
| `@opentelemetry/resources` | `2.7.0` | `resourceFromAttributes()`（2.x 新 API） | 描述 service.name 等資源屬性 |
| `@opentelemetry/semantic-conventions` | `1.40.0` | `ATTR_HTTP_ROUTE` 等標準屬性名稱 | 已在 node_modules 中（被 BetterAuth 等傳遞依賴）；可升級至此版本 |

> **注意：** `@opentelemetry/api@1.9.1` 和 `@opentelemetry/semantic-conventions@1.40.0` 已存在於 `node_modules`（被 BetterAuth/ioredis 等間接依賴）。`sdk-trace-node`、`exporter-trace-otlp-http`、`resources` 為新增套件。

### Supporting（InMemorySpanExporter，測試專用）

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@opentelemetry/sdk-trace-base` | `2.7.0` | `InMemorySpanExporter`、`SimpleSpanProcessor` | 整合測試斷言 span；是 `sdk-trace-node` 的傳遞依賴，已自動安裝 |

> `sdk-trace-base` 是 `sdk-trace-node` 的依賴，安裝 `sdk-trace-node` 後自動可用，**不需要明確列在 package.json**，但需在 import 時從正確套件名引入。

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `sdk-trace-node` (manual) | `@opentelemetry/sdk-node` | sdk-node 約 2-3MB+，auto-patches Node http/dns/net 模組，對 Rigging harness template 過重（D-01） |
| `exporter-trace-otlp-http` | `exporter-trace-otlp-grpc` | gRPC 需額外 native 依賴；HTTP/JSON 在 Bun 上更穩定 |
| `SimpleSpanProcessor` | `BatchSpanProcessor` | BatchSpan 在 Bun 上有已知 timeout issue（issue #5260）；Simple 足夠 Elysia-level tracing |
| `@elysiajs/opentelemetry` | 手動 plugin | 官方 plugin 用 sdk-node，bundle 較大；CONTEXT.md D-01 明確排除 |

**Version verification:**（透過 `npm view [package] version` 驗證 2026-04-21）
- `@opentelemetry/sdk-trace-node@2.7.0` — published 2026-04-17
- `@opentelemetry/exporter-trace-otlp-http@0.215.0` — published 2026-04-17
- `@opentelemetry/resources@2.7.0` — published 2026-04-17
- `@opentelemetry/semantic-conventions@1.40.0` — published 2026-02-26

**Installation:**

```bash
bun add @opentelemetry/sdk-trace-node@2.7.0 @opentelemetry/exporter-trace-otlp-http@0.215.0 @opentelemetry/resources@2.7.0 @opentelemetry/semantic-conventions@1.40.0
```

> `@opentelemetry/sdk-trace-base@2.7.0` 被 `sdk-trace-node` 傳遞安裝，不需明確加入 package.json。

---

## Architecture Patterns

### System Architecture Diagram

```
main.ts (entry)
    │
    ├── import otel-init.ts   ← 必須在任何其他 import 前執行
    │       │
    │       ├── NodeTracerProvider({ resource, spanProcessors: [...] })
    │       │       │
    │       │       ├── [if OTEL_EXPORTER_OTLP_ENDPOINT]
    │       │       │       └── SimpleSpanProcessor(OTLPTraceExporter({ url }))
    │       │       └── [else] 空 spanProcessors 陣列（no-op，spans 被 drop）
    │       │
    │       └── provider.register()  → trace.setGlobalTracerProvider(provider)
    │
    └── createApp(config)
            │
            Elysia root app
                │
                ├── requestLoggerPlugin  (ADR 0012 位置 1)
                ├── corsPlugin           (位置 2)
                ├── errorHandlerPlugin   (位置 3)
                ├── swaggerPlugin        (位置 4)
                ├── tracingPlugin        (位置 4.5 — 在 swagger 後、feature modules 前)
                │       │
                │       ├── onBeforeHandle { as: 'global' }
                │       │       └── span = tracer.startSpan(...)
                │       │           span.setAttribute(ATTR_HTTP_REQUEST_METHOD, method)
                │       │           span.setAttribute(ATTR_HTTP_ROUTE, context.route)
                │       │           startedAt = performance.now()
                │       │
                │       ├── onAfterHandle { as: 'global' }
                │       │       └── span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, status)
                │       │           span.setAttribute('http.request.duration', durationMs)
                │       │           span.setStatus({ code: OK })
                │       │           span.end()
                │       │
                │       └── onError { as: 'global' }
                │               └── span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, status)
                │                   span.setStatus({ code: ERROR, message })
                │                   span.end()
                │
                ├── createAuthModule(...)
                ├── createAgentsModule(...)
                └── createHealthModule(...)
```

### Recommended Project Structure

```
src/
├── bootstrap/
│   ├── otel-init.ts        # 新增：TracerProvider 初始化工廠
│   ├── config.ts           # 修改：加入 OTEL_EXPORTER_OTLP_ENDPOINT
│   └── app.ts              # 修改：加入 tracingPlugin() call
├── shared/
│   └── presentation/
│       └── plugins/
│           ├── tracing.plugin.ts   # 新增：HTTP span plugin
│           ├── request-logger.plugin.ts  (現有)
│           ├── cors.plugin.ts            (現有)
│           ├── error-handler.plugin.ts   (現有)
│           └── swagger.plugin.ts         (現有)
└── main.ts                 # 修改：頂部加 import './bootstrap/otel-init'
```

```
docs/decisions/
└── 0020-otel-sdk-manual-assembly.md   # 新增：ADR 0020
```

```
tests/
├── unit/shared/plugins/
│   └── tracing.plugin.test.ts   # 新增：unit test
└── integration/
    └── app-skeleton-smoke.test.ts   # 修改：加入 OTel span 斷言 cases
```

---

### Pattern 1: otel-init.ts — TracerProvider 初始化

**What:** 在 main.ts 頂部 import 的獨立初始化模組，條件掛載 OTLP exporter
**When to use:** 整個應用程式啟動時（production + development）

```typescript
// src/bootstrap/otel-init.ts
// Source: Context7 /open-telemetry/opentelemetry-js (verified 2026-04-21)
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'

export function initTracing(endpoint?: string): NodeTracerProvider {
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'rigging',
  })

  const spanProcessors = endpoint
    ? [new SimpleSpanProcessor(new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }))]
    : []

  const provider = new NodeTracerProvider({ resource, spanProcessors })
  provider.register()  // sets global TracerProvider via trace.setGlobalTracerProvider()
  return provider
}
```

> **SDK 2.x 關鍵變更：**
> - `new Resource({...})` → `resourceFromAttributes({...})` [VERIFIED: Context7]
> - `provider.addSpanProcessor(...)` → 已移除，改用 constructor `{ spanProcessors: [...] }` [VERIFIED: Context7 upgrade-to-2.x.md]
> - `BasicTracerProvider.register()` → 已移除，改用 `NodeTracerProvider.register()` 或 `trace.setGlobalTracerProvider()` [VERIFIED: Context7]

### Pattern 2: tracing.plugin.ts — Elysia Span Lifecycle

**What:** Elysia plugin，用 onBeforeHandle + onAfterHandle + onError 捕捉每個 request 的 span
**When to use:** `createApp` 中，位置在 swaggerPlugin 之後、feature modules 之前

```typescript
// src/shared/presentation/plugins/tracing.plugin.ts
// Source: Context7 /open-telemetry/opentelemetry-js + /elysiajs/documentation (verified 2026-04-21)
import { Elysia } from 'elysia'
import { trace, SpanStatusCode, SpanKind } from '@opentelemetry/api'
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_HTTP_ROUTE,
} from '@opentelemetry/semantic-conventions'

// Span store: keyed per-request, cleaned up on afterHandle/onError
// NOTE: Elysia context is request-scoped, so we store the span in a derived property
export function tracingPlugin() {
  const tracer = trace.getTracer('rigging/http')

  return new Elysia({ name: 'rigging/tracing' })
    .derive({ as: 'global' }, () => ({
      _span: null as ReturnType<typeof tracer.startSpan> | null,
      _spanStart: 0,
    }))
    .onBeforeHandle({ as: 'global' }, (ctx) => {
      const span = tracer.startSpan(`${ctx.request.method} ${ctx.route}`, {
        kind: SpanKind.SERVER,
        attributes: {
          [ATTR_HTTP_REQUEST_METHOD]: ctx.request.method,
          [ATTR_HTTP_ROUTE]: ctx.route,
        },
      })
      ctx._span = span
      ctx._spanStart = performance.now()
    })
    .onAfterHandle({ as: 'global' }, (ctx) => {
      const span = ctx._span
      if (!span) return
      const status =
        typeof ctx.set.status === 'number' ? ctx.set.status : Number(ctx.set.status ?? 200)
      const durationMs = Math.round(performance.now() - ctx._spanStart)
      span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, status)
      span.setAttribute('http.request.duration', durationMs)
      if (status >= 400) {
        span.setStatus({ code: SpanStatusCode.ERROR })
      } else {
        span.setStatus({ code: SpanStatusCode.OK })
      }
      span.end()
    })
    .onError({ as: 'global' }, (ctx) => {
      const span = ctx._span
      if (!span) return
      const status =
        typeof ctx.set.status === 'number' ? ctx.set.status : Number(ctx.set.status ?? 500)
      const durationMs = Math.round(performance.now() - ctx._spanStart)
      span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, status)
      span.setAttribute('http.request.duration', durationMs)
      span.setStatus({ code: SpanStatusCode.ERROR, message: ctx.error?.toString() })
      span.end()
    })
}
```

> **重要：** span 儲存在 derive 的 `_span` 屬性中。Elysia 的 context 是 request-scoped，因此不需要外部 Map；每個請求有自己的 context 物件。

### Pattern 3: InMemorySpanExporter（測試用）

**What:** 整合測試中注入 InMemorySpanExporter，在 test 結束後斷言 spans
**When to use:** 整合測試，需驗證 spans 確實被建立並具有正確屬性

```typescript
// tests/integration/tracing.test.ts（參考模式）
// Source: Context7 /open-telemetry/opentelemetry-js (verified 2026-04-21)
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { resourceFromAttributes } from '@opentelemetry/resources'

const exporter = new InMemorySpanExporter()
const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({ 'service.name': 'rigging-test' }),
  spanProcessors: [new SimpleSpanProcessor(exporter)],
})
provider.register()

// Reset between tests:
exporter.reset()  // 清空已記錄的 spans

// Assertions:
const spans = exporter.getFinishedSpans()
expect(spans).toHaveLength(1)
expect(spans[0]?.attributes['http.route']).toBe('/api/agents/:id')
expect(spans[0]?.attributes['http.response.status_code']).toBe(200)
```

### Pattern 4: Semantic Conventions — 舊 vs 新

**SDK 2.x + semantic-conventions 1.40 導入新 `ATTR_*` 前綴命名，舊 `SEMATTRS_*` 仍存在但 deprecated:**

| CONTEXT.md D-04 術語 | 新版 ATTR 常數 (1.40+) | 實際字串值 | 舊版 SEMATTRS（deprecated） |
|---------------------|----------------------|-----------|--------------------------|
| `http.route` | `ATTR_HTTP_ROUTE` | `'http.route'` | `SEMATTRS_HTTP_ROUTE` |
| `http.method` | `ATTR_HTTP_REQUEST_METHOD` | `'http.request.method'` | `SEMATTRS_HTTP_METHOD` (`'http.method'`) |
| `http.status_code` | `ATTR_HTTP_RESPONSE_STATUS_CODE` | `'http.response.status_code'` | `SEMATTRS_HTTP_STATUS_CODE` (`'http.status_code'`) |

> **Pitfall：** `CONTEXT.md D-04` 使用的 `http.method` 和 `http.status_code` 是**舊版屬性名稱**。新版 semconv 1.x 使用的是 `http.request.method` 和 `http.response.status_code`。使用新 `ATTR_*` 常數是正確做法；測試斷言時須用 `span.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]` 而非字串 `'http.status_code'`。

[VERIFIED: npm registry node -e 確認屬性字符串值，2026-04-21]

### Pattern 5: main.ts 修改（top-level early init）

```typescript
// src/main.ts
// OTel MUST be the first import — before Elysia, before createApp
import './bootstrap/otel-init'          // ← 加在最頂部

import { createApp } from './bootstrap/app'
import { loadConfig } from './bootstrap/config'

const config = loadConfig()
// otel-init 已在 import 時執行；不需要再呼叫
const app = createApp(config)
app.listen(config.PORT, ...)
```

> 或使用工廠函式模式：`import { initTracing } from './bootstrap/otel-init'; initTracing(config.OTEL_EXPORTER_OTLP_ENDPOINT)` — 但 import side-effect 方式更符合 OTel 慣例（在 createApp 拿到 config 之前已初始化）。若需要 config 資訊（endpoint URL），則需要先 loadConfig。

**推薦模式：**

```typescript
// src/main.ts
import { loadConfig } from './bootstrap/config'
import { initTracing } from './bootstrap/otel-init'

const config = loadConfig()
initTracing(config.OTEL_EXPORTER_OTLP_ENDPOINT)  // no-op if undefined

import { createApp } from './bootstrap/app'
const app = createApp(config)
```

> 注意：TypeScript `verbatimModuleSyntax: true` + Bun 的 ESM 處理在靜態 import 的情況下，頂部的 import 已在程式碼執行前完成。若 `initTracing` 需要 config 值，最安全的方式是先 `loadConfig()`，再呼叫 `initTracing(endpoint?)`，最後再 `createApp`（動態 import 非必要，Bun 支援 top-level await 但 main.ts 目前是同步的）。

### Anti-Patterns to Avoid

- **在 `onRequest` 中讀 `context.route`：** `PreContext`（onRequest）沒有 `route` 屬性，`route` 只在 `onBeforeHandle` 之後可用。[VERIFIED: Elysia context.d.ts 型別定義]
- **使用 `addSpanProcessor()` 方法：** SDK 2.x 已移除，改用 constructor `spanProcessors` 選項。[VERIFIED: Context7 upgrade-to-2.x.md]
- **使用 `new Resource({...})`：** SDK 2.x 改為 `resourceFromAttributes({...})`。[VERIFIED: Context7]
- **使用 `BatchSpanProcessor` 在 Bun 上：** 已知 HTTP timeout issue（issue #5260）；使用 `SimpleSpanProcessor` 迴避。[CITED: github.com/open-telemetry/opentelemetry-js/issues/5260]
- **在 spans 外使用 `SEMATTRS_*` 常數：** 仍可運作但 deprecated，新版用 `ATTR_*`。
- **在測試中忘記 `exporter.reset()`：** tests 之間未清除會導致 span 數量斷言失敗。[ASSUMED]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Span context propagation | 自製 AsyncLocalStorage map | `NodeTracerProvider.register()` — 自動設置 context manager | AsyncLocalStorage 正確傳遞、多重 async 邊界複雜 |
| OTLP 序列化與傳輸 | 自寫 HTTP POST to /v1/traces | `OTLPTraceExporter` | Protobuf/JSON 格式、retry、gzip、header 等邊緣案例 |
| Span ID / Trace ID 生成 | 自製 UUID | OTel SDK 內建 128-bit trace ID 生成 | W3C TraceContext 規範格式 |
| W3C traceparent header 傳播 | 手動解析 traceparent | `provider.register()` 預設帶入 `W3CTraceContextPropagator` | 規範細節多（版本、flags、state） |

**Key insight:** OTel SDK 2.x 的 `NodeTracerProvider.register()` 會自動設定 global context manager（AsyncLocalStorageContextManager）和 propagator（W3CTraceContextPropagator），完全不需手動設定。

---

## Common Pitfalls

### Pitfall 1: onRequest vs onBeforeHandle — route 屬性缺失

**What goes wrong:** 在 `onRequest` hook 中嘗試讀取 `ctx.route`，取得 `undefined`
**Why it happens:** Elysia 的 `onRequest` 使用 `PreContext`，此時路由尚未被解析，`route` 屬性不存在於 `PreContext` 型別
**How to avoid:** 從 `onBeforeHandle` 開始才能讀到 `ctx.route`（D-03 的正確設計）
**Warning signs:** TypeScript 型別錯誤，或 span attribute `http.route` 為 `undefined` / 空字串

[VERIFIED: Elysia dist/context.d.ts 型別定義，onRequest 返回 PreContext 不含 route]

### Pitfall 2: SDK 2.x API 使用舊 1.x 模式

**What goes wrong:** `provider.addSpanProcessor(...)` 拋出 TypeError（method 不存在）；或 `new Resource({...})` 有型別錯誤
**Why it happens:** SDK 2.0 為重大 breaking change，移除了 1.x 的 `addSpanProcessor` 和 class-based Resource
**How to avoid:**
- 用 `new NodeTracerProvider({ spanProcessors: [...] })` 構造函式選項
- 用 `resourceFromAttributes({...})` 取代 `new Resource({...})`
**Warning signs:** `tsc --noEmit` 報錯；runtime TypeError

[VERIFIED: Context7 /open-telemetry/opentelemetry-js upgrade-to-2.x.md]

### Pitfall 3: Bun 上 BatchSpanProcessor timeout 警告

**What goes wrong:** 每個請求後 stderr 出現 `"Request timed out"` 錯誤，但 spans 實際上有送達
**Why it happens:** Bun 的 HTTP lifecycle 與 Node.js 略有不同，BatchSpanProcessor 的 timer 處理有差異
**How to avoid:** 使用 `SimpleSpanProcessor` 取代 `BatchSpanProcessor`（SimpleSpan 立即送出，無 timer）
**Warning signs:** Console 有 timeout 警告，但 Jaeger 可看到 spans

[CITED: github.com/open-telemetry/opentelemetry-js/issues/5260]

### Pitfall 4: span 未在 onError 中 end

**What goes wrong:** 4xx/5xx 請求的 span 永不 end，在 exporter 緩衝區堆積，最後被 drop
**Why it happens:** Elysia 的 `onAfterHandle` 在 `onError` throw 的情況下**不執行**；必須分別在兩個 hook 中 `span.end()`
**How to avoid:** `onAfterHandle` 和 `onError` 各自有完整的 span.end() 邏輯
**Warning signs:** 正常請求有 span，error 請求無 span 或 span 沒有 error status

[ASSUMED: 基於 Elysia lifecycle hook 執行順序推斷；CONTEXT.md D-03 已正確指出此需求]

### Pitfall 5: 舊版 semantic-conventions 屬性名稱不一致

**What goes wrong:** 測試斷言 `span.attributes['http.status_code']` 找不到值（因為實際是 `'http.response.status_code'`）
**Why it happens:** D-04 中列出的術語（`http.status_code`）是舊版名稱，新版 semconv 1.x 已重命名
**How to avoid:** 始終用 `ATTR_*` 常數而非硬碼字串；測試也用常數斷言
**Warning signs:** 測試中 `span.attributes['http.status_code']` 為 undefined

[VERIFIED: npm registry node -e 執行確認屬性字串值]

### Pitfall 6: exactOptionalPropertyTypes 與 OTel config

**What goes wrong:** `new NodeTracerProvider({ spanProcessors: undefined })` TypeScript 錯誤
**Why it happens:** `tsconfig.json` 的 `exactOptionalPropertyTypes: true` — optional property 不能傳 `undefined`
**How to avoid:** 條件展開：`new NodeTracerProvider(endpoint ? { spanProcessors: [...] } : {})`
**Warning signs:** `tsc --noEmit` 報告 optional property 賦值錯誤

[VERIFIED: tsconfig.json exactOptionalPropertyTypes: true，現有代碼中 Redis/Auth 同樣問題有先例]

---

## Code Examples

### 完整 otel-init.ts 參考實作

```typescript
// src/bootstrap/otel-init.ts
// Sources: Context7 /open-telemetry/opentelemetry-js (verified 2026-04-21)
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'

export function initTracing(endpoint?: string): NodeTracerProvider {
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'rigging',
  })

  // exactOptionalPropertyTypes-safe: 不傳 undefined，用條件物件
  const provider = endpoint
    ? new NodeTracerProvider({
        resource,
        spanProcessors: [
          new SimpleSpanProcessor(
            new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
          ),
        ],
      })
    : new NodeTracerProvider({ resource })

  provider.register()
  return provider
}
```

### Config Schema 修改

```typescript
// src/bootstrap/config.ts（修改片段）
// 與 REDIS_URL 同一 Optional 模式
OTEL_EXPORTER_OTLP_ENDPOINT: Type.Optional(Type.String({ format: 'uri' })),
```

> `format: 'uri'` 在 `config.ts` 頂部已有 FormatRegistry.Set('uri', ...) 的 validator，可直接使用。

### createApp 整合

```typescript
// src/bootstrap/app.ts（修改片段）
import { tracingPlugin } from '../shared/presentation/plugins/tracing.plugin'

// 在 swaggerPlugin 後加入（ADR 0012 canonical ordering）
const app = new Elysia({ name: 'rigging/app' })
  .use(requestLoggerPlugin(logger))
  .use(corsPlugin())
  .use(errorHandlerPlugin(logger))
  .use(swaggerPlugin())
  .use(tracingPlugin())   // ← 新增，位置 4.5（horizontal before feature）
```

### InMemorySpanExporter 測試模式

```typescript
// tests/integration/app-otel-tracing.test.ts（新增檔案）
// Source: Context7 /open-telemetry/opentelemetry-js (verified 2026-04-21)
import { describe, beforeAll, afterEach, test, expect } from 'bun:test'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_HTTP_ROUTE, ATTR_HTTP_RESPONSE_STATUS_CODE } from '@opentelemetry/semantic-conventions'
import { createApp } from '../../src/bootstrap/app'

const exporter = new InMemorySpanExporter()
const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({ 'service.name': 'rigging-test' }),
  spanProcessors: [new SimpleSpanProcessor(exporter)],
})

beforeAll(() => { provider.register() })
afterEach(() => { exporter.reset() })

describe('OTel HTTP spans', () => {
  test('GET /health produces one span with correct route and status', async () => {
    const app = createApp(TEST_CONFIG, { db: fakeDb, probe: upProbe })
    await app.handle(new Request('http://localhost/health'))

    const spans = exporter.getFinishedSpans()
    expect(spans).toHaveLength(1)
    expect(spans[0]?.attributes[ATTR_HTTP_ROUTE]).toBe('/health')
    expect(spans[0]?.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toBe(200)
  })
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `new Resource({...})` | `resourceFromAttributes({...})` | SDK 2.0 (2025 Q4) | API 不相容，必須遷移 |
| `provider.addSpanProcessor(p)` | `new Provider({ spanProcessors: [p] })` | SDK 2.0 (2025 Q4) | 方法已移除 |
| `BasicTracerProvider.register()` | `NodeTracerProvider.register()` 或 `trace.setGlobalTracerProvider()` | SDK 2.0 (2025 Q4) | Basic 的 register() 已移除 |
| `SEMATTRS_HTTP_STATUS_CODE` | `ATTR_HTTP_RESPONSE_STATUS_CODE` | semconv 1.20+ | 字串值已更名（`http.status_code` → `http.response.status_code`） |
| `SEMATTRS_HTTP_METHOD` | `ATTR_HTTP_REQUEST_METHOD` | semconv 1.20+ | 字串值已更名（`http.method` → `http.request.method`） |
| `BatchSpanProcessor` | `SimpleSpanProcessor`（在 Bun 上） | Bun compat issue | timeout 警告；Simple 較穩定 |

**Deprecated/outdated:**
- `SEMATTRS_*` 常數：仍可用但 deprecated，新專案應用 `ATTR_*`
- `@opentelemetry/sdk-node`：不在本 phase 範圍；自動 auto-instrument，Rigging 不需要

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `onError` 中的 span 必須在 onAfterHandle 不執行時單獨 end | Common Pitfalls #4 | span 洩漏到 buffer；error requests 無正確 span |
| A2 | `provider.register()` 在無 OTLP exporter 時仍能正常運作（span 被 drop 而非錯誤） | otel-init.ts pattern | 啟動 log 可能有警告但不影響功能 |
| A3 | Elysia derive 的屬性（`_span`）在 afterHandle/onError 中是 request-scoped | tracing.plugin.ts pattern | 不同 requests 之間 span 交叉污染 |
| A4 | `app.handle(new Request(...))` 的測試模式（無真實伺服器）對 OTel span capture 有效 | 測試模式 | 測試找不到 spans；需改用真實 listen |

> **A3 說明：** Elysia `derive` 在每個 request 進入時建立新物件，但需要確認使用 `{ as: 'global' }` 時此行為一致。現有 `requestLoggerPlugin` 的 `startedAt` derive 已用同樣模式（Phase 2），可作為參考。

---

## Open Questions

1. **span 是否要在 `onAfterHandle` 還是 `onAfterResponse` 中結束？**
   - What we know：`onAfterHandle` 在 handler return 後執行；`onAfterResponse` 在 response 送出後執行
   - What's unclear：latency 應量到 response sent 還是 handler return？
   - Recommendation：用 `onAfterHandle`（與 requestLoggerPlugin 的 `startedAt` 量測點一致）；若要更精確的「到 response 送出」可改 `onAfterResponse`，但差距在網路層面

2. **`_span` derive 的 TypeScript 型別推斷**
   - What we know：`derive` 的返回值型別在 `{ as: 'global' }` 時需要明確的型別宣告
   - What's unclear：`Span | null` 型別在 onAfterHandle context 中是否能被正確推斷
   - Recommendation：`ctx._span as Span | null` 或用 `if (!ctx._span) return` guard

3. **`main.ts` import order 與 Bun ESM**
   - What we know：`verbatimModuleSyntax: true` 保留 import 順序；OTel 要求在其他 import 前初始化
   - What's unclear：Bun 是否保證 static import 的執行順序（vs top-level await）
   - Recommendation：使用 explicit 函式呼叫模式（loadConfig → initTracing → createApp）而非 side-effect import，更明確且可測試

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | Runtime | ✓ | 1.3.10 | — |
| `@opentelemetry/api` | 已在 node_modules（傳遞依賴） | ✓ | 1.9.1 | — |
| `@opentelemetry/semantic-conventions` | 已在 node_modules（傳遞依賴） | ✓ | 1.40.0 | — |
| `@opentelemetry/sdk-trace-node` | 主要 SDK | ✗ (待安裝) | — | — |
| `@opentelemetry/exporter-trace-otlp-http` | OTLP export | ✗ (待安裝) | — | — |
| `@opentelemetry/resources` | Resource 描述 | ✗ (待安裝) | — | — |
| Jaeger（本機驗證） | Success Criterion #3（manual verify） | ✗ (optional) | — | Grafana Tempo / Console exporter |

**Missing dependencies with no fallback:**
- `@opentelemetry/sdk-trace-node@2.7.0` — 核心 SDK，必須安裝
- `@opentelemetry/exporter-trace-otlp-http@0.215.0` — OTLP export，必須安裝
- `@opentelemetry/resources@2.7.0` — Resource API，必須安裝

**Missing dependencies with fallback:**
- Jaeger local instance — 僅用於 manual verification（PROD-03 success criterion #3）；未安裝不影響自動化測試

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | bun:test（內建） |
| Config file | bunfig.toml `[test]` section |
| Quick run command | `bun test tests/unit/shared/plugins/tracing.plugin.test.ts` |
| Full suite command | `bun test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROD-03 #1 | OTLP endpoint 設定時 export spans | integration | `bun test tests/integration/app-otel-tracing.test.ts` | ❌ Wave 0 |
| PROD-03 #2 | span 含 route/method/status/latency attributes | integration | `bun test tests/integration/app-otel-tracing.test.ts` | ❌ Wave 0 |
| PROD-03 #4 | 4xx/5xx 產生 error status span | integration | `bun test tests/integration/app-otel-tracing.test.ts` | ❌ Wave 0 |
| PROD-03 #5 | 現有測試繼續通過 | regression | `bun test` | ✅ 已有（不需額外建立）|
| PROD-03 #3 | Jaeger UI 可見 traces | manual | — | N/A（manual only）|

### Sampling Rate

- **Per task commit:** `bun run typecheck && bun test tests/unit/shared/plugins/tracing.plugin.test.ts`
- **Per wave merge:** `bun test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/integration/app-otel-tracing.test.ts` — covers PROD-03 #1, #2, #4（InMemorySpanExporter）
- [ ] `tests/unit/shared/plugins/tracing.plugin.test.ts` — unit test for plugin 行為（span 建立、error status）
- [ ] `docs/decisions/0020-otel-sdk-manual-assembly.md` — ADR（D-07 要求）

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | span attributes 不含 request body；只記錄 route/method/status/duration |
| V6 Cryptography | no | — |

### Known Threat Patterns for OTel Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Span attribute 注入（惡意 `http.route` 值） | Tampering | Elysia `context.route` 是 framework-controlled（registered route template），非用戶輸入 |
| OTLP endpoint 洩漏內部 URL | Information Disclosure | `OTEL_EXPORTER_OTLP_ENDPOINT` 應視為 infra 設定，不寫入 logs；僅用於 exporter 初始化 |
| Sensitive data in spans | Information Disclosure | D-04 的最小屬性集不含 request body、headers、auth tokens — 符合 ASVS V5 |

---

## Sources

### Primary (HIGH confidence)
- `/open-telemetry/opentelemetry-js` (Context7) — TracerProvider 初始化、SDK 2.x API、InMemorySpanExporter、semantic conventions
- `npm view @opentelemetry/[package] version` — 所有套件版本號（2026-04-21 驗證）
- `/elysiajs/documentation` (Context7) — lifecycle hooks、context.route 行為
- `node_modules/elysia/dist/context.d.ts` — `context.route: string` 型別定義（parametrized path）
- `github.com/open-telemetry/opentelemetry-js/blob/main/doc/upgrade-to-2.x.md` (Context7 + WebFetch) — SDK 2.x breaking changes

### Secondary (MEDIUM confidence)
- `github.com/open-telemetry/opentelemetry-js/issues/5260` (WebFetch) — Bun timeout issue with OTLP HTTP exporter
- `elysiajs.com/patterns/opentelemetry` (WebFetch) — 官方 OTel plugin 概述（本 phase 不採用但了解其做法）
- `oneuptime.com/blog/post/2026-02-06-opentelemetry-bun-without-nodejs-require-flag/view` (WebFetch) — Bun OTel 初始化模式

### Tertiary (LOW confidence)
- WebSearch: "OpenTelemetry BatchSpanProcessor Bun timeout" — 確認 issue 普遍性

---

## Project Constraints (from CLAUDE.md)

- **Immutability:** span attributes 設定後不可 mutate context；建立新 span，不修改傳入物件
- **File Organization:** `tracing.plugin.ts` < 200 lines；`otel-init.ts` < 50 lines
- **No console.log:** 所有 diagnostic logging 用 pino（但 main.ts 的啟動 log 現有 console.log 慣例）
- **Input Validation:** span attributes 只用 framework-controlled 值（`ctx.route`、`ctx.request.method`），不用 user-controlled query params 或 body
- **Exact pinning:** 所有 OTel 套件 exact pin（無 caret），與 ioredis/resend 一致（D-01）
- **exactOptionalPropertyTypes:** NodeTracerProvider config 物件要用條件展開，不傳 undefined

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 版本透過 npm registry 驗證，2026-04-17/21 發布日期確認
- Architecture: HIGH — Elysia context.d.ts 確認 context.route；SDK 2.x API 透過 Context7 驗證
- Pitfalls: MEDIUM-HIGH — 大部分透過 context.d.ts 和 upgrade guide 確認；Bun timeout 為 LOW confidence（舊版 issue，不確定 2.7.0 是否修復）

**Research date:** 2026-04-21
**Valid until:** 2026-05-21（OTel 版本快速迭代，30 天後應重新確認版本號）
