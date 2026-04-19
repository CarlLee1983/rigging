// HTTP error response body shape — stable across all Rigging routes.
// Shape: { error: { code, message, requestId } }
// Extensibility: future `details?` field can be added without breaking this shape.

export const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR'
export const INTERNAL_ERROR_MESSAGE = 'Internal server error'

export interface HttpErrorBody {
  error: {
    code: string
    message: string
    requestId: string
  }
}

export function toHttpErrorBody(args: {
  code: string
  message: string
  requestId: string
}): HttpErrorBody {
  return { error: { code: args.code, message: args.message, requestId: args.requestId } }
}
