import type { UserId } from '../../domain/auth-context'

export interface ApiKeyRow {
  readonly id: string
  readonly userId: UserId
  readonly label: string
  readonly prefix: string
  readonly hash: string
  readonly scopes: ReadonlyArray<string>
  readonly expiresAt: Date | null
  readonly revokedAt: Date | null
  readonly createdAt: Date
}

export interface IApiKeyRepository {
  findByPrefix(prefix: string): Promise<ApiKeyRow | null>
  /** SHA-256 digest of the raw API key, base64url-encoded (matches BetterAuth `apikey.key` column). */
  findByKeyHash(keyHashStorage: string): Promise<ApiKeyRow | null>
  listByUserId(userId: UserId): Promise<ApiKeyRow[]>
  markRevoked(id: string, userId: UserId): Promise<boolean>
}
