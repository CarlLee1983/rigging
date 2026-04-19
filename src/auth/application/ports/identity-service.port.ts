import type { AuthContext, Scope, UserId } from '../../domain/auth-context'

export interface IIdentityService {
  verifySession(headers: Headers): Promise<AuthContext | null>
  verifyApiKey(rawKey: string): Promise<AuthContext | null>
  createApiKey(params: {
    userId: UserId
    label: string
    scopes: ReadonlyArray<Scope>
    expiresAt: Date
  }): Promise<{ id: string; rawKey: string; prefix: string; createdAt: Date }>
  listApiKeysByUser(userId: UserId): Promise<
    Array<{
      id: string
      label: string
      prefix: string
      scopes: ReadonlyArray<string>
      expiresAt: Date | null
      createdAt: Date
      revokedAt: Date | null
    }>
  >
  revokeApiKey(id: string, userId: UserId): Promise<void>
}
