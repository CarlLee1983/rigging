import type { AuthContext } from '../auth-context'

/**
 * ApiKeyService — internal domain service. Constructor takes an AuthContext captured at request
 * time. Instances are per-request, short-lived, and carry the caller's identity so every operation
 * is implicitly scoped.
 */
export class ApiKeyService {
  constructor(readonly ctx: AuthContext) {}
}
