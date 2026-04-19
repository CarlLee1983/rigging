import { swagger } from '@elysiajs/swagger'
import { Elysia } from 'elysia'
import pkg from '../../../../package.json' with { type: 'json' }

/**
 * Swagger plugin — OpenAPI 3.x spec served at `/swagger`.
 *
 *   - Always on (D-14): not gated by NODE_ENV. Prod hardening is a v2 concern.
 *   - Security schemes pre-declared (D-15): cookieAuth + apiKeyAuth. Phase 2 routes do NOT
 *     apply these — that happens in Phase 3 when authContext plugin lands.
 *   - info.version is sourced dynamically from package.json via Bun's `import attributes`.
 */
export function swaggerPlugin() {
  return new Elysia({ name: 'rigging/swagger' }).use(
    swagger({
      path: '/swagger',
      documentation: {
        info: {
          title: 'Rigging API',
          version: pkg.version,
          description:
            'Opinionated TypeScript backend scaffold — DDD four-layer + mandatory AuthContext boundary.',
        },
        components: {
          securitySchemes: {
            cookieAuth: {
              type: 'apiKey',
              in: 'cookie',
              name: 'session',
            },
            apiKeyAuth: {
              type: 'apiKey',
              in: 'header',
              name: 'x-api-key',
            },
          },
        },
      },
    }),
  )
}
