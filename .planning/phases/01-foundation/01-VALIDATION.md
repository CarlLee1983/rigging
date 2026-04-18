---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `.planning/phases/01-foundation/01-RESEARCH.md` §Validation Architecture

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `bun:test` (Bun 內建, Jest-compatible) |
| **Config file** | 無需（zero-config）; optional `bunfig.toml` for coverage |
| **Quick run command** | `bun run lint && bun run typecheck` (per-task, < 5s, zero dep) |
| **Full suite command** | `bun run lint && bun run typecheck && bun test` (per-wave, < 30s) |
| **Estimated runtime** | ~5s quick / ~30s full |

---

## Sampling Rate

- **After every task commit:** Run `bun run lint && bun run typecheck`
- **After every plan wave:** Run `bun run lint && bun run typecheck && bun test`
- **Before `$gsd-verify-work`:** Full suite (clean checkout + `docker compose up -d postgres` healthy) must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Planner 填入此表格（每個 plan 的 tasks 對應 REQ-ID / Threat / Test Type / Automated Command）。
> 下表依 RESEARCH.md §Phase Requirements → Test Map 為 seed，Planner 將拆解到每 task。

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| FND-01 | `bun install && bun run dev` 能啟動 | smoke | `bun install --frozen-lockfile && timeout 10 bun run dev; test $? -eq 124 -o $? -eq 0` | ❌ W0 | ⬜ pending |
| FND-02 | env 缺值立即 fail | unit + smoke | `BETTER_AUTH_SECRET= bun src/main.ts 2>&1 \| grep -q 'Invalid environment variables'` | ❌ W0 | ⬜ pending |
| FND-03 | `docker-compose up` postgres health | smoke / manual | `docker compose up -d postgres && timeout 30 bash -c 'until docker compose exec -T postgres pg_isready; do sleep 1; done'` | manual | ⬜ pending |
| FND-04 | Drizzle 用 `postgres-js` driver | static grep | `! grep -rE "drizzle-orm/bun-sql" src/` | ❌ W0 | ⬜ pending |
| FND-05 | kernel framework-free | static grep | `! grep -rE "from ['\"](elysia\|drizzle-orm\|better-auth\|postgres)" src/shared/kernel/` | ❌ W0 | ⬜ pending |
| FND-05 | `Result.map/andThen/match` 行為正確 | unit | `bun test tests/unit/shared/kernel/result.test.ts` | ❌ W0 | ⬜ pending |
| FND-05 | `Brand<T,K>` 型別隔離 | type-level | `tsc --noEmit` + expect-error snippet | ❌ W0 | ⬜ pending |
| FND-05 | `crypto.randomUUID` 生成 UUID v4 | unit | `bun test tests/unit/shared/kernel/id.test.ts` | ❌ W0 | ⬜ pending |
| FND-05 | DomainError httpStatus mapping | unit | `bun test tests/unit/shared/kernel/errors.test.ts` | ❌ W0 | ⬜ pending |
| FND-06 | Biome single config | static | `test -f biome.json && ! find . -name '.eslintrc*' -o -name '.prettierrc*'` | ❌ W0 | ⬜ pending |
| ARCH-01 | 四層目錄 placeholder 就位 | static | `test -d src/shared/application && test -d src/shared/infrastructure && ...` | ❌ W0 | ⬜ pending |
| ARCH-02 | Biome 阻擋 domain 層 import drizzle-orm | contract | `bun test tests/biome-contract/domain-drizzle.test.ts` | ❌ W0 | ⬜ pending |
| ARCH-03 | Repository 回 domain entity（Phase 3 feature）| deferred | — | N/A P1 | — |
| ARCH-04 | package.json 無 tsyringe/inversify | static | `! grep -E "(tsyringe\|inversify)" package.json` | ❌ W0 | ⬜ pending |
| ARCH-05 | DomainError.httpStatus 存在於 5 子類 | unit | 含於 FND-05 errors.test.ts | — | ⬜ pending |
| ADR-01 | docs/decisions/ 就位、MADR 4.0 format | static | `test -d docs/decisions && for f in docs/decisions/0*.md; do head -5 "$f" \| grep -q '^status:'; done` | ❌ W0 | ⬜ pending |
| ADR-02 | 9 起始 ADR ship | static | `test $(ls docs/decisions/{0000,0001,0002,0003,0004,0005,0006,0007,0008}-*.md 2>/dev/null \| wc -l) -eq 9` | ❌ W0 | ⬜ pending |
| ADR-03 | 3 追加 ADR ship（0009/0010/0011）| static | `test $(ls docs/decisions/{0009,0010,0011}-*.md 2>/dev/null \| wc -l) -eq 3` | ❌ W0 | ⬜ pending |
| ADR-04 | README 索引含 status + Supersedes | static | `grep -q 'Status' docs/decisions/README.md && grep -q 'Supersedes' docs/decisions/README.md` | ❌ W0 | ⬜ pending |
| ADR-05 | PR template 含 ADR checkbox | static | `grep -q 'ADR' .github/PULL_REQUEST_TEMPLATE.md` | ❌ W0 | ⬜ pending |
| AGM-01 | AGENTS.md 含 Rigidity Map 三級 | static | `grep -q 'RIGGING:rigidity-map-start' AGENTS.md && grep -q 'Tier 1' AGENTS.md` | ❌ W0 | ⬜ pending |
| AGM-02 | AGENTS.md 含 anti-features | static | `grep -q 'RIGGING:anti-features' AGENTS.md && grep -q 'DO NOT propose' AGENTS.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Planner 須在 wave 0 建立（見 RESEARCH.md §Validation Architecture §Wave 0 Gaps）：

- [ ] `bunfig.toml` (optional)
- [ ] `tests/unit/shared/kernel/result.test.ts` — FND-05 Result behavior
- [ ] `tests/unit/shared/kernel/brand.test.ts` — FND-05 Brand type isolation
- [ ] `tests/unit/shared/kernel/id.test.ts` — FND-05 UUID generation
- [ ] `tests/unit/shared/kernel/errors.test.ts` — FND-05 / ARCH-05 DomainError hierarchy
- [ ] `tests/unit/bootstrap/config.test.ts` — FND-02 env schema fail-fast
- [ ] `tests/contract/kernel-framework-free.test.ts` — FND-05 zero framework import
- [ ] `tests/biome-contract/domain-drizzle-violation.ts` (with Bun test harness) — ARCH-02
- [ ] `tests/biome-contract/application-drizzle-violation.ts` — D-09 application rule
- [ ] `tests/biome-contract/internal-barrel-violation.ts` — D-11
- [ ] `tests/integration/auth-bypass-contract.test.ts` (`test.skip` stub) — 預留 AUX-06 (Phase 3)
- [ ] Framework install: 無額外（`bun:test` 內建 Bun 1.3.12）
- [ ] `.github/workflows/ci.yml` — 基本 CI (lint + typecheck + test)
- [ ] `.github/workflows/adr-check.yml` — D-16 PR ADR checkbox enforcement

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `docker compose up -d postgres` 於 clean 環境 10 分鐘內 healthy | FND-03 | 依賴 local Docker daemon、CI 不跑 | 照 `docs/quickstart.md` 步驟執行，`docker compose ps` 看 `postgres` status 為 healthy |
| 開發者 clone repo → 10 分鐘內 process 啟動 | FND-01 | 人類體感時間難 automate | 新 shell：`git clone ... && cd rigging && bun install && docker-compose up -d && bun run dev`；計時 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
