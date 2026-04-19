import { type Brand, brand } from '../../../shared/kernel/brand'
import { ValidationError } from '../../../shared/kernel/errors'

// Per D-23 sha256 — 32 bytes = 64 hex chars.
export type ApiKeyHash = Brand<string, 'ApiKeyHash'>

const HEX_64_RE = /^[0-9a-f]{64}$/

export const ApiKeyHash = (value: string): ApiKeyHash => {
  if (!HEX_64_RE.test(value)) {
    throw new ValidationError(
      `ApiKeyHash must be 64 lowercase hex chars (sha256); got length=${value.length}`,
    )
  }

  return brand<'ApiKeyHash'>()(value)
}
