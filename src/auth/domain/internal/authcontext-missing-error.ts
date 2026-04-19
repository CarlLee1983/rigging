import { DomainError } from '../../../shared/kernel/errors'

/**
 * AuthContextMissingError — thrown by `getApiKeyService(ctx)` runtime guard when ctx is missing.
 */
export class AuthContextMissingError extends DomainError {
  readonly code = 'AUTH_CONTEXT_MISSING'
  readonly httpStatus = 500
}
