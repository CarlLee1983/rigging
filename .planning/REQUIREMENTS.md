# Requirements: Rigging v1.3 Production Hardening

**Defined:** 2026-04-20
**Core Value:** AI Agent 寫出來的程式碼必須「自動」具備安全性與結構性——靠的不是提示詞約束，而是框架本身的軌道（type system + runtime guards + DI）讓錯誤的寫法根本跑不起來。

## v1.3 Requirements

### Email Delivery

- [ ] **PROD-01**: Developer can configure a Resend API key and sender address via environment variables so that email verification and password reset emails are delivered to real inboxes in production (replacing ConsoleEmailAdapter)

### Rate Limiting

- [ ] **PROD-02**: Developer can enable a Redis-backed rate limit store via environment configuration so that rate limiting state survives application restarts and is shared across multiple instances

### Observability

- [ ] **PROD-03**: All HTTP requests automatically emit OpenTelemetry trace spans (route, method, status code, latency) via an Elysia middleware, collectable by any OTLP-compatible backend

## Future Requirements

### Extended Email (v1.4+)

- **PROD-01b**: Postmark email adapter (alternative to Resend)
- **PROD-01c**: Bounce / delivery status webhook endpoint (`POST /webhooks/email`)

### Extended Rate Limiting (v1.4+)

- **PROD-02b**: PostgreSQL-backed rate limit store (no extra infra)
- **PROD-02c**: Rate limit response headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`)

### Extended Observability (v1.4+)

- **PROD-03b**: Drizzle DB query spans in traces
- **PROD-03c**: OTLP metrics export (request count, latency histogram, error rate)

### Extended Identity (v1.4+)

- **IDN-01**: OAuth provider login (GitHub / Google)
- **IDN-02**: Two-factor authentication (TOTP)
- **IDN-03**: Magic link login

### Extended Scaffold (v1.4+)

- **SCAF-09**: Interactive CLI mode (optional feature prompts)
- **SCAF-10**: Minimal harness variant (DDD skeleton + AuthContext only)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Postmark adapter | Resend covers v1.3; Postmark is additive and can be its own phase |
| Bounce webhooks | Requires external webhook infrastructure; deferred to v1.4 |
| DB-backed rate limit | Redis is the standard; Postgres fallback is additive, not blocking |
| DB query spans | HTTP traces deliver the core observability value; DB spans are additive |
| OTel metrics | Traces first; metrics require separate instrumentation setup |
| OAuth / SSO / 2FA | Deferred IDN-01..03, not blocking production hardening |
| 前端 UI | API-first 設計持續有效 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROD-01 | — | Pending |
| PROD-02 | — | Pending |
| PROD-03 | — | Pending |

**Coverage:**
- v1.3 requirements: 3 total
- Mapped to phases: 0 (to be filled by roadmapper)
- Unmapped: 3

---
*Requirements defined: 2026-04-20*
*Last updated: 2026-04-20 — initial v1.3 requirements*
