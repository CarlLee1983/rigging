import { Elysia } from 'elysia'
import type { Logger } from 'pino'
import { DomainError } from '../../kernel/errors'
import { INTERNAL_ERROR_CODE, INTERNAL_ERROR_MESSAGE, toHttpErrorBody } from '../http-error'

/**
 * Global error handler plugin. Reads DomainError.httpStatus directly — no mapping table.
 *
 *   - 4xx (DomainError): log.warn with { code, requestId, path }, NO stack (D-13).
 *   - 5xx (non-DomainError or DomainError with 5xx): log.error with { err, stack, cause, requestId }.
 *   - Response body shape uniform: { error: { code, message, requestId } } (D-12).
 *   - Non-DomainError message is replaced with 'Internal server error' to avoid leaking internals.
 *
 * Elysia 1.4 uses `{ as: 'global' }` on onError so it captures throws from all downstream plugins + feature modules.
 */
export function errorHandlerPlugin(logger: Logger) {
  return new Elysia({ name: 'rigging/error-handler' }).onError({ as: 'global' }, (ctx) => {
    const { error, set, request } = ctx
    // requestId is derived by requestLoggerPlugin upstream via `.derive({ as: 'global' }, ...)`.
    // onError's ctx type doesn't surface that cross-plugin decoration, so we read it defensively.
    const rid = (ctx as { requestId?: unknown }).requestId
    const requestId = typeof rid === 'string' ? rid : 'unknown'
    const url = new URL(request.url)

    const maybeValidation = error as { code?: unknown; status?: unknown; message?: unknown }
    if (maybeValidation.code === 'VALIDATION' && typeof maybeValidation.status === 'number') {
      set.status = maybeValidation.status
      logger.warn(
        { code: 'VALIDATION', requestId, path: url.pathname },
        String(maybeValidation.message ?? 'validation failed'),
      )
      return toHttpErrorBody({
        code: 'VALIDATION_ERROR',
        message:
          typeof maybeValidation.message === 'string'
            ? maybeValidation.message
            : 'Validation failed',
        requestId,
      })
    }

    if (error instanceof DomainError) {
      set.status = error.httpStatus
      if (error.httpStatus >= 500) {
        logger.error(
          { err: error, stack: error.stack, cause: error.cause, requestId },
          error.message,
        )
      } else {
        logger.warn({ code: error.code, requestId, path: url.pathname }, error.message)
      }
      return toHttpErrorBody({
        code: error.code,
        message: error.message,
        requestId,
      })
    }

    // Non-DomainError → 500 + INTERNAL_ERROR, message masked.
    set.status = 500
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error(
      {
        err,
        stack: err.stack,
        cause: (err as { cause?: unknown }).cause,
        requestId,
        path: url.pathname,
      },
      err.message || 'unhandled error',
    )
    return toHttpErrorBody({
      code: INTERNAL_ERROR_CODE,
      message: INTERNAL_ERROR_MESSAGE,
      requestId,
    })
  })
}
