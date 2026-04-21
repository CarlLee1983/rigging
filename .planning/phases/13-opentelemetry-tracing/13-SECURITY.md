---
phase: 13
slug: opentelemetry-tracing
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-21
---

# Phase 13 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 文件 → CI | ADR 文件格式經 validate-adr-frontmatter.ts 機器驗證 | ADR YAML frontmatter |
| env → ConfigSchema | OTEL_EXPORTER_OTLP_ENDPOINT 經 TypeBox uri format 驗證再進入應用程式 | 環境變數字串 |
| app → OTLP endpoint | initTracing 直接連接外部 endpoint | Trace span data |
| Elysia context → span attributes | ctx.route 和 ctx.request.method 為 framework-controlled，非 user input | Route template、HTTP method/status |
| test → InMemorySpanExporter | 測試環境使用 in-memory exporter，無網路連線需求 | Test span data（記憶體內） |
| 本地 app → 本地 Jaeger | 僅在本地網路環境驗證 | Trace span data（localhost only） |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-13-01-01 | Tampering | ADR frontmatter | mitigate | ADR 0020 存在；`bun run validate:adr` CI 驗證格式正確 | closed |
| T-13-01-02 | Information Disclosure | ADR References | accept | ADR 只引用 internal planning 路徑和公開 GitHub URLs | closed |
| T-13-02-01 | Spoofing | OTLP exporter endpoint | accept | endpoint 來自 env var（ops-controlled），非 user-controlled input | closed |
| T-13-02-02 | Tampering | ConfigSchema validation | mitigate | `config.ts:36` TypeBox `format: 'uri'`，啟動時 fail-fast | closed |
| T-13-02-03 | Information Disclosure | OTLP endpoint URL logging | mitigate | `otel-init.ts` 無任何 log 呼叫；endpoint 只傳給 OTLPTraceExporter constructor | closed |
| T-13-02-04 | Elevation of Privilege | SSRF via OTLP endpoint | accept | endpoint 由 operator 設定（infra config），非 user input；ops 責任範疇 | closed |
| T-13-03-01 | Information Disclosure | span attributes | mitigate | 只記錄 route/method/status/duration；無 body、headers、auth tokens、query params | closed |
| T-13-03-02 | Information Disclosure | onError span message | mitigate | `ctx.error?.toString()` 只送到 span.setStatus message，不進 HTTP response body | closed |
| T-13-03-03 | Tampering | ctx.route 高基數攻擊 | accept | Elysia `context.route` 是 registered route template，非 raw URL | closed |
| T-13-03-04 | Denial of Service | span creation overhead | accept | 無 endpoint 時為 no-op drop；可接受 | closed |
| T-13-03-05 | Information Disclosure | PII in URL paths | mitigate | 使用 `ctx.route`（如 `/api/users/:id`）而非 `ctx.path`（含真實 ID） | closed |
| T-13-04-01 | Information Disclosure | test span data | accept | InMemorySpanExporter 只在測試 process 記憶體，不傳輸至外部 | closed |
| T-13-04-02 | Tampering | exporter cross-test pollution | mitigate | 兩個 test suite 均有 `afterEach(() => exporter.reset())` | closed |
| T-13-04-03 | Denial of Service | global TracerProvider overwrite | accept | bun test 並行隔離模式可接受 | closed |
| T-13-05-01 | Information Disclosure | 本地驗證 trace data | accept | 驗證在 localhost 執行；驗證完成後 `docker stop jaeger` 清理 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-13-01 | T-13-01-02 | ADR 只引用 internal planning 路徑和公開 GitHub URLs，無機密資訊 | gsd-security-auditor | 2026-04-21 |
| AR-13-02 | T-13-02-01 | OTLP endpoint 為 ops-controlled env var，非 user input；infrastructure 設定範疇 | gsd-security-auditor | 2026-04-21 |
| AR-13-03 | T-13-02-04 | SSRF 風險由 ops 負責（endpoint 非 user-controlled）；URL allowlist 為過度工程 | gsd-security-auditor | 2026-04-21 |
| AR-13-04 | T-13-03-03 | Elysia route template 非 user-injectable；攻擊者無法注入任意 route | gsd-security-auditor | 2026-04-21 |
| AR-13-05 | T-13-03-04 | SimpleSpanProcessor 同步寫出延遲可接受；無 endpoint 時為 no-op | gsd-security-auditor | 2026-04-21 |
| AR-13-06 | T-13-04-01 | InMemorySpanExporter 僅存在測試 process 記憶體，不外洩 | gsd-security-auditor | 2026-04-21 |
| AR-13-07 | T-13-04-03 | bun test 並行隔離；TracerProvider 衝突風險可接受 | gsd-security-auditor | 2026-04-21 |
| AR-13-08 | T-13-05-01 | 本地 Jaeger 驗證完成後 docker stop 清理，不殘留 trace data | gsd-security-auditor | 2026-04-21 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-21 | 15 | 15 | 0 | gsd-security-auditor (automated) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-21
