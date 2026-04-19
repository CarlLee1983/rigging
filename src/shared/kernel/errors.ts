// DomainError hierarchy — framework-free, HTTP mapping via `httpStatus` field.
// Error handler plugin (Phase 2) reads err.httpStatus directly — no mapping table.
// See docs/decisions/0003-ddd-layering.md (framework-free) + docs/decisions/0006-authcontext-boundary.md.

export abstract class DomainError extends Error {
  abstract readonly code: string
  abstract readonly httpStatus: number

  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message)
    this.name = this.constructor.name
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR'
  readonly httpStatus = 400
}

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED'
  readonly httpStatus = 401
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN'
  readonly httpStatus = 403
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND'
  readonly httpStatus = 404
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT'
  readonly httpStatus = 409
}

// D-09 (P4): Ownership-aware 404 for cross-user resource access.
// Distinct from NotFoundError so controllers + tests can match on code === 'RESOURCE_NOT_FOUND'.
export class ResourceNotFoundError extends DomainError {
  readonly code = 'RESOURCE_NOT_FOUND'
  readonly httpStatus = 404
}
