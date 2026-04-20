---
phase: 7
slug: phase-04-security-audit-back-fill
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `bun:test` (built-in, Bun 1.3.10) |
| **Config file** | `bunfig.toml` (coverage settings; test config not required) |
| **Quick run command** | `bun run test:regression` |
| **Full suite command** | `bun test tests/integration/auth/cve-2025-61928.regression.test.ts tests/integration/auth/timing-safe-apikey.regression.test.ts tests/integration/agents/cross-user-404.test.ts tests/integration/agents/dogfood-self-prompt-read.test.ts` |
| **Estimated runtime** | ~30–60 seconds (timing test runs 1000-iter warm-up + measurement) |

**Prerequisite:** Source `.env` before running integration tests (`DATABASE_URL` must be set; Docker container `rigging-postgres` must be up).

---

## Sampling Rate

- **After every task commit:** Run `bun run test:regression`
- **After every plan wave:** Run the full evidence suite (4 files above)
- **Before `$gsd-verify-work`:** Full evidence suite must be green + 04-SECURITY.md updated with SHA
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | SEC-01 §b | T-04-08 | CVE-2025-61928: unauthenticated POST /api-keys with body.userId → 401; attacker session → 403 USER_ID_MISMATCH | integration regression | `bun test tests/integration/auth/cve-2025-61928.regression.test.ts` | ✅ | ⬜ pending |
| 7-01-02 | 01 | 1 | SEC-01 §c | T-04-12 | API Key timing alignment: malformed-path vs wrong-hash-path ratio < 0.2 (1000-iter) | integration regression | `bun test tests/integration/auth/timing-safe-apikey.regression.test.ts` | ✅ | ⬜ pending |
| 7-01-03 | 01 | 1 | SEC-01 §d | T-04-08 | Cross-user GET/PATCH/DELETE/POST → 404 RESOURCE_NOT_FOUND | integration | `bun test tests/integration/agents/cross-user-404.test.ts` | ✅ | ⬜ pending |
| 7-01-04 | 01 | 1 | SEC-01 §d | T-04-08 | Cross-user nested read (GET /prompts/latest) → 404 RESOURCE_NOT_FOUND | integration | `bun test tests/integration/agents/dogfood-self-prompt-read.test.ts` | ✅ | ⬜ pending |
| 7-01-05 | 01 | 1 | SEC-01 §d | T-04-08 | Cross-user list-prompts (GET /agents/:id/prompts) → 404 (Branch A) | integration | `bun test tests/integration/agents/cross-user-404.test.ts` | ❌ W0 (Branch A only) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **Branch A only:** `tests/integration/agents/cross-user-404.test.ts` — new `describe` block for `GET /agents/:userAAgentId/prompts → 404 RESOURCE_NOT_FOUND` (cross-user list-prompts)

*If Branch B is chosen for D-07: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 04-SECURITY.md `## SEC-01 Compliance Evidence` section added with all 3 subsections | SEC-01 §b/c/d | File content review — no automated markdown checker | Read `.planning/phases/04-demo-domain/04-SECURITY.md`; confirm sections for CVE, timing-safe, and cross-user matrix exist with correct test refs and HEAD SHA |
| Audit trail row added with execution date + HEAD SHA | SEC-01 (repeatable evidence) | Content verification | Check Security Audit Trail table in 04-SECURITY.md for new row dated 2026-04-20 with actual `git rev-parse HEAD` value |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (Branch A: cross-user list test)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
