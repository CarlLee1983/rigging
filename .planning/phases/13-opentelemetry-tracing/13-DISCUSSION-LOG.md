# Phase 13: OpenTelemetry Tracing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 13-opentelemetry-tracing
**Areas discussed:** OTel SDK 組合策略, Span 初始化位置, Route 識別策略, 測試策略

---

## OTel SDK 組合策略

| Option | Description | Selected |
|--------|-------------|----------|
| 手動組裝 + OTLP HTTP | 只裝必要的 sdk-trace-node + exporter-trace-otlp-http + resources。精準控制、bundle 小，harness template 的依賴對用戶最透明 | ✓ |
| @opentelemetry/sdk-node all-in-one | 一個套件自動 instrument http/dns/net 等，設定簡單但 bundle 約 2-3MB+，會 auto-patch Node.js 內建模組，template 用戶可能不需要這些 | |

**User's choice:** 手動組裝 + OTLP HTTP

---

## SDK 版本策略

| Option | Description | Selected |
|--------|-------------|----------|
| Exact pin | 與 ioredis、resend 一致的 exact pinning 策略，避免 patch 版本帶入 breaking change | ✓ |
| Caret range (^x.y.z) | 接受 minor/patch 自動升級，OTel 生態版本迭代快，可能省心但破壞 harness 穩定性契約 | |

**User's choice:** Exact pin

---

## SDK 套件清單

| Option | Description | Selected |
|--------|-------------|----------|
| trace-node + otlp-http + resources | @opentelemetry/sdk-trace-node + @opentelemetry/exporter-trace-otlp-http + @opentelemetry/resources + @opentelemetry/semantic-conventions。涵蓋 span 建立、OTLP export、service.name resource 屬性，不引入其他自動插樁 | ✓ |
| 加上 @opentelemetry/api | 加入同圖書館來的 peer dep @opentelemetry/api，方便未來讓用戶自行建立 custom span | |

**User's choice:** trace-node + otlp-http + resources（最小集合）

---

## Span 初始化位置

| Option | Description | Selected |
|--------|-------------|----------|
| main.ts 頂部 | main.ts 第一行 import 一個 otel-init.ts，在 createApp 前就啟動 TracerProvider。符合 OTel 規範、可確保 Span 被正確建立。對 Harness 模板來說這是可學習的擴展 | ✓ |
| createApp 內的 Elysia plugin | OTel 紥入 createApp，保持所有 infra 級結都在同一地方的一致性。但因為 Bun 是手動插樁而非 auto-instrument，實際上也沒關係 | |

**User's choice:** main.ts 頂部

---

## 沒有 OTEL_EXPORTER_OTLP_ENDPOINT 時的行為

| Option | Description | Selected |
|--------|-------------|----------|
| TracerProvider 但不 export | TracerProvider 和 span 建立正常運作，就是不設 OTLP exporter，這樣可以經由 in-memory exporter 推入 span 進行測試 | ✓ |
| 完全跳過 OTel（NODE_ENV=test） | 類似 rateLimit 的處理，test 環境完全跳過所有 OTel 代碼，簡單但少了一層測試覺環張力 | |

**User's choice:** TracerProvider 但不 export（no-op exporter 模式）

---

## Route 識別策略

| Option | Description | Selected |
|--------|-------------|----------|
| Elysia onAfterHandle + store | Elysia plugin 在 onBeforeHandle 記錄 request 開始時間，onAfterHandle/onError 中完成 span。Elysia 在 handler 內已知道 route template，透過 context.route 即可取得 /api/agents/:id | ✓ |
| 從 URL 自行解析 | 自行寫 regex 把 /api/agents/abc123 對映回 template，但這是重複客戶端 routing logic、維護成本高 | |

**User's choice:** Elysia onAfterHandle + context.route

---

## Span 屬性範圍

| Option | Description | Selected |
|--------|-------------|----------|
| 只照 PROD-03 最小定義 | http.route、http.method、http.status_code、http.request.duration。不加 user_id/request_id 等，PROD-03b 再擴充 | ✓ |
| 加入 request_id 關聯 | 將 requestLoggerPlugin 的 requestId 加入 span 屬性，方便將 Pino log 跟 trace 串連 | |

**User's choice:** 最小集合

---

## 測試策略

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory span exporter | 在測試中推入 InMemorySpanExporter，在整合測試後斷言 span 數量、route、status code。與 Bun 整合測試一致，驗證 OTel instrumentation 正確出現 | ✓ |
| 只確保現有測試不爆 | OTel 唯一要求是不破壞現有測試。Span 正確性以手動登入 Jaeger/Tempo 確認 | |

**User's choice:** In-memory span exporter

---

## ADR 需求

| Option | Description | Selected |
|--------|-------------|----------|
| 需要 | STATE.md 已記錄「will need ADR for OTel SDK choice」。ADR 0020 記錄 sdk-trace-node 選擇理由、與 all-in-one sdk-node 的權衡 | ✓ |
| 不需要 | 選擇小、實作直接就好 | |

**User's choice:** 需要 ADR 0020

---

## Agent's Discretion

- OTel SDK 的確切版本號
- `otel-init.ts` 工廠函式的具體簽名
- Elysia plugin 內 span name 格式

## Deferred Ideas

- PROD-03b（Drizzle DB query spans）— 未來 phase
- PROD-03c（OTLP metrics export）— 未來 phase
- request_id 關聯（Pino log ↔ trace 串連）— 超出 PROD-03 最小範圍
