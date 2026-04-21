---
phase: 13
slug: opentelemetry-tracing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bun:test（內建） |
| **Config file** | bunfig.toml `[test]` section |
| **Quick run command** | `bun test tests/unit/shared/plugins/tracing.plugin.test.ts` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run typecheck && bun test tests/unit/shared/plugins/tracing.plugin.test.ts`
- **After every plan wave:** Run `bun test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | PROD-03 (D-07) | — | ADR documents SDK choice rationale | manual | `cat docs/decisions/0020-otel-sdk-manual-assembly.md` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 1 | PROD-03 #1 | OTLP endpoint SSRF | OTEL_EXPORTER_OTLP_ENDPOINT not logged | unit | `bun run typecheck` | ❌ W0 | ⬜ pending |
| 13-02-02 | 02 | 1 | PROD-03 #1 | — | TracerProvider init without exporter is no-op | unit | `bun run typecheck` | ❌ W0 | ⬜ pending |
| 13-03-01 | 03 | 2 | PROD-03 #2, #4 | Sensitive data in spans | Only route/method/status/duration in attributes | unit | `bun run typecheck && bun test` | ❌ W0 | ⬜ pending |
| 13-03-02 | 03 | 2 | PROD-03 #1, #5 | — | Existing tests continue passing | regression | `bun run typecheck && bun test` | ✅ existing | ⬜ pending |
| 13-04-01 | 04 | 3 | PROD-03 #1, #2, #4 | — | InMemorySpanExporter captures spans with correct attributes | integration | `bun test tests/unit/shared/plugins/tracing.plugin.test.ts` | ❌ W0 | ⬜ pending |
| 13-04-02 | 04 | 3 | PROD-03 #2, #4, #5 | — | app-otel-tracing.test.ts: route/method/status/latency + error spans | integration | `bun test tests/integration/app-otel-tracing.test.ts && bun test` | ❌ W0 | ⬜ pending |
| 13-05-01 | 05 | 4 | PROD-03 #3 | — | Jaeger UI shows individual request traces | manual | — | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/shared/plugins/tracing.plugin.test.ts` — unit tests for tracingPlugin span creation, error status, attributes (PROD-03 #2, #4)
- [ ] `tests/integration/app-otel-tracing.test.ts` — integration tests with InMemorySpanExporter for PROD-03 #1, #2, #4
- [ ] `docs/decisions/0020-otel-sdk-manual-assembly.md` — ADR 0020 (D-07 requirement)
- [ ] `src/bootstrap/otel-init.ts` — TracerProvider factory
- [ ] `src/shared/presentation/plugins/tracing.plugin.ts` — Elysia tracing plugin

*All Wave 0 gaps are created by Plans 01–04.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Jaeger UI shows traces for individual HTTP requests | PROD-03 #3 | Requires live OTLP backend; no programmatic assertion possible | `docker run -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one`, set `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`, run app, exercise an endpoint, open `http://localhost:16686` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
