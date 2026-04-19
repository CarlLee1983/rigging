# Phase 3: Auth Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `03-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 03-auth-foundation
**Areas discussed:** Scope design, Resolver precedence, BetterAuth 整合 surface, API Key lifecycle & storage shape
**Mode:** Interactive（使用者逐區選擇 → 全 4 區深度討論 → 共 25 條決策）

---

## Scope Design

### Q1. Scope 字串詞彙 v1 多細？

| Option | Description | Selected |
|--------|-------------|----------|
| 最簡 `['*']` / `['read:*']` | 兩值；DEMO-05 可實測；真正 RBAC defer v2 | ✓ |
| 資源-動作粒度 `read:agents` / `write:agents` | 當代 SaaS 風；P4 resources 未 land，P3 要先 pre-define | |
| Freeform string[] 無詞彙限制 | 彈性高但 typo 成 silent dead scope | |

**User's choice:** 最簡 `['*']` / `['read:*']`
**Notes:** 符合 PROJECT.md「囚型在輸概念，不囚型在細節」。

---

### Q2. Scope 檢查落在哪裡？

| Option | Description | Selected |
|--------|-------------|----------|
| Use case 層（command 內體別判斷） | ARCHITECTURE Pattern 3 風；可單元測試；runtime guard > type guard | ✓ |
| Macro 帶參數 `requireAuth: { scope: '…' }` | presentation 層 declarative；Pitfall #2 scoped plugin undefined cascade 繞不過 | |
| 雙層 defense-in-depth（Macro + use case） | 最囚但樣板程式碼翻倍 | |

**User's choice:** Use case 層

---

### Q3. Human cookie session 的預設 scopes？

| Option | Description | Selected |
|--------|-------------|----------|
| Human 給 `['*']`（sudo） | API Key 是 human 的子集；DEMO-05 直觀 | ✓ |
| Human 給 `['user']`（象徵性 token） | `'*'` 保留給未來 admin；v1 用不到 | |
| Human 走顯示 scopes 列表 | 無特殊值；新 resource 時 human session 要同步更新 | |

**User's choice:** Human 給 `['*']`（sudo）

---

### Q4. API Key invariant — human 能建立比自己 scope 更寬的 key 嗎？

| Option | Description | Selected |
|--------|-------------|----------|
| 不行 — `key.scopes ⊆ session.scopes` | least-privilege；CVE-class 多一層檢查 | ✓ |
| 隨意 — 只檢 `session.userId === body.userId`（AUTH-15） | 簡單；未來 human scope 縮減時熱衛生 hole | |

**User's choice:** subset check

---

### Q5. POST /api-keys 的 scopes validation？

| Option | Description | Selected |
|--------|-------------|----------|
| Allow-list 嚴格驗證（TypeBox literal union） | typo 不會變 silent dead scope | |
| Accept any string[] | v2 擴展簡單但 typo 風險 | |
| Validate + 共用常數（`ALLOWED_SCOPES`） | domain 常數 + schema 動態引用；v2 加 scope 只改常數 | ✓ |

**User's choice:** Validate + 共用常數
**Notes:** 常數位置 `src/auth/domain/auth-context.ts`。

---

### Q6. 無 scope 時 403 response body shape？

| Option | Description | Selected |
|--------|-------------|----------|
| 詳細但不洩追加幾條（`INSUFFICIENT_SCOPE` + 缺哪個） | teaching moment 友善，scope 詞彙公開 | ✓ |
| 泛 `FORBIDDEN` | 防 enumeration，但 dev UX 差 | |
| Dev/Prod 模式切換 | parity 債 | |

**User's choice:** 詳細（INSUFFICIENT_SCOPE + 缺哪條）

---

### Q7. `'*'` 未來語意鎖定

| Option | Description | Selected |
|--------|-------------|----------|
| `'*'` = 永等 catch-all | 新 scope 自動授予舊 key；v2 收緊再開 ADR | ✓ |
| `'*'` = 創建時 snapshot 凍結 | 安全但 DB 不同步、v2 migration 複雜 | |
| `'*'` 是 v1 temporary / v2 強制明示 rotate | 最安全但上線 ≈ 舊 key 作廢，差 DX | |

**User's choice:** 永等 catch-all

---

### Q8. `/me` endpoint 是否需 scope？

| Option | Description | Selected |
|--------|-------------|----------|
| 只檢 `requireAuth`，無 scope check | identity introspection 回 ctx 本身，不星外洩 | ✓ |
| 需 `read:*` 或 `*` | 所有 read endpoint 從同詞彙；write-only key 打 /me 回 403 反直覺 | |
| 需 `*`（sudo） | 「key 多大權」不被 /me 探知；但使用性差 | |

**User's choice:** 只檢 requireAuth

---

## Resolver Precedence

### Q9. API Key 驗證失敗 + cookie 有效 → ?

| Option | Description | Selected |
|--------|-------------|----------|
| 硬 401、不 fallback cookie | 身分明朗，audit log 答得了「誰做的」 | ✓ |
| Fallback 到 cookie session | UX 溫容但雙身分互脫 | |

**User's choice:** 硬 401，不 fallback

---

### Q10. Malformed API Key header → ?

| Option | Description | Selected |
|--------|-------------|----------|
| Fast-reject 401 + timing 對齊 valid-format-wrong-hash baseline | AUX-04 timing-safe 涵蓋整段 auth path | ✓ |
| 嘗試 cookie（同 Q9 fallback 邏輯） | 若 Q9 選 fallback 才一致 | |
| Fast-reject 401 不管 timing | 簡單但技術債 | |

**User's choice:** Fast-reject 401 + timing 對齊

---

### Q11. API Key + cookie 都有效 → AuthContext shape？

| Option | Description | Selected |
|--------|-------------|----------|
| 只留 `apiKeyId`，忽略 cookie（identityKind='agent'，`sessionId` 不設） | 「一請求一身分」invariant 不破 | ✓ |
| 雙權黏都搭（`apiKeyId` + `sessionId`） | 破身分單一 invariant；Pitfall #2 愛用場景 | |

**User's choice:** 只留 apiKeyId

---

### Q12. 所有 401 scenario body 是否同一？

| Option | Description | Selected |
|--------|-------------|----------|
| 同一 `UNAUTHENTICATED` + `requestId`（dev 透過 server log 取細節） | Pitfall #13 single generic；enumeration 最少 | ✓ |
| 分級 `INVALID_API_KEY` / `INVALID_SESSION` / `EXPIRED_SESSION` | UX 好但 OWASP enumeration vector | |
| Dev 細節 / Prod 同一 | parity 債 | |

**User's choice:** 同一 UNAUTHENTICATED + requestId

---

## BetterAuth 整合 Surface

### Q13. BetterAuth plugins 換設哪些？

| Option | Description | Selected |
|--------|-------------|----------|
| 只 apiKey() | email-and-password 內建；滿足 AUTH-12~16 + AUX-01~07 | ✓ |
| apiKey() + bearer() | 三條 auth 路徑，AUX-03 precedence 要重寫；與雙軌精神衝突 | |
| 只 email-and-password，apiKey plugin defer | 挑戰 ROADMAP Phase 3 atomic | |

**User's choice:** 只 apiKey()

---

### Q14. BetterAuth handler mount basePath？

| Option | Description | Selected |
|--------|-------------|----------|
| /api/auth | 文件標準 + 大多社區範例；避 #3384 | ✓ |
| /auth | 短但與範例分歧 | |
| /auth/v1 | YAGNI | |

**User's choice:** /api/auth

---

### Q15. auth-instance.ts 檔案位置？

| Option | Description | Selected |
|--------|-------------|----------|
| `src/auth/infrastructure/better-auth/auth-instance.ts` | feature vertical slice；Pitfall #5446 「config 與 Elysia bootstrap 解耦」 | ✓ |
| `src/shared/infrastructure/auth/auth-instance.ts` | STACK.md 範例；但其他 feature 不應 reach 進 auth 內部 | |

**User's choice:** src/auth/infrastructure/better-auth/auth-instance.ts

---

### Q16. BetterAuth built-in rate limit 在 P3 開還是 defer？

| Option | Description | Selected |
|--------|-------------|----------|
| P3 最小可用 — memory store + 預設欄位 + log.warn + per-email wrapper | 防護不完備溫容版；v2 PROD-02 升級 | ✓ |
| 總 defer v2 PROD-02 | 空口，外部 clone 跑一下就暴露 | |
| P3 自行打包 BetterAuth rate limit | 偏離 atomic phase 核心 | |

**User's choice:** P3 最小可用

---

### Q17. BetterAuth schema 生成 + commit 如何安排？

| Option | Description | Selected |
|--------|-------------|----------|
| Plan 03-01 獨立 spike + commit schema + migration | 工具相容 issue（#5446）先驗；rollback 成本低 | ✓ |
| 統在第一張 plan 開頭步驟 | plan 數量減一；rollback 難 | |
| 手寫頭 schema 不跟 BetterAuth CLI | Pitfall #5 Anti-Pattern 5 被支起 | |

**User's choice:** Plan 03-01 獨立 spike

---

### Q18. Session cookie 屬性？

| Option | Description | Selected |
|--------|-------------|----------|
| 信 BetterAuth 預設（HttpOnly + Secure + SameSite=Lax），ADR 釘定 | BetterAuth 1.6.5 預設安全；ADR 鎖依賴 | ✓ |
| 明寫覆寫所有 cookie attributes | audit 友善但可能錯過 BetterAuth 版本更新預設 | |

**User's choice:** 信 BetterAuth 預設 + ADR 釘定

---

## API Key Lifecycle & Storage Shape

### Q19. API Key prefix 格式？

| Option | Description | Selected |
|--------|-------------|----------|
| `rig_live_` + 32 bytes base64url | 單一 prefix；git/log leak scan 方便；未來可擴 `rig_test_` | ✓ |
| `rig_agent_` 獨立 prefix | 讓 prefix 標東身分來源；危險 | |
| 純隨機，無前綴 | logs / git 洩漏難搜；BetterAuth lookup 麻煩 | |

**User's choice:** rig_live_ + 32 bytes base64url

---

### Q20. POST /api-keys response body shape？

| Option | Description | Selected |
|--------|-------------|----------|
| 扁平 `{ id, key, prefix, label, scopes, expiresAt, createdAt }` | client 不需解嵌套；「存這個」提示明確 | ✓ |
| 嵌套 `{ apiKey: {...}, plaintext: 'rig_live_...' }` | plaintext 分欄看似貴重；實際混淆 | |
| 只回 `{ id, key }`，metadata 另端 GET | 2 輪 API 呼叫，貴 | |

**User's choice:** 扁平

---

### Q21. DB 儲存欄位策略？

| Option | Description | Selected |
|--------|-------------|----------|
| `prefix` (text, indexed 前 8 字元) + `hash` (text, unique) | Pitfall #4 推薦；O(log n) lookup | ✓ |
| 只 hash，整筆 hash 作為 lookup key | 大型 key set O(log n) 但失 prefix audit | |
| 信 BetterAuth plugin 預設 | 非明確權威；version 綁定 | |

**User's choice:** prefix + hash 分欄

---

### Q22. 預設 expiresAt（body 無此欄位時）？

| Option | Description | Selected |
|--------|-------------|----------|
| 預設 90 天 | Pitfall #4「強制 opt-out 過期」；平衡 UX | ✓ |
| 預設 30 天 | 安全但短 | |
| No default，必填 | 過嚴，毀 agent 自動化 UX | |
| 永不過期 (null) | Pitfall #4 明示反例外 | |

**User's choice:** 預設 90 天

---

### Q23. BetterAuth apiKey plugin hashing 選項？

| Option | Description | Selected |
|--------|-------------|----------|
| 明寫 `hashing: 'sha256'` | Pitfall #4 建議；audit 可見；ADR 釘定 | ✓ |
| 信 plugin 預設 | 假設預設永遠安全且不變；audit 死角 | |

**User's choice:** 明寫 hashing: 'sha256'

---

### Q24. DELETE /api-keys/:id 模式？

| Option | Description | Selected |
|--------|-------------|----------|
| Soft delete（`revokedAt` timestamp） | Audit / forensics 友善；regression test 可驗 | ✓ |
| Hard delete | 乾淨但 forensics 不便 | |
| Soft delete + TTL cron purge | P3 不含 cron | |

**User's choice:** Soft delete: revokedAt timestamp

---

### Q25. POST /api-keys body.label 規約？

| Option | Description | Selected |
|--------|-------------|----------|
| Required, 1-64 chars, trim, UTF-8 | dashboard 強制命名；UTF-8 任何語言 OK | ✓ |
| Optional，空時 auto-generate 'API Key #n' | unnamed key UX 災難 | |
| Required 無 trim / 無長度限 | DB bloat / zalgo 風險 | |

**User's choice:** Required, 1-64 chars, trim, UTF-8

---

## the agent's Discretion

下列項目未在討論中明示決策，由 researcher / planner / executor 依 ARCHITECTURE.md + STACK.md + P1/P2 CONTEXT + BetterAuth 文件直接決定：

- BetterAuth apiKey plugin 其他欄位（`prefix` 是否 plugin 自加 / `start` 長度 / `length` 總字數）
- Drizzle migration 檔名
- auth module factory 具體 shape（已有 ARCHITECTURE Pattern 5 範例）
- IEmailPort shape + ConsoleEmailAdapter 輸出格式
- BunPasswordHasher port / adapter（P3 實務上不需暴露獨立 port）
- IUserRepository / IApiKeyRepository port 位置（`src/auth/application/ports/`）
- Mapper 命名（`UserMapper.toDomain` / `toPersistence`）
- Regression test 檔案組織（`.regression.test.ts` 尾碼供 P5 搬遷）
- `/me` controller 檔位與 `identityKind` 回傳格式
- auth feature module 是否拆子目錄（單一 `src/auth/` 即可）
- P3 新增 ADR 編號順序（預計 0013~0016）
- Session fixation 防線實作（包 reset hook 或 use case 層 `sessionRepo.deleteOthers(userId, exceptId)`）

## Deferred Ideas

見 `03-CONTEXT.md` `<deferred>` 段落。主要包含：BetterAuth rate limit 持久化、API Key TTL purge、multi-environment prefix、OAuth/2FA/Passkey、scope resource-action 粒度、session TTL cleanup、`/debug/whoami`、API Key rotate endpoint、event bus / webhooks、audit log table、per-user key 上限、admin scope。
