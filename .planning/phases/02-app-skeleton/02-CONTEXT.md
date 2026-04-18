# Phase 2: App Skeleton - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning
**Mode:** auto-resolved（使用者 `開始實作` → 使用 recommended defaults）

<domain>
## Phase Boundary

Phase 2 在 Foundation 骨架之上掛起 **Elysia root app + 全域橫切 plugin（errorHandler / requestLogger / CORS / Swagger）+ `/health` endpoint**，讓 DDD 四層 template 被一個 trivial feature 真實走過一次。之後 Phase 3 (auth) / Phase 4 (demo domain) 都 clone 這個 shape。

**規矩在 P1 定、P2 驗**：
- P1 擺好目錄、Biome rules、shared kernel、12 ADRs
- P2 讓第一個 feature（health）走完四層，證明「錯的寫法根本跑不起來」的 rails 真的運作
- **所有 Phase 3+ 的 feature module 必須以 P2 的 health feature 為模板**

**Out of this phase（scope guard）：**
- BetterAuth / AuthContext / API Key → Phase 3 (atomic)
- Demo Domain (Agent / PromptVersion / EvalDataset) → Phase 4
- Full test suite / CI / README 完整化 → Phase 5
- 真實 Domain business logic → Phase 3+（P2 的 health 純 operational）

</domain>

<decisions>
## Implementation Decisions

### /health 作為第一個 DDD 四層 walkthrough feature

- **D-01** — `/health` **走完 DDD 四層**，放在 `src/health/{domain,application,infrastructure,presentation}/`
  - **Why:** ROADMAP Phase 2 明確要求「DDD 四層模板被一個 trivial feature 真實驗證過」；presentation-only 無法回答「AuthContext-less feature 該不該有 domain 層」這類真實問題；P3+ 必有後人模仿的具體範本
  - **Purposefully minimal shape:**
    - `domain/` — `HealthStatus` value object（`{ ok: boolean, db: 'up' | 'down' | 'unknown', checkedAt: Date }`）+ `domain/index.ts` barrel（export `getHealthService()` factory，**不需要 AuthContext**——health 是 operational concern，屬 P2 唯一允許不走 requireAuth 的 route）
    - `application/ports/` — `IDbHealthProbe` port（`probe(): Promise<'up' | 'down'>`）
    - `application/usecases/` — `CheckHealthUseCase`（組 HealthStatus，依賴 `IDbHealthProbe` port）
    - `infrastructure/` — `DrizzleDbHealthProbe`（實作 port，跑 `sql\`SELECT 1\``）
    - `presentation/controllers/` — `healthController` Elysia plugin，`GET /health`
    - `health.module.ts` — factory function `createHealthModule(shared)` 回 Elysia plugin
- **D-02** — **DB healthcheck 實作用 Drizzle `db.execute(sql\`SELECT 1\`)`** 經 shared infra client（`src/shared/infrastructure/db/client.ts`），**非 direct postgres-js ping**
  - **Why:** 後續 repos 也走 Drizzle，healthcheck 走同條 path 才能驗證「Drizzle + postgres-js 配置實際可用」而非另一條繞過測試
  - Timeout: 2000ms（`AbortController` wrap），逾時視為 `'down'`
- **D-03** — **DB down → 503 的流動路徑**：`/health` controller 自己 try/catch（非透過 global error handler）
  - **Why:** DomainError 族對應 business error (400/401/403/404/409)；503 是 infrastructure availability state，不是「domain rule 違反」；health route 應明示「DB ping 失敗 = 服務不健康」而非把它塞進 error handler 讓讀者困惑
  - Response: `200 { ok: true, db: 'up', checkedAt }` / `503 { ok: false, db: 'down', checkedAt }`

### 全域 plugin 組裝位置 + 順序

- **D-04 (Location)** — 全域 plugin 放 `src/shared/presentation/plugins/*.plugin.ts`，**每個 plugin 獨立檔案**：
  - `error-handler.plugin.ts` — global `.onError()` + DomainError → HTTP
  - `request-logger.plugin.ts` — pino + elysia-logger + requestId derive
  - `cors.plugin.ts` — `@elysiajs/cors` wrapper（policy 可配）
  - `swagger.plugin.ts` — `@elysiajs/swagger` wrapper（security schemes pre-wired）
- **D-05 (Assembly point)** — `src/bootstrap/app.ts` 是唯一組裝點（`createApp(config): Promise<Elysia>`）
  - Feature module `.use()` 寫在 bootstrap（P2 只掛 healthModule，P3+ 加 authModule / agentsModule）
- **D-06 (Ordering rules — canonical)**：
  ```
  new Elysia()
    .use(requestLoggerPlugin)   // 1. 最先 — 產生 requestId，後續 plugin 都能引用
    .use(corsPlugin)            // 2. CORS 先於 route handler，預flight 處理
    .use(errorHandlerPlugin)    // 3. onError 掛根、global scope，攔所有下游 throw
    .use(swaggerPlugin)         // 4. Swagger 自身 routes 不走 auth，最後掛位
    .use(createHealthModule(shared))  // 5. Feature modules
  ```
  - **Why this order:**
    - requestLogger 先 derive `requestId`，error handler / controllers 才能把 requestId 寫進 response body 與 log
    - errorHandler 用 `scope: 'global'`（Elysia 1.4 API）攔所有 plugin 的 throw；位置不影響 onError 捕獲能力，但寫在 feature modules 前維持視覺順序（橫切先於業務）
    - Swagger plugin 最後掛位 — swagger spec 由 Elysia 內省所有已註冊 route 產出，掛最後才能完整收集
- **D-07 (ADR 0012 留痕)** — 寫 `docs/decisions/0012-global-plugin-ordering.md` 記錄 canonical ordering + rationale
  - **Why:** Plugin 順序在 Elysia 是實務陷阱（Pitfall #4 的延伸：scoped plugin undefined cascade 常源於順序錯誤）；P3 / P4 加 plugin 時必須先讀此 ADR 才改 bootstrap
  - Status: accepted（P2 即定）

### Request logger 設計

- **D-08 (requestId 策略)** — **優先用 client 送的 `X-Request-Id` header，缺則 `crypto.randomUUID()` fallback**
  - **Why:** 分散式系統對 trace 的標準做法；P2 還是單節點，但預留上游 load balancer / gateway 寫 X-Request-Id 的慣例，未來無需重構
  - 實作：`.derive({ as: 'global' }, ({ request }) => ({ requestId: request.headers.get('x-request-id') ?? crypto.randomUUID() }))`
  - Response header echo：`set.headers['x-request-id'] = requestId`（client 可在 response 找到 id）
- **D-09 (log 欄位)** — 每個 request log 必含：`requestId / method / path / status / durationMs / userAgent / remoteAddress`
  - 不含：request body / response body（避免洩敏 + log size 爆量）
  - body 若要 debug 由 controller-level explicit log
- **D-10 (dev vs prod 切換)** — `NODE_ENV === 'development'` 用 `pino-pretty` transport，其他環境 raw JSON
  - 實作：pino 設定 `transport: NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined`
  - LOG_LEVEL（已在 config schema）控制 verbosity；format 選擇交給 NODE_ENV
- **D-11 (redact 清單)** — pino `redact.paths` 必含：
  - `req.headers.cookie`
  - `req.headers.authorization`
  - `req.headers["x-api-key"]`
  - `res.headers["set-cookie"]`
  - **Why:** Pitfall #1 (CVE-2025-61928 class) 防線一環——即使 log 意外抓到 header，也不該以明文外洩 API Key / session token

### Error response body + Swagger + CORS

- **D-12 (error body shape)** — 統一為 `{ error: { code: string, message: string, requestId: string } }`
  - **Why:** 客戶端唯一入口判斷（查 `error.code` 不查 HTTP status 文字）；requestId 內嵌方便回報 / log 關聯；`error` 外包一層保留空間（未來可加 `error.details` 或 `error.validation[]` 不 break shape）
  - `code` 來自 `DomainError.code`（已在 P1 ship）；`message` 對 4xx 用 `err.message`、對 5xx 用固定 `"Internal server error"`
  - httpStatus 來自 `DomainError.httpStatus`（D-08 of P1），**非 DomainError 的 throw → 500 + code `INTERNAL_ERROR`**
- **D-13 (error log 策略)** — onError 內：
  - 5xx（含 non-DomainError）：`log.error({ err, stack: err.stack, cause: err.cause, requestId }, message)`
  - 4xx：`log.warn({ code, requestId, path }, message)`（**不記 stack**，避免噪音 + 攻擊者 probe 產生 log flood）
- **D-14 (Swagger path + gate)** — path `/swagger`（`@elysiajs/swagger` 預設）、**不 gate by NODE_ENV**（永遠開）
  - **Why:** Swagger 非 secret；harness 的核心是 DX，prod 也讓外部開發者看 API spec；若真要 disable production swagger，屬 v2 production hardening（PROD-03 範疇），v1 不做
- **D-15 (Swagger security schemes 預埋)** — P2 就預寫 `cookieAuth` + `apiKeyAuth` security schemes 定義（values 指向 `session` cookie 與 `x-api-key` header），但 P2 的 `/health` route **不套用** `security` 標記
  - **Why:** P3 加 protected route 時只需 `security: [{ apiKeyAuth: [] }, { cookieAuth: [] }]` 標記，不必回頭改 security scheme 註冊
- **D-16 (CORS policy)** — **echo request origin + `credentials: true` + 明示 allowed headers**
  - `origin: (request) => request.headers.get('origin') ?? '*'`（dev 全開，prod 未來可用 allowlist override）
  - `credentials: true`（P3 cookie auth 必要）
  - `allowMethods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS']`
  - `allowHeaders: ['content-type','authorization','x-api-key','x-request-id']`（明列避免 browser 預flight reject）

### the agent's Discretion

- **pino transport options 細節** — `colorize` / `translateTime` 格式等 dev UX 細節，executor 按 pino-pretty 預設即可
- **Swagger info 段落**（title / version / description）— 取自 `package.json` 即可；version 即時讀 vs hardcode 交由 executor 判斷
- **CORS `maxAge`** — 預flight cache 秒數，預設 0（不 cache）或 86400（1 day）都可；executor 默認 86400
- **Health controller response 外 `checkedAt` 用 ISO string vs Unix ms** — 採 ISO string（與 pino log timestamp 風格一致）
- **Request logger 是否記 query string**：記進 `path` 欄位（含 query），search params 不單獨拆欄——簡化欄位
- **`src/shared/infrastructure/db/client.ts` 的 connection pool 參數** — postgres-js 預設即可；P2 不調；若 healthcheck 發現 cold-start 過慢再於 P5 revisit
- **`src/shared/application/ports/`（ILogger / IClock）是否 P2 就擺** — executor 判斷；若 P2 的 requestLogger 可透過 pino instance 直接注入則 ILogger 可延至 P3（P3 的 use case 才真正需要）
- **`_template/` 目錄** — P2 完成 `health/` 後可保留 `_template/` 作為空骨架或刪除；建議保留 + 在 README 寫「新增 feature 時複製 `_template/` 或 `health/`」

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level（必讀）
- `.planning/PROJECT.md` — Core Value、Constraints、Key Decisions
- `.planning/REQUIREMENTS.md` §Web Framework Skeleton — 4 條 P2 requirements (WEB-01..04)
- `.planning/ROADMAP.md` §Phase 2 — Goal、Depends on、Success Criteria、Plans estimate

### Prior phase context（必讀，避免重複決策）
- `.planning/phases/01-foundation/01-CONTEXT.md` — Phase 1 的 16 條 D-xx 決策（特別是 D-04 detection、D-08 DomainError httpStatus 欄位、D-09 Biome DDD rules）

### Research（P2 規劃必讀）
- `.planning/research/ARCHITECTURE.md` §Pattern 5 (Feature Module Factory) §Pattern 1 (AuthContext Boundary — P2 不強制但須熟悉，P3 會用)、§Error Flow、§Data Flow
- `.planning/research/STACK.md` §Elysia 1.4.28（`.mount()` 修復）§Pino 10 + @bogeychan/elysia-logger
- `.planning/research/PITFALLS.md` — 特別是 #4 (Elysia scoped plugin undefined cascade) — canonical plugin ordering 的成因

### Phase 1 產出物（P2 必 import）
- `src/shared/kernel/{result,brand,id,errors}.ts` — `DomainError` 基底 + 子類（error handler 直讀 `httpStatus`）
- `src/bootstrap/config.ts` — 啟動 env 校驗（P2 的 `createApp(config)` 取用）
- `src/_template/` — DDD 四層空骨架（P2 的 `src/health/` 以此為模板）
- `biome.json` — DDD framework-free rules（P2 新增 code 必不違反）
- `docs/decisions/0000-0011` — 12 條起始 ADR（P2 新增 ADR 0012 時 README 索引同步更新）

### External specs（agent 實作時參考）
- Elysia 官方 docs — `https://elysiajs.com/essential/life-cycle`, `https://elysiajs.com/patterns/macro`（P2 不用 macro，P3 會用）
- `@bogeychan/elysia-logger` docs — `https://github.com/bogeychan/elysia-logger`
- `@elysiajs/swagger` docs — `https://elysiajs.com/plugins/swagger`
- `@elysiajs/cors` docs — `https://elysiajs.com/plugins/cors`
- Pino 10 docs — transport + redact 設定
- MADR 4.0 canonical — `https://adr.github.io/madr/`（ADR 0012 寫法）

### P2 會產出的新檔案（locked by this CONTEXT）
- `src/bootstrap/app.ts` — `createApp(config)` factory
- `src/shared/presentation/plugins/{error-handler,request-logger,cors,swagger}.plugin.ts`
- `src/shared/infrastructure/db/client.ts` — Drizzle + postgres-js client factory
- `src/shared/application/ports/` — `ILogger` (optional P2) + `IClock` (executor 判斷)
- `src/health/{domain,application,infrastructure,presentation}/` + `src/health/health.module.ts`
- `docs/decisions/0012-global-plugin-ordering.md`
- `docs/decisions/README.md` — 新增 0012 索引列

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/shared/kernel/errors.ts`** — `DomainError` 帶 `httpStatus` 欄位，error handler plugin 直接 `err.httpStatus` 讀（無 mapping table；D-12 onError 實作的核心）
- **`src/shared/kernel/{result,brand,id}.ts`** — Result / Brand / UUID，可在 health 的 usecase 回 `Result<HealthStatus, never>` 範例上使用（示範給 P3+）
- **`src/bootstrap/config.ts`** — `loadConfig()` 已 ship；`createApp(config)` 直接接收
- **`src/_template/{domain,application,infrastructure,presentation}/`** — 空 DDD 骨架，`src/health/` 可複製並改造
- **Package dependencies 已全裝**：elysia 1.4.28 / @elysiajs/cors 1.4.1 / @elysiajs/swagger 1.3.1 / @bogeychan/elysia-logger 0.1.10 / pino 10.3.1 / pino-pretty 13.1.3 / drizzle-orm 0.45.2 / postgres 3.4.9 — **無需 `bun add`**

### Established Patterns (from P1 CONTEXT + research)
- **DDD 四層 × feature vertical slice** — `src/{feature}/{domain,application,infrastructure,presentation}/`（P1 D-09, Biome enforced）
- **Factory function DI** — `createXxxModule(shared)` 回 Elysia plugin（P1 D-09 / ARCHITECTURE.md Pattern 5）
- **Domain barrel export** — `domain/index.ts` 為唯一 entry，`domain/internal/` 放 class impl（P1 D-11）
- **Error handler 讀 `err.httpStatus`** — 不用 switch/map table（P1 D-08）
- **Biome rule: Application/Presentation 不可 import `domain/internal/**`**（P1 D-11，D-16 之前配套）

### Integration Points
- **`src/main.ts`** — 目前是 stub（P1 D-06）；P2 改為 `const app = await createApp(loadConfig()); app.listen(config.PORT)`
- **`src/bootstrap/app.ts`** — P2 新增，未來 P3 加 `authModule` / P4 加 `agentsModule` 都 `.use()` 在此
- **`src/shared/infrastructure/db/client.ts`** — P2 新增的 Drizzle client factory；P3 的 BetterAuth drizzle-adapter + repos 會 inject 此 client
- **`src/shared/presentation/plugins/`** — P2 新增的橫切 plugin 目錄；P3 會加 `auth-context.plugin.ts`（但屬 `src/auth/presentation/plugins/` 比較對）
- **`docs/decisions/`** — 新增 ADR 0012，同步更新 `README.md` 索引表

### Risks carried from Phase 1 to watch
- **Pitfall #4 (Elysia scoped plugin `undefined` cascade)** — P2 的 plugin 順序 + `scope: 'global'` 的 onError 是第一道防線；ADR 0012 必須記明
- **Pitfall #2 (bun:sql transaction hang)** — P2 的 DB healthcheck 走 Drizzle + postgres-js，再次驗證 P1 ADR 0010 的 driver 選擇不走 bun:sql

</code_context>

<specifics>
## Specific Ideas

- **Plugin 檔名統一 kebab-case + `.plugin.ts` 尾碼** — `error-handler.plugin.ts`，與 ARCHITECTURE.md 示例一致，executor 不要省略 `.plugin` 尾碼
- **`src/health/` 的 domain 層即使只有 `HealthStatus` value object 也必須 ship** — 這是 P2 的教學價值；下游 agent 看到「health 這麼 trivial 的 feature 都有 domain 層」就知道 P3+ 的 feature 更該遵守
- **Swagger info.version 動態讀 package.json** — `import pkg from '../../package.json' with { type: 'json' }`，Bun 原生支援 import attributes
- **ADR 0012 的 Decision Drivers 段** — 必列「避免 Pitfall #4 cascade」「提供 P3+ plugin 加入的 canonical 位置」「順序改動 = Plugin 生命週期改動，須 ADR 而非 PR-only 批准」三項
- **`createApp(config)` 必非 async-lazy-init** — P2 不做 DB 連線 pre-warm（讓 healthcheck 自行驗）；`createApp` 回 `Elysia`（非 Promise<Elysia>）；`main.ts` 呼叫 `.listen()` 才開 listen
- **`/health` 不套 `security` Swagger 標記**（D-15）— 明示 operational route 不需 auth；P3 才加其他 route 的 `security`
- **redact paths 用 pino 的 path syntax**（D-11）— `req.headers.cookie` 非 `request.cookie`；寫錯會 silent miss，executor 必查 pino docs 驗證

</specifics>

<deferred>
## Deferred Ideas

以下想法在 P2 討論中浮現，但屬後續 phase 範疇：

- **Production CORS allowlist**（勿 origin: '*' in prod） → v2 production hardening（PROJECT.md Out of Scope §Rate limiting / observability 同級）
- **Rate limiting middleware** → v2 PROD-02（BetterAuth rate limit 補強於 P3 觸及時另評；P2 純 health 不需要）
- **Real `/ready` vs `/health` split**（liveness vs readiness probe） → 目前 `/health` 合併 liveness + readiness，K8s deploy 時（未來）再拆
- **OpenTelemetry tracing / metrics collection** → v2 PROD-03
- **Request body logging（debug mode）** → 不做；controller-level explicit log 足夠
- **Swagger auth（basic auth on /swagger）** → D-14 已決「永遠開」；若 prod 要收，屬 v2
- **pino log shipping（syslog / cloudwatch）** → v2 PROD-03
- **`src/_template/` 的長期命運**（保留 / 刪除 / 移到 docs） → P4 dogfood 後評估（若 template 在 P4 adoption 時發現痛點，改為 `bun rigging new-domain <name>` scaffold 命令，屬 v2 SCAF-02）
- **Graceful shutdown（SIGTERM → close db pool）** → P5 `main.ts` polish 時補；P2 `createApp` 不 own process lifecycle

未提及但屬於未來 phase：
- AuthContext macro / requireAuth / dual auth → Phase 3
- BetterAuth schema generation → Phase 3
- Demo domain (Agent / PromptVersion / EvalDataset) → Phase 4
- Testcontainers integration / CI workflow → Phase 5

</deferred>

---

*Phase: 02-app-skeleton*
*Context gathered: 2026-04-19 (auto-resolved with recommended defaults per user request `開始實作`)*
