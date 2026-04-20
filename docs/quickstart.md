# Rigging Quickstart

**You'll go from `git clone` to issuing an authenticated request in 10 min** — both as a human (cookie session) and as an AI Agent (API Key). By the end, you'll have dogfooded the full Rigging surface: sign-up → verify → login → create Agent → create prompt → mint API Key → fetch your own prompt as the Agent.

Estimated time: **10 min** (5-6 if you skip reading).

## Prerequisites

- [Bun](https://bun.com) 1.3.12+
- [Docker](https://www.docker.com) + Docker Compose v2 (or Colima / Rancher Desktop)
- `curl` and `jq` (any UNIX toolchain)
- Port `3000` (Rigging dev server) and `5432` (Postgres) free

## Scaffold (fastest path)

New project? Use the CLI — one command, no clone needed:

```bash
npx create-rigging <project-name>
cd <project-name>
bun install
cp .env.example .env
docker compose up -d
bun test
```

That's it. The scaffold includes a working `.env.example`, migrations, and CI workflow.
See the [Path A / Path B curl flows](#path-a--human-session-3-min) below to dogfood the full Rigging surface.

## Dev server (30 sec)

```bash
bun run dev
```

Verify the server is up:

```bash
curl http://localhost:3000/health
# => {"status":"healthy","db":"connected"}
```

Open the auto-generated OpenAPI docs in your browser: <http://localhost:3000/swagger>

Keep `bun run dev` running in this terminal. Open a second terminal for the next steps.

## Path A — Human session (3 min)

Step 1: Sign up. Rigging's Console email adapter writes the verification link to the dev server's stdout (no real email needed in v1):

```bash
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"you@example.test","password":"Password123!","name":"You"}'
```

Step 2: Look at the **first terminal** (running `bun run dev`). You'll see something like:

```
[verification] Verify your email: http://localhost:3000/api/auth/verify-email?token=...
```

Copy the URL and click it (or `curl` it):

```bash
curl "http://localhost:3000/api/auth/verify-email?token=<paste-token>"
```

Step 3: Sign in to capture the session cookie:

```bash
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -c cookies.txt -b cookies.txt \
  -d '{"email":"you@example.test","password":"Password123!"}'
```

You now have a session cookie in `cookies.txt`. Verify:

```bash
curl http://localhost:3000/me -b cookies.txt
# => {"user":{...},"identityKind":"human","scopes":["*"]}
```

## Path B — Create + read your own Agent (2 min, dogfood story)

Now you'll **act as a developer creating an Agent, then become that Agent and read your own prompt** — the core Rigging dogfood story (DEMO-04).

Step 1: Create an Agent (cookie auth):

```bash
AGENT_ID=$(curl -s -X POST http://localhost:3000/agents \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"my-first-agent"}' | jq -r '.id')
echo "Agent ID: $AGENT_ID"
```

Step 2: Create prompt v1 (cookie auth):

```bash
curl -X POST "http://localhost:3000/agents/$AGENT_ID/prompts" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"content":"You are a helpful assistant."}'
```

Step 3: Mint an API Key for this user (cookie auth — the response includes the raw key **once only**):

```bash
API_KEY=$(curl -s -X POST http://localhost:3000/api-keys \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"label":"quickstart-key","scopes":["*"]}' | jq -r '.rawKey')
echo "API Key: $API_KEY"
```

Step 4: **You are now the Agent.** Drop the cookie. Use only the `x-api-key` header to fetch your own latest prompt:

```bash
curl "http://localhost:3000/agents/$AGENT_ID/prompts/latest" \
  -H "x-api-key: $API_KEY"
# => {"id":"...","version":1,"content":"You are a helpful assistant.",...}
```

The same endpoint, same agent — but the resolver returned `identityKind: 'agent'` this time, with the API Key's scopes. The Agent fetched its own prompt without any session.

## What just happened (1 min)

You were both human and Agent operating on the same resources:

- **Path A** authenticated you as a human (`identityKind: 'human'`) via session cookie
- **Path B** Step 4 authenticated you as the Agent (`identityKind: 'agent'`) via `x-api-key` header — same user, different identity kind, different scopes
- The handler `GET /agents/:id/prompts/latest` is a **single** route with `requireAuth: true` — both auth paths flow through the same `AuthContext` boundary
- The use case `GetLatestPrompt(ctx, agentId)` checks `ctx.authContext.userId === agent.ownerId` — cross-user 404; ownership enforced at the use-case layer

This is the dogfood moment: Rigging's harness made it impossible to forget the auth check, even though you wrote zero auth code.

## Error shape — one example

If you POST sign-up with a malformed email, you'll get:

```bash
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","password":"x","name":"x"}'
# => {"error":{"code":"VALIDATION_ERROR","message":"...","requestId":"..."}}
```

Every error response in Rigging follows the `{ error: { code, message, requestId } }` shape (P2 D-12 + ADR 0012). Frontends can branch on `code`; logs can correlate by `requestId`.

## Next steps

- [docs/architecture.md](architecture.md) — DDD layering, AuthContext macro flow, dual identity resolution (with mermaid diagrams)
- [docs/decisions/](decisions/) — 19 ADRs documenting every locked design choice
- [.planning/PROJECT.md](../.planning/PROJECT.md) — full Core Value, Constraints, Out of Scope
- [AGENTS.md](../AGENTS.md#ai-agent-onboarding) — for AI Agents (and humans) onboarding to contribute

## Developing Rigging Itself

Contributing to Rigging or working on the scaffold source? Clone the reference app directly:

```bash
git clone <this-repo> rigging && cd rigging
cp .env.example .env
docker-compose up -d
bun install
bun run db:migrate
```

If `docker-compose up -d` fails with port conflict on 5432, stop the conflicting service or change `DATABASE_URL` in `.env` to a free port.

---

*If you got stuck:* file an issue with the failing curl + first 30 lines of `bun run dev` output. Most setup failures are postgres connectivity (port 5432 free? `docker ps` shows `rigging-postgres` healthy?) or stale env (re-run `cp .env.example .env`).
