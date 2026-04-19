# Phase 3: Auth Foundation - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning
**Mode:** Interactive（使用者逐區選擇 → 全部四區深度討論 → 25 條決策鎖定）

<domain>
## Phase Boundary

Phase 3 交付 Rigging 論述核心：**BetterAuth 整合 + 雙軌 AuthContext（cookie + API Key，API Key 優先）+ Runtime Guards + CVE regression suite**，作為 **atomic unsplittable phase**。

**規矩在 P1 鋪、P2 驗、P3 立身：**
- P1 鋪紀律（shared kernel / Biome rules / 12 ADRs / AGENTS.md Rigidity Map）
- P2 驗 DDD 四層模板（health feature 走完四層）
- P3 把「錯的寫法根本 wire 不起來」從抽象論述變成強制物理實作：AuthContext macro 單一根層掛、無 `requireAuth: true` 則 `ctx.authContext` 根本不存在、Domain service factory runtime assert `ctx.authContext` 缺失 throw

**本 phase atomic 的結構性理由**（ROADMAP 已記，複述在此讓 researcher/planner 遇到「要不要拆」時立即拒絕）：
- BetterAuth schema 生成 + Drizzle migration + auth domain + ports + 雙軌 resolver + Runtime Guard + CVE-2025-61928 regression 任一拆出 → 破壞雙軌論述 或 留 CVE-class 漏洞
- Session fixation 防線（AUTH-11）必須與 password reset 流程同時 land
- Regression suite 必須一次 ship 齊全，否則「少一條 test」的 phase 實際上等於「還沒做完」

**Out of this phase（scope guard）：**
- Demo domain（Agent / PromptVersion / EvalDataset）→ Phase 4
- Full test suite / CI / README 完整化 / testcontainers 整合 → Phase 5
- Rate limit 持久化 store + per-email rate limiter observability → v2 PROD-02（P3 只做 memory store + log.warn）
- OAuth / 2FA / Passkey / Magic Link → v2 IDN-*（PROJECT.md Out of Scope 已鎖）
- Real email provider → v2 PROD-01（P3 只用 ConsoleEmailAdapter）
- OpenTelemetry / tracing → v2 PROD-03
- Multi-tenancy / RBAC / API Key per-tenant scope → v2 TEN-02

</domain>

<decisions>
## Implementation Decisions

### Scope Design（AuthContext.scopes 與 apiKey.scopes 的規約）

- **D-01** — Scope 字串詞彙 v1 鎖為**兩值**：`'*'`（full access / sudo）與 `'read:*'`（唯讀）
  - **Why:** PROJECT.md「囚型在輸概念，不囚型在細節」；真正 RBAC 定 v2 TEN-02；DEMO-05「只讀 scope 呼叫 write endpoint 必回 403」可完全以此兩值實測
  - **常數落地:** `export const ALLOWED_SCOPES = ['*', 'read:*'] as const` 於 `src/auth/domain/auth-context.ts`
- **D-02** — Scope 檢查 **落在 use case 層**（非 macro 參數、非雙層 defense-in-depth）
  - **Why:** 符合 P1 Rigidity Map「runtime guard > type guard」精神；Pitfall #2 scoped plugin undefined cascade 不信 macro 層型別；可全部單元測試覆蓋
  - **實作模板（use case body 第一行）:**
    ```ts
    if (!ctx.scopes.includes('*') && !ctx.scopes.includes('write:*')) {
      throw new ForbiddenError('INSUFFICIENT_SCOPE', 'This operation requires scope write:*')
    }
    ```
- **D-03** — Human cookie session 的預設 scopes = `['*']`（sudo）
  - **Why:** BetterAuth session 本身無 scopes 概念；human 直接有全權、API Key 是「human 的子集」心智模型最少分支；DEMO-05 測試用 API Key(scope=['read:*']) 呼 write endpoint → 403 直觀
  - **Mapper 落點:** `src/auth/infrastructure/better-auth/identity-service.adapter.ts` 的 `verifySession` 內，BetterAuth session → AuthContext 時補 `scopes: ['*']`
- **D-04** — API Key invariant：`key.scopes ⊆ session.scopes`（subset check at creation）
  - **Why:** least-privilege；符合 CVE-2025-61928 class 防線「多一層檢查不會遮住任何決定」；human 預設 `['*']` 時任何 key 自動 pass，不會造成現階段 UX 摩擦
  - **實作落點:** `CreateApiKeyUseCase.execute` 第二步（第一步是 AUTH-15 `body.userId === session.userId` 檢查）
  - **違反時:** `ForbiddenError('SCOPE_NOT_SUBSET', 'Requested key scopes must be subset of your session scopes')`
- **D-05** — `POST /api-keys` body 的 `scopes` 用 **Validate + 共用常數**（不允許任意字串）
  - **Why:** v1 詞彙就兩值，allow-list 嚴格最自然；typo `'read-agents'`（應為 `'read:*'`）不會變「silent dead scope」—— key 建起來成功但永遠 match 不到任何 use case 檢查
  - **Schema 實作:** `t.Array(t.Union([t.Literal('*'), t.Literal('read:*')]))`，動態引用 `ALLOWED_SCOPES` 常數展開為 TypeBox enum（未來 v2 新增 scope 只改常數）
- **D-06** — 無 scope 時 403 body = **INSUFFICIENT_SCOPE + 缺哪條**（不洩其他可用 scope 或其他 endpoint 清單）
  - **Why:** Pitfall #11 teaching moment；scope 詞彙本身已公開（docs + Swagger），露「缺哪條」不增加資訊洩露；dev UX 友善
  - **Body shape:** `{ error: { code: 'INSUFFICIENT_SCOPE', message: 'This operation requires scope write:*', requestId } }`
- **D-07** — `'*'` 未來語意 = **永等 catch-all**（v2 新增 scope 自動授予給現存 `['*']` key）
  - **Why:** v1 需求簡單；v2 若要收緊（新 scope 不自動授權）再開 ADR supersede ADR 0011 / 新 ADR；snapshot 凍結方案的 DB 不同步與 migration 複雜度不值得 v1 承擔
  - **consequence:** v2 TEN-02 上線前，必須評估「這個新 scope 暴露給舊 key 是否安全」；若不安全則 v2 必須伴隨一次性 key force-rotate（作為 migration）
- **D-08** — `/me` endpoint 只檢 `requireAuth`，**不做 scope check**
  - **Why:** `/me` 是 identity introspection，回的資料是 ctx 本身（userId / identityKind / scopes），不星外洩；任何合法 identity（human cookie 或 agent api key）都應能讀自己；write-only key（v1 無此概念但 v2 可能有）打 /me 回 403 反直覺
  - **Swagger:** `/me` 標記 `security: [{ cookieAuth: [] }, { apiKeyAuth: [] }]` 但不標 scope 條件

### Resolver Precedence 邊界

- **D-09** — API Key 驗證失敗（hash 不對 / 已撤銷 / 已過期）+ cookie session 有效 → **硬 401，不 fallback cookie**
  - **Why:** Agent 聲明身分 = agent，key 失效就是失敗；fallback 會造成 identityKind 悄換、audit log 回答不了「這件事誰做」；符合 ADR 0011「雙軌身分必須各自明朗」精神
  - **實作落點:** `authContextPlugin.macro.requireAuth.resolve`；`identity.verifyApiKey(rawKey)` 回 `null` 時直接 `return status(401)`，不往下讀 cookie
- **D-10** — Malformed API Key header（prefix 不對 / 長度不對 / non-ASCII） → **Fast-reject 401 + timing 對齊 valid-format-wrong-hash baseline**
  - **Why:** AUX-04 timing-safe 要求涵蓋整段 auth path 而非僅 hash 比對；攻擊者不能從 latency 區分「key 格式錯」vs「key 格式對但 hash 錯」
  - **實作手法:** 格式檢查失敗後仍走一次 dummy `timingSafeEqual` + 一次 dummy DB lookup（或使用單次固定延遲 baseline），令整條 reject path latency 與真實 hash 比對相當；**不是**睡指定毫秒數（那會被統計學繞過），而是「走完實際操作」
- **D-11** — API Key + cookie 都有效 → API Key 優先；AuthContext shape **只留 apiKeyId，忽略 cookie**
  - **Why:** 「一請求一身分」invariant 硬鎖；response 不動 Set-Cookie（cookie 仍存在於 client 端，但本 request 從未使用）；Pitfall #2 scoped plugin undefined cascade 最愛場景直接被排除
  - **最終 AuthContext:** `{ userId: apiKey.userId, identityKind: 'agent', scopes: apiKey.scopes, apiKeyId: apiKey.id }`，**無 sessionId**
- **D-12** — 所有 401 scenario body **同一字串**：`{ error: { code: 'UNAUTHENTICATED', message: 'Authentication required', requestId } }`
  - **Why:** OWASP 已知 enumeration vector；Pitfall #13「single generic 'invalid credentials'」建議；dev debugging 透過 server log + requestId 取細節（錯誤原因寫進 `log.warn`，不進 response body）
  - **涵蓋場景:** malformed API Key / invalid hash / revoked key / expired key / no auth / invalid session / expired session — 全部回同一 body；差異只在 server-side log

### BetterAuth 整合 Surface

- **D-13** — BetterAuth plugins 只開 **apiKey()**（加上 built-in email-and-password）
  - **Why:** email-and-password 內建；apiKey() 滿足 AUTH-12~16 + AUX-01~07；不加 bearer() 避免「cookie / api-key / bearer-token / ?」四條 auth 路徑的軟件複雜度；bearer 發行流程 v1 用不到
- **D-14** — BetterAuth handler mount basePath = **`/api/auth`**
  - **Why:** BetterAuth 文件標準 + 大多社區範例一致；與 Rigging「未來可能 `/api/*`」組織思想契合（Phase 4 demo 可放 `/api/agents`）；避 Pitfall「basePath 空或 `/` → 裸路徑衝突 #3384」
  - **Elysia mount:** `new Elysia().mount('/api/auth', auth.handler)`（Elysia 1.4.28 `.mount()` Set-Cookie 修復）
- **D-15** — `auth` (BetterAuth instance) 檔案位置 = **`src/auth/infrastructure/better-auth/auth-instance.ts`**
  - **Why:** 依 ARCHITECTURE.md feature-vertical-slicing：BetterAuth 是 auth feature 自己的內部細節；**純 import `better-auth` + `drizzle-adapter` + db schema**（不 import `elysia`）→ 保證 `bunx @better-auth/cli generate` 可成功讀取（Pitfall #5446 建議的「config 與 Elysia bootstrap 解耦」）
  - **其他 feature 不直 import 此檔:** 若 demo domain 要用 auth 行為，走 port / Elysia plugin，不 reach 進 auth 內部
- **D-16** — BetterAuth built-in rate limit 在 P3 **開啟最小可用版**（memory store + 預設欄位 + dev log.warn）+ per-email wrapper for `/send-verification-email`
  - **Why:** PROJECT.md「社群可用」等級已有必要開；Pitfall #7 記「/send-verification-email 無效 #2112」要用額外 per-email wrapper 補救（use case 層記錄上次發送時間，10 秒內重送回 429）；v2 PROD-02 才換 persistent store + per-email 統計儀表
  - **config:** `rateLimit: { enabled: true, window: 60, max: 100, storage: 'memory' }` + `log.warn({ event: 'rate_limit_hit', ip, path }, 'Rate limit reached')` hook
- **D-17** — BetterAuth schema 生成 + commit 單獨作為 **Plan 03-01 spike**
  - **Why:** Pitfall #5446（BetterAuth CLI + Elysia 近期版本 schema gen 失敗）風險偏中；獨立 plan 可讓 spike 失敗時 rollback 成本低（只退 schema + migration 檔案，不退其他 auth domain / ports 已寫程式碼）；atomic commit 區塊界線清楚
  - **Plan 03-01 範圍:** `bunx @better-auth/cli generate` → 驗證產生的 user/session/account/verification/apiKey schema → commit 到 `src/auth/infrastructure/schema/*.ts` → `bunx drizzle-kit generate --name=0001_auth_foundation` → commit migration 進 `drizzle/` → `bun test:contract` 通過
- **D-18** — Session cookie 屬性**信 BetterAuth 預設**（HttpOnly + Secure[prod] + SameSite=Lax），在 ADR 0013（新）釘定此依賴
  - **Why:** BetterAuth 1.6.5 預設安全；若手動覆寫所有欄位反而會造成「BetterAuth 更新預設時我們沒跟上」的 audit 死角；ADR 釘定意味著「未來 BetterAuth 改預設時必須開 ADR 重新評估」
  - **dev 環境:** Secure 自動 off（HTTP 連線），HttpOnly + SameSite=Lax 仍生效

### API Key Lifecycle & Storage Shape

- **D-19** — Key prefix **單一格式 `rig_live_` + 32 bytes base64url**（human / agent 不分 prefix）
  - **Why:** identityKind='agent' 由「是否經 API Key 驗證路徑」決定而非 prefix 字面；統一 prefix 供 git / log leak scan（`grep -r 'rig_live_' logs/` O(1) 搜尋）；Pitfall #4 推薦 indexable prefix；v2 可擴 `rig_test_` / `rig_prod_` 多環境
  - **完整格式:** `rig_live_<43 chars base64url>`（32 bytes × 4/3 ≈ 43 chars）
- **D-20** — POST /api-keys 成功 response **扁平 shape**：`{ id, key, prefix, label, scopes, expiresAt, createdAt }`
  - **Why:** 「存這個 key」提示明確；client 不需解嵌套；與 GET /api-keys/:id 的 shape 差只在多了 `key` 欄位（raw key 只在 create 出現一次）
  - **raw key 欄位名:** `key`（非 `plaintext` / `secret` / `token` — 避免 client 誤將某 wrapper 值當 key）
- **D-21** — API Key DB 儲存 = **prefix (text, indexed 前 8 字元) + hash (text, unique)** 分欄
  - **Why:** Resolver 驗證路徑：parse raw key → 取 prefix 前 8 → `SELECT ... WHERE prefix = ?`（indexed, O(log n)）→ `timingSafeEqual(hash(raw), row.hash)`；Pitfall #4 推薦形式；BetterAuth apiKey plugin 雖有 `start` 欄位但預設不 index——P3 透過 ADR 0014（新）明指 index
  - **Drizzle schema 要求:** `prefix: text('prefix').notNull()` + `index('api_keys_prefix_idx').on(table.prefix)` + `hash: text('hash').notNull().unique()`
- **D-22** — POST /api-keys 沒傳 `expiresAt` 時**預設 90 天**
  - **Why:** Pitfall #4「強制 opt-out 過期」；90 天符合 BetterAuth 範例 + 大多 agent lifecycle 常見默契；60 天過頻繁 / 30 天對 Agent dogfood 週期過短 / 無期限違反 Pitfall #4 明示警告
  - **body schema:** `expiresAt: t.Optional(t.String({ format: 'date-time' }))`；use case 層 `input.expiresAt ?? clock.now() + 90 days`
- **D-23** — BetterAuth apiKey plugin 明寫 `hashing: 'sha256'`
  - **Why:** Pitfall #4 建議；明示設定則 ADR 0014 可釘定「at-rest 雜湊不可逆、算法硬鎖」；避免 Agent 調試時「跟著預設」flip `hashing: false`（CVE-class 配置漏洞）；audit 可見
  - **config:** `apiKey({ hashing: 'sha256', ... })` — 其他欄位依 BetterAuth 文件預設
- **D-24** — DELETE /api-keys/:id = **Soft delete**（`revokedAt: timestamp`）
  - **Why:** Revoked key 仍保留在 DB，便於 audit / incident forensics；regression test「revoked key → 401」可驗 DB state；「hard delete」讓某 id 從 DB 消失時，audit 無法回答「誰 revoke 過 / 何時」；TTL 自動 purge 需 cron 非 P3 scope
  - **Resolver 改動:** `WHERE prefix = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`
- **D-25** — POST /api-keys body.label 規約 = **Required, 1-64 chars, trim, UTF-8**
  - **Why:** 強制使用者每把 key 命名；Dashboard「3 把 unnamed key」UX 災難不發生；UTF-8 任何語言（中文 / emoji）OK；trim 防空白；Pitfall #11「harness 要教 Agent」對應 UX 原則
  - **Schema:** `t.String({ minLength: 1, maxLength: 64 })`；use case 內 `label.trim()` 後再驗 min/max

### the agent's Discretion

以下項目未納入本次討論，researcher / planner 可依 ARCHITECTURE.md + STACK.md + P1/P2 CONTEXT + BetterAuth 文件直接決定：

- **BetterAuth apiKey plugin 其他欄位**（`prefix` 是否由 plugin 自動加、`start` 長度、`length` 設多少）— 依 BetterAuth 文件 + D-19 `rig_live_` prefix 反推
- **Drizzle migration 檔名** — `drizzle-kit generate --name=0001_auth_foundation` 範例；executor 決定
- **auth module factory 具體 shape** — ARCHITECTURE Pattern 5 範例已夠；`createAuthModule(shared: SharedDeps): Elysia`
- **IEmailPort shape + ConsoleEmailAdapter 輸出格式** — 研究建議「明確標記 `📧 CLICK THIS: <url>`」的 UX 形式；executor 按 Pitfall UX 建議實作
- **BunPasswordHasher port / adapter** — v1 由 BetterAuth 自身處理 user password；Rigging 側的 `IPasswordHasher` 僅當需要 hash API Key 時用（但 BetterAuth apiKey plugin 已處理），實務上 P3 **不需**額外暴露 `IPasswordHasher` port——researcher / planner 可直接略過
- **IUserRepository / IApiKeyRepository port 位置** — per ARCHITECTURE.md feature-owned：`src/auth/application/ports/`；研究範例已完整
- **Mapper 命名**（`UserMapper.toDomain` / `toPersistence`）— ARCHITECTURE.md 範例；executor 直接用
- **Regression test 檔案組織** — `tests/regression/auth/` 下放（P5 test 整併時會合進去）；P3 先在 `tests/integration/auth/` 放 regression 套件並加 `.regression.test.ts` 尾碼以供後 P5 grep 搬遷
- **`/me` controller 檔位與 `identityKind` 回傳格式** — `src/auth/presentation/controllers/me.controller.ts`，回 `{ userId, identityKind, scopes, apiKeyId?, sessionId? }` 透明呈現 ctx
- **Auth feature module 是否拆子目錄** — 單一 `src/auth/` 即可；core + apiKey 邏輯共用 AuthContext domain；若未來 scope 膨脹再考慮（P4 dogfood 會是先照 P3 pattern 再評估 template 設計債）
- **ADR 編號順序** — P3 新增預計 3-4 條 ADR：`0013-api-key-storage-hash-plus-index.md` / `0014-api-key-hashing-sha256.md` / `0015-rate-limit-memory-v1-persistent-v2.md` / `0016-betterauth-defaults-trust.md`（或類似；executor 依 P1 編號機制順序排定）
- **session fixation 防線實作**（AUTH-11 password reset invalidates other sessions）— 若 BetterAuth 1.6.5 預設已做（P3 planner spike 驗證為先），直接測試；否則包 reset hook 內 `session.delete WHERE userId = ? AND id != ?`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level（必讀）
- `.planning/PROJECT.md` — Core Value、Constraints、Key Decisions（特別是 BetterAuth 1.6.5 pin exact、雙軌 auth、Email dev-only console log）
- `.planning/REQUIREMENTS.md` §Authentication — Foundation / §Email Verification / §Password Reset / §API Key (Agent Track) / §AuthContext Boundary — 23 條 P3 requirements (AUTH-01..16 / AUX-01..07)
- `.planning/ROADMAP.md` §Phase 3 — Goal、Depends on、Success Criteria、Risk Flags（三件 spike 候選）

### Prior phase context（必讀，避免重複決策）
- `.planning/phases/01-foundation/01-CONTEXT.md` — P1 的 16 條 D-xx 決策（特別是 D-07 UserId Brand、D-08 DomainError httpStatus、D-11 domain barrel + internal、D-09 Biome DDD rules 含 `drizzle-orm` 禁 import / D-14 ADR 0011 Resolver precedence accepted 基礎）
- `.planning/phases/02-app-skeleton/02-CONTEXT.md` — P2 的 D-04..D-16 決策（特別是 D-06 canonical plugin ordering / D-12 error body shape `{ error: { code, message, requestId } }` / D-16 CORS credentials: true）

### Research（P3 規劃必讀）
- `.planning/research/ARCHITECTURE.md` §Pattern 1 (AuthContext Boundary via Elysia `.macro()` + `.resolve()`) §Pattern 2 (AuthContext Concrete Shape) §Pattern 3 (Use Case = Class with `execute(ctx, input)`) §Pattern 5 (Feature Module Factory) §Data Flow §Anti-Patterns 1-6（全部與 P3 相關）
- `.planning/research/STACK.md` §BetterAuth（`drizzleAdapter` + `bunx @better-auth/cli generate`）§Integration Pattern: BetterAuth + Elysia + Drizzle §What NOT to Use（Drizzle 1.0-beta / bcrypt / Lucia / dotenv）
- `.planning/research/PITFALLS.md` — **核心必讀**：#1 AuthContext advisory、#2 scoped plugin undefined cascade、#3 CVE-2025-61928、#4 API key plaintext、#5 bun:sql hang（D-21 驗證 postgres-js 路徑）、#6 session fixation (AUTH-11)、#7 BetterAuth rate limit gaps (D-16)、#11 harness 太緊（error message teaching moment）、#13 timing attack（D-10）、#14 Bun native-module（BetterAuth apiKey plugin 相容性 spike 第一環節）
- `.planning/research/FEATURES.md` — must-have vs defer 對照（確認 OAuth / 2FA / magic link 皆為 defer）
- `.planning/research/SUMMARY.md` §Phase 3 — Delivers / Addresses / Avoids

### Phase 1 + 2 產出物（P3 必 import / extend）
- `src/shared/kernel/errors.ts` — `UnauthorizedError`（401）、`ForbiddenError`（403）用於 resolver / use case scope check（D-02 D-04 D-06 D-09 D-12）
- `src/shared/kernel/{result,brand,id}.ts` — `UserId` brand（BetterAuth user.id → UserId）、`Result<T, DomainError>` 於 createApiKey 等 use case
- `src/shared/kernel/index.ts` — barrel export
- `src/bootstrap/config.ts` — 擴充 TypeBox schema：新增 `BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`（若 env schema 尚未涵蓋）
- `src/bootstrap/app.ts` — `createApp(config, deps?)` 已存在；P3 擴 `deps.authInstance?: BetterAuthInstance`（for test override，Pitfall #5446 規避用）並插入 `createAuthModule(shared)` 於 health module 之前
- `src/shared/infrastructure/db/client.ts` — `createDbClient(config)` 已存在；BetterAuth drizzle-adapter 接收同一 `db` instance
- `src/shared/presentation/plugins/error-handler.plugin.ts` — onError 已讀 `err.httpStatus`，D-12 401 body 由 ErrorHandler 處理（`ForbiddenError.httpStatus = 403` 等由 kernel 鎖定）
- `docs/decisions/0011-resolver-precedence-apikey-over-cookie.md` — P1 已 accepted；P3 spike 驗證後若無需修正則「Decision Drivers」段落補一段「P3 spike 結果：確認 API Key 優先 cookie 實測通過」；若需修正則新增 `0011a-*.md` Supersedes

### External specs（agent 實作時參考）
- BetterAuth 官方 docs — `https://better-auth.com/docs/integrations/elysia`（`.mount(auth.handler)` 正規路徑）、`https://better-auth.com/docs/adapters/drizzle`（`drizzleAdapter(db, { provider: "pg", schema })`）、`https://better-auth.com/docs/plugins/api-key`（apiKey 配置 + hashing）、`https://better-auth.com/docs/concepts/rate-limit`（D-16 memory store 語法）
- BetterAuth CLI generate — `bunx @better-auth/cli generate` 產出的 Drizzle schema 直接 commit（Pitfall #5 Anti-Pattern 5 明示不可手寫）
- Elysia 官方 docs — `https://elysiajs.com/patterns/macro`（D-02 use case 層 scope check 背景）、`https://elysiajs.com/essential/plugin`（scope `global` 機制）
- Elysia #5446 issue — BetterAuth schema gen 相容性；spike plan (D-17) 先跑、確認後若仍不穩定則 work-around（如 pin BetterAuth 次版本）
- MADR 4.0 canonical — `https://adr.github.io/madr/`（P3 新增 ADR 0013/0014/0015/0016 格式一致）
- NIST SP 800-53 / Google API Keys best practices — D-19 (prefix) / D-21 (prefix+hash indexed) / D-23 (hashing: sha256) / D-24 (revocation) 設計依據
- OWASP Session Fixation — `https://owasp.org/www-community/attacks/Session_fixation`（AUTH-11 + Pitfall #6，verify BetterAuth 1.6.5 reset 行為是否自帶 session purge）

### CVE / advisory（必 watchlist）
- CVE-2025-61928 — `https://zeropath.com/blog/breaking-authentication-unauthenticated-api-key-creation-in-better-auth-cve-2025-61928` — 攻擊 pattern: 未 auth 之 POST /api-keys 帶 `body.userId` 建 victim 的 key；P3 regression test 必須明確複現此 pattern 並驗證 401
- BetterAuth Security Advisories — `https://github.com/better-auth/better-auth/security/advisories`（P3 commit 時 package.json BetterAuth 版本 >= 1.3.26）
- AUTH-15 防線實作：`CreateApiKeyUseCase.execute` 第一行 `if (input.userId && input.userId !== ctx.userId) throw new ForbiddenError('USER_ID_MISMATCH')`；實際 BetterAuth plugin 應已修但 Rigging 多一層檢查不會遮遺任何決定

### P3 產出物（由本 CONTEXT 鎖定、downstream 必產）
- `src/auth/domain/auth-context.ts` — `AuthContext` type + `ALLOWED_SCOPES` 常數（D-05）
- `src/auth/domain/errors.ts` — `UnauthorizedError` / `ForbiddenError` re-export 或擴充（依 P1 kernel）
- `src/auth/domain/values/{email,api-key-hash}.ts` — value objects
- `src/auth/application/ports/{identity-service,user-repository,api-key-repository,email}.port.ts`
- `src/auth/application/usecases/{register-user,verify-email,request-password-reset,reset-password,create-api-key,list-api-keys,revoke-api-key}.usecase.ts`
- `src/auth/infrastructure/better-auth/{auth-instance,identity-service.adapter}.ts`（D-15）
- `src/auth/infrastructure/repositories/{drizzle-user,drizzle-api-key}.repository.ts`
- `src/auth/infrastructure/email/console-email.adapter.ts`
- `src/auth/infrastructure/schema/{user,session,account,verification,api-key}.schema.ts`（D-17 由 BetterAuth CLI 生成並 commit）
- `src/auth/presentation/plugins/auth-context.plugin.ts` + `require-auth.macro.ts`（macro 單一根層、scope `global`；D-02 scope check 不在 macro）
- `src/auth/presentation/controllers/{auth,api-key,me}.controller.ts`
- `src/auth/auth.module.ts` — `createAuthModule(shared: SharedDeps): Elysia`
- `drizzle/0001_auth_foundation.sql`（及後續 migration）
- `docs/decisions/0013-api-key-storage-hash-plus-index.md`（D-21）
- `docs/decisions/0014-api-key-hashing-sha256.md`（D-23）
- `docs/decisions/0015-rate-limit-memory-v1-persistent-v2.md`（D-16）
- `docs/decisions/0016-betterauth-defaults-trust.md`（D-18）
- `docs/decisions/README.md` — 新增上述 4 條索引列
- `tests/integration/auth/*.regression.test.ts` — 包含 CVE-2025-61928 pattern / AUX-06 no-auth-plugin → 401 / precedence (AUX-07) / timing-safe compare / password reset invalidates other sessions / API Key hashed not plaintext

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/shared/kernel/errors.ts`** — `DomainError` 基底類別（`code` + `httpStatus` + `cause?`）；P3 新增的 auth errors 只需繼承並填兩欄位：
  - `UnauthorizedError extends DomainError` (httpStatus: 401, code: 'UNAUTHENTICATED')（D-12 body 由 global errorHandler 構築）
  - `ForbiddenError extends DomainError` (httpStatus: 403, code varies: 'INSUFFICIENT_SCOPE' / 'SCOPE_NOT_SUBSET' / 'USER_ID_MISMATCH')
- **`src/shared/kernel/id.ts`** — `UserId` brand type + `crypto.randomUUID()` factory；BetterAuth 生的 user.id 字串在 `IIdentityService.verifySession` 出口處 `as UserId`，進 AuthContext 之前就是 branded
- **`src/shared/kernel/result.ts`** — `Result<T, E>`；`CreateApiKeyUseCase.execute` 可回 `Result<CreatedApiKeyDto, ForbiddenError>` 讓 controller 二選一 handle
- **`src/shared/infrastructure/db/client.ts`** — `createDbClient(config)` 回 `{ db, sql }`；BetterAuth drizzle-adapter 接 `db`（同一 instance，auth table 與 demo domain table 在同一 transaction boundary）
- **`src/shared/presentation/plugins/error-handler.plugin.ts`** — 已讀 `err.httpStatus` 並組 body `{ error: { code, message, requestId } }`（P2 D-12）；D-12 401 body + D-06 INSUFFICIENT_SCOPE body 全部直接經此 plugin 映射，**P3 不必改 errorHandler**
- **`src/shared/presentation/plugins/request-logger.plugin.ts`** — pino 已 redact `req.headers.authorization / cookie / x-api-key` 與 `res.headers.set-cookie`（P2 D-11）；D-10 malformed key / D-12 UNAUTHENTICATED log 走 warn 不需改 plugin
- **`src/bootstrap/app.ts`** — `createApp(config, deps?: AppDeps)`；P3 擴 `AppDeps.authInstance?` 便 test 注入假 BetterAuth（for #5446 規避與 atomicity verification）；`createHealthModule(deps)` 之前加 `createAuthModule(shared)` 一行
- **`src/bootstrap/config.ts`** — env 校驗（TypeBox）；P3 新增 `BETTER_AUTH_SECRET: t.String({ minLength: 32 })` + `BETTER_AUTH_URL: t.String({ format: 'uri' })`
- **`src/_template/`** — 空 DDD 骨架，`src/auth/` 以此為模板（feature module factory pattern）
- **Package dependencies 已全裝（Phase 1）:** `better-auth@1.6.5` / `@better-auth/drizzle-adapter@1.6.5` / `drizzle-orm@0.45.2` / `postgres@3.4.9` / `elysia@1.4.28`、pino、@elysiajs/cors、@elysiajs/swagger — 無需 `bun add`

### Established Patterns (from P1 + P2 + research)
- **Feature module factory** — `createAuthModule(shared: SharedDeps): Elysia` 回 plugin（P2 D-04 / ARCHITECTURE Pattern 5）
- **Domain barrel + internal** — `src/auth/domain/index.ts` 為唯一 entry；auth feature 的 public 流程（register / verify / login / reset）不走 factory pattern（它們是未驗證前的進入點，不需要 `AuthContext`）—— 這些 use case 直接在 `auth.module.ts` 內 new UseCase 而非經 `getXxxService(ctx)` factory
- **Protected use case factory pattern** — 需 AuthContext 的 use case（CreateApiKey / ListApiKeys / RevokeApiKey / /me-related），透過 `getApiKeyService(ctx: AuthContext)` factory 取得；factory 內 `if (!ctx?.userId) throw new AuthContextMissingError()`（Pitfall #1 防線；P1 D-11 延伸）
- **Macro 單一根層** — `authContextPlugin` 以 `scope: 'global'` 掛在 `createAuthModule` 最外層；Feature `.use(authContextPlugin)` 一次；macro `requireAuth: true` 由各 route 宣告
- **Error handler 讀 `err.httpStatus`** — 不用 switch/map；P3 新 error class 只需繼承 DomainError 並設 httpStatus
- **Biome DDD rules** — `src/auth/domain/` 禁 import drizzle-orm / better-auth / elysia / postgres / pino；P1 D-09 已設，P3 新 code 會直接被 lint 擋

### Integration Points
- **`src/auth/` 目錄將新建** — 參照 `src/_template/` 或 `src/health/`；feature vertical slice 包含 `domain / application / infrastructure / presentation / auth.module.ts`
- **`createApp(config, deps)` 加一行** — `.use(createAuthModule({ db, authInstance, clock, logger }))`，放在 `.use(swaggerPlugin())` 之後、`.use(createHealthModule(healthDeps))` 之前（Plugin ordering follow P2 D-06 canonical + ADR 0012：橫切先於 feature modules；auth plugin 掛根以符 D-15 單一根層 macro）
- **`drizzle/` migration 首度有 auth table** — Drizzle migration 從 P1 的「空目錄」變成「0001_auth_foundation」；drizzle.config.ts 的 `schema: './src/**/infrastructure/schema/*.ts'` 已設 — P3 的 auth schema 自動被掃描
- **ADR 索引 `docs/decisions/README.md`** — P3 會新增 4 條 ADR（0013~0016），索引表照 P1 D-15 欄位（編號 / 標題 / Status / 日期 / Supersedes）追加
- **demo domain (Phase 4) 依賴點** — Phase 4 的 `DEMO-04` 要驗 `apiKey.userId === agent.ownerId`；P3 必確保 `IApiKeyRepository.findByPrefix(prefix)` 或類似查詢回的物件含 `userId` 欄位以供 Phase 4 use case 讀取

### Risks carried from Phase 1 + 2 to watch（P3 特別關注）
- **Pitfall #4 (Elysia scoped plugin `undefined` cascade)** — D-11 「身分單一」invariant + D-02 use case 層 scope check 是主防線；macro 掛根以 `scope: 'global'` 確保 ctx.authContext 型別在任何 `requireAuth: true` route 下都是 `AuthContext` 非 `AuthContext | undefined`
- **Pitfall #5 (bun:sql transaction hang)** — P1 ADR 0010 postgres-js 驅動已鎖；P3 BetterAuth drizzle-adapter 接同一 db instance，不涉及 bun:sql
- **Pitfall #5446 (BetterAuth schema gen 失敗 on 近期 Elysia)** — D-15 檔案解耦 + D-17 獨立 spike plan 為主防線；若 spike 發現仍失敗，工作繞道：pin BetterAuth 次版本回 1.5.x 或 reach upstream issue
- **Pitfall #6 (session fixation on reset)** — AUTH-11 requirement 明示；P3 spike 先驗 BetterAuth 1.6.5 是否自帶 session purge，否則 wrap reset hook（researcher/planner 決 wrap 位置：BetterAuth `emailAndPassword.resetPassword.after` hook 或 use case 層明 call `sessionRepo.deleteOthers(userId, exceptId)`）
- **Pitfall #7 (BetterAuth rate limit gaps, esp. /send-verification-email #2112)** — D-16 wrapper rate limiter 防線；memory store v1 accepted，v2 升級到 persistent store 與 per-email cap

</code_context>

<specifics>
## Specific Ideas

- **`ALLOWED_SCOPES` 常數與 TypeBox schema 必須引用同一 source**（D-05）—— 寫法範例：
  ```ts
  // src/auth/domain/auth-context.ts
  export const ALLOWED_SCOPES = ['*', 'read:*'] as const
  export type Scope = typeof ALLOWED_SCOPES[number]

  // src/auth/presentation/dtos/create-api-key.dto.ts
  import { ALLOWED_SCOPES } from '../../domain/auth-context'
  export const CreateApiKeyBody = t.Object({
    label: t.String({ minLength: 1, maxLength: 64 }),
    scopes: t.Array(t.Union(ALLOWED_SCOPES.map(s => t.Literal(s))), { default: ['*'] }),
    expiresAt: t.Optional(t.String({ format: 'date-time' })),
  })
  ```
  未來 v2 新增 scope 只改常數，DTO schema 自動同步。Executor 不可把字串 literal 寫死在 DTO。

- **timing-safe 寫法一致**（D-10）：`timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))`；**若兩個 buffer 長度不同 `timingSafeEqual` 會直接 throw**。Resolver 實作必須：
  1. Parse raw API key → 取出 prefix 與後段
  2. 若格式不符（prefix 錯 / 長度錯） → **仍跑一次** `timingSafeEqual(zeroBuf, zeroBuf)` + **仍跑一次** dummy DB SELECT（確保 query 總 latency baseline 一致）→ return null
  3. 若格式 OK → 真正 prefix lookup → `timingSafeEqual(Buffer.from(hash_of_raw), Buffer.from(row.hash))`
  - **若 executor 圖方便寫 `if (!key.startsWith('rig_live_')) return 401`** 沒補 dummy operations，就是漏了 D-10。Planner 必須為此寫明的一條 unit test：`malformed-path-timing-vs-valid-hash-path` 用 `performance.now()` 量 1000 次 sample 均值做 assertion（不 strict equal，assert `|t_malformed - t_valid| / t_valid < 0.2` 之類）。

- **CVE-2025-61928 regression test 必須精確複現攻擊 pattern**：
  ```ts
  // tests/integration/auth/cve-2025-61928.regression.test.ts
  it('unauthenticated POST /api-keys with body.userId returns 401', async () => {
    const app = createApp(testConfig, { db: fakeDb, authInstance: realAuth })
    const victim = await createTestUser(fakeDb, 'victim@example.com')

    const res = await app.handle(new Request('http://localhost/api-keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },  // NO Authorization, NO cookie
      body: JSON.stringify({ userId: victim.id, label: 'attacker-key' }),
    }))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required', requestId: expect.any(String) } })
    // Critical: verify no key was created
    const keys = await fakeDb.select().from(apiKeys).where(eq(apiKeys.userId, victim.id))
    expect(keys).toHaveLength(0)
  })
  ```
  `label` 檔名 `.regression.test.ts` 讓 P5 test 整併時可 grep 一次性移到 `tests/regression/`。

- **Plan 03-01 spike acceptance criterion**（D-17）：executor 不可把 spike 與後續 auth domain 合一。spike 交付物是一份 `schema/*.ts` + 一份 `drizzle/0001_auth_foundation.sql` + 一次 commit；若產出的 schema 有 unexpected column（Pitfall #5446 變種）或 migration 包含非預期欄位（e.g. BetterAuth 在 1.6.x 生了新欄位），執行者 **不得自行改生成物**，回頭開 Q 給使用者決策（pin BetterAuth 次版本？手寫 patch migration？）。

- **Rigidity Map 對應更新**：P1 ADR 0009 Rigidity Map 三級中，`requireAuth` macro 單一根層、scope global 屬「必嚴格，無逃生口」—— P3 ship 時可 verify ADR 0009 仍描述正確，若發現「macro 位置」在 P3 實作時出現彈性需求（例如某 subpath 想自己掛自己的 macro），先停下來開 ADR supersede 而非改 AGENTS.md。

- **AuthContextMissingError 必含教學訊息**（Pitfall #11，P1 D-12 四段格式延伸）：
  ```
  AuthContext is missing when calling getApiKeyService(ctx).

  Reason: Domain services require AuthContext from `requireAuth: true` macro.
  See docs/decisions/0006-authcontext-boundary.md.

  Fix: Declare `requireAuth: true` in your route options. Example:
    new Elysia().get('/api-keys', handler, { requireAuth: true })
  ```
  Executor 不得只寫 `'AuthContext is missing'` 一行。

- **`/me` 不加 Swagger `security` 標記的其他 scope 但仍加 security 本身**（D-08）：Swagger route 宣告 `{ detail: { security: [{ cookieAuth: [] }, { apiKeyAuth: [] }] } }` 但沒 `scope` 欄；這告訴 API consumer 「有 session 或 key 即可」而非「有特定 scope 才行」。

</specifics>

<deferred>
## Deferred Ideas

以下想法在 P3 討論中浮現但屬後續 phase / v2 範疇：

- **BetterAuth rate limit 持久化 store（Postgres / Redis）+ per-email 統計儀表 + admin visibility** → v2 PROD-02（P3 只做 memory store + dev log.warn + per-email wrapper）
- **API Key TTL 自動 purge（revoked > 30 天 cron）** → v2 PROD hardening；P3 只做 soft delete，手動 cleanup 由運營決定
- **API Key 以 prefix namespace 區分環境（`rig_test_` / `rig_prod_`）** → v2 SCAF-* 或 PROD-*；v1 只用 `rig_live_`
- **BetterAuth multi-environment config（staging / prod 不同 secret / base URL）** → 交由 `config.ts` env schema 處理，不額外設計
- **OAuth / 2FA / Magic Link / Passkey** → v2 IDN-*（PROJECT.md Out of Scope，已鎖）
- **scope 擴充到 resource-action 粒度（`read:agents` / `write:agents`）** → v2 TEN-02 RBAC；P3 `'read:*'` 足以示範 DEMO-05
- **session 表 expired cleanup / session 數量上限** → v2 PROD（Pitfall「session table 無界生長」）
- **Dev 環境 `/debug/whoami` endpoint** → Pitfall UX 建議；P3 的 `/me` 已覆蓋 happy path，`/debug/whoami` 僅在生產 debug 場景 necessary，v2 考慮
- **API Key 旋轉 endpoint（`PATCH /api-keys/:id` 產新 raw key 保留 metadata）** → v2 convenience；v1 用「revoke + create new」走一遍已達成
- **BetterAuth webhook（user.created / session.revoked 事件）** → v2 event-bus / AGT-03
- **audit log 專用 table（API Key 使用記錄、失敗驗證嘗試）** → v2 observability / compliance
- **per-user API Key 數量上限** → v2；v1 信 human 自己管理
- **Swagger 安全 schemes 的 `bearerAuth` 類型** → 未啟用 bearer plugin，故不需要
- **Eden Treaty + BetterAuth 型別破損偵測 (Pitfall #15)** → P5 QA（docs 測試）範疇
- **Admin 路徑 / sudo scope** → v2 TEN-* 後再談
- **AUTH-08「未驗證 email 之使用者嘗試特定受保護操作時回 403」的具體 endpoint 清單** → v1 保留擴充點；P3 在 use case factory 層放「email 未驗證則 throw」hook but 不 wire 到任何 route（留 interface，v2 或 demo domain 決定用在哪）

未提及但屬於未來 phase：
- Demo domain (Agent / PromptVersion / EvalDataset) → Phase 4
- Testcontainers integration test / CI workflow / README / quickstart → Phase 5
- Production deployment / observability → v2 PROD-*

</deferred>

---

*Phase: 03-auth-foundation*
*Context gathered: 2026-04-19（interactive，4 區各 4-8 題，共 25 條決策）*
