import type { UUID } from '../../shared/kernel/id'
import type { IdentityKind } from './identity-kind'

// D-01: the only two scope values in v1. Extension to resource-action granularity is v2 TEN-02 RBAC.
// DTOs (Plan 03-04) MUST derive their TypeBox union from this constant — never hardcode the literals.
export const ALLOWED_SCOPES = ['*', 'read:*'] as const

export type Scope = (typeof ALLOWED_SCOPES)[number]

export type UserId = UUID<'UserId'>

/**
 * AUX-01 canonical AuthContext shape.
 * - `userId`: branded UUID from resolver.
 * - `identityKind`: 'human' when cookie session path used; 'agent' when x-api-key path used.
 * - `scopes`: ReadonlyArray — `['*']` for human (D-03); subset of session scopes for agent (D-04).
 * - `apiKeyId` present iff identityKind === 'agent' (D-11 no-sessionId invariant).
 * - `sessionId` present iff identityKind === 'human'.
 */
export interface AuthContext {
  readonly userId: UserId
  readonly identityKind: IdentityKind
  readonly scopes: ReadonlyArray<Scope>
  readonly apiKeyId?: string
  readonly sessionId?: string
}

export const isAgent = (ctx: AuthContext): boolean => ctx.identityKind === 'agent'

export const isHuman = (ctx: AuthContext): boolean => ctx.identityKind === 'human'
