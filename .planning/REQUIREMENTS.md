# Requirements — Milestone v1.1 Release Validation

**Milestone goal:** 關閉 v1.0 遺留的收尾項目（CI 首跑綠燈、Phase 04 SECURITY audit、ADR 機制 self-check、Observability smoke），讓 Rigging 在進入 scaffold 拆分或 production hardening 前站穩 release-ready 的起跑點。

**Core Value 守護（不變）：** AI Agent 寫出來的程式碼必須「自動」具備安全性與結構性——靠的不是提示詞約束，而是框架本身的軌道（type system + runtime guards + DI）讓錯誤的寫法根本跑不起來。

**Version continuity:** v1.0 shipped 55 requirements (archive: `milestones/v1.0-REQUIREMENTS.md`). v1.1 REQ-IDs continue numbering within shared prefixes (CI-04+, ADR-06+; SEC + OBS are new prefixes).

---

## v1.1 Requirements

### CI Pipeline Validation (CI-04..05)

- [x] **CI-04**: 在 master 以外的分支 push commit 並開 PR 後，GitHub Actions 三個 parallel jobs（`lint` / `typecheck` / `test+coverage`）與 `migration-drift` job 首次實跑且全數 green；PR check summary 可看到 ≥4 個 check items 全綠 — **Validated Phase 6 / Plan 1 (2026-04-20)** — PR #1 merged `bf9eaf4`, run `24652628305` all green
- [x] **CI-05**: 任一 CI gate 破壞時 PR 會被擋下（fail-mode 驗證）——刻意製造以下 4 種狀況之一並在 PR 上觀察結果：biome lint 錯誤 → lint job fail / `// @ts-expect-error` 無誤用 → typecheck fail / 砍掉一個必經 test → test job fail / 手動改 schema 不補 migration → migration-drift fail — **Validated Phase 6 / Plan 2 (2026-04-20)** — PR #2 CLOSED (not merged); 5 independent red CI runs captured in `06-02-SUMMARY.md`

### Security Audit Back-fill (SEC-01)

- [x] **SEC-01**: Phase 04 `04-SECURITY.md` 含 threat mitigation evidence + CVE-2025-61928 regression + timing-safe API Key path + cross-user 404 matrix（含 list 動詞 D-07 Branch B 程式碼舉證）— **Validated Phase 7 / Plan 07-01 (2026-04-20)** — commit e2941a6, `07-01-SUMMARY.md`

### ADR Process Self-Check (ADR-06)

- [ ] **ADR-06**: ADR 機制在 v1.1 PR 實務上可運作——(a) 故意以格式錯誤的 ADR（缺 MADR 必要欄位）開 PR，`adr-check` workflow 擋下該 PR；(b) 審計 ADR 0000..0018 的 status 欄一致（`Accepted` / `Superseded` / `Deprecated`）並在 `docs/decisions/README.md` 索引表反映；(c) 若 v1.1 有產生新決策（e.g. CI 流程改動），補寫 ADR 0019+

### Observability Smoke (OBS-01)

- [x] **OBS-01**: CI 新增 smoke step——`createApp(config)` 實際 boot 後對 `/health` 發真 HTTP request 並驗 200 OK；此 step 為 PR gate 的最後一關（所有型別與 test 都過但 app 起不來時會 red）；同時驗證 smoke fail-mode（故意破壞 config 校驗或 plugin wiring）確實會擋 PR — **Validated Phase 6 / Plans 1+2 (2026-04-20)** — `scripts/smoke-health.ts` + ci.yml smoke step green on PR #1; smoke fail-mode red (`SMOKE_TRIPWIRE`) on PR #2 row #5

---

## Future Requirements (Deferred to v1.2+)

來自 v1.0 收尾時識別的候選池，v1.1 完成後重議優先序：

### Production Hardening
- **PROD-01**: 真實 email adapter（Resend 或 Postmark）+ bounce handling
- **PROD-02**: Rate limit 持久化 store（取代 memory-only，ADR 0015 的 v2 計畫）
- **PROD-03**: OpenTelemetry instrumentation（trace + metric + log 三面）

### Scaffold Extraction
- **SCAF-01**: `npx create-rigging` CLI scaffold（把 Reference App 抽成可重用骨架）
- **SCAF-02**: `@rigging/core` 套件拆分（shared kernel + auth harness 上 npm）

### Extended Identity
- **IDN-01**: OAuth（Google / GitHub）
- **IDN-02**: 2FA（TOTP / WebAuthn）
- **IDN-03**: Magic link 登入

---

## Out of Scope (v1.1)

v1.1 是 hygiene milestone，專心關閉 v1.0 遺留；以下明確不在 v1.1 範圍：

- **新 product feature**（任何 domain 新增、新 endpoint、新 feature module）——v1.1 只動 CI / docs / audit / observability infrastructure
- **Production-grade email / rate-limit / observability 升級**——屬 PROD-01..03，延後
- **Scaffold 拆分 / npm 發布**——屬 SCAF-01/02，延後
- **OAuth / 2FA / Magic link**——屬 IDN-01..03，延後
- **前端 UI / WebSocket / GraphQL**——與 v1.0 同樣 Out of Scope，維持不變
- **取代 BetterAuth 或任何技術棧換手**——除非 v1.1 執行時出現 blocker 需 ADR，預設不動
- **多 runtime / 多 DB driver 支援**——Bun + postgres-js 鎖定，繼承 v1.0

---

## Traceability

每條 v1.1 requirement 對應到 ROADMAP.md 的 phase。下表由 `gsd-roadmapper` 在 ROADMAP 建立時填寫。

| REQ-ID | Phase    | Status  |
|--------|----------|---------|
| CI-04  | Phase 6  | Validated (2026-04-20) |
| CI-05  | Phase 6  | Validated (2026-04-20) |
| OBS-01 | Phase 6  | Validated (2026-04-20) |
| SEC-01 | Phase 7  | Validated (2026-04-20) |
| ADR-06 | Phase 8  | Pending |

---

_Created: 2026-04-20 — milestone v1.1 start via `$gsd-new-milestone`_
_Traceability filled: 2026-04-20 — `gsd-roadmapper` mapped 5 requirements across Phases 6-8_
