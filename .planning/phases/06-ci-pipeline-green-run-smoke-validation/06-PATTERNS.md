# Phase 6: CI Pipeline Green-Run & Smoke Validation — Pattern Map

**Mapped:** 2026-04-20
**Files analyzed:** 3 （1 new + 2 modified；Plan 2 fail-mode patches 刻意不納入 pattern mapping，因為是 sacrificial 不 merge）
**Analogs found:** 3 / 3 （全 exact match — repo 內有可直接對齊的先例）

---

## File → Analog Mapping

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `scripts/smoke-health.ts`（NEW） | CI tooling / smoke script | request-response（in-process Fetch） + exit-code | `scripts/coverage-gate.ts` | **exact**（同目錄、同 role、同 exit-code 風格；差別僅在「驗 HTTP 200」vs「驗 coverage %」） |
| `.github/workflows/ci.yml`（MODIFIED） | CI workflow YAML | event-driven（GitHub Actions on `pull_request`） | 本檔既有 `test` job（line 49-109） | **exact**（注入點就在同 job 尾端；env/service/install 全部 reuse） |
| `package.json`（MODIFIED） | Manifest / scripts entry | N/A（宣告式） | 本檔既有 `"coverage:gate"` / `"test:ci"`（line 20-22） | **exact**（命名慣例與 shape 完全沿用） |

**Canonical reference（非 merge 目標，但 smoke script 的技術模型直接複製自此）：**
- `tests/integration/app-skeleton-smoke.test.ts` — in-process `createApp + app.handle(new Request(...))` 的 first-class 先例。smoke-health.ts 要做的事是這個 test 的「單 request、無 test runner 包裝、exit-code 版」。

---

## Code Excerpts

### 1. `scripts/smoke-health.ts` ← analog `scripts/coverage-gate.ts`

**檔名：** `/Users/carl/Dev/CMG/Rigging/scripts/coverage-gate.ts`

#### 1a. Shebang + file-level JSDoc（line 1-12）

```typescript
#!/usr/bin/env bun
/**
 * coverage-gate.ts — Phase 5 per-tier 80% coverage enforcement (D-13-B / RESEARCH §1)
 *
 * Reads coverage/lcov.info (produced by `bun test --coverage --coverage-reporter=lcov`),
 * enumerates expected source files via Bun.Glob from the target tiers, and exits 1 if
 * any file or aggregate is below THRESHOLD% lines OR functions.
 *
 * Critical (RESEARCH Pitfall 1): Bun coverage OMITS files with zero test coverage from
 * the LCOV report. Naively iterating LCOV `SF:` blocks would let an entirely untested
 * module silently pass. This gate enumerates the filesystem and treats absent files as 0%.
 */
```

**Copy pattern：** smoke-health.ts header 照抄這個 shape —
- 第 1 行：`#!/usr/bin/env bun` shebang
- 第 2-12 行：`/** ... */` 段落式 JSDoc，首行 `檔名 — 目的（對應 Requirement / Phase / RESEARCH §）`，接 2-3 行說明「讀什麼、做什麼、exit 條件」。
- 若有「landmine / critical note」用一整段另起解釋（對應 RESEARCH R1 的 PORT 補齊、R6 的 drift-fails-skip-smoke 行為）。

#### 1b. Imports + constants（line 13-17）

```typescript
import { existsSync, readFileSync } from 'node:fs'
import { Glob } from 'bun'

const LCOV_PATH = 'coverage/lcov.info'
const THRESHOLD = 80
```

**Copy pattern：** smoke-health.ts imports 應為：
```typescript
import { createApp } from '../src/bootstrap/app'
import { loadConfig } from '../src/bootstrap/config'
```
- 使用相對路徑（`../src/...`），**不要**用 `@/*` path alias（repo 其他 `scripts/` 檔無前例；tsconfig paths 雖有但此處未使用）。
- 無 semicolons（biome `semicolons: asNeeded`）；single quotes（biome `quoteStyle: single`）。
- Constants 用 `const UPPERCASE_SNAKE` 宣告在 top-level（本檔定義 `LCOV_PATH` / `THRESHOLD` / `TIER_GLOBS`）— 若 smoke-health.ts 需要常數（e.g. `const HEALTH_URL = 'http://localhost/health'`），沿用此位置與命名。

#### 1c. Top-level async main + exit-code 風格（line 88-144）

```typescript
async function main() {
  if (!existsSync(LCOV_PATH)) {
    console.error(
      `✗ ${LCOV_PATH} not found — did you run 'bun test --coverage --coverage-reporter=lcov'?`,
    )
    process.exit(2)
  }
  // ... compute ...

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} file(s) below ${THRESHOLD}% threshold:`)
    failures.forEach((f) => console.error(f))
    process.exit(1)
  }
  if (totalLinePct < THRESHOLD || totalFuncPct < THRESHOLD) {
    console.error(`\n✗ Aggregate below ${THRESHOLD}%`)
    process.exit(1)
  }
  console.log(`\n✓ Coverage gate passed (≥${THRESHOLD}%)`)
}

main()
```

**Copy pattern：** smoke-health.ts 的骨架（RESEARCH §2 已給完整版本，此處標註哪一行對齊 analog 的哪條慣例）：

| smoke-health.ts 行為 | 對齊 coverage-gate.ts 行號 | 備註 |
|----------------------|----------------------------|------|
| `async function main() { ... }` 包成單一 async function | line 88 | 不用 IIFE；function name 就叫 `main` |
| 失敗訊息用 `console.error` + `✗` prefix | line 90-94 / 133-138 | `✗` 是 U+2717（Ballot X）非 ASCII X |
| 成功訊息用 `console.log` + `✓` prefix | line 141 | `✓` 是 U+2713（Check Mark） |
| `process.exit(0)` 隱式（end of function） / `process.exit(1)` 顯式 fail | line 135 / 139 | coverage-gate 用 exit(2) 表示「pre-condition missing」；smoke 建議僅 0/1 兩種（RESEARCH §2 骨架） |
| 底部呼叫 `main()` 觸發執行 | line 144 | coverage-gate 未加 `.catch(...)`；smoke-health 建議加 `.catch((err) => { console.error('✗ Smoke threw:', err); process.exit(1) })`（RESEARCH §2），因 smoke 比 coverage-gate 多一層「createApp throw」可能性 |

**⚠️ 差異警告：** coverage-gate.ts 的 `main()` 底部**不加** `.catch` — unhandled rejection 會讓 bun process 非零 exit 但 stack trace 不會被 prefix 成 `✗`。smoke-health.ts **需要**顯式 `.catch`（RESEARCH §2 骨架已給）以便 CI log 有一致的 `✗ Smoke threw:` 前綴，方便 Plan 2 fail-mode #5 的 `gh run view --log | grep 'Smoke threw'` 驗收。

---

### 2. `scripts/smoke-health.ts` ← canonical reference `tests/integration/app-skeleton-smoke.test.ts`

**檔名：** `/Users/carl/Dev/CMG/Rigging/tests/integration/app-skeleton-smoke.test.ts`

#### 2a. in-process `createApp + app.handle(Request)` 核心模式（line 28-45）

```typescript
describe('app skeleton smoke (real createApp)', () => {
  test('/health → 200 on DB up + x-request-id UUID v4 echoed', async () => {
    const app = createApp(TEST_CONFIG, {
      db: fakeDb,
      authInstance: createFakeAuthInstance(),
      probe: stubProbe(() => Promise.resolve('up')),
    })
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; db: string; checkedAt: string }
    expect(body.ok).toBe(true)
    expect(body.db).toBe('up')
    // ...
```

**Copy pattern（重要技術 primitive）：**
- 建 app：`const app = createApp(config)` — smoke-health.ts 走 production 路徑，**不傳 deps**（用真 DrizzleDbHealthProbe、真 postgres service SELECT 1）；這和 integration test 的 stubbed probe 模式相反。
- 發 request：`const res = await app.handle(new Request('http://localhost/health'))` — URL 的 host 部分無意義（in-process），但 path 必須是 `/health`。
- 驗 status：`if (res.status !== 200) { exit 1 }`。
- 驗 body：`const body = (await res.json()) as { ok: boolean; db: string }`；assert `body.ok === true && body.db === 'up'`（防「status 對但 body 亂」的 silent drift，對應 RESEARCH §2 骨架三層 fail gate 的第 3 層）。

**⚠️ 生產模式 vs 測試模式差異：**

| Aspect | integration test (`app-skeleton-smoke.test.ts`) | smoke-health.ts 要做的 |
|--------|------------------------------------------------|------------------------|
| config | 硬寫 `TEST_CONFIG` object（line 10-17） | 呼叫 `loadConfig()` 讀 CI env（含 CI workflow 的 `DATABASE_URL` / `PORT` / `BETTER_AUTH_SECRET` 等） |
| deps.db | 傳 `fakeDb = {} as never` | 不傳（讓 createApp 內部走 `createDbClient(config)` 實建 connection） |
| deps.probe | 傳 `stubProbe(...)` 假裝 up/down | 不傳（讓 createHealthModule 內部建真 `DrizzleDbHealthProbe(db)` → SELECT 1） |
| deps.authInstance | 傳 `createFakeAuthInstance()` | 不傳（讓 createAuthModule 內部建真 BetterAuth instance） |
| 執行框架 | `bun test` + `describe/test/expect` | 裸 `bun run scripts/smoke-health.ts` + `process.exit` |

smoke-health.ts **必須**走完整 prod 路徑（無 stub），否則失去驗證 ADR 0012 plugin chain + 真 DB 連線的意義（RESEARCH §1 / OBS-01 核心）。

#### 2b. Synchronous factory guarantee（line 123-134）

```typescript
test('createApp(config, deps) — factory is synchronous (no thenable)', () => {
  // Guard: createApp must NOT be async. We check that the returned value is not a Promise by
  // probing for a .then property at runtime. Elysia instances have no .then at the type level,
  // so `'then' in maybeApp` is the type-system-safe assertion (no @ts-expect-error needed).
  const maybeApp = createApp(TEST_CONFIG, { ... })
  expect('then' in maybeApp).toBe(false)
  expect(typeof maybeApp.handle).toBe('function')
})
```

**Copy pattern（背景知識，不直接複製）：** 這個 test 背書了 smoke-health.ts 可以**同步**拿到 app —
```typescript
const app = createApp(config)   // 同步、無 await
const res = await app.handle(...)  // 只有 handle 是 async
```
不要誤加 `const app = await createApp(config)`（TS 會過但 runtime `await` 一個非 thenable 是 no-op，掩蓋未來若 createApp 被改成 async 的 regression）。ADR 0012 consequence 明訂 createApp 同步回傳。

---

### 3. `.github/workflows/ci.yml` ← analog 本檔既有 `test` job

**檔名：** `/Users/carl/Dev/CMG/Rigging/.github/workflows/ci.yml`

#### 3a. `test` job env 區塊（line 49-70）— smoke step 的 env 繼承基底

```yaml
  test:
    name: Test + coverage gate + migration drift
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: rigging_test
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U postgres -d rigging_test"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/rigging_test
      BETTER_AUTH_SECRET: ${{ secrets.CI_BETTER_AUTH_SECRET || 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' }}
      BETTER_AUTH_URL: http://localhost:3000
      NODE_ENV: test
      LOG_LEVEL: error
```

**Modification pattern：** Plan 1 必須在 line 70 之後、`steps:` 之前，於 env 區塊新增一行：

```yaml
      PORT: 3000
```

**為何必加（RESEARCH R1）：**
- `src/bootstrap/config.ts` line 19：`PORT: Type.Integer({ minimum: 1, maximum: 65535 })` — **無 default，無 optional**。
- `loadConfig()` 在 PORT 缺時直接 throw；smoke script 會在 entry 就炸，連 `createApp` 都走不到，log 只會寫 「Invalid environment variables」— 語意不清（應是「smoke 設定正確但 boot 失敗」才是紅燈的正確語意）。
- 其他三個 jobs（lint / typecheck）本來就不 load config，所以沒踩到這個雷；smoke step 是第一個在 CI 呼叫 `loadConfig()` 的 runner 流程。

**不改動：** `services.postgres` 整段（line 52-64）、既有 5 個 env（line 66-70）、`runs-on` / `name`。

#### 3b. `test` job steps 區塊（line 71-109）— smoke step 注入點

```yaml
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.12
      - name: Cache bun deps
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('bun.lock') }}
          restore-keys: ${{ runner.os }}-bun-
      - run: bun install --frozen-lockfile

      - name: Apply migrations
        run: bun run db:migrate

      - name: Test (with coverage)
        run: bun run test:ci

      - name: Coverage gate (>=80% on src/**/domain/ + src/**/application/)
        run: bun run coverage:gate

      - name: Migration drift check
        run: |
          bun run db:generate --name=ci-drift
          if [ -n "$(git status --porcelain drizzle/)" ]; then
            echo "::error::Schema drift detected — run 'bun run db:generate' locally and commit the resulting migration."
            git status drizzle/
            git diff drizzle/
            exit 1
          fi

      - name: Upload coverage artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-lcov
          path: coverage/lcov.info
          retention-days: 7
```

**Modification pattern（RESEARCH §3 推薦位置）：** Plan 1 必須在 `Migration drift check`（line 93-101）之後、`Upload coverage artifact`（line 103-109）之前插入：

```yaml
      - name: Smoke (createApp boot + /health 200)
        run: bun run smoke
```

**為何這個位置：**
- `Upload coverage artifact` 有 `if: always()` — 不管前面 fail 不 fail，artifact 都會上傳；smoke step 若放它後面會在 drift fail 時被 skip（符合 RESEARCH R6 的隔離原則）；若放它之前，smoke 自己 fail 時 coverage artifact 仍照常上傳（對 audit 有利）。
- drift 成功後再跑 smoke 確保 migration 已 apply 且 schema 同步；smoke 的 `SELECT 1` 不依賴 schema，但語意上放在「所有 DB 相關驗證」最末是正確的。
- sibling steps 的 `name:` 都有括號說明（e.g. `Test (with coverage)`、`Coverage gate (>=80% on ...)`、`Migration drift check`）；smoke step 命名 `Smoke (createApp boot + /health 200)` 對齊此風格。

**不改動：** 其他 6 個 steps（checkout / setup-bun / cache / install / migrate / test / coverage-gate / drift / upload）完整保留；`concurrency` 區塊（line 9-12）不動；`lint` / `typecheck` jobs（line 15-47）不動。

#### 3c. Step naming convention（跨 3 個 jobs 觀察）

| Job | `name:` 格式 | 示例 |
|-----|-------------|------|
| Top-level job | `Role (tool)` | `Lint (biome check)` / `Typecheck (tsc --noEmit)` / `Test + coverage gate + migration drift` |
| Step inside job | `Action (tool / scope)` | `Apply migrations` / `Test (with coverage)` / `Coverage gate (>=80% on ...)` / `Migration drift check` |
| Action-uses 類 step | 省略 `name:` 直接 `- run: ...` | `- run: bun install --frozen-lockfile` |

**Copy pattern：** smoke step 對齊 → `name: Smoke (createApp boot + /health 200)` + `run: bun run smoke`（一 run-command 一命名）。

---

### 4. `package.json` ← analog 本檔既有 scripts 區塊

**檔名：** `/Users/carl/Dev/CMG/Rigging/package.json`

#### 4a. `scripts` 區塊（line 6-23）

```json
  "scripts": {
    "dev": "bun --watch src/main.ts",
    "start": "bun src/main.ts",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "typecheck": "tsc --noEmit",
    "test": "bun run db:migrate && bun test",
    "test:contract": "bun test tests/biome-contract tests/contract",
    "test:regression": "bun test tests/integration/auth/*.regression.test.ts",
    "test:coverage": "bun test --coverage --coverage-reporter=lcov && bun run scripts/coverage-gate.ts",
    "test:ci": "bun test --coverage --coverage-reporter=lcov",
    "coverage:gate": "bun run scripts/coverage-gate.ts"
  },
```

**Modification pattern：** Plan 1 新增一行（建議插在最後一行 `coverage:gate` 之後，對齊「`bun run scripts/...` pattern 聚在一起」的既有 implicit 順序）：

```json
    "smoke": "bun run scripts/smoke-health.ts"
```

**為何 key 叫 `smoke` 而非 `smoke:health` 或 `ci:smoke`：**
- 既有 scripts 只有兩種命名形狀：(a) 單字 `dev` / `start` / `lint` / `format` / `typecheck`；(b) 帶冒號 `db:*` / `test:*` / `lint:fix` / `coverage:gate`。
- 冒號形的語意是「namespace:action」（`db` 動詞群、`test` 動詞群、`coverage:gate` 動詞組合）。
- `smoke` 不屬於既有 namespace（沒有其他 `smoke:*`），用單字命名最乾淨；對應 workflow 一行 `bun run smoke` 也最短。
- **替代考量（若未來有 `smoke:auth` / `smoke:agents`）：** 改名 `smoke:health` 也可，但 Phase 6 只有這一個 smoke，YAGNI。

**不改動：** 其他 16 個 scripts、`devDependencies` / `dependencies`、`name` / `version` / `type`。

#### 4b. JSON 格式慣例

- 2-space indent（biome config `indentWidth: 2`）。
- Key 用 double quotes（JSON 硬性要求，非 biome `quoteStyle`）。
- Trailing comma：scripts 區塊最後一 entry **無** trailing comma（看 line 22 `"coverage:gate": "..."` 無逗號）— 新增 `smoke` 後，若 `smoke` 為新末行則無逗號；若插在中間則前一行補逗號。

---

## Signature / Convention Checklist

### smoke-health.ts 必須遵守的 repo 風格

| # | Convention | 來源 / 背書 | Must-have |
|---|------------|-------------|-----------|
| **C1** | Shebang `#!/usr/bin/env bun` 第 1 行 | `scripts/coverage-gate.ts` line 1 | ✓ 必 |
| **C2** | 第 2 行起 block JSDoc `/** ... */`，首行 `filename — purpose (REQ-ID / Phase ref)` | `scripts/coverage-gate.ts` line 2-12 | ✓ 必 |
| **C3** | Imports 用相對路徑 `../src/bootstrap/app` 非 `@/bootstrap/app` | `scripts/coverage-gate.ts` line 13-14；repo scripts/ 無 path alias 先例 | ✓ 必 |
| **C4** | `import { createApp } from '../src/bootstrap/app'` + `import { loadConfig } from '../src/bootstrap/config'`（兩個 import 完成 smoke 所需） | `src/main.ts` line 1-2（production 同樣組合） | ✓ 必 |
| **C5** | 無 semicolons（biome `semicolons: asNeeded`） | `biome.json` line 27 | ✓ 必 |
| **C6** | Single quotes（biome `quoteStyle: single`） | `biome.json` line 26 | ✓ 必 |
| **C7** | 2-space indent；line width ≤ 100 | `biome.json` line 13-15 | ✓ 必 |
| **C8** | Top-level `async function main()` 封裝主邏輯 | `scripts/coverage-gate.ts` line 88 | ✓ 必 |
| **C9** | 成功 log 用 `console.log('✓ ...')`；失敗 log 用 `console.error('✗ ...')` | `scripts/coverage-gate.ts` line 90-94 / 133 / 141 | ✓ 必 |
| **C10** | `✓` = U+2713、`✗` = U+2717（非 ASCII；repo 既有風格） | `scripts/coverage-gate.ts`（已是 UTF-8 ballot marks） | ✓ 必 |
| **C11** | 失敗路徑 `process.exit(1)`；成功路徑隱式 exit 0（function 正常結束） | `scripts/coverage-gate.ts` line 135/139/141 | ✓ 必 |
| **C12** | 底部呼叫 `main().catch((err) => { console.error('✗ Smoke threw:', err); process.exit(1) })` | RESEARCH §2 骨架（coverage-gate 未加 catch，smoke 需加，因 createApp / loadConfig / app.handle 皆可 throw） | ✓ 必 |
| **C13** | 使用 `createApp(loadConfig())` — 不傳 deps（走 prod 路徑） | `src/main.ts` line 4-5；RESEARCH §1 方案 (a) | ✓ 必 |
| **C14** | 發 request 用 `new Request('http://localhost/health')` — URL host 不重要，path 必為 `/health` | `tests/integration/app-skeleton-smoke.test.ts` line 34 | ✓ 必 |
| **C15** | 驗 `res.status === 200` + `body.ok === true && body.db === 'up'`（三層 fail gate） | RESEARCH §2 骨架；`src/health/presentation/controllers/health.controller.ts` line 17-38 定義的 response shape | ✓ 必 |
| **C16** | TS `strict` + `exactOptionalPropertyTypes: true` + `noUncheckedIndexedAccess: true` — 所有 optional prop 要明確處理 `undefined` | `tsconfig.json` line 8-11 | ✓ 必 |
| **C17** | 不引入新 npm dependency；只 import `src/bootstrap/*` + runtime 內建 `Request` | RESEARCH §Architectural Responsibility Map（smoke 不引新 layer）；`tests/integration/app-skeleton-smoke.test.ts` 同樣只用內建 Fetch API | ✓ 必 |
| **C18** | 不重新 export 任何 symbol；smoke-health.ts 是終端執行檔非 library | `scripts/coverage-gate.ts` 無 export | ✓ 必 |
| **C19** | 檔案大小 ≤ 80 行（KISS；coverage-gate.ts 是 145 行的極限） | 用戶全域 coding-style.md「200-400 行 typical」；smoke 邏輯極簡不該膨脹 | ⚠️ 建議 |

### ci.yml 修改必守規則

| # | Rule | 背書 |
|---|------|------|
| **W1** | `test` job env 區塊補 `PORT: 3000`（line 70 之後） | RESEARCH R1；`src/bootstrap/config.ts` line 19 |
| **W2** | smoke step 插入位置：`Migration drift check` 之後、`Upload coverage artifact` 之前 | RESEARCH §3 推薦位置；`ci.yml` line 101-103 之間 |
| **W3** | step 命名 `Smoke (createApp boot + /health 200)`（英文、括號補 scope） | 本檔 step naming convention（§3c） |
| **W4** | step body 只一行 `run: bun run smoke`（不 inline script） | RESEARCH §2 方案 (a)；避免 YAML multiline string 難讀 |
| **W5** | 不動 `lint` / `typecheck` 兩個 jobs；不動 `concurrency` 區塊；不動 `services.postgres` 區塊 | Phase 6 不改 pipeline 結構（CONTEXT「不在範圍」第 3 條） |
| **W6** | 不加新 job；smoke 併入 test job（共用 install + postgres service） | RESEARCH §3 方案 (a)；ADR 0018 CI Postgres 共用精神 |
| **W7** | YAML indent 2 spaces（對齊現況 line 14-109） | GitHub Actions YAML 慣例 + 本檔既存 |

### package.json 修改必守規則

| # | Rule | 背書 |
|---|------|------|
| **P1** | 新增 key `"smoke": "bun run scripts/smoke-health.ts"`（非 `smoke:health`，非 `ci:smoke`） | 本檔 scripts naming 慣例（§4a） |
| **P2** | 新增位置：`coverage:gate` 之後成為新末行（無 trailing comma）；或插在 `test:*` 群後（前一行補逗號）— 兩種皆可，以維持「`scripts/*` 類聚集」為佳 | 本檔 line 20-22 既有 `coverage:gate` 為末行 |
| **P3** | 不改其他 scripts；不改 `devDependencies` / `dependencies` | Phase 6 無新套件（RESEARCH §Environment Availability） |
| **P4** | 2-space indent + double-quote keys（JSON 硬規 + biome） | 本檔既有 |

---

## Shared Patterns

### Pattern S1: in-process Fetch smoke（唯一 cross-cutting pattern）

**Source：** `tests/integration/app-skeleton-smoke.test.ts` line 28-45
**Apply to：** `scripts/smoke-health.ts`

**Canonical form（production 版本，無 stub）：**
```typescript
const config = loadConfig()
const app = createApp(config)
const res = await app.handle(new Request('http://localhost/health'))
// assert res.status === 200 && body.ok === true && body.db === 'up'
```

**為何跨 cutting：** Phase 6 只有一個新檔；此 pattern 是 smoke script 的核心技術模型。未來若 Phase 7+ 有新 smoke（e.g. `/metrics` / `/ready`），同樣沿用此 pattern（不另起 server process）。

### Pattern S2: exit-code gate script（scripts/ 目錄通用風格）

**Source：** `scripts/coverage-gate.ts`
**Apply to：** `scripts/smoke-health.ts`（目前只有這兩個 script）

**Canonical form：**
```typescript
#!/usr/bin/env bun
/** filename — purpose (REQ-ID / Phase) ... */
import { ... } from '...'
const CONST_1 = ...
async function main() {
  // fail path
  if (bad) { console.error('✗ ...'); process.exit(1) }
  // success path
  console.log('✓ ...')
}
main()  // smoke 版要加 .catch(err => { console.error('✗ ... threw:', err); process.exit(1) })
```

**為何跨 cutting：** 任何未來在 `scripts/` 下加的 CI gate（e.g. `scripts/bundle-size-gate.ts`、`scripts/license-check.ts`）都應套此骨架，保證 CI log 統一、exit-code 語意一致。

---

## No Analog Found

無。本 phase 所有檔案都能在 repo 內找到 exact 或 role-match analog。

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | — |

---

## Metadata

**Analog search scope：**
- `/Users/carl/Dev/CMG/Rigging/scripts/`（1 檔：coverage-gate.ts）
- `/Users/carl/Dev/CMG/Rigging/.github/workflows/`（2 檔：ci.yml、adr-check.yml；analog 為 ci.yml 本身）
- `/Users/carl/Dev/CMG/Rigging/tests/integration/app-skeleton-smoke.test.ts`（canonical reference，非 merge analog）
- `/Users/carl/Dev/CMG/Rigging/src/bootstrap/{app,config}.ts`（smoke-health.ts 的 import target）
- `/Users/carl/Dev/CMG/Rigging/src/main.ts`（production createApp caller，驗證 `createApp(loadConfig())` 是 canonical 使用模式）
- `/Users/carl/Dev/CMG/Rigging/package.json`（scripts 命名慣例）
- `/Users/carl/Dev/CMG/Rigging/biome.json` / `tsconfig.json`（lint / TS 嚴格性背書）

**Files scanned：** 9
**Pattern extraction date：** 2026-04-20
**CLAUDE.md read：** 無 repo-level CLAUDE.md；`.claude/skills` / `.agents/skills` 均不存在（user 全域 CLAUDE.md 已在 system reminder 中讀取並納入：繁中語言政策、coding-style immutability、git commit 格式）。
**新 ADR needed：** 無（RESEARCH §Domain Investigation §4 已論證 smoke script 屬 Tier 3 convention）。

---

## PATTERN MAPPING COMPLETE

**Phase:** 06 — ci-pipeline-green-run-smoke-validation
**Files classified:** 3（1 new + 2 modified）
**Analogs found:** 3 / 3

### Coverage
- Files with exact analog: **3**
- Files with role-match analog: 0
- Files with no analog: 0

### Key Patterns Identified
- **P1:** smoke-health.ts 必須 mirror `scripts/coverage-gate.ts` 的 shebang + JSDoc + async main + exit-code + ✓/✗ log 風格；唯一差別是加 `main().catch(...)` 以處理 createApp / loadConfig throw。
- **P2:** smoke script 核心技術模型直接複製 `tests/integration/app-skeleton-smoke.test.ts` 的 `createApp + app.handle(new Request('http://localhost/health'))` in-process pattern；但走 production 路徑（不傳 deps）以驗真 DB + 真 plugin chain。
- **P3:** ci.yml 修改是**純加步**（一行 env `PORT: 3000` + 兩行 step `name: Smoke...` / `run: bun run smoke`），不動現有 jobs 結構；smoke 併入 test job 尾端共用 postgres service + install cache。
- **P4:** package.json 新增 `"smoke": "bun run scripts/smoke-health.ts"` — 單字命名對齊 `lint` / `typecheck`；指令 shape 對齊 `coverage:gate`。
- **P5:** 整 phase 無新 npm dependency、無新 src/ 檔、無新 ADR；符合 RESEARCH §Architectural Responsibility Map 的 Tier 3 convention 判定。

### File Created
`/Users/carl/Dev/CMG/Rigging/.planning/phases/06-ci-pipeline-green-run-smoke-validation/06-PATTERNS.md`

### Ready for Planning
Pattern mapping 完成。Planner 現可在 Plan 1 action 中直接引用：
- 「smoke-health.ts 照 `scripts/coverage-gate.ts` line 1-12 / 88-144 pattern 寫，加 `main().catch` 處理 throw」
- 「ci.yml 在 line 70 後加 `PORT: 3000`，line 101 / 103 之間插兩行 smoke step」
- 「package.json line 22 後加 `smoke` script」
- 「smoke 的 in-process Fetch 技術參考 `tests/integration/app-skeleton-smoke.test.ts` line 28-45（但走 prod 路徑不傳 deps）」
