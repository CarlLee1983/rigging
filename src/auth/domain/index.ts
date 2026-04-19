import type { AuthContext } from './auth-context'
import { ApiKeyService } from './internal/api-key-service'
import { AuthContextMissingError } from './internal/authcontext-missing-error'

export {
  ALLOWED_SCOPES,
  type AuthContext,
  isAgent,
  isHuman,
  type Scope,
  type UserId,
} from './auth-context'
export {
  EmailNotVerifiedError,
  InsufficientScopeError,
  ScopeNotSubsetError,
  UnauthenticatedError,
  UserIdMismatchError,
} from './errors'
export type { IdentityKind } from './identity-kind'
export { AuthContextMissingError } from './internal/authcontext-missing-error'
export { ApiKeyHash } from './values/api-key-hash'
export { Email } from './values/email'

/**
 * getApiKeyService — AUX-05 Runtime Guard factory.
 *
 * The ONLY legal entry point to the internal ApiKeyService. Any caller that attempts to
 * `import { ApiKeyService } from '.../internal/api-key-service'` directly is blocked by Biome.
 */
export const getApiKeyService = (ctx: AuthContext | null | undefined): ApiKeyService => {
  if (!ctx?.userId) {
    throw new AuthContextMissingError(
      `AuthContext is missing when calling getApiKeyService(ctx).

Reason: Domain services require AuthContext from \`requireAuth: true\` macro.
See docs/decisions/0006-authcontext-boundary.md.

Fix: Declare \`requireAuth: true\` in your route options. Example:
  new Elysia()
    .use(authContextPlugin(identity))
    .get('/api-keys', ({ authContext }) => ..., { requireAuth: true })`,
    )
  }

  return new ApiKeyService(ctx)
}
