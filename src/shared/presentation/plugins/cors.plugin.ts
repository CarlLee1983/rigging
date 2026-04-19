import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'

/**
 * CORS plugin — dev-permissive policy (D-16).
 *
 *   - origin: `true` — @elysiajs/cors 1.4.1 echoes the request's `Origin` header when set to true,
 *     with `Access-Control-Allow-Origin` never becoming `*` while credentials are enabled.
 *     (Plan text showed a `(request) => request.headers.get('origin') ?? '*'` callback, but the
 *     installed version's `Origin` type is `(context) => boolean | void`. `true` gives the exact
 *     required behaviour — echo the request origin, fall back to `*` when Origin is absent —
 *     per the plugin's own source (dist/index.mjs line 58-65).)
 *     Production allowlist is deferred to v2 (ADR 0012 + PROJECT.md Out of Scope).
 *   - credentials: true — required for Phase 3 cookie-auth flow.
 *   - methods + allowedHeaders are explicit to avoid browser preflight rejection.
 *   - maxAge: 86400 (1 day preflight cache) per CONTEXT discretion.
 */
export function corsPlugin() {
  return new Elysia({ name: 'rigging/cors' }).use(
    cors({
      origin: true,
      credentials: true,
      allowedHeaders: ['content-type', 'authorization', 'x-api-key', 'x-request-id'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      maxAge: 86400,
    }),
  )
}
