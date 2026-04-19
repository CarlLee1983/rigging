import { Elysia } from 'elysia'
import type { IIdentityService } from '../../application/ports/identity-service.port'
import { type AuthContext, UnauthenticatedError } from '../../domain'

export interface AuthContextPluginDeps {
  identity: IIdentityService
}

/**
 * authContextPlugin — resolver for protected routes.
 *
 * API Key wins over cookie session. If x-api-key is present but invalid, the request is rejected
 * immediately and does not fall back to the cookie path.
 */
export function authContextPlugin(deps: AuthContextPluginDeps) {
  return new Elysia({ name: 'rigging/auth-context' }).macro({
    requireAuth: {
      async resolve({ request }) {
        const headers = request.headers
        const rawApiKey = headers.get('x-api-key')

        if (rawApiKey !== null) {
          const apiKeyCtx = await deps.identity.verifyApiKey(rawApiKey)
          if (!apiKeyCtx) {
            throw new UnauthenticatedError('Authentication required')
          }

          return { authContext: apiKeyCtx satisfies AuthContext }
        }

        const sessionCtx = await deps.identity.verifySession(headers)
        if (!sessionCtx) {
          throw new UnauthenticatedError('Authentication required')
        }

        return { authContext: sessionCtx satisfies AuthContext }
      },
    },
  })
}
