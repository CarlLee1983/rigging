import { type Brand, brand } from '../../../shared/kernel/brand'
import { ValidationError } from '../../../shared/kernel/errors'

export type Email = Brand<string, 'Email'>

// Minimal validator — not full RFC 5322. BetterAuth does its own email parsing; this guards
// our domain boundary against empty / whitespace / obviously-invalid input before we hand it over.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const Email = (value: string): Email => {
  const normalized = value.trim().toLowerCase()
  if (!EMAIL_RE.test(normalized)) {
    throw new ValidationError(`Invalid email: ${JSON.stringify(value)}`)
  }

  return brand<'Email'>()(normalized)
}
