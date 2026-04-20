# Phase 6: CI Pipeline Green-Run & Smoke Validation — Research

**Researched:** 2026-04-20
**Domain:** GitHub Actions PR gating + in-process Elysia smoke test + deliberate fail-mode demonstration
**Confidence:** HIGH（核心發現以 repo 內既有檔案、既有 ADR、官方 GitHub Actions 語義為主；只有 3 處 MEDIUM — 詳見 §Sources）

---

## Summary

Phase 6 本質不是寫新 feature，而是**對一組已經 land 在 main 的 CI infrastructure 做「真實運行」與「逐 gate 反向驗證」**。v1.0 Phase 5 Plan 05-03 已完成 ci.yml 改寫（3 parallel jobs + drift check + postgres service + concurrency cancel-in-progress），但從未在非 master 分支的 PR 上實跑過；Phase 6 的交付物是**兩條證據鏈**：

1. **Plan 1（Green baseline + smoke）** — 在現有 ci.yml 裡新增 smoke step（`createApp(config)` boot + `/health` 真 HTTP 200），開 PR → 全綠 → merge 進 main。交付物是 (a) smoke step 的 code（script + workflow 注入）、(b) PR check run URL 證明四個 check items + smoke step 皆 green。
2. **Plan 2（Fail-mode matrix）** — 在 Plan 1 merge 後的 main 上，用**單一 sacrificial PR + 5 次 force-push** 各驗一種 fail-mode（lint / typecheck / test / drift / smoke）讓對應 job 紅燈並貼 check URL 進 SUMMARY，PR close 不 merge。

**關鍵技術發現：** repo 內 `tests/integration/app-skeleton-smoke.test.ts` 已經在用 `createApp(TEST_CONFIG, deps).handle(new Request('http://localhost/health'))` 這個模式做 in-process HTTP 測試 — 這等於證明「in-process Fetch handler」對既有 codebase 是 first-class pattern，smoke step 可以直接沿用。唯一差別是 smoke step 需要對**真 DB**（CI postgres service）而非 fake probe 做檢查，因為 OBS-01 的價值是驗證整條 boot chain 能起來、包含 DB 連線。

**Primary recommendation:**
- Smoke 用 `scripts/smoke-health.ts`（dedicated file，對齊 `scripts/coverage-gate.ts` 風格），在 ci.yml `test` job 尾端（drift 之後、coverage artifact upload 之前）呼叫 `bun run scripts/smoke-health.ts`，內部 `createApp(loadConfig()).handle(new Request('http://localhost/health'))` → 驗 status === 200 → exit code 0/1。
- Fail-mode demo 的 smoke 破壞點選**擴張 `ConfigSchema` 加一條嚴格 runtime validation**（e.g. `DATABASE_URL` 強制含特定 substring），boot 時 `loadConfig()` throw → smoke script non-zero exit → job red。不動 plugin wiring（那會同時打到 test job，違反「一次破壞只 red 一個 gate」的隔離原則）。

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01**: Phase 6 切 2 個 plans — Plan 1 = Green baseline + smoke（CI-04 + OBS-01）；Plan 2 = Fail-mode matrix（CI-05）。
- **D-02**: Plan 順序 Green 先、Fail 後；Plan 2 depends_on Plan 1。
- **D-03**: Plan 1 acceptance 必須含「push branch + open PR + 等 CI finish + check URL 寫進 SUMMARY」作為 CI-04 shippable evidence。
- **D-04**: Plan 1 的 PR 直接 merge 進 main（不另開 demo PR）— 把 smoke step infra land 與 CI-04 驗證合併。
- **D-05**: Plan 2 使用單一 sacrificial PR force-push 5 次，每次一種 fail-mode，close 不 merge。
- **D-06**: Fail-mode 收嚴到 5 種（lint / typecheck / test / drift / smoke 全驗）。

### the agent's Discretion（本研究聚焦項）

1. Smoke step 實作策略（in-process / background server / reuse e2e harness）。
2. Smoke script 檔案落點（dedicated script / inline workflow / npm script）。
3. ci.yml 注入位置（test job 尾端 / 新 parallel job / 最終 sequential gate）。
4. 5 種 fail-mode 的最小破壞 patch 設計。
5. Plan 2 sacrificial PR branch 命名 + force-push 流程。
6. `actions/cache@v4` + `setup-bun@v2` 對 smoke step 延遲的影響。

### Deferred Ideas (OUT OF SCOPE)

- Fail-mode 執行策略的其他變體（多 PR / commit chain / ephemeral 不開 PR） — D-05 已鎖。
- Evidence artifact 上傳 / 截圖替代 URL — D-03 已鎖 check URL。
- Production observability（OTel / metrics） — PROD-03，v1.2+。
- 多 runtime / 多 DB driver 支援矩陣 — v1.1 OOS。
- Self-hosted runner 加速 — v1.1 無此需求。
- 新 product feature / endpoint — v1.1 milestone 整體 OOS。

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CI-04 | 非 master 分支 PR push + 開 PR 後，GitHub Actions 三 parallel jobs（lint / typecheck / test+coverage）與 migration-drift job 首跑全綠；PR check summary ≥4 check items all-green，外部可驗 | §Domain Investigation「什麼算全綠」、§Technical Approach §1 + §3；check URL 取得由 `gh pr checks --json` 支援 |
| CI-05 | 刻意破壞任一 gate 時 PR 被擋：本 phase 收嚴成 5 種 fail-mode（lint / typecheck / test / drift / smoke） | §Technical Approach §4「5 種最小破壞 patch」；§Validation Architecture Plan 2 signal list |
| OBS-01 | CI 新增 smoke step — `createApp(config)` 實際 boot 後對 `/health` 發真 HTTP request 驗 200；smoke step 為 PR gate 最後一關；且驗證 smoke fail-mode（破壞 config 或 plugin wiring）會擋 PR | §Technical Approach §1「in-process Fetch 符合真 HTTP 語意」與 §2「smoke script 落點」；§Implementation Risks「smoke 隔離原則」 |

---

## Project Constraints (from AGENTS.md / ADRs)

- **Tier 1 Rigidity**：stack pin（Bun 1.3.12 / Elysia 1.4.28 / Drizzle 0.45.2 / BetterAuth 1.6.5 / postgres 3.4.9）不動；`createApp` 單一 assembly point 不破壞；plugin order（ADR 0012）不變。
- **Tier 2**：smoke step 的實作細節（dedicated script vs inline）屬 convention 不是 ADR 事項；但若 smoke step 引入「新 runtime behavior」（e.g. pre-warm DB, background polling）會觸發 ADR 0019。
- **Anti-features**：不新增 frontend、不接真 email provider、不加 OTel、不加 WebSocket — Phase 6 範圍內無此風險（純 CI + 1 個 HTTP ping）。
- **Commit format**：`<type>: <scope> <subject>`（繁中 OK）；範例：`ci: [workflow] 加入 createApp smoke step（OBS-01）`。
- **Git / GSD**：Phase 6 的所有 edit 必須走 GSD workflow（`/gsd-execute-phase`）不能直接手改 repo。

---

## Architectural Responsibility Map

本 phase 的 capability 幾乎全部落在 **CI infrastructure** 層（GitHub Actions + bash + Bun script），唯一觸碰 runtime 的是 smoke script 要 import `createApp`，但不引入新 layer。

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Smoke script (boot + HTTP ping + exit code) | CI / Tooling (`scripts/`) | Bootstrap (`src/bootstrap/app.ts` import) | 屬 build-time/CI 工具類，落在 `scripts/` 與 `scripts/coverage-gate.ts` 同等 tier。不是 application code，不進 DDD 分層 |
| GitHub Actions workflow step 注入 | CI / Workflow (`.github/workflows/ci.yml`) | — | 純 YAML pipeline 層；不改 code |
| Config schema 微調（若 smoke 需要）| Bootstrap (`src/bootstrap/config.ts`) | — | 已是 bootstrap 層，smoke step 若加 env 變數（e.g. `SMOKE_MODE=true`）應在此擴；但 Plan 1 預期**不需要擴**（直接 reuse CI 既有 env） |
| Fail-mode demo patches（Plan 2） | 破壞點散落（src / drizzle schema / tests） | — | 每個 fail-mode patch 是 throwaway，落點就是各自 gate 會掃到的 source（lint → src/*.ts、drift → drizzle/schema） |

**為何不分成新 feature module**：smoke script 不是 domain concept；它是 CI infrastructure 的一部分，目標是「驗 app 起得來」而非「提供 business capability」。和 `scripts/coverage-gate.ts` 同性質：build/CI tooling。

---

## Domain Investigation — Phase 6 CI Pipeline 語意

### 1. 「CI 全綠」的精確定義

在本 phase 脈絡下「全綠」= PR 的 **Checks** tab 每一個 check item 都是 ✓（pass）或 skipped，無 ✗ / neutral / cancelled。對照 ci.yml 與 adr-check.yml 現況，「四個 check items」的精確列表為：

| Check item name (as shown in GitHub UI) | Source workflow + job | 必須綠 |
|------------------------------------------|------------------------|--------|
| `CI / Lint (biome check)` | `ci.yml` job `lint` | 是 |
| `CI / Typecheck (tsc --noEmit)` | `ci.yml` job `typecheck` | 是 |
| `CI / Test + coverage gate + migration drift` | `ci.yml` job `test`（含 drift step） | 是 |
| `ADR Check / adr-check` | `adr-check.yml` job `adr-check` | 是（PR body 若未打勾 ADR required box 則此 job 直接 pass；若打勾則必須加新 ADR 檔） |

**重要語義釐清：** ci.yml 的 `test` job 內部含 `Apply migrations` / `Test (with coverage)` / `Coverage gate` / `Migration drift check` / `Upload coverage artifact` 五個 step。GitHub UI 上**只顯示一個 check item**（`CI / Test + coverage gate + migration drift`），step 層失敗只會把整個 check item 打紅，沒有「4 個 check items 分開顯示」那樣細。因此 ROADMAP success criterion #1 寫的「四個 check items 全綠」指的是 **lint + typecheck + test(+drift) + smoke** 四個，而非「lint + typecheck + test + drift 分開四個」。Plan 1 新增 smoke step 時必須讓 smoke 成為**獨立顯示的 check item**或**在既有 test job 中內嵌**這兩種 UI 呈現有差異（詳見 §Technical Approach §3）。

### 2. 「真 HTTP」的精確定義（OBS-01 語意）

OBS-01 要求「對 `/health` 發**真 HTTP request**並驗 200」。這句話有兩種合理解讀：

- **寬解讀**：走過 HTTP 語義（method、URL、headers、body）的 Request/Response 循環，不論是 in-process (`app.handle(Request)`) 還是 cross-process (`curl http://localhost:3000/health`)。
- **嚴解讀**：必須經過 TCP socket、實際佔用 port、能被 `curl` / `wget` 從 shell 發起 request。

**判斷**：採**寬解讀**，理由三條：
1. Elysia 的 `app.handle(Request)` 走的是**完整 Fetch API Request → Response pipeline**，包含 cors / errorHandler / requestLogger 所有 plugin hooks — ADR 0012 的 plugin chain 會被走一遍。Elysia 官方把 `app.handle()` 稱為「unit test 用的 in-process fetch」且語義等同 `fetch(...)`。
2. 嚴解讀需要 `bun src/main.ts &` + `sleep 2` + `curl` + `kill $pid`，在 CI 內不穩定（race condition、port conflict、kill 失敗留殭屍 process）；而 in-process 方案由 `scripts/smoke-health.ts` 一個 process 完成，失敗即非零 exit，乾淨。
3. 既有 `tests/integration/app-skeleton-smoke.test.ts` 已經用這個模式驗過 `/health` 200/503、swagger、error handler、requestId header — 等於 repo 已把「`app.handle(Request)` 是 real HTTP」當既有約定。

**背書**：ADR 0012 的 consequence 明文「startup time is bounded by import cost, not network latency」「`/health` validates DB at request time」——即 boot 時沒有 pre-warm，smoke step 必須發一次真 request 才能驗 DB probe，這和 in-process Fetch 模型完全相容。

### 3. `pull_request` 事件 + `concurrency.cancel-in-progress: true` + force-push 的語意

ci.yml line 9-12 明文：

```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

GitHub Actions 官方語義（[docs.github.com/actions/.../concurrency](https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs)）：

- 對 `pull_request` 事件，`github.ref` 在 PR 脈絡下是 `refs/pull/{NUMBER}/merge`。同一個 PR 的每次 push / force-push 共享同一個 `github.ref` → **都進同一個 concurrency group**。
- `cancel-in-progress: true` → 新 push 會 **cancel 舊的 in-progress run**，不會排隊。被 cancel 的 run 在 UI 顯示為 `cancelled`（不是 success / failure）。

**對 Plan 2 的直接影響 — 必讀 landmine：**

| 情境 | 結果 |
|------|------|
| force-push A → 等 run finish（任一種終態）→ force-push B | ✅ 每次 push 各有一個獨立終態的 run，對應獨立 check URL |
| force-push A → 不等 finish，立刻 force-push B | ❌ A 的 run 變 `cancelled`，B 的 run 才開始；A 的「fail-mode 有擋 PR」證據流失（`cancelled` 不是 `failure`） |
| force-push B 時 A 還在跑 → cancel-in-progress kick in | ❌ A 未完成即被砍；拿不到 red 的 check URL 當 evidence |

**行動項（planner 必須寫進 Plan 2）：** 每次 force-push 後，必須先 `gh pr checks --watch` 或肉眼確認 CI run **進入終態**（`failure` / `success` / `cancelled` 之中的 `failure` 才算證據），再進行下一次 force-push。否則 evidence 流失。

建議指令序列（可放 plan acceptance）：
```bash
# 1. 造破壞、force-push
git commit --amend --no-edit && git push --force
# 2. 等 CI finish（--watch 每 10s 檢查，全 done 才退出）
gh pr checks --watch
# 3. 抓當次 run 的 check URL（選 failure 那個 job）
gh pr checks --json name,state,link
```

### 4. ADR check workflow 與本 phase 的互動

`adr-check.yml` 只 trigger `pull_request: branches: [main]`，job 做兩件事：
1. grep PR body 有無「`- [x] This PR introduces a decision that requires a new ADR`」勾選。
2. 若勾選 → 檢查本 PR 是否有新增 `docs/decisions/*.md` 檔（`git diff --name-only --diff-filter=A`）。

**對 Plan 1 的影響**：Plan 1 的 PR body 若**不勾**「需要 ADR」box，則 adr-check 會直接 pass（早退）— 這是正常路徑。但 researcher/planner 要注意：smoke step 的引入**算不算一個需要 ADR 的決策**？

**判斷**：依 ADR 0009 Rigidity Map：
- 新增一個 CI script 本身屬 **Tier 3（convention）**，不需 ADR。
- 但若 smoke step 引入**新 runtime behavior**（e.g. boot 時先 warm-up DB connection pool / smoke script 需要獨立的 `createSmokeApp()` factory 而非 reuse `createApp()`）→ 觸碰 Tier 1（`createApp` 是唯一 assembly point），需 ADR 0019。
- **推薦方案下不需要 ADR**：smoke script 直接 `import { createApp } from '../src/bootstrap/app'` + reuse 既有 `loadConfig()` + `app.handle(Request)`，沒有新增 factory 也沒有改 boot 語義。SUMMARY.md 明示「本 phase 無新 ADR」即可（符合 CONTEXT D-06）。

**對 Plan 2 的影響**：5 種 fail-mode patch 都不改 ADR 相關檔，adr-check 對 Plan 2 PR 每次 force-push 應該都 **pass**。若某次 patch 意外動到 `docs/decisions/` 會同時觸發 adr-check fail，污染「一次破壞打一個 gate」的隔離語義 — planner 要在 Plan 2 acceptance 明示「每個 fail-mode patch 必須確認 adr-check 仍為 green」。

---

## Technical Approach — 對 the agent's Discretion 1-6 的推薦方案

### §1. Smoke step 實作策略

**推薦：(a) in-process — `createApp(loadConfig()).handle(new Request('http://localhost/health'))`。**

| 方案 | Startup latency | Debuggability | 真 HTTP 語義 | DB 需求 | 推薦度 |
|------|-----------------|---------------|-------------|---------|--------|
| **(a) in-process（app.handle(Request)）** | ~100-200ms（import + Elysia boot） | 高（單 process，stack trace 直達 createApp；失敗即非零 exit） | ✓ 走完整 Fetch pipeline + 所有 plugin hooks | 需（走真 DrizzleDbHealthProbe → Postgres SELECT 1） | ⭐⭐⭐ **推薦** |
| (b) background server + curl | ~2-4s（`bun src/main.ts &` + `sleep 2` 等 listen + curl + kill） | 中（跨 process；要 tail log 看錯；kill 失敗留殭屍） | ✓ TCP socket + OS port | 需 | ⭐ 次佳 |
| (c) reuse tests/e2e harness（bun test 跑 smoke-specific test） | ~3-5s（test runner 啟動 + bun:test 本身 overhead） | 中（失敗訊息混在 test report 裡，較難從 CI log 一眼看到） | ✓ 但進 test runner 層 | 需 | ⭐ 不推薦 |

**為何選 (a)：**
- 延遲最低（CI minute 便宜），且與既有 `tests/integration/app-skeleton-smoke.test.ts` 的技術棧完全一致 — repo 已有先例。
- Debuggability 最高：CI 失敗時直接看 script stderr 即知 boot 哪段失敗；不需挖 test runner 的 output 或 background process 的 PID log。
- 完整走 ADR 0012 plugin chain（requestLogger → cors → errorHandler → swagger → authModule → agentsModule → healthModule），這是 OBS-01 的核心目的 — 任何 plugin wiring 破壞都會在這裡 surface。
- `app.handle(Request)` 等同於 Elysia 官方文件推薦的 unit-test pattern（[elysiajs.com/patterns/unit-test](https://elysiajs.com/patterns/unit-test)）。

**為何拒絕 (b)：** cross-process 帶來 race condition（`sleep 2` 是魔法數字）、殭屍 process 風險、CI minute 成本高；只有在需要驗「真的 bind 到 OS port」時才值得，而 OBS-01 不要求這點。

**為何拒絕 (c)：** bun:test 的 exit code 包含所有 test suite 結果，smoke 若混入既有 test job 的 `bun run test:ci` 失去了「smoke 獨立 gate」的語義；且 test runner 輸出 verbose，CI log 不利 debug。

### §2. Smoke script 落點

**推薦：`scripts/smoke-health.ts` dedicated file + `package.json` 新增 `"smoke": "bun run scripts/smoke-health.ts"` npm script。**

| 方案 | Maintainability | Workflow 可讀性 | 對齊既有風格 | 推薦度 |
|------|-----------------|-----------------|--------------|--------|
| **scripts/smoke-health.ts + `bun run smoke`** | 高（單一檔案，可 local `bun run smoke` 本地複現） | 高（workflow 只有一行 `run: bun run smoke`） | ✓ 對齊 `scripts/coverage-gate.ts` + `bun run coverage:gate` | ⭐⭐⭐ **推薦** |
| inline `bun -e "..."` 在 workflow | 低（YAML multi-line string 難讀 / escape 噩夢 / 本地不可複現） | 低 | ✗ | ⭐ 拒絕 |
| 只加 npm script（不加 dedicated file） | 不適用（npm script 不能內嵌 > 1 行 TS 邏輯） | — | — | N/A |

**推薦 script 骨架（planner 可直接參考）：**

```typescript
#!/usr/bin/env bun
/**
 * smoke-health.ts — Phase 6 CI smoke gate (OBS-01)
 *
 * 驗證 createApp(loadConfig()) 能完整 boot 並對 /health 回 200。
 * Walks 全 ADR 0012 plugin chain（requestLogger → cors → errorHandler → swagger → auth → agents → health）。
 * Exit 0 → green；Exit 非零 → red。
 */
import { createApp } from '../src/bootstrap/app'
import { loadConfig } from '../src/bootstrap/config'

async function main() {
  const config = loadConfig()              // throws on invalid env
  const app = createApp(config)            // full plugin chain; sync per ADR 0012
  const res = await app.handle(new Request('http://localhost/health'))

  if (res.status !== 200) {
    const body = await res.text()
    console.error(`✗ Smoke failed: /health returned ${res.status}`)
    console.error(`  Body: ${body}`)
    process.exit(1)
  }
  const body = (await res.json()) as { ok: boolean; db: string }
  if (!body.ok || body.db !== 'up') {
    console.error(`✗ Smoke failed: body.ok=${body.ok} body.db=${body.db}`)
    process.exit(1)
  }
  console.log(`✓ Smoke OK — createApp boot + /health 200 + db up`)
}

main().catch((err) => {
  console.error(`✗ Smoke threw:`, err)
  process.exit(1)
})
```

**為何這個骨架：**
- Mirror 既有 `scripts/coverage-gate.ts` 的風格（`#!/usr/bin/env bun` shebang、top-level `async function main()`、明確 exit code、✓/✗ ASCII prefix）。
- 三層 fail gate：(1) `loadConfig()` throw（config schema 破壞）、(2) status !== 200（plugin wiring / DB down 破壞）、(3) body 檢查（防 status-but-body-wrong 的 silent drift）。
- 不引入新依賴、不改 `createApp` 簽名、不新增 `src/` 檔案。

### §3. ci.yml 注入位置

**推薦：加在現有 `test` job 尾端（接在 `Migration drift check` 之後、`Upload coverage artifact` 之前）。**

| 方案 | 能及早失敗？ | Install / cache 成本 | Postgres service 共用？ | Check UI 顆粒 | 推薦度 |
|------|-------------|---------------------|------------------------|--------------|--------|
| **(a) test job 尾端（drift 之後）** | 中（要等 test + drift 完） | 0（完全 reuse test job 的 install + postgres） | ✓ 免開新 service | 與 test 合併成 1 check item（`CI / Test + coverage gate + migration drift`）；step 名獨立可辨 | ⭐⭐⭐ **推薦** |
| (b) 獨立第 4 個 parallel job | 快（與其他 3 個並行） | +1 install（~10-30s 若 cache hit） + 需要開 Postgres service | ✗ 需獨立宣告 services.postgres（image / env / healthcheck 全 copy） | 多一個獨立 check item，UI 最清楚 | ⭐⭐ 次佳 |
| (c) sequential 最終 gate（`needs: [lint, typecheck, test]`） | 最慢（linear） | +1 install + 需 Postgres | ✗ 需獨立 service | 獨立 check item | ⭐ 拒絕 |

**為何選 (a)：**
- **共用 postgres service 零成本**：ci.yml test job 已有 `services.postgres` + `DATABASE_URL` env + `Apply migrations` step；smoke step 接在 drift 之後時 DB 已是 migrated 狀態、connection string 現成。若獨立 job 則要完整複製 18 行 service + env 宣告（ADR 0018 的「共用 Postgres」語義也會受挑戰）。
- **共用 install**：test job 已做 `bun install --frozen-lockfile`，smoke step 直接 `bun run smoke` 即可；獨立 job 每次要重新 install + cache restore（即便 cache hit 也 ~10-30s）。
- **延遲 trade-off 可接受**：加在 drift 之後、test 最後一環，**不影響 lint / typecheck parallel 進度**（那兩個仍並行）；只是 test job 本身多跑 ~1-2s。
- **Success criteria #1「4 個 check items」對應**：lint（1）+ typecheck（1）+ test-job-with-smoke（1）+ adr-check（1）= 4；smoke 併入 test job，該 check item 仍然 ✓/✗ 二元清楚。這符合 ROADMAP 第 1 條的「PR check summary 可看到 ≥4 check items 全綠」。

**為何拒絕 (b)：**
- 違反 ADR 0018「local + CI 共用單一 Postgres service」的精神（該 ADR 明文為了「onboarding friction」+「CI minute budget」）；開第 2 個 Postgres service 會讓 CI minute 增 ~30-60s。
- UI 多一個 check item 雖然視覺上清楚，但對 CI-04 的驗收「≥4 check items 全綠」沒有本質差異（4 vs 5 都通過）。

**為何拒絕 (c)：**
- Sequential gate 讓 linear CI 時間變成 `max(lint, typecheck) + test + smoke`，總時間拉長；而 fail-fast 能力沒有比 (a) 好（test 先跑還是 smoke 先跑，紅燈速度差不多）。
- 複雜度增加：workflow YAML 多一個 job、多一個 `needs:`、多一套 service 宣告。

**workflow YAML 片段預覽（planner 可直接採用）：**

```yaml
# 接在 ci.yml test job line 100-101 之間（Migration drift check 之後、Upload coverage 之前）
      - name: Smoke (createApp boot + /health 200)
        run: bun run smoke
```

一行即完成。env 沿用 test job 既有的 `DATABASE_URL` / `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` / `NODE_ENV` / `LOG_LEVEL` / `PORT`（⚠️ 注意 PORT 未在 test job env 宣告，但 ConfigSchema 要求 PORT 是 integer 1-65535 — 需補一行 `PORT: 3000` 在 test job env 區塊；詳見 §Implementation Risks）。

### §4. 五種 fail-mode 最小破壞 patch 設計

原則：每個 patch 只打到**一個 gate**、可一行 `git revert`、不污染 repo 歷史（因 D-05 的 sacrificial PR 會 close 不 merge）。

| # | Fail-mode | 最小 patch（diff 建議） | 會變紅的 job / step | 為何只打到這個 gate |
|---|-----------|------------------------|---------------------|---------------------|
| **1** | **Lint fail（biome）** | 在 `src/main.ts` 首行加 `var x = 1` | `CI / Lint (biome check)` | biome `recommended` 含 `noVar`；typecheck 不在意 var/let；bun test 不掃 src/main.ts（除了冒煙 import chain，但 main.ts 本身無 test） |
| **2** | **Typecheck fail（tsc）** | 在 `src/main.ts` 加 `// @ts-expect-error` 到下一行正確的語句上方（e.g. `// @ts-expect-error\nconst config = loadConfig()`） | `CI / Typecheck (tsc --noEmit)` | tsc `--noEmit` 對「unused @ts-expect-error」會 fail（TS2578: Unused '@ts-expect-error' directive）；biome 不會擋；bun test 執行時 bun 會忽略 @ts-expect-error directive（runtime 無差） |
| **3** | **Test fail（bun:test）** | 刪/改 `tests/unit/health/check-health.usecase.test.ts`（或任一必經 test）中的一個 assertion — 例如把 `expect(status.ok).toBe(true)` 改成 `expect(status.ok).toBe(false)` | `CI / Test + coverage gate + migration drift` → `Test (with coverage)` step | 只改 test file 不改 src；lint 可能會抓到（視 rule）但不擋；typecheck 會過（test file 本身 compile 過）；drift 無觸碰；smoke 無觸碰 |
| **4** | **Drift fail（schema 未跑 generate）** | 手動編輯 `src/auth/infrastructure/better-auth/schema.ts`（或任一 drizzle schema 檔）加一個 nullable column e.g. `phoneNumber: text('phone_number')`，但**不執行 `bun run db:generate`**（不產生對應 migration） | `CI / Test + coverage gate + migration drift` → `Migration drift check` step | 因 drift step 跑 `db:generate --name=ci-drift` 然後 `git status --porcelain drizzle/` 檢查 — 有 untracked migration 就 fail；test step 會在 drift 之前，若 test 跑真 DB 可能 fail 在 migration 不符 schema 前（要確認 order — ci.yml 順序是 migrate → test → coverage gate → drift，所以 test 有可能先紅）|
| **5** | **Smoke fail（config/wiring 破壞）** | 在 `src/bootstrap/config.ts` 的 `ConfigSchema` 新增 `ADMIN_EMAIL: Type.String({ minLength: 1 })` — CI 環境未設此變數，`loadConfig()` throw → smoke script 非零 exit | `CI / Test + coverage gate + migration drift` → `Smoke (createApp boot + /health 200)` step | Config schema 改動 tsc 仍過（Static 型別會更新）；biome 不擋；test 會部分 fail（因 `tests/integration/app-skeleton-smoke.test.ts` 的 `TEST_CONFIG` 未含 ADMIN_EMAIL，型別不符 tsc 會 fail） — **landmine**：這個破壞會同時打到 typecheck 和 smoke，違反隔離。**修正建議（§Implementation Risks §R3）**：改用 **runtime-only 破壞**，例如在 `createApp` 頂端加一行 `if (process.env.SMOKE_TRIPWIRE === '1') throw new Error('smoke tripwire')`，然後在 fail-mode #5 的 patch 把 workflow YAML 的 smoke step 改成 `env: SMOKE_TRIPWIRE: '1'` 再 `run: bun run smoke`。這樣 tsc / biome / test 全綠，只 smoke 紅 |

**關於 Fail-mode #4 的 ordering landmine：** ci.yml `test` job step 順序為 Apply migrations → Test → Coverage gate → Migration drift check。若破壞 schema 但不補 migration，**Apply migrations step** 不會抓到（它 run 既有 migrations，對新 column 無感），**Test step 才可能第一個紅**（因 Drizzle 查詢會返回未預期結果 / 或 TypeScript type 不符）。也就是 fail-mode #4 的紅燈**可能出現在 test step 而非 drift step**。

**Planner 決策建議**：fail-mode #4 應選「改 schema 加 column、既無 migration 也不動程式碼查詢路徑」（讓 test 仍通過），這樣紅燈會**只出現在 drift step**。例如加一個**未被任何 code 引用**的 column（e.g. `lastSeenAt: timestamp('last_seen_at')`），test 不會 query 這個 column → test pass → drift fail。

**修正後的 fail-mode #5（推薦方案）：**

Patch A — 改 `src/bootstrap/app.ts`（在 createApp 頂端加 tripwire）：
```typescript
export function createApp(config: Config, deps: AppDeps = {}) {
  if (process.env.SMOKE_TRIPWIRE === '1') {
    throw new Error('Smoke tripwire: createApp intentionally failed for fail-mode #5')
  }
  // ... existing code unchanged
```

Patch B — 改 `.github/workflows/ci.yml` smoke step（加 env inline）：
```yaml
      - name: Smoke (createApp boot + /health 200)
        env:
          SMOKE_TRIPWIRE: '1'
        run: bun run smoke
```

這樣 tsc / biome / test 全綠（env 未設 tripwire → createApp 正常），只有 CI 的 smoke step 設 env 觸發 throw → smoke script 非零 exit → 該 step 紅。

### §5. Plan 2 sacrificial PR branch 命名 + force-push 流程

**推薦 branch 命名**：`phase-6-failmode-demo`（明示用途、非 milestone 正式 branch、close 後可刪）。

**推薦 flow：**

```bash
# 前置：Plan 1 已 merge 進 main
git checkout main && git pull
git checkout -b phase-6-failmode-demo

# 第一次破壞（以 lint fail 為例）
# 直接編 src/main.ts 加 `var x = 1`
git add src/main.ts
git commit -m "ci: [phase-6] fail-mode demo #1 — lint fail (WILL NOT MERGE)"
git push -u origin phase-6-failmode-demo
gh pr create --title "[Phase 6 Plan 2] Fail-mode demo PR (DO NOT MERGE)" \
             --body "Sacrificial PR for CI-05 evidence. Force-pushed ×5. Will be closed not merged. See plan SUMMARY for fail-mode matrix."

# 等 CI finish，抓 check URL 記錄
gh pr checks --watch
gh pr checks --json name,state,link,workflow > /tmp/failmode-01.json

# 回滾 + 下一次破壞（typecheck fail）
git reset --hard HEAD~1
# 編 src/main.ts 加 `// @ts-expect-error` + 下一行正確語句
git add src/main.ts
git commit -m "ci: [phase-6] fail-mode demo #2 — typecheck fail (WILL NOT MERGE)"
git push --force-with-lease

# 重複 watch + record × 5 次
```

**為何 `--force-with-lease` 而非 `--force`**：`--force-with-lease` 會先驗證 remote 沒有被其他人推過新 commit 才 force（即便本 sacrificial PR 是單人操作，養成習慣避免誤砍）— 對本 phase 是 nice-to-have，不是 must。

**為何每次 `git reset --hard HEAD~1`**：維持每次 PR 只有 1 個 commit 的歷史，SUMMARY 表格的 5 個 check URL 各自對應 1 個 force-push；若用 commit chain（`git commit --amend` 變）會讓 PR timeline 顯示「5 次 force-push 同一個 commit hash 被改」這樣比較亂。

**Close 後清理：**
```bash
gh pr close <PR_NUMBER> --comment "Fail-mode matrix evidence captured — closing per plan"
git checkout main
git branch -D phase-6-failmode-demo
git push origin :phase-6-failmode-demo
```

### §6. `actions/cache@v4` + `setup-bun@v2` 對 smoke step 的延遲

**結論：若採推薦方案 §3(a)（smoke 併入 test job），smoke step 本身 install / cache 延遲 = 0（完全 reuse）。smoke script 本身執行延遲 = `createApp` + `Value.Decode` + `/health` 一次 request + postgres SELECT 1 ≈ 200-500ms。**

對比獨立 parallel job（§3 option b）：
- `actions/checkout@v4`：~1-2s
- `oven-sh/setup-bun@v2`：~2-4s（首次 download bun binary / cache hit 時 ~1s）
- `actions/cache@v4` restore：~3-8s（依 bun.lock cache 大小）
- `bun install --frozen-lockfile`（cache hit）：~3-5s
- **合計獨立 job overhead**：~10-20s before smoke script 跑

**決策**：推薦方案已免除這個 overhead，不需進一步優化。唯一 action item — ci.yml 各 job 的 cache key 目前是 `${{ runner.os }}-bun-${{ hashFiles('bun.lock') }}`，若 smoke 併入 test job 則完全 reuse；若未來拆成獨立 job，記得加 `restore-keys` fallback（ci.yml 已有此 pattern，line 28 / 45 / 80）。

---

## Validation Architecture

> Phase 6 的**「交付物」不是 source code 行為，而是 GitHub Actions 外部狀態 + SUMMARY 內嵌的 evidence URL**。因此 validation signal 的本質不是「unit test 跑過」，而是「外部可複查的 CI run 狀態」。

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **GitHub Actions CI**（外部狀態驗收）+ bun:test（內部 script smoke-health 可選 unit cover） + bash verification（`gh pr checks --json`） |
| Config file | `.github/workflows/ci.yml`（無改 test framework 本身） |
| Quick run（local） | `bun run smoke`（Plan 1 local sanity）；`bun run lint && bun run typecheck && bun run test:ci`（complete pre-push check） |
| Full suite（CI-driven） | PR push → wait `gh pr checks --watch` → 檢查四個 check items state |
| Phase gate | 兩組 check URL 都必須貼進各自 plan SUMMARY（Plan 1 綠 URL × 1，Plan 2 紅 URL × 5） |

### Phase Requirements → Validation Signal Map

| REQ ID | Behavior to validate | Signal | Automated command | Source of truth |
|--------|----------------------|--------|-------------------|----------------|
| CI-04 | 非 master 分支 PR 首跑四 check items 全綠 | PR 頁面 Checks tab 全 ✓；`gh pr checks --json` 每 item `state: "success"` | `gh pr checks <PR_NUM> --json name,state,link` | GitHub API 上對應的 check run resources（持久 URL） |
| OBS-01（green path）| smoke step 在上述同一 PR run 中也 green | CI log 含 `✓ Smoke OK — createApp boot + /health 200 + db up`；test job 的 Smoke step 顯示 ✓ | `gh run view <RUN_ID> --log \| grep 'Smoke OK'` | GitHub Actions run log（保留 ≥90 天） |
| CI-05 #1 lint | 刻意 lint fail 讓 lint job red | `gh pr checks --json`: `CI / Lint (biome check)` state=`failure`；其他三個 state=`success`（除了 adr-check 永遠 pass） | 同上 | 第 1 次 force-push 對應的 check run URL |
| CI-05 #2 typecheck | @ts-expect-error 誤用讓 typecheck fail | `CI / Typecheck` state=`failure`；其他 success | 同上 | 第 2 次 |
| CI-05 #3 test | 改 assertion 讓 test fail | `CI / Test + coverage gate + migration drift` state=`failure`，log 顯示 `Test (with coverage)` step 紅 | `gh run view --log \| grep -A 5 'FAIL'` | 第 3 次 |
| CI-05 #4 drift | schema 未補 migration 讓 drift fail | 同上 check state=`failure`，log 顯示 `Migration drift check` step 紅（含 `::error::Schema drift detected`） | `gh run view --log \| grep 'Schema drift detected'` | 第 4 次 |
| CI-05 #5 smoke | tripwire 讓 createApp throw → smoke fail | 同上 check state=`failure`，log 顯示 `Smoke (createApp boot + /health 200)` step 紅（含 `✗ Smoke threw`） | `gh run view --log \| grep 'Smoke threw'` | 第 5 次 |

### Sampling Rate

- **Per task commit**（Plan 1 實作階段）：`bun run lint && bun run typecheck && bun run test:ci && bun run smoke`（local 全跑 ~20s，確保 push 到 CI 會綠）。
- **Per plan merge**（Plan 1 merge 前）：PR 實跑一輪 CI 全綠 + smoke step log 含 `✓ Smoke OK` 訊息 + check URL 已記錄進 `06-01-SUMMARY.md`。
- **Per fail-mode iteration**（Plan 2 每次 force-push）：等 `gh pr checks --watch` 完成 → 驗證**只有預期 job 紅**（其他三個綠） → check URL 記錄進 `06-02-SUMMARY.md`。
- **Phase gate**（ `/gsd-verify-work` 或 phase close 前）：
  - Plan 1 SUMMARY 含 1 個 green check URL
  - Plan 2 SUMMARY 含 5 行表格，每行一個 red check URL + 對應 fail-mode + 預期 red step name
  - `docs/decisions/` 有無新 ADR（若無，SUMMARY 明示「no new ADR」）
  - Plan 2 sacrificial PR 已 close（用 `gh pr view <PR> --json state` 驗 state=`CLOSED`）

### Wave 0 Gaps

- [ ] **`scripts/smoke-health.ts`** — 新檔，Plan 1 wave 0 task 建立；需含 `#!/usr/bin/env bun` shebang + top-level async main + 明確 ✓/✗ output。
- [ ] **`package.json` scripts 區塊** — 新增 `"smoke": "bun run scripts/smoke-health.ts"`；為 Plan 1 wave 0 的 adjacent edit。
- [ ] **`.github/workflows/ci.yml`** — test job 加 `Smoke` step + 補 test job env 區塊的 `PORT: 3000`（詳見 §Implementation Risks R1）。
- [ ] **`tests/unit/smoke-health.test.ts`**（選配）— 若要 local unit cover smoke 邏輯分支（200 / 非 200 / throw），可加一個 bun:test；但本 phase 主 validation 是 CI 外部狀態而非 unit cover，**建議不加**以免把 phase 膨脹。

---

## Implementation Risks

### R1. `PORT` env missing in test job（blocks smoke step）

**症狀**：ConfigSchema 要求 `PORT: Type.Integer({ minimum: 1, maximum: 65535 })`，而 ci.yml test job 的 env 區塊只有 `DATABASE_URL` / `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` / `NODE_ENV` / `LOG_LEVEL` — **沒有 PORT**。smoke script 跑 `loadConfig()` 會 throw「PORT is required」。

**修正**：Plan 1 的 ci.yml patch 必須同時加 `PORT: 3000` 到 test job env 區塊（line 65-70 之間）。planner 要在 plan task 明列這條。

**背書**：`src/bootstrap/config.ts` line 19 `PORT: Type.Integer({ minimum: 1, maximum: 65535 })` 無 default、無 optional；`src/main.ts` 用 `app.listen(config.PORT, ...)` — 沒有 PORT 會在 load 階段就 throw。

### R2. Plan 2 force-push 踩 `cancel-in-progress` landmine（evidence 流失）

**症狀**：若在前一次 CI run 尚未 finish 時立刻 force-push 下一個 fail-mode，前一次 run 被標記 `cancelled`（非 `failure`），失去「fail-mode 有擋 PR」的證據。

**修正**：Plan 2 的 SOP 必須寫明「每次 force-push 前必須 `gh pr checks --watch` 或目視確認上一次 run 進入終態 `failure`」。建議把這條做成 plan task 的 verification 步驟（e.g. acceptance criteria「第 N 次 force-push 後，`gh pr checks --json \| jq '.[] \| select(.state != \"success\")'` 回傳至少 1 個 failure」）。

### R3. Fail-mode #5（smoke fail）若用 Config schema 擴張會同時打到 typecheck

**症狀**：原先寫的 patch「在 ConfigSchema 加 `ADMIN_EMAIL` required field」會讓 `TEST_CONFIG` in `tests/integration/app-skeleton-smoke.test.ts` 型別不符（Static\<typeof ConfigSchema\> 多了一個 required property），tsc `--noEmit` fail。

**修正**：改用 **runtime-only 破壞**（§Technical Approach §4 Fail-mode #5 修正版），在 `createApp` 頂端加 `SMOKE_TRIPWIRE` env-gated throw，並在 workflow YAML 的 smoke step 設 `env: SMOKE_TRIPWIRE: '1'`。這樣 tsc / biome / test（未設 env）全綠，只 CI 的 smoke step 觸發。

### R4. adr-check workflow 與 lint job 「搶 parallel slot」誤解

**症狀（其實不是風險）**：有人可能以為 adr-check.yml 與 ci.yml lint/typecheck/test 會爭 GitHub Actions runner slot 導致 Phase 6 CI 慢。

**事實**：GitHub Actions 對 public repo 有 20 concurrent job limit、對 free tier private repo 有 20 job limit；本 repo 的 PR 上最多同時跑 4 個 job（lint / typecheck / test / adr-check），遠低於上限，實際上 4 個會一起並行 — **無 slot 爭奪**。這條不是風險，只是避免 planner 誤以為要把 smoke 拆獨立 job「為了提早 fail-fast」。

### R5. `bun run db:generate --name=ci-drift` 可能在 Plan 2 fail-mode #4 產生副作用

**症狀**：drift step 的 `bun run db:generate --name=ci-drift` 會在 `drizzle/` 寫新 migration file（這個行為是 drift 檢測的核心 — 若 porcelain non-empty 就 fail）。Plan 2 fail-mode #4 sacrificial PR 的 CI run 會留下一個 `drizzle/xxxx_ci-drift.sql` 檔在 **CI 的 workspace**（不是 commit 到 branch），finish 後 workspace 丟棄 — **不污染 repo**。

**實際風險低**：但 planner 要在 Plan 2 acceptance 明示「fail-mode #4 的破壞是 local edit schema.ts → commit → force-push；CI 會 auto-gen migration 但不 commit；close PR 時無需 manual cleanup」。

### R6. Smoke step 在 test job 尾端 — drift 失敗時 smoke 不會跑

**症狀**：ci.yml step order = migrate → test → coverage → drift → smoke。若 drift step fail（non-zero exit），後續 smoke step **不會執行**（GitHub Actions 預設 fail-fast per step）。Plan 2 fail-mode #4（drift fail）的 CI run 中 smoke step 會是 `skipped` 狀態。

**影響**：fail-mode #4 的「預期 red job/step」應明示「`Migration drift check` step red，`Smoke` step skipped」— 這是正確行為，不是 bug。

**反向校驗**：fail-mode #5（smoke fail）預期 drift 綠 / smoke 紅。因 drift 在 smoke 之前，drift 必須先綠才會走到 smoke；若 drift 先紅，fail-mode #5 無法 demonstrate 到 smoke gate — planner 要在 Plan 2 fail-mode #5 的 patch 明示「只動 src/bootstrap/app.ts（加 tripwire）和 ci.yml（設 env），不動 drizzle schema」。

### R7. ADR 0018「testcontainers deviation」的 Postgres service 對 smoke 的隱含依賴

**症狀（非風險，但 planner 要理解）**：ADR 0018 明文 CI 用 `services.postgres` with `postgres:16-alpine` — smoke step 在 test job 尾端會自然拿到這個 service；若未來有人把 postgres service 移除（e.g. 為了加速 lint/typecheck job），smoke step 會無聲 fail。**本 phase 不會動 ADR 0018，但 planner 可在 Plan 1 SUMMARY 或新增的 ADR（若寫）中 cross-reference**，讓後人知道 smoke step 的 DB 依賴源頭。

### R8. Smoke step 對 DATABASE_URL 的隱含要求

**症狀**：推薦方案（in-process smoke）走真 `DrizzleDbHealthProbe` → `SELECT 1` → 需要 Postgres 可達。CI 的 test job 有 postgres service，`DATABASE_URL=postgres://postgres:postgres@localhost:5432/rigging_test` — 可達。

**風險**：Plan 2 fail-mode #5 的 tripwire 是在 DB connection 之前就 throw（createApp 頂端），所以不受 DB 影響；但若未來有人把 tripwire 位置挪到 plugin wiring 裡面（例如 healthModule 內），且 test 有跑 `createApp`（e.g. 測 `/health` 200），那次的 test 也會紅 — **smoke fail-mode 不能與 test cover 到的 code path 衝突**。推薦方案已規避。

### R9. Plan 1 PR 觸發 adr-check 的判定

**症狀**：Plan 1 新增 `scripts/smoke-health.ts` + 改 `ci.yml` + 改 `src/bootstrap/app.ts`（若選 tripwire 方案）— 這些**不需要 ADR**（屬 Tier 3 convention + Tier 1 bootstrap 的非 boundary-touching 擴張）。PR body 不勾 ADR required box，adr-check workflow 直接 early-return pass。

**行動項**：Plan 1 PR body template 應明示「This PR does NOT introduce a decision requiring ADR」 — 避免誤勾引發 adr-check fail（會多一筆 false negative check URL）。

---

## Recommended Reading for Planner

**必讀（Plan 1/2 撰寫前）**：
- `/Users/carl/Dev/CMG/Rigging/.planning/phases/06-ci-pipeline-green-run-smoke-validation/06-CONTEXT.md` — 六條結構 decision（D-01..D-06），特別是 D-03（Plan 1 acceptance 含 check URL）、D-05（單 sacrificial PR）、D-06（收嚴 5 種）
- `/Users/carl/Dev/CMG/Rigging/.github/workflows/ci.yml` — 現有 3 parallel jobs + drift 的完整 workflow；smoke step 注入點在 line 100-101 之間
- `/Users/carl/Dev/CMG/Rigging/.github/workflows/adr-check.yml` — adr-check trigger 邏輯；Plan 1 PR body 不可誤勾 ADR box
- `/Users/carl/Dev/CMG/Rigging/src/bootstrap/app.ts` — createApp 簽名 + synchronous return（ADR 0012 consequence）
- `/Users/carl/Dev/CMG/Rigging/src/bootstrap/config.ts` — ConfigSchema 精確 required fields（特別 PORT required → R1）
- `/Users/carl/Dev/CMG/Rigging/scripts/coverage-gate.ts` — smoke-health.ts 應 mirror 的風格（shebang + async main + 明確 exit + ✓/✗ prefix）
- `/Users/carl/Dev/CMG/Rigging/tests/integration/app-skeleton-smoke.test.ts` — **關鍵先例**：證明「in-process createApp + app.handle(new Request(...))」是 repo 既有 pattern
- `/Users/carl/Dev/CMG/Rigging/package.json` — smoke npm script 命名應對齊 `lint` / `typecheck` / `test:ci` / `coverage:gate` 風格

**ADR（Plan 設計時參照）**：
- `/Users/carl/Dev/CMG/Rigging/docs/decisions/0012-global-plugin-ordering.md` — **必讀 consequence 段**，明文「createApp synchronous / no DB pre-warm / /health validates DB at request time」— 這是 smoke step 技術合理性的背書
- `/Users/carl/Dev/CMG/Rigging/docs/decisions/0018-testcontainers-deviation-via-docker-compose.md` — CI Postgres service 的 adopted deviation；smoke step 若併入 test job 完全 reuse 此 service
- `/Users/carl/Dev/CMG/Rigging/docs/decisions/0009-rigidity-map.md` — Tier 3 convention 判定（smoke script 不需 ADR）

**Phase 5 歷史脈絡（Plan 1 evidence 對照）**：
- `/Users/carl/Dev/CMG/Rigging/.planning/phases/05-quality-gate/05-SUMMARY.md` §Plan Completion Matrix + §Manual Follow-ups 第 2 項「Push + PR — GitHub Actions workflow 首次實跑」— 這是本 phase Plan 1 直接承接的 deferred item

**選讀（僅在需要時）**：
- `/Users/carl/Dev/CMG/Rigging/tests/e2e/_helpers.ts` — 若考慮方案 §1(c)「reuse e2e harness」才需讀（本研究已拒絕此方案）
- `/Users/carl/Dev/CMG/Rigging/biome.json` — 若要挑 lint fail 用的規則精確命中，查 `recommended` 涵蓋範圍（`noVar` 已驗證會 fail）

---

## Assumptions Log

本研究中 **2 條 `[ASSUMED]`** 需 planner 或執行階段驗證：

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tsc --noEmit` 對「unused @ts-expect-error directive」會 fail（TS2578）[ASSUMED] | §Technical Approach §4 Fail-mode #2 | 若 tsconfig 未開對應 flag（e.g. 舊版 TS 需 `--strict` 或 `--useUnknownInCatchVariables`），fail-mode #2 不觸發；planner 在 Plan 2 實作時 local 試跑一次確認 `bun run typecheck` 紅 |
| A2 | ci.yml 目前 step 順序 migrate → test → coverage → drift → smoke 會讓 fail-mode #4（drift fail）在 test step **也** 紅（因 schema change 未有對應 migration，test 讀查會走過時 row → assertion 可能 fail）[ASSUMED] | §Implementation Risks R6 + §Technical Approach §4 Fail-mode #4 | 若 test 不被影響，fail-mode #4 只紅 drift step（符合預期）；若 test 也紅，planner 要在 Plan 2 fail-mode #4 patch 選「加未被任何 code 引用的 column」確保 test 不紅 |

所有其他 claim 都來自 repo 內既有檔案（`.github/workflows/ci.yml`、`src/bootstrap/*`、`scripts/coverage-gate.ts`、`tests/integration/app-skeleton-smoke.test.ts`、ADR 0012 / 0018 / 0009）或 GitHub Actions 官方文件（concurrency / gh CLI），屬 `[VERIFIED]` 或 `[CITED]`。

---

## Open Questions (RESOLVED)

1. **Plan 1 PR 是否要在 PR body 內附 smoke step 的預期 log snippet？**
   - What we know：D-03 要求 check URL 進 SUMMARY；D-04 要求 PR merge。
   - What's unclear：PR body 格式是否也要舉證 smoke 綠燈（除了 check URL 外）？
   - RESOLVED：PR body 寫一句「Smoke step expected log: `✓ Smoke OK — createApp boot + /health 200 + db up`」，check URL 只在 SUMMARY。已於 Plan 1 Task 3 PR body 模板採納。

2. **Plan 2 sacrificial PR 的 PR body 要不要提前宣告「DO NOT MERGE」？**
   - What we know：D-05 明定 close 不 merge；D-11-D concurrency 會 cancel 舊 run。
   - What's unclear：是否有 GitHub branch protection rule 會阻擋「no reviewer approval」的 PR merge？本 repo 未見 CODEOWNERS / branch protection config（無從 repo 內驗證）。
   - RESOLVED：Plan 2 PR title 前加「[DO NOT MERGE]」+ body 首行標 `<!-- phase-6-plan-2 sacrificial PR; will be closed, not merged -->`。已於 Plan 2 Task 1 明確採納。

3. **OBS-01 的「smoke fail 時 log 要長什麼樣」有無具體模板？**
   - What we know：REQUIREMENTS.md OBS-01 要求 fail-mode 驗證但沒規定 log 模板。
   - What's unclear：SUMMARY 記 check URL 就夠，或還要附 CI log 片段？
   - RESOLVED：SUMMARY 表格額外加一欄「預期 error line」（e.g. fail-mode #5 預期 `✗ Smoke threw: Error: Smoke tripwire...`），審計時可 `gh run view --log | grep <期望 line>` 快速驗證。Plan 2 Task 5 acceptance 已明示預期 log line。

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun runtime | local smoke script 試跑 | ✓（pinned 1.3.12 in ci.yml + AGENTS.md Tier 1） | 1.3.12 | — |
| Docker + docker-compose | local Postgres for smoke DB dependency | ✓（ADR 0018 locks；docker-compose.yml in repo root） | postgres:16-alpine | — |
| `gh` CLI | Plan 1/2 PR ops + check URL capture | **需在 local 環境確認**（executor 要跑 `gh auth status`）；CI 內**不需要** | — | Fallback: 用 GitHub UI 手動抓 check URL 貼 SUMMARY |
| GitHub Actions runner (ubuntu-latest) | CI 執行 | ✓（workflow 已定） | — | — |
| Postgres service in CI | smoke step 對 `/health` 走真 DB | ✓（ci.yml test job services.postgres，ADR 0018） | postgres:16-alpine | — |
| `git push --force-with-lease` / `git push --force` | Plan 2 sacrificial PR 流程 | ✓（內建 git 命令） | — | — |

**Missing dependencies with no fallback:** 無。所有依賴都在 repo 鎖定或內建。

**Missing dependencies with fallback:** `gh` CLI — 若 executor 本機未裝 / 未登入，仍可用 GitHub web UI 手動抓 check URL（慢 ~10 倍但可行）。

---

## Sources

### Primary (HIGH confidence — repo 內 canonical 檔案直讀)

- `/Users/carl/Dev/CMG/Rigging/.github/workflows/ci.yml`（v1.0 Phase 5 Plan 05-03 commit `f546f2e`）— 3 parallel jobs + drift + concurrency
- `/Users/carl/Dev/CMG/Rigging/.github/workflows/adr-check.yml` — D-16 ADR required gate
- `/Users/carl/Dev/CMG/Rigging/src/bootstrap/app.ts` — createApp signature + plugin chain + synchronous return
- `/Users/carl/Dev/CMG/Rigging/src/bootstrap/config.ts` — ConfigSchema required fields（含 PORT）
- `/Users/carl/Dev/CMG/Rigging/src/health/*`（module / controller / usecase / probe）— /health 200/503 語義 + DrizzleDbHealthProbe `SELECT 1`
- `/Users/carl/Dev/CMG/Rigging/tests/integration/app-skeleton-smoke.test.ts` — in-process `app.handle(new Request(...))` 先例
- `/Users/carl/Dev/CMG/Rigging/scripts/coverage-gate.ts` — dedicated script 風格
- `/Users/carl/Dev/CMG/Rigging/package.json` — npm script 命名慣例
- `/Users/carl/Dev/CMG/Rigging/biome.json` — lint rule scope（`recommended` 含 noVar）
- `/Users/carl/Dev/CMG/Rigging/docs/decisions/0012-global-plugin-ordering.md` — plugin chain + createApp sync + /health at request time
- `/Users/carl/Dev/CMG/Rigging/docs/decisions/0018-testcontainers-deviation-via-docker-compose.md` — CI Postgres service 設計
- `/Users/carl/Dev/CMG/Rigging/docs/decisions/0009-rigidity-map.md`（via AGENTS.md 引用）— Tier 1/2/3 分類
- `/Users/carl/Dev/CMG/Rigging/.planning/phases/05-quality-gate/05-SUMMARY.md` — Phase 5 deferred item 「CI 首 run」接承

### Secondary (HIGH confidence — GitHub Actions 官方文件)

- [GitHub Actions — Control the concurrency of workflows and jobs](https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs) — `concurrency.cancel-in-progress: true` 對 pull_request 事件的精確語義（同 `github.ref` 共享 group、新 push cancel 舊 run、cancelled ≠ failure）
- [GitHub CLI manual — gh pr checks](https://cli.github.com/manual/gh_pr_checks) — `--watch` / `--json` / check URL 取得方式
- [Elysia — Unit Test Patterns](https://elysiajs.com/patterns/unit-test) — `app.handle(new Request(...))` 是 first-class test primitive
- [futurestud.io — GitHub Actions Limit Concurrency](https://futurestud.io/tutorials/github-actions-limit-concurrency-and-cancel-in-progress-jobs) — concurrency 實務範例驗證

### Tertiary (MEDIUM confidence — 需 planner 於執行階段二次驗證)

- A1 [ASSUMED]：`tsc --noEmit` 對 unused `@ts-expect-error` 會 fail — 官方文件語義為真但本 repo tsconfig 實際行為需 local `bun run typecheck` 跑一次確認
- A2 [ASSUMED]：fail-mode #4（schema drift）是否會**同時**讓 test step 紅 — 取決於選哪個 column 破壞，需 executor 實作時微調

---

## Metadata

**Confidence breakdown:**
- Standard stack / repo inventory: **HIGH** — 所有 src / workflow / ADR / scripts 都直讀 verified
- Smoke step 技術方案（§1-3）: **HIGH** — in-process pattern 在 repo 已有 `tests/integration/app-skeleton-smoke.test.ts` 先例，Elysia 官方 pattern 背書
- Fail-mode 破壞 patch（§4）: **MEDIUM** — A1 / A2 需 local 驗證；smoke fail-mode 的 tripwire 方案無先例但邏輯推演直接
- GitHub Actions concurrency 語義（§Domain Investigation §3 + R2）: **HIGH** — 官方文件直接 cite
- Plan 2 sacrificial PR 流程（§5）: **HIGH** — gh CLI 官方文件 + git 標準命令

**Research date:** 2026-04-20
**Valid until:** 2026-05-20（30 天；若期間 Elysia 1.5 / Bun 1.4 發布改動 app.handle 或 `.mount` 行為，需重驗 §Technical Approach §1）

---

## RESEARCH COMPLETE

**Phase:** 6 — CI Pipeline Green-Run & Smoke Validation
**Confidence:** HIGH（2 條 MEDIUM 標記為 Assumptions A1/A2，planner 執行時會 local 驗證）

### Key Findings

1. **In-process smoke 是首選** — `tests/integration/app-skeleton-smoke.test.ts` 已證明 `createApp(...).handle(new Request(...))` 是 repo 既有 first-class pattern，`/health` 200 對 OBS-01「真 HTTP」寬解讀完全成立；cross-process `bun + curl` 方案無額外價值且帶來 race condition。
2. **Smoke step 併入既有 test job 尾端（drift 之後）** — 零新 install、零新 Postgres service、省 CI minute、不違反 ADR 0018；一行 YAML 即完成（`bun run smoke`）。
3. **Fail-mode #5 smoke 要用 runtime tripwire（env-gated throw）** — 若用 ConfigSchema 擴張會同時打到 typecheck，破壞「一次破壞一個 gate」的隔離；tripwire 方案 tsc/biome/test 全綠，只 smoke 紅。
4. **Plan 2 force-push 必須等每次 CI finish 再下一次** — ci.yml `concurrency.cancel-in-progress: true` 會把 in-progress run 砍成 `cancelled`，這樣拿不到 `failure` 狀態的 check URL；evidence 會流失。
5. **無新 ADR 需要** — smoke script 屬 Tier 3 convention；不改 plugin chain、不改 createApp 簽名、不破壞 Rigidity Map Tier 1。SUMMARY 明示「no new ADR」即可。
6. **PORT env 遺漏是隱含 landmine** — 現 ci.yml test job env 缺 `PORT`，smoke script 會在 `loadConfig()` throw；Plan 1 必須補 `PORT: 3000`。
7. **check URL 用 `gh pr checks --json name,state,link` 結構化取得** — 貼進 SUMMARY 時格式穩定，審計 friendly。

### File Created

`/Users/carl/Dev/CMG/Rigging/.planning/phases/06-ci-pipeline-green-run-smoke-validation/06-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Smoke step 技術方案 | HIGH | Repo 既有先例 + Elysia 官方 pattern |
| ci.yml 注入位置 | HIGH | ADR 0018 + 既有 service reuse 邏輯直接 |
| Fail-mode #1/#2/#3/#4 patches | MEDIUM | A1/A2 需 local 驗證最終行為 |
| Fail-mode #5 smoke patch（tripwire 方案）| HIGH | 邏輯推演 + 規避所有 side channel |
| GitHub Actions concurrency + force-push 語義 | HIGH | 官方文件 cite |
| Plan 2 sacrificial PR 流程 | HIGH | 標準 gh CLI + git 操作 |

### Open Questions

1. Plan 1 PR body 是否附 smoke log snippet（除了 check URL）— 建議附 1 行期望 log，planner 自由決定
2. Plan 2 sacrificial PR 是否需 `[DO NOT MERGE]` 前綴 — 建議加，防誤 merge
3. SUMMARY 表格是否加「預期 error line」欄位 — 建議加，審計快

### Ready for Planning

研究完成，planner 可依 §Technical Approach §1-6 推薦方案 + §Implementation Risks R1-R9 撰寫 Plan 1（Green + smoke）與 Plan 2（Fail-mode matrix）。§Validation Architecture 的 signal map 可直接化為 plan acceptance criteria。
