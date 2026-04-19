import { DomainError } from '../../shared/kernel/errors'

// D-12: All 401 scenarios share this one code; body shape uniform via global errorHandler.
export class UnauthenticatedError extends DomainError {
  readonly code = 'UNAUTHENTICATED'
  readonly httpStatus = 401
}

// D-06: 403 with specific code so Swagger + client can disambiguate from generic FORBIDDEN.
export class InsufficientScopeError extends DomainError {
  readonly code = 'INSUFFICIENT_SCOPE'
  readonly httpStatus = 403
}

// D-04: API Key creation-time check — requested scopes exceed session scopes.
export class ScopeNotSubsetError extends DomainError {
  readonly code = 'SCOPE_NOT_SUBSET'
  readonly httpStatus = 403
}

// AUTH-15 + CVE-2025-61928 defense — session userId vs body userId mismatch.
export class UserIdMismatchError extends DomainError {
  readonly code = 'USER_ID_MISMATCH'
  readonly httpStatus = 403
}

// AUTH-08 extension point — interface only; no route wires it in v1 per CONTEXT deferred list.
export class EmailNotVerifiedError extends DomainError {
  readonly code = 'EMAIL_NOT_VERIFIED'
  readonly httpStatus = 403
}
