# Phase 13: OpenTelemetry Tracing - Pattern Map

**Mapped:** 2026-04-21
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/bootstrap/otel-init.ts` | bootstrap / factory | request-response (init-time) | `src/shared/infrastructure/redis/client.ts` | role-match (infra factory) |
| `src/bootstrap/config.ts` | config | — | `src/bootstrap/config.ts` (自身，加欄位) | exact (modify existing) |
| `src/shared/presentation/plugins/tracing.plugin.ts` | middleware / plugin | request-response | `src/shared/presentation/plugins/request-logger.plugin.ts` | exact |
| `src/bootstrap/app.ts` | config / wiring | — | `src/bootstrap/app.ts` (自身，加 use()) | exact (modify existing) |
| `src/main.ts` | entrypoint | — | `src/main.ts` (自身，加 initTracing 呼叫) | exact (modify existing) |
| `tests/unit/shared/plugins/tracing.plugin.test.ts` | test (unit) | request-response | `tests/unit/shared/plugins/request-logger.plugin.test.ts` | exact |
| `tests/integration/app-otel-tracing.test.ts` | test (integration) | request-response | `tests/integration/app-skeleton-smoke.test.ts` | exact |
| `docs/decisions/0020-otel-sdk-manual-assembly.md` | ADR document | — | `docs/decisions/0015-rate-limit-memory-v1-persistent-v2.md` | exact (MADR format) |

---

## Pattern Assignments

### `src/bootstrap/otel-init.ts` (bootstrap factory, init-time)

**Analog:** `src/shared/infrastructure/redis/client.ts`

**Imports pattern** (redis/client.ts lines 1-2):
```typescript
import { Redis } from 'ioredis'
import type { Logger } from 'pino'
```
→ 仿此格式，但引入 OTel SDK 套件（不需要 pino，直接 export factory fn）

**Core infrastructure factory pattern** (redis/client.ts lines 12-24):
```typescript
export function createRedisClient(url: string, logger: Logger): Redis {
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(2 ** (times - 1) * 100, 2000)
      return delay
    },
  })
  // ...event listeners...
  return client
}
```
→ `otel-init.ts` 仿此 factory 函式 signature pattern：接受 optional 參數、回傳 provider 實例

**exactOptionalPropertyTypes 條件物件 pattern** (app.ts lines 63-66):
```typescript
const authDeps: AuthModuleDeps = {
  db,
  logger,
  config,
  ...(redis && { redis }),
  ...(deps.authInstance && { authInstance: deps.authInstance }),
}
```
→ `otel-init.ts` 中的 `NodeTracerProvider` config 必須條件建構，不傳 undefined：
```typescript
const provider = endpoint
  ? new NodeTracerProvider({
      resource,
      spanProcessors: [new SimpleSpanProcessor(new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }))],
    })
  : new NodeTracerProvider({ resource })
```

**Complete otel-init.ts target implementation:**
```typescript
// src/bootstrap/otel-init.ts
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'

export function initTracing(endpoint?: string): NodeTracerProvider {
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'rigging',
  })

  // exactOptionalPropertyTypes-safe: 條件建構，不傳 undefined
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

---

### `src/bootstrap/config.ts` (config, modify existing)

**Analog:** `src/bootstrap/config.ts` 自身（REDIS_URL 與 RESEND_API_KEY 為 Optional 模式）

**Optional env var pattern** (config.ts lines 33-35):
```typescript
REDIS_URL: Type.Optional(Type.String({ pattern: '^(redis|rediss)://.+' })),
RESEND_API_KEY: Type.Optional(Type.String()),
RESEND_FROM_ADDRESS: Type.Optional(Type.String({ format: 'email' })),
```
→ 新增一行，仿 REDIS_URL（有 format 驗證）：
```typescript
OTEL_EXPORTER_OTLP_ENDPOINT: Type.Optional(Type.String({ format: 'uri' })),
```

**Note:** `format: 'uri'` 已有 FormatRegistry.Set('uri', ...) 在 config.ts 頂部（lines 4-10），可直接使用。

---

### `src/shared/presentation/plugins/tracing.plugin.ts` (middleware/plugin, request-response)

**Analog:** `src/shared/presentation/plugins/request-logger.plugin.ts`

**Imports pattern** (request-logger.plugin.ts lines 1-3):
```typescript
import { Elysia } from 'elysia'
import pino, { type Logger } from 'pino'
import type { Config } from '../../../bootstrap/config'
```
→ tracing.plugin.ts 的 imports：
```typescript
import { Elysia } from 'elysia'
import { trace, SpanStatusCode, SpanKind } from '@opentelemetry/api'
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_HTTP_ROUTE,
} from '@opentelemetry/semantic-conventions'
```

**Plugin factory with name pattern** (request-logger.plugin.ts lines 56-58):
```typescript
export function requestLoggerPlugin(logger: Logger) {
  return (
    new Elysia({ name: 'rigging/request-logger' })
```
→ 仿此，`tracing.plugin.ts`：
```typescript
export function tracingPlugin() {
  const tracer = trace.getTracer('rigging/http')
  return new Elysia({ name: 'rigging/tracing' })
```

**derive + as: 'global' pattern** (request-logger.plugin.ts lines 61-67):
```typescript
.derive({ as: 'global' }, ({ request, set }) => {
  const incoming = request.headers.get('x-request-id')
  const requestId =
    incoming && UUID_RE.test(incoming) ? incoming : (incoming ?? crypto.randomUUID())
  set.headers['x-request-id'] = requestId
  return { requestId, startedAt: performance.now() }
})
```
→ tracing.plugin.ts 的 derive，儲存 span 和 start time：
```typescript
.derive({ as: 'global' }, () => ({
  _span: null as ReturnType<typeof tracer.startSpan> | null,
  _spanStart: 0,
}))
```

**onAfterResponse / lifecycle hook as: 'global' pattern** (request-logger.plugin.ts lines 68-88):
```typescript
.onAfterResponse({ as: 'global' }, (ctx) => {
  const url = new URL(ctx.request.url)
  const durationMs = Math.round(performance.now() - (ctx.startedAt as number))
  const status =
    typeof ctx.set.status === 'number' ? ctx.set.status : Number(ctx.set.status ?? 200)
  logger.info({ requestId: ctx.requestId, method: ctx.request.method, ... }, 'request')
})
```
→ tracing.plugin.ts 的 `onBeforeHandle` + `onAfterHandle` + `onError`，複用 `performance.now()` latency 計算和 `status` 型別轉換模式

**Status type coercion pattern** (request-logger.plugin.ts line 72):
```typescript
const status =
  typeof ctx.set.status === 'number' ? ctx.set.status : Number(ctx.set.status ?? 200)
```
→ tracing.plugin.ts 的 onAfterHandle 和 onError 完全複用此模式

**onError cross-plugin derive 讀取 pattern** (error-handler.plugin.ts lines 21-23):
```typescript
const rid = (ctx as { requestId?: unknown }).requestId
const requestId = typeof rid === 'string' ? rid : 'unknown'
```
→ tracing.plugin.ts 的 onError 讀取 `ctx._span` 時採用防禦性 null check（`if (!span) return`）

---

### `src/bootstrap/app.ts` (wiring, modify existing)

**Analog:** `src/bootstrap/app.ts` 自身（Redis 條件注入模式）

**Plugin use() chain pattern** (app.ts lines 68-84):
```typescript
const app = new Elysia({ name: 'rigging/app' })
  .use(requestLoggerPlugin(logger))
  .use(corsPlugin())
  .use(errorHandlerPlugin(logger))
  .use(swaggerPlugin())

if (config.NODE_ENV !== 'test') {
  if (redis) {
    app.use(rateLimit({ context: new RedisRateLimitContext(redis) }))
  } else {
    app.use(rateLimit({}))
  }
}
```
→ tracingPlugin 不需條件判斷（無 endpoint 時 provider 仍運作，no-op），直接鏈式加在 swaggerPlugin 後：
```typescript
.use(swaggerPlugin())
.use(tracingPlugin())   // ADR 0012 位置 4.5：horizontal before feature modules
```

**Import pattern** (app.ts lines 14-17):
```typescript
import { corsPlugin } from '../shared/presentation/plugins/cors.plugin'
import { errorHandlerPlugin } from '../shared/presentation/plugins/error-handler.plugin'
import {
  createPinoLogger,
  requestLoggerPlugin,
} from '../shared/presentation/plugins/request-logger.plugin'
import { swaggerPlugin } from '../shared/presentation/plugins/swagger.plugin'
```
→ 新增一行：
```typescript
import { tracingPlugin } from '../shared/presentation/plugins/tracing.plugin'
```

---

### `src/main.ts` (entrypoint, modify existing)

**Analog:** `src/main.ts` 自身

**Current pattern** (main.ts lines 1-13):
```typescript
import { createApp } from './bootstrap/app'
import { loadConfig } from './bootstrap/config'

const config = loadConfig()
const app = createApp(config)

app.listen(config.PORT, ({ hostname, port }) => {
  console.log(`[rigging] listening on http://${hostname}:${port}`)
  ...
})
```
→ 修改為顯式函式呼叫（loadConfig → initTracing → createApp），因為 initTracing 需要 config 值：
```typescript
import { loadConfig } from './bootstrap/config'
import { initTracing } from './bootstrap/otel-init'
import { createApp } from './bootstrap/app'

const config = loadConfig()
initTracing(config.OTEL_EXPORTER_OTLP_ENDPOINT)  // no-op if undefined

const app = createApp(config)
app.listen(config.PORT, ({ hostname, port }) => {
  console.log(`[rigging] listening on http://${hostname}:${port}`)
  ...
})
```

---

### `tests/unit/shared/plugins/tracing.plugin.test.ts` (unit test)

**Analog:** `tests/unit/shared/plugins/request-logger.plugin.test.ts`

**Test file structure** (request-logger.plugin.test.ts lines 1-10):
```typescript
import { describe, expect, test } from 'bun:test'
import { Elysia } from 'elysia'
import pino from 'pino'
import {
  createPinoLogger,
  requestLoggerPlugin,
} from '../../../../src/shared/presentation/plugins/request-logger.plugin'
```
→ tracing.plugin.test.ts 的 import 路徑結構：
```typescript
import { describe, expect, test, beforeAll } from 'bun:test'
import { Elysia } from 'elysia'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_HTTP_ROUTE, ATTR_HTTP_RESPONSE_STATUS_CODE } from '@opentelemetry/semantic-conventions'
import { tracingPlugin } from '../../../../src/shared/presentation/plugins/tracing.plugin'
```

**In-process request test pattern** (request-logger.plugin.test.ts lines 38-51):
```typescript
test('generates uuid v4 requestId when no header present and echoes via x-request-id', async () => {
  const logger = createPinoLogger({ NODE_ENV: 'test', LOG_LEVEL: 'error' })
  const app = new Elysia()
    .use(requestLoggerPlugin(logger))
    .get('/ping', ({ requestId }) => ({ requestId }))

  const res = await app.handle(new Request('http://localhost/ping'))
  expect(res.headers.get('x-request-id')).not.toBeNull()
})
```
→ tracing.plugin.test.ts 仿此 `app.handle(new Request(...))` 模式，加上 span 斷言

**Span 斷言 pattern（來自 RESEARCH.md）：**
```typescript
const spans = exporter.getFinishedSpans()
expect(spans).toHaveLength(1)
expect(spans[0]?.attributes[ATTR_HTTP_ROUTE]).toBe('/ping')
expect(spans[0]?.attributes[ATTR_HTTP_RESPONSE_STATUS_CODE]).toBe(200)
```

**注意：** 測試間必須 `exporter.reset()` — 仿 client.test.ts 的 `onMock.mockClear()` 清理模式

---

### `tests/integration/app-otel-tracing.test.ts` (integration test)

**Analog:** `tests/integration/app-skeleton-smoke.test.ts`

**TEST_CONFIG pattern** (app-skeleton-smoke.test.ts lines 10-17):
```typescript
const TEST_CONFIG: Config = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3000',
  PORT: 3000,
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
}
```
→ app-otel-tracing.test.ts 的 TEST_CONFIG 完全複用，不需加 OTEL_EXPORTER_OTLP_ENDPOINT（測試用 InMemorySpanExporter，不走 OTLP）

**fakeDb + stubProbe pattern** (app-skeleton-smoke.test.ts lines 21-26):
```typescript
const fakeDb = {} as never

function stubProbe(impl: () => Promise<'up' | 'down'>): IDbHealthProbe {
  return { probe: impl }
}
```
→ 完全複用這兩個 helpers

**createApp with AppDeps pattern** (app-skeleton-smoke.test.ts lines 29-33):
```typescript
const app = createApp(TEST_CONFIG, {
  db: fakeDb,
  authInstance: createFakeAuthInstance(),
  probe: stubProbe(() => Promise.resolve('up')),
})
const res = await app.handle(new Request('http://localhost/health'))
```
→ app-otel-tracing.test.ts 使用相同 createApp 呼叫 pattern，beforeAll 設 InMemorySpanExporter

**Integration test 完整 pattern：**
```typescript
import { describe, beforeAll, afterEach, test, expect } from 'bun:test'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_HTTP_ROUTE, ATTR_HTTP_RESPONSE_STATUS_CODE } from '@opentelemetry/semantic-conventions'
import { createApp } from '../../src/bootstrap/app'
import { createFakeAuthInstance } from './auth/_helpers'

const exporter = new InMemorySpanExporter()
const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({ 'service.name': 'rigging-test' }),
  spanProcessors: [new SimpleSpanProcessor(exporter)],
})

beforeAll(() => { provider.register() })
afterEach(() => { exporter.reset() })
```

---

### `docs/decisions/0020-otel-sdk-manual-assembly.md` (ADR document)

**Analog:** `docs/decisions/0015-rate-limit-memory-v1-persistent-v2.md`

**MADR 4.0 frontmatter pattern** (0015.md lines 1-7):
```markdown
---
status: accepted
date: 2026-04-19
deciders: the-team
consulted: .planning/phases/03-auth-foundation/03-CONTEXT.md D-16, .planning/research/PITFALLS.md
informed: future AI Agents and future maintainers
---
```
→ 0020 完全仿此 frontmatter（ADR 0019 驗證要求 `status`、`date`、`deciders`、`consulted`、`informed` 五個必填鍵）

**ADR 標題 + 編號格式** (0015.md line 9):
```markdown
# 0015. Rate limit: memory store v1 / persistent store v2
```
→ `# 0020. OpenTelemetry SDK: manual assembly over sdk-node all-in-one`

**Considered Options → Decision Outcome → Consequences 結構** (0015.md lines 31-57):
```markdown
## Considered Options
- **Option A — Memory store v1 ...** (粗體標示選擇的 option)
- Option B — ...
- Option C — ...

## Decision Outcome
Chosen option: **A — ...**

### Consequences
Good / Bad / Note 條列
```
→ 0020 核心論點：「Rigging 是 template，sdk-node auto-patches Node http/dns/net，bundle ~2-3MB+；手動組裝只需 Elysia-level spans，bundle 小，對 downstream 用戶影響低」

**References section** (0015.md lines 72-77):
```markdown
## References
- `.planning/phases/03-auth-foundation/03-CONTEXT.md` D-16
- BetterAuth documentation URL
```
→ 0020 references 指向 CONTEXT.md D-01~D-07 和 RESEARCH.md

---

## Shared Patterns

### `as: 'global'` Plugin Scope
**Source:** `src/shared/presentation/plugins/request-logger.plugin.ts` lines 61, 68
**Apply to:** `tracing.plugin.ts` 的所有 hooks（`.derive`、`.onBeforeHandle`、`.onAfterHandle`、`.onError`）
```typescript
.derive({ as: 'global' }, ...)
.onBeforeHandle({ as: 'global' }, ...)
.onAfterHandle({ as: 'global' }, ...)
.onError({ as: 'global' }, ...)
```
缺少 `{ as: 'global' }` 時，hooks 僅作用於 plugin 自身，跨越 feature modules 的 request 不會被捕捉。

### Status Code 型別轉換
**Source:** `src/shared/presentation/plugins/request-logger.plugin.ts` line 72
**Apply to:** `tracing.plugin.ts` 的 `onAfterHandle` 和 `onError`
```typescript
const status =
  typeof ctx.set.status === 'number' ? ctx.set.status : Number(ctx.set.status ?? 200)
```

### exactOptionalPropertyTypes 條件展開
**Source:** `src/bootstrap/app.ts` lines 63-66
**Apply to:** `otel-init.ts` 的 NodeTracerProvider 建構
```typescript
// 條件建構兩個不同的物件，而非傳入 undefined 值
const provider = endpoint
  ? new NodeTracerProvider({ resource, spanProcessors: [...] })
  : new NodeTracerProvider({ resource })
```

### Infrastructure Factory Pattern
**Source:** `src/shared/infrastructure/redis/client.ts` lines 12-42
**Apply to:** `src/bootstrap/otel-init.ts`
- 導出具名工廠函式（非 class）
- 接受 optional 參數
- 回傳 provider 實例供呼叫端保存（若需要 shutdown）

### 在 `app.handle(new Request(...))` 中測試
**Source:** `tests/integration/app-skeleton-smoke.test.ts` lines 29-44
**Apply to:** `tests/unit/shared/plugins/tracing.plugin.test.ts`、`tests/integration/app-otel-tracing.test.ts`
- 不 listen 真實 port；直接呼叫 `app.handle(new Request(...))`
- 對 OTel span capture 有效（RESEARCH.md A4 assumption）

### OTel Semantic Conventions — 用 ATTR_* 常數，不用字串
**Source:** RESEARCH.md Pattern 4（Pitfall #5）
**Apply to:** `tracing.plugin.ts` 的 span.setAttribute 呼叫、所有測試斷言
```typescript
// 正確
span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, status)
// 錯誤（deprecated 舊版名稱）
span.setAttribute('http.status_code', status)  // 字串值已更名為 'http.response.status_code'
```

### Elysia Plugin 命名 convention
**Source:** `src/shared/presentation/plugins/request-logger.plugin.ts` line 58
**Apply to:** `tracing.plugin.ts`
```typescript
new Elysia({ name: 'rigging/tracing' })  // 格式：rigging/<feature>
```

---

## No Analog Found

所有文件均找到對應 analog。無需依賴 RESEARCH.md 中的外部 code examples。

---

## Metadata

**Analog search scope:** `src/bootstrap/`、`src/shared/presentation/plugins/`、`src/shared/infrastructure/redis/`、`tests/unit/`、`tests/integration/`、`docs/decisions/`
**Files scanned:** 10 source files + 5 test files + 2 ADR files
**Pattern extraction date:** 2026-04-21
