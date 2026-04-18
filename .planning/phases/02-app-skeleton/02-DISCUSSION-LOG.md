# Phase 2: App Skeleton - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 02-app-skeleton
**Mode:** auto-resolved（使用者輸入 `開始實作` → 以 recommended defaults 解析所有 gray areas）
**Areas discussed:** /health 的 DDD 分層落點, 全域 plugin 組裝位置 + 順序, Request logger 設計, Error response shape + Swagger/CORS policy

---

## /health 的 DDD 分層落點

| Option | Description | Selected |
|--------|-------------|----------|
| presentation-only route | /health 直接掛 bootstrap/app.ts，不走四層（最快實作、最小行數）| |
| src/health/ feature 走完四層 | HealthStatus VO + CheckHealthUseCase + DrizzleDbHealthProbe + healthController + health.module.ts | ✓ |
| 半四層（只 presentation + infra） | 省略 domain / application | |

**User's choice:** src/health/ feature 走完四層（recommended default）
**Notes:** ROADMAP Phase 2 success criteria 明寫「DDD 四層模板被一個 trivial feature 真實驗證過」；presentation-only 無法作為 P3+ feature 的模板。

### DB healthcheck 實作策略（子題）

| Option | Description | Selected |
|--------|-------------|----------|
| Drizzle db.execute(sql`SELECT 1`) | 經 shared infra client，與後續 repos 同條 path | ✓ |
| 直接 postgres-js client ping | 繞過 Drizzle，最 lightweight | |
| 不做 DB check（純 liveness） | /health 只回 process 存活 | |

**User's choice:** Drizzle db.execute（recommended default）

### DB down → 503 的流動路徑（子題）

| Option | Description | Selected |
|--------|-------------|----------|
| controller 自己 try/catch → status(503) | 503 在 controller 層處理，不走 DomainError | ✓ |
| 定義 ServiceUnavailableError DomainError | 走全域 error handler | |

**User's choice:** controller try/catch（recommended default）
**Notes:** DomainError 是 business rule 違反（4xx）；503 是 infra availability，屬 route 層關注。

---

## 全域 plugin 組裝位置 + 順序

| Option | Description | Selected |
|--------|-------------|----------|
| src/shared/presentation/plugins/ + 各自檔案 | 每個 plugin 獨立 .plugin.ts | ✓ |
| src/bootstrap/ 集中定義 | 不分檔，全寫 bootstrap/app.ts | |

**User's choice:** src/shared/presentation/plugins/（recommended default）

### Plugin .use() 順序（子題）

| Option | Description | Selected |
|--------|-------------|----------|
| logger → cors → errorHandler → swagger → features | requestId 先 derive，onError global 攔所有下游 | ✓ |
| errorHandler → logger → cors → swagger → features | errorHandler 最先掛 | |

**User's choice:** logger → cors → errorHandler → swagger → features（recommended default）
**Notes:** requestLogger 先 derive `requestId` 才能被下游 plugin 引用；Elysia 1.4 的 onError `scope: 'global'` 不依賴物理順序就能攔所有下游，但視覺順序維持「橫切先於業務」可讀性。

### ADR 0012 記錄 ordering（子題）

| Option | Description | Selected |
|--------|-------------|----------|
| 寫 ADR 0012-global-plugin-ordering.md | 下游改 plugin 順序前先讀 ADR | ✓ |
| 不留 ADR，註解 bootstrap/app.ts 即可 | 省 ADR churn | |

**User's choice:** 寫 ADR 0012（recommended default）

---

## Request logger 設計

### requestId 策略

| Option | Description | Selected |
|--------|-------------|----------|
| X-Request-Id 優先 + crypto.randomUUID() fallback | 尊重上游 trace id，缺則自產 | ✓ |
| 永遠自產 crypto.randomUUID() | 不信上游 | |
| nanoid 自產 | 短 id | |

**User's choice:** X-Request-Id 優先 + randomUUID fallback（recommended default）

### log 欄位

| Option | Description | Selected |
|--------|-------------|----------|
| method/path/status/durationMs/requestId/userAgent/remoteAddress | 實務標準組 | ✓ |
| 前者 + request body | body 要 log 需 debug | |
| 最小化：method/path/status | 不做 observability | |

**User's choice:** 標準組（不含 body）（recommended default）
**Notes:** body log 交給 controller-level explicit log，避免敏資訊洩漏到全域 log。

### dev vs prod 切換

| Option | Description | Selected |
|--------|-------------|----------|
| NODE_ENV === 'development' 用 pino-pretty，其他 raw JSON | 標準 | ✓ |
| 用 LOG_LEVEL 切 format | 混用兩個 concern | |

**User's choice:** NODE_ENV 切換（recommended default）

### redact 清單

| Option | Description | Selected |
|--------|-------------|----------|
| cookie + authorization + x-api-key + set-cookie | 防 session/key 明文洩漏 | ✓ |
| 只 redact authorization | 最小化 | |

**User's choice:** 完整 redact 清單（recommended default）
**Notes:** 與 CVE-2025-61928 防禦一脈相承；log 是常見的 secret 洩漏途徑。

---

## Error response shape + Swagger/CORS policy

### error body shape

| Option | Description | Selected |
|--------|-------------|----------|
| { error: { code, message, requestId } } | 外包一層保留擴展空間（details / validation[]）| ✓ |
| 扁平 { code, message, requestId } | 少一層 | |
| RFC 7807 Problem Details | 標準但 verbose | |

**User's choice:** 包一層 { error: {...} }（recommended default）

### 5xx vs 4xx log 策略

| Option | Description | Selected |
|--------|-------------|----------|
| 5xx log.error + stack; 4xx log.warn 精簡 | 對稱分明 | ✓ |
| 全 log.error 含 stack | 噪音大 | |

**User's choice:** 5xx 完整 / 4xx 精簡（recommended default）

### Swagger path + gate

| Option | Description | Selected |
|--------|-------------|----------|
| /swagger 永遠開 | 預設 path，harness DX 重要 | ✓ |
| /swagger gate by NODE_ENV !== 'production' | prod 隱藏 | |
| /docs 永遠開 | 慣例差異 | |

**User's choice:** /swagger 永遠開（recommended default）
**Notes:** Swagger spec 非 secret；prod 隱藏屬 v2 production hardening 範疇。

### Swagger security schemes 預埋

| Option | Description | Selected |
|--------|-------------|----------|
| 預寫 cookieAuth + apiKeyAuth，P2 route 不套 security | P3 加 protected route 時直接標記 | ✓ |
| 不預寫，P3 時再加 | 省 P2 前置 | |

**User's choice:** 預寫（recommended default）

### CORS policy

| Option | Description | Selected |
|--------|-------------|----------|
| echo request origin + credentials=true + 明列 headers | P3 cookie auth 必備 | ✓ |
| origin '*' + credentials=false | 最寬鬆 | |
| 環境變數 allowlist | 太早做 config surface | |

**User's choice:** echo + credentials + 明列 headers（recommended default）
**Notes:** credentials=true + echo origin 是 cookie auth 最低需求（prod allowlist 屬 v2）。

---

## the agent's Discretion

executor 可自行決定（不需使用者 input）：
- pino transport options 細節（colorize / translateTime）
- Swagger info 段落（title / version / description）從 package.json 讀
- CORS maxAge（預flight cache 秒數）
- `checkedAt` 格式（ISO string）
- Request logger 是否記 query string（記進 path 欄位）
- postgres-js connection pool 參數（用預設）
- `src/shared/application/ports/` 是否 P2 即建 ILogger / IClock（可延至 P3）
- `src/_template/` 是否保留（建議保留）

## Deferred Ideas

以下想法在 P2 討論中浮現，但明確推遲：
- Production CORS allowlist → v2 production hardening
- Rate limiting → v2 PROD-02
- `/ready` vs `/health` split → K8s deploy 時
- OpenTelemetry → v2 PROD-03
- Request body logging → 不做
- Swagger basic auth → v2
- pino log shipping → v2 PROD-03
- `_template/` 長期命運 → P4 dogfood 後評估
- Graceful shutdown → P5 polish
