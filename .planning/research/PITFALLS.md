# Pitfalls Research

**Domain:** Opinionated TypeScript backend scaffold (Bun + Elysia + PostgreSQL + Drizzle + BetterAuth) acting as an AI-Agent harness with DDD + ADR discipline and a mandatory AuthContext boundary
**Researched:** 2026-04-18
**Confidence:** HIGH (auth / Bun / BetterAuth / Drizzle specifics verified against official docs, GitHub issues, and CVE advisories) · MEDIUM (ADR and opinionated-framework-trap pitfalls verified across multiple credible sources) · MEDIUM (AI-agent-harness pressure pitfalls — newer territory, fewer canonical sources)

Pitfalls below are ordered by severity: **Catastrophic** (Rigging's thesis collapses or a CVE-class bug ships), **Major** (significant rework required), **Minor** (annoyance, tech debt). Each pitfall maps to a likely phase in the v1 roadmap.

Assumed phase structure (from PROJECT.md Active Requirements):
- **P1 Foundation** — Bun + Elysia + TS + Postgres + Drizzle skeleton, DDD layering, ADR process
- **P2 Auth** — BetterAuth integration, email/password, verification, reset, sessions
- **P3 AuthContext + API Keys** — dual-track identity (session + API key), runtime guards, AuthContext as mandatory boundary
- **P4 Demo Domain** — Agent meta-project (prompt versioning, eval datasets) as dog-food proof
- **P5 Tests + Docs** — community-grade unit + integration tests, README, quickstart

---

## Critical Pitfalls

### Pitfall 1: AuthContext is advisory, not mandatory — handlers can bypass the boundary

**Severity:** Catastrophic (Rigging's Core Value fails — "any Domain operation must pass AuthContext, no AuthContext means handler can't even wire up")

**What goes wrong:**
Elysia handlers can still `import { userService } from '.../UserService'` at module top level and bypass DI entirely. `.derive()` populates context but nothing forces the handler to read from context — so AI Agents naturally write the most convenient thing, which is a direct import. The guardrail exists but is not enforced.

**Why it happens:**
- Elysia `.derive()` / `.decorate()` *adds* to context — it does not *remove* module-level access.
- Domain services are normal TypeScript classes; `new UserService(db)` works from anywhere.
- TypeScript has no built-in "this module can only be imported via DI" primitive.

**How to avoid:**
Use a **factory pattern requiring AuthContext as the first argument to obtain any Domain service**, and *never export the service class directly*:

```ts
// Domain exposes ONLY a factory, never the class
// app/domain/user/index.ts
export const getUserService = (ctx: AuthContext): UserService => {
  if (!ctx?.userId) throw new AuthContextMissingError()
  return new UserService(ctx, deps)
}
// UserService class is NOT exported
```

Combine with an **ESLint rule that forbids importing from `app/domain/*/internal/*`** — only the factory barrel is allowed. This converts a runtime check into a lint-time refusal that an Agent cannot ignore ([Factory.ai on linters as agent guardrails](https://factory.ai/news/using-linters-to-direct-agents)).

**Warning signs:**
- A PR grep for `new UserService(` outside `app/domain/` returns results
- Integration tests pass when AuthContext is `undefined` (means the service was obtained without going through the factory)
- Agent-written code contains `import { UserService }` rather than `context.userService`
- Handler tests don't need to mock AuthContext

**Phase to address:** P3 (AuthContext + API Keys) — but the enforcement pattern (factory + lint rule) must be designed in P1 as part of the DDD skeleton, otherwise retro-fitting is painful.

---

### Pitfall 2: Elysia scoped-plugin `undefined` cascade — guard thinks user is authed when they aren't

**Severity:** Catastrophic (auth bypass on the "opt-out is impossible" platform)

**What goes wrong:**
When plugin A uses `.derive({ as: 'scoped' }, ...)` to inject `{ user }` and plugin B depends on A, B's handlers see `user` typed as `User | undefined`. Elysia's [documented gotcha](https://github.com/elysiajs/elysia/issues/1366) is that in "successive scoped plugins", derived values can silently become `undefined`. A guard that does `if (!ctx.user) throw` can *pass* in type-land but fail at runtime in the wrong direction — or worse, typed as `User` but actually `undefined` when plugin ordering shifts.

Additionally, [guard does not support derive/resolve](https://github.com/elysiajs/elysia/issues/566), so attempting to wire auth inside `.guard()` silently breaks.

**Why it happens:**
- Elysia's scope model (Global/Scoped/Local → Singleton/Ephemeral/Volatile) is documented but non-obvious. Agents guess.
- Plugin order matters; Elysia merges context based on registration order, and `.use()` chains in a different file can reorder it.
- The [BetterAuth Elysia integration issue #3384](https://github.com/better-auth/better-auth/issues/3384) shows even experts hit endpoint resolution quirks caused by plugin prefixes.

**How to avoid:**
1. **Single canonical auth plugin** registered at the root app, not per-route or per-module. Lock scope to `global` for the `user` / `authContext` decorator.
2. **Runtime assertion, not type trust**: every Domain service factory asserts `authContext !== undefined` with a specific error class — never rely on TS narrowing alone:
   ```ts
   if (!ctx.authContext) throw new AuthContextMissingError('...')
   ```
3. **Integration test for the happy-path-but-wrong-plugin-order case**: write a test that registers the app *without* the auth plugin and asserts every protected route returns 401, not 500 and not "pretend success".
4. Pin Elysia version and avoid `beta.*` releases until v1 is locked — the scope API has churned across versions.

**Warning signs:**
- `ctx.user` typed as `User | undefined` in any Domain-facing handler (should be `User`, period — if it can be undefined, the guard chain is broken)
- Any `?.` operator on `ctx.user` in a supposedly-protected handler
- Auth tests only cover "valid token works" and "no token returns 401" — missing "token present but plugin misordered"
- Eden Treaty client shows `any` for a user-dependent response ([eden#215](https://github.com/elysiajs/eden/issues/215), [elysia#1701](https://github.com/elysiajs/elysia/issues/1701))

**Phase to address:** P3 — but the plugin composition skeleton is laid in P1 and the auth plugin in P2; misdesigning either creates compound debt.

Sources:
- [Elysia #566: derive doesn't work as plugin inside guard](https://github.com/elysiajs/elysia/issues/566)
- [Elysia #1366: undefined cascade in scoped plugins](https://github.com/elysiajs/elysia/issues/1366)
- [BetterAuth #3384: some endpoints fail in Elysia](https://github.com/better-auth/better-auth/issues/3384)

---

### Pitfall 3: BetterAuth API-Key plugin ships CVE-class bugs (CVE-2025-61928 precedent)

**Severity:** Catastrophic (full account takeover via unauthenticated API-key creation was a real shipped vuln, CVSS 9.3)

**What goes wrong:**
In October 2025, [CVE-2025-61928](https://zeropath.com/blog/breaking-authentication-unauthenticated-api-key-creation-in-better-auth-cve-2025-61928) let an unauthenticated attacker create API keys for any user by simply including `userId` in the JSON body. The handler branch treated "no session + `userId` in body" as "trusted internal call". Patched in 1.3.26. BetterAuth is fast-moving early-version software, and Rigging bets v1 on it.

**Why it happens:**
- BetterAuth is feature-velocity mode; [version 1.5 in Feb 2026 added major API-key changes](https://better-auth.com/blog/1-5).
- Plugin pattern gives contributors lots of surface area to introduce auth-branch bugs.
- Rigging will likely want to wrap/extend the API-key plugin for its "Agent API keys" feature — which means *Rigging's code sits right on the bug-prone boundary*.

**How to avoid:**
1. **Pin BetterAuth to a known-good minor**, not `^x.y` — auth libs are the one place caret ranges are a bad default.
2. **Watchlist**: subscribe to [github.com/better-auth/better-auth/security/advisories](https://github.com/better-auth/better-auth/security/advisories) and have a documented "auth-lib advisory response" playbook as part of the ADR set.
3. **Defense-in-depth**: Rigging's AuthContext layer must *re-validate* that the caller matches the claimed identity on every API-key creation, not trust BetterAuth's internal check alone.
4. **Never expose raw BetterAuth endpoints as "the" API-key endpoint** — wrap them behind Rigging's own handler that enforces "the authenticated `userId` MUST equal the `userId` in body or body MUST omit it".
5. Integration test: "POST /api-key/create with `userId: <victim>` and no session → 401". Ship this test in P3 and never let it go red.

**Warning signs:**
- BetterAuth version in `package.json` uses `^` or `~`
- No recurring audit of BetterAuth changelog / advisories
- Rigging passes `userId` through to BetterAuth without double-checking against session
- Handler trusts `body.userId` anywhere

**Phase to address:** P3 (API Keys). Must land with the CVE-specific regression test from day one.

Sources:
- [ZeroPath: CVE-2025-61928 write-up](https://zeropath.com/blog/breaking-authentication-unauthenticated-api-key-creation-in-better-auth-cve-2025-61928)
- [BetterAuth security advisory GHSA-99h5-pjcv-gr6v](https://github.com/better-auth/better-auth/security/advisories/GHSA-99h5-pjcv-gr6v)
- [eSecurity Planet coverage](https://www.esecurityplanet.com/threats/better-auth-flaw-allows-unauthenticated-api-key-creation/)

---

### Pitfall 4: API keys stored as plaintext, shown forever, never rotatable

**Severity:** Catastrophic (DB breach = every Agent in every user's account compromised)

**What goes wrong:**
The naïve implementation is `apiKeys.key = generatedKey` stored verbatim, displayed in the dashboard every time, never rotatable. This is the 2019-era mistake that still ships in MVPs because it's the first thing an Agent will generate if left unconstrained.

Required properties for production-grade API keys ([NIST SP 800-53, Okta API-key guidance](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices)):
- **Hashed at rest** (bcrypt/argon2 — NOT reversible crypto like AES)
- **High entropy** — ≥32 bytes from `crypto.randomBytes()` / Bun `crypto.getRandomValues()`
- **Shown-once** at creation, never again; DB stores prefix + hash only
- **Prefixed** (e.g. `rig_live_...`) so they're detectable in git/log leaks and so BetterAuth's lookup is O(1)
- **Revocable** with an `expires_at` / `revoked_at` column
- **Scoped** — least-privilege via `permissions` JSON, not "all or nothing"

BetterAuth's API-key plugin supports all of these [when configured correctly](https://better-auth.com/docs/plugins/api-key) — but it also supports *disabling hashing*, which an Agent tuning for a weird error might flip off.

**Why it happens:**
- Default "just works" code paths favor plaintext for convenience in dev.
- Agent sees "get key, check DB" as 5 lines versus "hash, compare, handle prefix split" as 30.
- "I'll add rotation later" is the most seductive shortcut in all of auth.

**How to avoid:**
1. Configure BetterAuth with `apiKey({ hashing: 'sha256' })` (or stronger — verify current default) **explicitly** in the config, don't rely on the default. Add an ADR: "ADR-0XX: API keys are hashed at rest via X — this is non-negotiable."
2. Make the API-key creation endpoint return the full key exactly once in a `{ key, prefix, id }` shape. Document in OpenAPI: "key returned once, store it."
3. DB schema must have columns: `id`, `prefix` (first 8 chars, non-unique but queryable), `hash` (unique), `name`, `scopes` (JSON), `created_at`, `last_used_at`, `expires_at`, `revoked_at`. An Agent looking at the schema should *see* that the design enforces rotation.
4. Integration test: "create key → row in DB has no substring of the raw key". This single test prevents the most common regression.
5. Default expiration (say, 1 year). Force Agents to opt out of expiration rather than opt in.

**Warning signs:**
- DB migration contains `key: text()` with no `hash` suffix
- Dashboard shows the key on list view
- No `revoked_at` column
- No `scopes` column (or a boolean `isAdmin` — this is scoping done wrong)
- Manual `console.log(apiKey)` in any file

**Phase to address:** P3 — API-key creation, storage, and rotation must all land together. Shipping "create" without "revoke" is worse than shipping neither.

Sources:
- [BetterAuth API Key plugin docs](https://better-auth.com/docs/plugins/api-key)
- [Google Cloud API-key best practices](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices)
- [OneUptime: API Key Management Best Practices](https://oneuptime.com/blog/post/2026-02-20-api-key-management-best-practices/view)

---

### Pitfall 5: Bun's `bun:sql` / Postgres transaction hangs — connection pool becomes permanently stuck

**Severity:** Catastrophic (production deadlock requires process restart; happens under constraint violations, which are *normal*)

**What goes wrong:**
Multiple open Bun issues document that `bun:sql` with Postgres hangs indefinitely inside `sql.begin` when the callback throws a constraint violation (e.g. unique violation, exclusion constraint `23P01`). The connection enters a stuck state; any subsequent query on the pool also hangs; the entire process's DB access is wedged until restart. See:
- [bun#21934: Bun SQL transaction callback hangs on constraint violation](https://github.com/oven-sh/bun/issues/21934)
- [bun#22395: 23P01 exclusion constraint causes driver to get stuck](https://github.com/oven-sh/bun/issues/22395)
- [bun#17178: SQL loses connection after timeout](https://github.com/oven-sh/bun/issues/17178)
- [bun#23215: Postgres connection leak](https://github.com/oven-sh/bun/issues/23215)

Additionally, the `max` connection-pool parameter in `bun:sql` is reportedly not enforced — pool grows unbounded under load.

**Why it happens:**
Bun's Postgres driver is rewritten native code, not `node-postgres`. It's fast but younger, and the error-propagation plumbing in transaction callbacks has had multiple regressions. Drizzle's `bun-sql` driver is a thin wrapper — it inherits these bugs.

**How to avoid:**
**For v1, do not use `bun:sql` as the Drizzle driver.** Use `postgres` (porsager/postgres) via Drizzle's `drizzle-orm/postgres-js` driver instead. It runs fine on Bun, is battle-tested, and has correct transaction error propagation.

```ts
// Prefer:
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
const client = postgres(DATABASE_URL, { max: 10 })
export const db = drizzle(client, { schema })

// Avoid until bun:sql is stable:
// import { drizzle } from 'drizzle-orm/bun-sql'
```

Document this as an ADR: "ADR-0XX: Use `postgres-js` driver, not `bun:sql`, for v1. Revisit when [bun#21934 and #22395] close." This is a textbook ADR use-case — future Agents will wonder why, the ADR explains.

Add an integration test: "Insert duplicate key → callback throws → next query succeeds". This catches regression if someone swaps drivers back.

**Warning signs:**
- `drizzle-orm/bun-sql` import in any file
- Production logs show requests hanging indefinitely, not failing
- Constraint-violation errors appear to "succeed" (because the promise never resolved either way)
- Connection count in Postgres grows monotonically under load

**Phase to address:** P1 (Foundation) — driver choice is baked into the skeleton. Getting this wrong in P1 creates a hard migration later.

Sources:
- [bun#21934](https://github.com/oven-sh/bun/issues/21934), [bun#22395](https://github.com/oven-sh/bun/issues/22395), [bun#17178](https://github.com/oven-sh/bun/issues/17178), [bun#23215](https://github.com/oven-sh/bun/issues/23215)
- [Drizzle Bun-SQL docs](https://orm.drizzle.team/docs/connect-bun-sql)

---

### Pitfall 6: Session fixation on password reset — old sessions survive

**Severity:** Catastrophic (defeats the entire point of password reset — common OWASP-class finding)

**What goes wrong:**
User suspects account compromise → requests password reset → completes flow → believes they're safe. But the *old* session (the attacker's) is still valid because the session store wasn't cleared on password change. Classic [OWASP session fixation](https://owasp.org/www-community/attacks/Session_fixation).

**Why it happens:**
- BetterAuth may or may not invalidate all sessions by default on password reset — needs explicit verification, not assumption.
- Agent hears "password reset" and writes "update password hash", done. The invalidation is a second, invisible step.
- Password reset + remember-me cookies is a known underhandled combo.

**How to avoid:**
1. Verify BetterAuth's reset behavior. The docs must explicitly state "all sessions for user X are revoked on password change" — if they don't, wrap the reset hook to do it yourself.
2. Same for: email change, verified email on new device, disable 2FA, etc. — all "trust anchor" changes.
3. Integration test: create two sessions → reset password on one → the other session's `GET /me` returns 401.
4. Rotate session ID on login too (session fixation at login, not just reset — less common but same class).

**Warning signs:**
- No test named anything like `password_reset_invalidates_other_sessions`
- `updatePassword` is a single DB write with no session-table touch
- Reset-email link includes the session cookie (yes, this has shipped) — the link should be cookie-free

**Phase to address:** P2 (Auth flows). Password reset without session invalidation is not "done".

Sources:
- [OWASP Session Fixation](https://owasp.org/www-community/attacks/Session_fixation)
- [BetterAuth #3461: Invalid Token for every reset password request](https://github.com/better-auth/better-auth/issues/3461) — shows BetterAuth has had reset-flow bugs
- [Authgear: Password Reset Best Practices](https://www.authgear.com/post/authentication-security-password-reset-best-practices-and-more)

---

### Pitfall 7: BetterAuth rate-limiting has known gaps — silent abuse of email/verification endpoints

**Severity:** Major (user inbox abuse, email provider bans, cost blowup; not code-injection but operationally catastrophic)

**What goes wrong:**
BetterAuth ships built-in rate limiting but has multiple documented gaps:
- [#2112: `/send-verification-email` has no effective rate limit](https://github.com/better-auth/better-auth/issues/2112) — no rows added to `rateLimit` table
- [#3264: magic links rate limit not working](https://github.com/better-auth/better-auth/issues/3264)
- [#1891: Email OTP rate limit not enforced](https://github.com/better-auth/better-auth/issues/1891)
- [#4497: rate limit applies globally, can't restrict specific routes](https://github.com/better-auth/better-auth/issues/4497)

Attacker scripts email enumeration or verification-spam → user inbox floods → SendGrid/Resend bans the domain → email delivery dies for everyone.

Even when rate limiting *works*, the [default store is in-memory (RAM)](https://better-auth.com/docs/concepts/rate-limit) and keyed on IP — trivially bypassed by IP rotation.

**Why it happens:**
Built-in rate limiting makes it look "solved" when it isn't. Agent sees `rateLimit: { enabled: true }` and moves on. v1 is dev-mode with console-log email so the problem is invisible until prod.

**How to avoid:**
1. Even in dev, put a request-counter + log warning in front of `/send-verification-email` and `/forgot-password`. Make abuse visible during development, not after deploy.
2. Rate limit by *email address*, not just IP. The [issue #1556 discussion](https://github.com/better-auth/better-auth/issues/1556) explicitly flags this.
3. Use a persistent rate-limit store (Redis/Postgres), not RAM. Configure in P2, not later.
4. Add an ADR: "ADR-0XX: email-send rate limiting strategy". Forces the decision to be explicit rather than accidental.
5. Integration test: 10 consecutive verification requests for the same email in 1 minute → subsequent requests are 429.

**Warning signs:**
- Rate-limit config uses defaults / in-memory store
- Rate limit keys are only `req.ip`
- No alert / log when rate limit is hit
- "Resend verification" button has no client-side debounce AND no server-side per-email cap

**Phase to address:** P2 (Auth).

Sources:
- [BetterAuth Rate Limit docs](https://better-auth.com/docs/concepts/rate-limit)
- [Issues #2112, #1556, #1891, #3264, #4497](https://github.com/better-auth/better-auth/issues?q=is%3Aissue+rate+limit)

---

### Pitfall 8: Repository returns Drizzle result types — domain layer leaks infrastructure

**Severity:** Major (DDD skeleton's main premise collapses; rewrite when changing ORM becomes the entire app)

**What goes wrong:**
The most common "I'm doing DDD" mistake: Drizzle's type for a row is `InferSelectModel<typeof users>`, and that type has non-domain properties (auto-increment internals, timestamps Drizzle manages, relation result shapes like `{ user: User & { posts: Post[] } }`). If `UserRepository.findById` returns `Promise<InferSelectModel<...>>`, every call site becomes coupled to Drizzle. The "repository" is now just a `db` rename.

This is [explicitly called out](https://medium.com/@mesutatasoy/the-dark-side-of-repository-pattern-a-developers-honest-journey-eb51eba7e8d8) as the #1 leaky-abstraction failure mode.

**Why it happens:**
- Writing a mapping function from Drizzle row → Domain entity feels like boilerplate. Agent skips it.
- TS "just infer it" encourages returning raw ORM types.
- NestJS-style tutorials often [teach `@Entity` classes as domain objects](https://coldfusion-example.blogspot.com/2026/01/preventing-anemic-domain-models-in.html), conflating the two.

**How to avoid:**
1. **Domain entities are plain classes with private state + behavior methods**, never ORM decorators. `User` lives in `app/domain/user/User.ts`; its fields are private; mutations go through methods like `user.changeEmail(newEmail, ctx)`.
2. **Repositories live in Infrastructure and return Domain entities**. Signature: `findById(id: UserId): Promise<User | null>`. Internally: `db.select().from(users)...` then `return User.fromPersistence(row)`.
3. **ESLint rule: `app/domain/**` MAY NOT import from `drizzle-orm` or `app/infrastructure/**`**. Enforces the boundary at lint-time. This is the canonical case where [linters codify architecture](https://factory.ai/news/using-linters-to-direct-agents).
4. **Test**: grep for `InferSelectModel` and `InferInsertModel` across `app/domain/` — should return zero matches.
5. Have one real example repository in P1 (even with a dummy entity) so later Agents copy from a correct template, not a tutorial.

**Warning signs:**
- `import type { ... } from 'drizzle-orm'` inside `app/domain/`
- Domain service signatures use `typeof usersTable.$inferSelect`
- Entity has public setters (`user.email = newEmail`)
- No `fromPersistence` / `toPersistence` methods on entities
- Handler does `await db.select()...` directly (repository bypassed entirely)

**Phase to address:** P1 (Foundation) — the skeleton needs one working example. Retrofitting is miserable.

Sources:
- [Anemic Domain Model — Fowler](https://martinfowler.com/bliki/AnemicDomainModel.html)
- [The Dark Side of Repository Pattern](https://medium.com/@mesutatasoy/the-dark-side-of-repository-pattern-a-developers-honest-journey-eb51eba7e8d8)
- [Preventing Anemic Domain Models in Hexagonal Architecture](https://coldfusion-example.blogspot.com/2026/01/preventing-anemic-domain-models-in.html)

---

### Pitfall 9: `drizzle-kit push` used in production — silent schema drift, potential data loss

**Severity:** Major (data loss risk)

**What goes wrong:**
`drizzle-kit push` compares schema-in-code to live DB and applies the diff directly, skipping migration files. Great for local iteration, catastrophic for shared/prod because:
- No audit trail of schema changes
- Multi-developer conflicts become lost schema churn
- `ALTER TABLE DROP COLUMN` runs with no review — [instant data loss](https://dev.to/whoffagents/drizzle-orm-migrations-in-production-zero-downtime-schema-changes-e71)
- Rename detection is heuristic — a rename can become drop+add

**Why it happens:**
`push` is faster and in Drizzle docs alongside `generate`. Agents pick whichever appears first. The distinction is subtle until it bites.

**How to avoid:**
1. **P1 decision, locked in an ADR**: "local dev = `push` optional; anything shared = `generate` + `migrate`." Wire `bun run db:push` only in a dev-labeled script; wire `bun run db:migrate` for CI/prod.
2. Migrations folder (`drizzle/`) is checked into git and code-reviewed. Never edit past migrations — create new ones.
3. For zero-downtime in prod: expand → backfill → contract pattern (add new column → populate → drop old). Drizzle can generate the SQL but can't pick the strategy — this is ADR territory.
4. CI check: `drizzle-kit generate --name=ci-drift-check` in CI; if it produces a new file, schema and migrations are out of sync → fail the build.

**Warning signs:**
- `db:push` appears in any deploy script
- `drizzle/` folder is gitignored or has few files relative to schema changes
- No CI check for migration drift
- Schema changes land without an accompanying migration file in the PR

**Phase to address:** P1.

Sources:
- [Drizzle push docs](https://orm.drizzle.team/docs/drizzle-kit-push)
- [Drizzle ORM Migrations in Production: Zero-Downtime Schema Changes](https://dev.to/whoffagents/drizzle-orm-migrations-in-production-zero-downtime-schema-changes-e71)
- [3 Biggest Mistakes with Drizzle ORM](https://medium.com/@lior_amsalem/3-biggest-mistakes-with-drizzle-orm-1327e2531aff)

---

### Pitfall 10: The opinionated-framework trap — rigid in the wrong places

**Severity:** Major (existential to Rigging's thesis: if it's rigid where flexibility is needed, no one uses it; if flexible where rigidity is needed, AuthContext bypass wins)

**What goes wrong:**
Rails-style frameworks fail in two symmetric ways:
- **Over-rigid core**: "one way to do X" where X is genuinely context-dependent. Developers (or Agents) can't express legitimate variation → fight the framework → leave or break out.
- **Under-rigid boundary**: the place where the opinion needs to hold is actually a convention, not a constraint. Anyone can bypass. The framework "feels" opinionated but isn't enforcing anything.

The Rails doctrine succeeds because it's [rigid on *defaults* but escapable](https://rubyonrails.org/doctrine). The trap is the inverse: rigid on details, loose on defaults.

**Why it happens:**
Easier to be opinionated about syntax (folder names, file naming) than about semantics (what may/may not call what). Agents and humans both grab the visible opinion and ignore the invisible one.

**How to avoid: Rigging's rigidity map (the core design call).**

**Must be rigid (no escape hatch):**
- AuthContext is the only path to any Domain service. No import shortcut, no global singleton, no "just for tests".
- Repositories return Domain entities, never ORM types. ESLint-enforced.
- Every architectural decision with lasting impact has an ADR. PR merges block without one.

**Should be rigid-by-default, escapable with an ADR:**
- DDD 4-layer folder structure. If a subdomain is trivially CRUD, allow collapsing — but write the ADR.
- Drizzle as the ORM. A subdomain using raw SQL requires an ADR explaining why.
- Bun as runtime. Not escapable in v1, arguably never.

**Should be flexible (convention, not enforcement):**
- Handler style (functional vs. class) — let Agent follow team preference
- Error message format (recommend but don't enforce)
- Test file locations (colocate vs. `__tests__/`)
- Commit message format (recommend but don't gate)

The trap specifically: don't enforce opinions on layer-cake minutia (file naming, handler style) while leaving the *actual security boundary* (AuthContext) as a convention. That is Rails-trap for real.

**Warning signs:**
- More ESLint rules about file naming than about architectural boundaries
- An Agent (or new human) says "I wanted to do X but the framework forced Y" about something that *wasn't* safety-critical
- An Agent (or new human) easily writes handlers that skip AuthContext with no warning
- More than half of ADRs are post-hoc rationalizations, not forward decisions
- The README opens with conventions before it opens with Core Value

**Phase to address:** This is an *architecture* pitfall, addressed in P1 via the rigidity map, validated in every phase. Consider landing the explicit "Rigging Rigidity Map" as a foundational ADR (ADR-0001 or similar).

Sources:
- [Ruby on Rails Doctrine](https://rubyonrails.org/doctrine)
- [Ruby on Rails: Configuration over Convention (critique)](https://blog.teamtreehouse.com/ruby-on-rails-configuration-over-convention)
- [Convention over Configuration in the age of AI](https://dev.to/w3ndo/convention-over-configuration-in-the-age-of-ai-happy-accident--1b9j)

---

### Pitfall 11: Guardrails that fail Agent progress — the "harness is too tight" failure mode

**Severity:** Major (directly counter to Rigging's thesis; different from Pitfall 10 in that this is about *Agent UX*, not framework design philosophy)

**What goes wrong:**
The AuthContext boundary works — Agent cannot write a handler that skips it. Good. But then:
- To add one new Domain service, Agent must touch 6 files in 4 layers.
- Error messages when the boundary is violated are stack traces, not "you're missing AuthContext — add `.derive(auth)` to your plugin chain, example at X".
- No scaffold command. Agent writes the Application/Infrastructure/Presentation plumbing from scratch every time and makes small mistakes in each.

Result: Agent either burns tokens fighting the harness, gives up and uses `// @ts-ignore` / `// eslint-disable`, or silently degrades to handlers that bypass via the one loophole it found.

Literature: "[Guardrails that install constraints help teams go faster without lowering standards](https://jvaneyck.wordpress.com/2026/02/22/guardrails-for-agentic-coding-how-to-move-up-the-ladder-without-lowering-your-bar/)" — but only when the constraint comes with a clear productive path.

**Why it happens:**
Frameworks optimize for correctness-of-the-constrained-code and forget about cost-of-writing-constrained-code. The same structure that stops the Agent from doing wrong also stops it from doing right *fast*.

**How to avoid:**
1. **Error messages are teaching moments**: every Rigging-thrown error (AuthContextMissing, RepositoryBypass, etc.) includes (a) what went wrong, (b) the file pattern the error references, (c) a link to the ADR explaining why, (d) a minimal example of the correct pattern.
2. **Ship a "new Domain" scaffold as part of P1**: `bun rigging new-domain <name>` creates the 6 files with correct DI wiring. Agent's job becomes "fill in the logic", not "remember the 6 files". Even if v1 is "Reference App not scaffold" per PROJECT.md, this single codegen script doesn't violate that.
3. **Canonical worked example in the repo**: the Agent meta-domain (P4) serves this. Agents pattern-match heavily — give them a correct pattern to copy.
4. **Measure**: when building P4, track "number of times I had to explain the harness to Claude Code before it stopped writing bypass code". If that number is high, the harness has a UX bug, not a strictness bug.

**Warning signs:**
- In P4 dog-fooding, Agent repeatedly tries to import domain services directly
- PR diffs show lots of boilerplate per feature ("I'm just wiring"), not domain logic
- `// @ts-ignore` appears anywhere
- README-level documentation of "how to add a feature" is longer than the domain logic itself
- Agent outputs include phrases like "I'll skip the repository for now and just"

**Phase to address:** P1 (error-message design, scaffold script) + P4 (dog-food validation).

Sources:
- [Guardrails for Agentic Coding](https://jvaneyck.wordpress.com/2026/02/22/guardrails-for-agentic-coding-how-to-move-up-the-ladder-without-lowering-your-bar/)
- [How we prevent AI agent's drift & code slop generation](https://dev.to/singhdevhub/how-we-prevent-ai-agents-drift-code-slop-generation-2eb7)
- [ESLint as AI Guardrails](https://medium.com/@albro/eslint-as-ai-guardrails-the-rules-that-make-ai-code-readable-8899c71d3446)

---

### Pitfall 12: ADRs become performative — or stop existing altogether

**Severity:** Major (core Rigging value of "living context for future Agents" dies silently)

**What goes wrong:**
Two failure modes, both common:
- **Performative ADRs**: ADR written after the decision, rubber-stamping the status quo. "ADR-007: we chose Drizzle because it's TypeScript-first." Doesn't explain the tradeoffs, alternatives considered, or what would invalidate the decision. Useless as future context.
- **ADR rot**: Early enthusiasm, then no ADRs for 3 months. New decisions happen in commit messages or Slack. The "living context" becomes a museum.

Industry data: ADRs are [supposed to be immutable; changes become new ADRs with "Superseded by XXX" status](https://github.com/joelparkerhenderson/architecture-decision-record/blob/main/locales/en/templates/decision-record-template-by-michael-nygard/index.md). Most projects violate this within 6 months.

**Why it happens:**
- No ADR review ritual.
- "Decision" is fuzzy — when does a choice need an ADR?
- Writing ADRs is work with deferred payoff; humans and Agents both discount the future.

**How to avoid:**
1. **Define the ADR trigger crisply**: "Any choice that an Agent 6 months from now cannot reconstruct from the code alone — including 'why NOT X' for competing libs — requires an ADR." Lock this as ADR-0002 (after ADR-0001 = "we use ADRs, here's the template").
2. **PR template has a checkbox**: "Does this introduce a decision that an ADR doesn't cover? If yes, ADR added? If no, justify." Making skipping require a sentence is enough friction to force the right behavior most of the time.
3. **Status field is real**: Proposed → Accepted → Deprecated → Superseded, with links. An ADR with `Status: Accepted` but contradicting code is a detectable bug — flag in CI if feasible.
4. **Part of the review checklist** in P5 (docs) — auditors can see how decisions evolved.
5. **Agent reads ADRs before modifying architecture**: make `.adr/README.md` land in CLAUDE.md / AGENTS.md so the Agent literally loads them as context. This is Rigging's actual edge.

**Warning signs:**
- Fewer than 5 ADRs at end of P1 (the skeleton has many decisions)
- All ADRs are dated in a two-week window at project start
- No ADR has `Status: Superseded`
- Agent asks "why did we choose X?" and there's no ADR to point at
- ADRs are 3 lines long and say "we chose X because it's better"

**Phase to address:** P1 (process + template), reinforced at every phase transition via gsd rituals per PROJECT.md.

Sources:
- [Michael Nygard ADR template](https://github.com/joelparkerhenderson/architecture-decision-record/blob/main/locales/en/templates/decision-record-template-by-michael-nygard/index.md)
- [Maintain an architecture decision record — Microsoft](https://learn.microsoft.com/en-us/azure/well-architected/architect-role/architecture-decision-record)
- [Master ADRs — AWS](https://aws.amazon.com/blogs/architecture/master-architecture-decision-records-adrs-best-practices-for-effective-decision-making/)

---

### Pitfall 13: Timing attacks on login and password reset token comparison

**Severity:** Major (enumeration attack; lower bar than full takeover but leaks user existence + long-term token reuse)

**What goes wrong:**
`if (apiKey === storedKey)` and `if (resetToken === storedToken)` are both non-constant-time comparisons in JS. Over many samples, attacker learns where keys start matching. BetterAuth's verify path *should* use constant-time compare, but Rigging's own code around it might not.

**Why it happens:**
`===` looks correct. Agent has no feedback that it's wrong.

**How to avoid:**
- Use `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` for any secret comparison — reset tokens, API key hashes, session tokens, HMAC verifications.
- Password login should fail in constant time regardless of whether the username exists (don't early-return on "user not found"; hash a dummy password to keep timing level).
- Verify BetterAuth's own implementation of login and reset — if the docs don't mention timing-safe compare, open an issue.

**Warning signs:**
- Any `=== ` comparing two strings that are secrets
- `if (!user) return 401 early; bcrypt.compare(...)` pattern — variable-time reveals existence
- No test for "login time for valid user ≈ login time for invalid user"

**Phase to address:** P2 (auth internals) and P3 (API key verify).

Sources:
- [Sentry: Cracking Password Reset Mechanisms](https://blog.sentry.security/cracking-password-reset-mechanisms/)
- [Authgear: Password Reset Best Practices](https://www.authgear.com/post/authentication-security-password-reset-best-practices-and-more)

---

### Pitfall 14: Bun native-module incompatibility hits at the wrong moment

**Severity:** Minor-to-Major depending on which dep breaks (embarrassing if bcrypt breaks at demo time)

**What goes wrong:**
[Bun achieves 95–98% Node.js compat in 2026](https://www.alexcloudstar.com/blog/bun-compatibility-2026-npm-nodejs-nextjs/), but the 2–5% gap is concentrated in native modules and node-gyp stuff. Known breakage as of 2026:
- `bcrypt` (node-gyp) — use `bcryptjs` instead
- `sharp` — experimental WASM build only
- `sqlite3` — use `bun:sqlite` instead
- `app-module-path` breaks completely
- `package.json` `resolutions` not supported — use `overrides`
- `--inspect` debugger is flaky

**Why it happens:**
Ecosystem assumes Node. BetterAuth and Drizzle themselves work well on Bun, but a transitive dep (say, a mailer lib in P6+) may pull in a native dep.

**How to avoid:**
1. **Audit the dep tree at the end of P1** — `bun pm ls` and check any suspicious native-looking deps.
2. Prefer pure-JS alternatives as a Rigging convention — document in an ADR.
3. CI runs `bun install --frozen-lockfile && bun test` to catch "works locally, fails on fresh install" cases.
4. Don't use `bcrypt` — BetterAuth's own password hash lib is already pure JS; stay on that path.

**Warning signs:**
- `postinstall` scripts compiling native code during `bun install`
- Any import of `bcrypt` (not `bcryptjs`)
- `resolutions` in package.json
- Flaky CI only reproducible on fresh-checkout machines

**Phase to address:** P1 skeleton choices, P5 CI gate.

Sources:
- [Bun Compatibility 2026 — Alex Cloudstar](https://www.alexcloudstar.com/blog/bun-compatibility-2026-npm-nodejs-nextjs/)
- [Bun Runtime Production Guide 2026](https://byteiota.com/bun-runtime-production-guide-2026-speed-vs-stability/)
- [Node.js Compatibility — Bun docs](https://bun.com/docs/runtime/nodejs-compat)

---

### Pitfall 15: Eden Treaty loses type inference with BetterAuth / scoped plugins — false confidence

**Severity:** Minor (no runtime break — but erodes the "type-safe everywhere" marketing Rigging needs)

**What goes wrong:**
A selling point of Elysia is end-to-end types via Eden Treaty. Multiple issues document that combining BetterAuth plugins, macros with early-return (typical auth guard pattern), and modular Elysia composition breaks treaty inference — handlers return `any`, and nobody notices until a prod bug.

- [eden#215: Eden loses type inference with Better Auth plugin in modules](https://github.com/elysiajs/eden/issues/215)
- [elysia#1701: Eden Treaty returns `any` when I use an Elysia macro](https://github.com/elysiajs/elysia/issues/1701)
- [elysia#1284: Function macro with early return breaks type inference](https://github.com/elysiajs/elysia/issues/1284)
- [elysia#1468: Type inference lost for decorated properties in macro resolve](https://github.com/elysiajs/elysia/issues/1468)

**Why it happens:**
TypeScript inference limits + Elysia's aggressive type gymnastics + new plugin composition = holes.

**How to avoid:**
1. Don't build a client SDK on Eden in v1 unless it actually works — PROJECT.md says "no frontend" so this may be a non-issue for v1.
2. If consuming your own API from the test suite, use plain `fetch` + zod validation, not Eden treaty. Safer, less magical.
3. Add a type-level test (using `tsd` or `expect-type`) for at least one guarded endpoint: handler return type must not be `any`. Catches regression.

**Warning signs:**
- Any `response.data as User` cast in client or test code
- IDE shows `any` on a response in a downstream call
- Treaty imports + macro resolve + BetterAuth plugin all touch the same file

**Phase to address:** P5 (tests), lightweight — don't waste P1/P2 debugging Eden.

Sources:
- [eden#215](https://github.com/elysiajs/eden/issues/215), [elysia#1701](https://github.com/elysiajs/elysia/issues/1701), [elysia#1284](https://github.com/elysiajs/elysia/issues/1284), [elysia#1468](https://github.com/elysiajs/elysia/issues/1468)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `drizzle-kit push` for all envs | Fast iteration, no migration files to review | Silent schema drift, data loss on rename, no audit trail | Local dev only — NEVER on shared DB |
| Return Drizzle row types from repository | Skip the mapper boilerplate | Every caller is coupled to ORM; ORM swap = full rewrite | Never — this is the defining DDD anti-pattern |
| Single plaintext `apiKey` column | Simpler endpoint (return stored value on GET) | DB breach = full compromise; no rotation; CVE-class | Never |
| BetterAuth pinned via `^x.y` | Auto-get security patches (in theory) | Auto-get breaking changes mid-sprint; audit surface is moving | Only with an automated advisory alerting + test suite in place |
| AuthContext checked only at handler level, not repository | 1 check not 5 | One handler forgotten = full domain bypass path | Never — defense-in-depth per Core Value |
| In-memory rate-limit store | Zero infra in dev | Server restart wipes counters; multi-instance fails; IP-only keying trivially bypassed | Local dev only |
| Skip ADR "because it's obvious" | 20 min saved today | Agent in 6 months can't reconstruct the reasoning; decision silently reversed in a refactor | Never for decisions that shape the harness; OK for commit-level mechanical choices |
| `bun:sql` for Postgres "because it's the Bun way" | Marginally faster benchmark | Transaction hangs on constraint violations (real, open bugs) | Not in v1 — revisit when open Bun issues close |
| Disable BetterAuth API-key hashing | Easier debugging, see keys in DB | Database breach = full key compromise; CVSS-relevant | Never |
| `// @ts-ignore` around AuthContext types | Build passes | Bypasses the one invariant Rigging exists to enforce | Never — if types are wrong, the harness is wrong and must be fixed |
| Skip email-rate-limiting because dev only logs to console | Faster dev loop | Ships to prod, spammers find endpoint in week 1 | Add visible logging of rate-limit hits even in dev |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| BetterAuth + Elysia | Using `@elysiajs/static` at `/` prefix — kills most BetterAuth endpoints ([issue #3384](https://github.com/better-auth/better-auth/issues/3384)) | Mount static files under a non-`/` prefix, or skip static plugin entirely in API-first server |
| BetterAuth + Elysia | "Body already used" errors on POSTs ([issue #2306](https://github.com/better-auth/better-auth/issues/2306)) | Don't consume request body before passing to BetterAuth handler; let BetterAuth own the body-reading |
| BetterAuth + Elysia | basePath cannot be empty or `/` — results in redundant URL structure | Pick a basePath like `/api/auth` consistently and mirror it in cookie settings |
| BetterAuth + Drizzle | Adapter mismatch between BetterAuth schema and your migrations → inconsistent state | Run `better-auth generate` → check resulting SQL into migrations folder → keep the two in sync as part of the deploy ritual |
| BetterAuth schema generation | `Couldn't read your auth config` with recent Elysia ([issue #5446](https://github.com/better-auth/better-auth/issues/5446)) | Keep auth config file importable without running Elysia bootstrapping; separate config from server init |
| Drizzle + Bun SQL driver | Using `drizzle-orm/bun-sql` — hits open transaction-hang bugs | Use `drizzle-orm/postgres-js` with `postgres` package until Bun issues close |
| Drizzle + Postgres migrations | Manually editing past migration files | Always add a new migration; treat committed migrations as immutable |
| Elysia plugin ordering | Auth plugin registered per-route, not at root | Register auth plugin at root app; use `.guard()` for route-level enforcement only |
| CORS + cookies | Forget `credentials: true` on client or `credentials: 'include'` on fetch | Document as ADR; integration test with cross-origin fetch from test client |
| BetterAuth + IP-based rate limit | Trusting `req.ip` when behind proxy | Configure trusted proxy headers in Bun/Elysia and verify `X-Forwarded-For` is sane |
| API Key + DB query | Querying by full key (requires hash lookup on every request) | Store `prefix` (first N chars, indexed) + `hash`; query by prefix, then `timingSafeEqual(hash)` |

---

## Performance Traps

Rigging's v1 is "community-grade", not "web-scale" — don't over-engineer. But some traps bite even at small scale.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded Bun SQL connection pool | Postgres connection count climbs to max, server dies | Use `postgres-js` with explicit `max: 10`; verify via `pg_stat_activity` | ~50 concurrent requests under Bun SQL bug |
| Drizzle N+1 via non-relational query | Lots of small queries per request in logs | Use Drizzle's `with` relational query — outputs a single SQL ([per Drizzle docs](https://orm.drizzle.team/docs/relations-v2)) | As soon as a list endpoint ships |
| Password hashing on every auth request with no session caching | CPU pegged at low RPS | BetterAuth session cookies cache the auth decision; don't re-run bcrypt per request | Even 10 RPS reveals this |
| Loading entire ADR/docs folder into Agent context every request | Token budget blown, slow responses | ADRs are for humans + out-of-band Agent context, not runtime | Never meant to — but naïve implementations do it |
| No index on `api_keys.prefix` | Every request does full table scan | `CREATE INDEX` on the prefix column; ensure Drizzle schema has `.$unique()` or index helper | 1000+ API keys |
| Rate-limit store in RAM behind a load balancer | Rate limits effectively per-instance, not per-user | Persistent store (Postgres or Redis) keyed on user/email, not IP | As soon as you have >1 instance |
| Session table grows unbounded (no pruning) | DB size grows, slow auth queries | Index `expires_at`; scheduled cleanup of expired sessions | Months of production use |
| Fetching user → authContext decorator runs DB query per request | DB query on every route | Put AuthContext lookup *once* in a root-scoped plugin, cache session in a request-scoped map | Any production traffic |

---

## Security Mistakes

Domain-specific to an AuthContext-centric harness. Beyond OWASP basics.

| Mistake | Risk | Prevention |
|---------|------|------------|
| AuthContext bypass via direct service import | Full domain access without auth — defeats Core Value | Factory-only service access, ESLint rule banning domain internals import, integration test with missing AuthContext asserts 500/401 not data leak |
| Trusting `body.userId` in API-key creation (CVE-2025-61928 pattern) | Unauthenticated account takeover | Wrap BetterAuth's API-key handlers; always compare body userId to session userId, reject mismatch |
| Sharing session + API-key auth paths without clear precedence | Attacker with both cookie and API key gets unintended merge of privileges | AuthContext should be *one* identity, derived from *one* mechanism per request, with explicit precedence documented in ADR |
| Returning detailed auth errors ("user not found" vs "wrong password") | Enumeration attack reveals valid accounts | Single generic "invalid credentials"; log detail server-side only |
| Password reset doesn't invalidate all sessions | Session fixation attack survives reset | Wrap BetterAuth reset hook to purge `sessions` table for the user |
| API key in URL path/query string | Logged in access logs, in browser history, in proxy logs | Always in `Authorization: Bearer ...` header; reject query-string API keys |
| Reset token doesn't one-time-invalidate | Replay attack reuses token | Store a `used_at` column; reject if set. Verify BetterAuth does this |
| Email change without re-verification | Takeover pivot: change email, then reset password | Require current password for email change AND verify new address before it becomes primary |
| Cookie without `HttpOnly`, `Secure`, `SameSite=Lax` | XSS steals session | Verify BetterAuth defaults (should be correct); lock in an ADR that these are mandatory |
| API-key `permissions` JSON is "just a field", not enforced | Scoped keys aren't actually scoped | Enforcement lives in Rigging's AuthContext layer, not in Agent's handler code; test that a read-only key returns 403 on a write handler |
| Logs contain PII / tokens | Breach of log store = breach of everything | Structured logger with field allowlist; never log the request body verbatim |

---

## UX Pitfalls

"UX" here is mostly developer/Agent experience — Rigging is a backend harness.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Cryptic error when AuthContext is missing (stack trace, no guidance) | Agent flails, tries `// @ts-ignore`, eventually bypasses | Typed error with (a) what's missing, (b) likely cause, (c) ADR link, (d) minimal example snippet |
| "How to add a Domain" requires reading 4 files of prose | Agent skips docs, pattern-matches from bad sources | One canonical worked example (P4 meta-domain) + scaffold command |
| No `dev` script that surfaces ADR-level violations in real time | Problem discovered at PR time, painful rework | ESLint + `tsc --watch` wired into `bun dev`; violations appear in terminal as code is written |
| Email verification link output only in server console (per PROJECT.md) | Dev forgets to click, onboarding test fails mysteriously | Clearly labeled log line with ASCII box and "CLICK THIS:" prefix; consider writing to a `./dev-mailbox.log` file too |
| API-key creation returns the key in a nested response shape | Agent parses wrong, stores the wrong value, subsequent calls fail auth | Top-level `{ key: "rig_live_..." }` on creation, clear "store this now" in response and docs |
| First-run requires 5 env vars with no defaults | New user bounces at setup | `.env.example` with sensible dev defaults; generate secrets on first run into a gitignored `.env.local` |
| No way to see "what identity am I running as" in a dev handler | Agent debugs auth issues blindly | Ship a `/debug/whoami` endpoint in dev mode that returns the AuthContext; remove in prod build |
| Scaffold produces code, but no accompanying test stub | Agent ships without tests; P5 "testing phase" becomes "write tests for everything" | Scaffold always produces a failing test too, forcing TDD-ish loop |

---

## "Looks Done But Isn't" Checklist

Verify at phase transitions and before merging P1→P2, P2→P3, etc.

- [ ] **AuthContext boundary:** integration test exists that mounts the app *without* the auth plugin and asserts every Domain-facing route returns 401/500, not stale data or `undefined` — verify: remove auth plugin in test, run full request suite
- [ ] **API key rotation:** creating a key → revoking it → using it returns 401. Key column in DB is a hash, not the raw value — verify: `grep -R 'rig_live_' data/ | wc -l` returns 0
- [ ] **Password reset:** two sessions for same user, reset password on one, other session's `/me` returns 401 — verify: integration test named `password_reset_invalidates_other_sessions`
- [ ] **Email verification rate limit:** 10 POSTs to send-verification within 1 minute → 429 — verify: scripted test, not just docs
- [ ] **Migrations:** `drizzle-kit generate --name=check` produces no new migration (schema and migrations in sync) — verify: CI job
- [ ] **ADRs:** every locked decision in PROJECT.md → Key Decisions has an ADR with status `Accepted`, context, and alternatives — verify: count ADRs > count of Key Decisions rows
- [ ] **Repository pattern:** `grep -R 'InferSelectModel\|InferInsertModel' app/domain/` returns empty — verify: lint rule + one-liner grep check in CI
- [ ] **Scoped plugin trap:** `ctx.authContext` in every protected handler is typed as `AuthContext`, never `AuthContext | undefined` — verify: `tsc --noEmit --strict`
- [ ] **CVE response:** BetterAuth version in `package.json` is pinned and >= 1.3.26 (CVE-2025-61928 patch) — verify: audit script
- [ ] **AuthContext cascade:** runtime guard throws clearly when AuthContext missing in a domain service call — verify: unit test that constructs a service without ctx and asserts the specific error class
- [ ] **Session security:** cookies have `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` — verify: test inspects `Set-Cookie` header
- [ ] **Timing safety:** API-key comparison uses `timingSafeEqual` — verify: grep for `=== ` comparisons in auth-critical paths returns zero hits
- [ ] **Bun driver:** `grep -R 'drizzle-orm/bun-sql' app/` returns zero until open Bun bugs close — verify: documented in ADR
- [ ] **Scaffold/example:** at least one end-to-end worked Domain exists (P4 meta-domain); a new Agent can copy-paste its shape and succeed — verify: dog-food session, counted "had to explain harness" events
- [ ] **Documentation:** README quickstart takes an external dev from `git clone` → running server → authenticated request in <10 minutes on a fresh machine — verify: timed walk-through on clean box

---

## Recovery Strategies

When a pitfall slips through.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| AuthContext bypass discovered in handler | MEDIUM | 1. Audit all handlers for direct Domain imports. 2. Add ESLint rule to block. 3. Integration test to prevent regression. 4. Consider revoking all active sessions if data access was possible. |
| BetterAuth CVE-class vulnerability | HIGH | 1. Patch BetterAuth immediately. 2. Rotate all API keys created during exposure window. 3. Audit logs for suspicious `/api-key/create` calls. 4. Consider forcing logout of all sessions. 5. Notify users if data access occurred. |
| API keys stored plaintext, realized post-launch | HIGH | 1. Force-rotate all keys (mass invalidation). 2. Ship hash-at-rest migration. 3. Users regenerate on next login. 4. Audit logs for prior access patterns. 5. Notify users. |
| Drizzle `push` used in prod, data lost | HIGH | 1. Restore from backup (hopefully exists). 2. Rebuild missing records from event log if any. 3. Switch all envs to `generate` + `migrate`. 4. Post-mortem + ADR documenting the rule. |
| Bun SQL transaction hang wedged production | MEDIUM | 1. Restart process (quick fix, recurs). 2. Swap driver to `postgres-js` (real fix). 3. Add monitoring for "request duration > 30s" as alerting signal. |
| Repository returns Drizzle types, now coupling is deep | MEDIUM-HIGH | 1. Add mapper functions incrementally per repository. 2. Update domain signatures one at a time. 3. Lint rule goes in at the end to prevent regression. Tedious but non-urgent. |
| ADR set rotted, decisions untracked | LOW-MEDIUM | 1. "ADR catch-up day": one session to retroactively ADR major decisions. 2. Re-enable PR checklist. 3. Accept that some context is lost — document what's unknown as "ADR-XXX: undocumented historical decision". |
| Opinionated-trap: rigid in wrong places | HIGH (if early), LOW (if caught early) | 1. Write the Rigidity Map ADR. 2. Classify each enforced opinion: catastrophic/major/minor. 3. Relax minor enforcements (make them conventions). 4. Strengthen major enforcements. |
| Harness too tight, Agent progress stalled | MEDIUM | 1. Add scaffold command. 2. Improve error messages to teaching-moment quality. 3. Document the happy-path in one place. 4. Dog-food (P4) reveals friction — act on it. |
| Session fixation on reset | MEDIUM | 1. Force-invalidate all sessions site-wide one time. 2. Fix the reset handler to purge sessions. 3. Regression test. 4. If abuse is suspected, notify users. |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address each pitfall.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. AuthContext advisory not mandatory | P1 (design) → P3 (enforce) | Integration test: mount app without auth plugin, all protected routes 401/500 |
| 2. Elysia scoped-plugin undefined cascade | P1 (plugin architecture) → P3 | `strict` TS + type-level test that ctx.authContext is not `undefined` in any guarded handler |
| 3. BetterAuth API-key CVE class | P3 | Pinned BetterAuth ≥ 1.3.26; regression test posts `{ userId: ... }` without session → 401 |
| 4. API keys plaintext / no rotation | P3 | Test "DB hash != raw key"; test "revoked key → 401"; schema review |
| 5. Bun SQL transaction hang | P1 (driver choice) | ADR documenting `postgres-js` driver choice; integration test with constraint violation |
| 6. Session fixation on reset | P2 | Test: two sessions, reset one, other returns 401 |
| 7. BetterAuth rate-limit gaps | P2 | Test: 10 verification requests in 60s → 429; custom per-email rate limiter wraps BetterAuth |
| 8. Repository leaks Drizzle types | P1 (skeleton) → enforced throughout | ESLint rule + CI grep for `InferSelectModel` in `app/domain/` |
| 9. `drizzle-kit push` in prod | P1 (scripts) | Deploy scripts only call `drizzle-kit migrate`; CI checks migration drift |
| 10. Opinionated framework trap | P1 (Rigidity Map ADR) | Review at each phase transition: what's enforced, what's convention, is the split right? |
| 11. Guardrails fail Agent progress | P1 (error messages, scaffold) → P4 (dog-food) | Track "had to explain harness" events during P4 dog-food; if >3, harness has UX bug |
| 12. ADRs performative or absent | P1 (process) → every phase | Phase-transition ritual checks ADR count growth; PR template gate |
| 13. Timing attacks | P2 / P3 | `grep` for string `===` in auth-critical files; mandate `timingSafeEqual` |
| 14. Bun native-module incompat | P1 / P5 | CI on clean checkout; dep-tree audit after each significant install |
| 15. Eden Treaty type holes | P5 | Type-level test (`expect-type`) on at least one guarded endpoint |

---

## Sources

Official docs & advisories:
- [BetterAuth docs](https://better-auth.com/docs) — [Rate Limiting](https://better-auth.com/docs/concepts/rate-limit), [Security](https://better-auth.com/docs/reference/security), [API Key plugin](https://better-auth.com/docs/plugins/api-key), [Elysia integration](https://better-auth.com/docs/integrations/elysia), [1.5 release notes](https://better-auth.com/blog/1-5)
- [Elysia docs](https://elysiajs.com) — [Plugin](https://elysiajs.com/essential/plugin), [Lifecycle](https://elysiajs.com/essential/life-cycle), [Macro](https://elysiajs.com/patterns/macro), [BetterAuth integration](https://elysiajs.com/integrations/better-auth)
- [Drizzle docs](https://orm.drizzle.team) — [Migrations](https://orm.drizzle.team/docs/migrations), [Push](https://orm.drizzle.team/docs/drizzle-kit-push), [Relations v2](https://orm.drizzle.team/docs/relations-v2), [Bun SQL](https://orm.drizzle.team/docs/connect-bun-sql), [Transactions](https://orm.drizzle.team/docs/transactions)
- [Bun Node.js Compatibility](https://bun.com/docs/runtime/nodejs-compat)
- [Ruby on Rails Doctrine](https://rubyonrails.org/doctrine) — for the opinionated-framework reference
- [Michael Nygard ADR template](https://github.com/joelparkerhenderson/architecture-decision-record/blob/main/locales/en/templates/decision-record-template-by-michael-nygard/index.md)

CVE / security:
- [CVE-2025-61928 — ZeroPath write-up](https://zeropath.com/blog/breaking-authentication-unauthenticated-api-key-creation-in-better-auth-cve-2025-61928)
- [CVE-2025-61928 — Snyk advisory](https://security.snyk.io/vuln/SNYK-JS-BETTERAUTH-13537497)
- [BetterAuth GHSA-99h5-pjcv-gr6v](https://github.com/better-auth/better-auth/security/advisories/GHSA-99h5-pjcv-gr6v)
- [OWASP Session Fixation](https://owasp.org/www-community/attacks/Session_fixation)

GitHub issues driving pitfall specifics:
- Bun: [#21934 transaction hang](https://github.com/oven-sh/bun/issues/21934), [#22395 23P01 wedge](https://github.com/oven-sh/bun/issues/22395), [#17178 connection loss](https://github.com/oven-sh/bun/issues/17178), [#23215 connection leak](https://github.com/oven-sh/bun/issues/23215)
- Elysia: [#566 derive/guard](https://github.com/elysiajs/elysia/issues/566), [#1366 scoped plugin undefined cascade](https://github.com/elysiajs/elysia/issues/1366), [#1284 macro early return](https://github.com/elysiajs/elysia/issues/1284), [#1468 type inference in macro resolve](https://github.com/elysiajs/elysia/issues/1468), [#1701 Eden + macro = any](https://github.com/elysiajs/elysia/issues/1701)
- Eden: [#215 lost inference with BetterAuth](https://github.com/elysiajs/eden/issues/215)
- BetterAuth: [#3384 endpoints fail in Elysia](https://github.com/better-auth/better-auth/issues/3384), [#2306 "body already used"](https://github.com/better-auth/better-auth/issues/2306), [#5446 schema generation fails](https://github.com/better-auth/better-auth/issues/5446), [#2112 no rate limit on verify email](https://github.com/better-auth/better-auth/issues/2112), [#1556 rate limit by email](https://github.com/better-auth/better-auth/issues/1556), [#1891 OTP rate limit](https://github.com/better-auth/better-auth/issues/1891), [#3264 magic link rate limit](https://github.com/better-auth/better-auth/issues/3264), [#4497 rate limit not per-route](https://github.com/better-auth/better-auth/issues/4497), [#3461 invalid token reset](https://github.com/better-auth/better-auth/issues/3461)

Expert commentary / patterns:
- [Fowler — Anemic Domain Model](https://martinfowler.com/bliki/AnemicDomainModel.html)
- [Fowler — Architecture Decision Record](https://martinfowler.com/bliki/ArchitectureDecisionRecord.html)
- [The Dark Side of Repository Pattern — Atasoy](https://medium.com/@mesutatasoy/the-dark-side-of-repository-pattern-a-developers-honest-journey-eb51eba7e8d8)
- [3 Biggest Mistakes with Drizzle ORM — Amsalem](https://medium.com/@lior_amsalem/3-biggest-mistakes-with-drizzle-orm-1327e2531aff)
- [Drizzle Migrations in Production: Zero-Downtime Schema Changes](https://dev.to/whoffagents/drizzle-orm-migrations-in-production-zero-downtime-schema-changes-e71)
- [Bun Compatibility 2026 — Alex Cloudstar](https://www.alexcloudstar.com/blog/bun-compatibility-2026-npm-nodejs-nextjs/)
- [Bun Runtime Production Guide 2026](https://byteiota.com/bun-runtime-production-guide-2026-speed-vs-stability/)
- [Factory.ai: Using Linters to Direct Agents](https://factory.ai/news/using-linters-to-direct-agents)
- [Guardrails for Agentic Coding](https://jvaneyck.wordpress.com/2026/02/22/guardrails-for-agentic-coding-how-to-move-up-the-ladder-without-lowering-your-bar/)
- [ESLint as AI Guardrails](https://medium.com/@albro/eslint-as-ai-guardrails-the-rules-that-make-ai-code-readable-8899c71d3446)
- [How Weak Password Reset Flows Turn "Forgot Password" Into Full Account Takeover](https://medium.com/@MuhammedAsfan/how-weak-password-reset-flows-turn-forgot-password-into-full-account-takeover-dc95508cdfe8)
- [Session Fixation Flaw on Password Reset](https://undercodetesting.com/the-session-fixation-flaw-why-your-password-reset-is-secretly-useless/)
- [Cracking Password Reset Mechanisms — Sentry](https://blog.sentry.security/cracking-password-reset-mechanisms/)
- [Authgear: Password Reset Best Practices](https://www.authgear.com/post/authentication-security-password-reset-best-practices-and-more)
- [Google Cloud API Keys Best Practices](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices)
- [OneUptime: API Key Management Best Practices](https://oneuptime.com/blog/post/2026-02-20-api-key-management-best-practices/view)
- [Master ADRs — AWS](https://aws.amazon.com/blogs/architecture/master-architecture-decision-records-adrs-best-practices-for-effective-decision-making/)

---
*Pitfalls research for: Rigging — opinionated TypeScript backend scaffold acting as AI-Agent harness (Bun + Elysia + Postgres + Drizzle + BetterAuth)*
*Researched: 2026-04-18*
