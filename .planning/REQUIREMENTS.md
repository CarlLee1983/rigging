# Requirements: Rigging v1.2 Create Rigging

**Defined:** 2026-04-20
**Core Value:** AI Agent 寫出來的程式碼必須「自動」具備安全性與結構性——靠的不是提示詞約束，而是框架本身的軌道（type system + runtime guards + DI）讓錯誤的寫法根本跑不起來。

## v1.2 Requirements

### CLI & Distribution

- [ ] **SCAF-01**: Developer can run `npx create-rigging <project-name>` to scaffold a new project
- [ ] **SCAF-02**: `create-rigging` package is published to npm (public) and invocable via `npx`

### Template Generation

- [ ] **SCAF-03**: Generated project contains full reference app — DDD 四層 + AuthContext + demo domain + tests + CI workflow
- [ ] **SCAF-04**: Project name is automatically substituted in `package.json` and relevant identifiers throughout the generated codebase
- [ ] **SCAF-05**: `.planning/` directory and scaffold-internal files are excluded from generated output
- [ ] **SCAF-06**: Generated project includes `.env.example` with all required environment variables documented

### Developer Experience

- [ ] **SCAF-07**: CLI outputs clear next-steps guidance after scaffolding (cd / bun install / docker compose up / bun test)
- [ ] **SCAF-08**: `README.md` and `docs/quickstart.md` updated to use scaffold as primary entry point

## Future Requirements

### Extended Scaffold Options (v1.3+)

- **SCAF-09**: Interactive mode — CLI prompts for optional features (demo domain yes/no, CI yes/no)
- **SCAF-10**: Minimal harness variant — DDD skeleton + AuthContext only, no demo domain

### Production Hardening (v1.3+)

- **PROD-01**: Real email adapter (Resend / Postmark) + bounce handling
- **PROD-02**: Rate limit persistent store
- **PROD-03**: OpenTelemetry instrumentation

### Extended Identity (v1.3+)

- **IDN-01**: OAuth provider login (GitHub / Google)
- **IDN-02**: Two-factor authentication (TOTP)
- **IDN-03**: Magic link login

## Out of Scope

| Feature | Reason |
|---------|--------|
| Interactive feature selection | v1.2 先用 opinionated 單一輸出；互動式選項留 v1.3 |
| Multiple template variants | 先驗證完整 reference app 複本的 UX，再抽最小化變體 |
| GitHub template repo | CLI 是主要分發管道；GitHub template 為替代方案留 v1.3+ |
| Monorepo structure | 單 CLI 套件已足夠；monorepo 是過度設計 |
| 前端 UI | API-first 設計持續有效 |
| OAuth / SSO / 2FA / Magic Link | 留 IDN-01..03 候選池 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCAF-01 | TBD | Pending |
| SCAF-02 | TBD | Pending |
| SCAF-03 | TBD | Pending |
| SCAF-04 | TBD | Pending |
| SCAF-05 | TBD | Pending |
| SCAF-06 | TBD | Pending |
| SCAF-07 | TBD | Pending |
| SCAF-08 | TBD | Pending |

**Coverage:**
- v1.2 requirements: 8 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 8 ⚠️

---
*Requirements defined: 2026-04-20*
*Last updated: 2026-04-20 after initial v1.2 definition*
