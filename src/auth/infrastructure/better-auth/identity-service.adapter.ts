import { createHash, timingSafeEqual } from 'node:crypto'
import type { IApiKeyRepository } from '../../application/ports/api-key-repository.port'
import type { IIdentityService } from '../../application/ports/identity-service.port'
import type { AuthContext, UserId } from '../../domain'
import type { AuthInstance } from './auth-instance'

const API_KEY_PREFIX = 'rig_live_'
const PREFIX_INDEX_LEN = 8
const RAW_KEY_LENGTH = 52
const DUMMY_HASH = createHash('sha256').update('dummy').digest()

function isAscii(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 0x7f) return false
  }
  return true
}

function asBuffer(hash: string): Buffer {
  return Buffer.from(hash, 'hex')
}

export class BetterAuthIdentityService implements IIdentityService {
  constructor(
    private readonly auth: AuthInstance,
    private readonly apiKeys: IApiKeyRepository,
  ) {}

  async verifySession(headers: Headers): Promise<AuthContext | null> {
    const result = await this.auth.api.getSession({ headers })
    if (!result) return null
    return {
      userId: result.user.id as UserId,
      identityKind: 'human',
      scopes: ['*'],
      sessionId: result.session.id,
    }
  }

  async verifyApiKey(rawKey: string): Promise<AuthContext | null> {
    if (
      !rawKey.startsWith(API_KEY_PREFIX) ||
      rawKey.length !== RAW_KEY_LENGTH ||
      !isAscii(rawKey)
    ) {
      timingSafeEqual(DUMMY_HASH, DUMMY_HASH)
      await this.apiKeys.findByPrefix('xxxxxxxx')
      return null
    }

    const prefix = rawKey.slice(0, PREFIX_INDEX_LEN)
    const row = await this.apiKeys.findByPrefix(prefix)
    if (!row) {
      timingSafeEqual(DUMMY_HASH, DUMMY_HASH)
      return null
    }

    if (
      row.revokedAt !== null ||
      (row.expiresAt !== null && row.expiresAt.getTime() <= Date.now())
    ) {
      timingSafeEqual(DUMMY_HASH, DUMMY_HASH)
      return null
    }

    const computedHash = createHash('sha256').update(rawKey).digest()
    const storedHash = asBuffer(row.hash)
    if (computedHash.length !== storedHash.length) {
      timingSafeEqual(DUMMY_HASH, DUMMY_HASH)
      return null
    }

    if (!timingSafeEqual(computedHash, storedHash)) {
      timingSafeEqual(DUMMY_HASH, DUMMY_HASH)
      return null
    }

    return {
      userId: row.userId,
      identityKind: 'agent',
      scopes: row.scopes as AuthContext['scopes'],
      apiKeyId: row.id,
    }
  }

  async createApiKey(params: {
    userId: UserId
    label: string
    scopes: ReadonlyArray<string>
    expiresAt: Date
  }): Promise<{ id: string; rawKey: string; prefix: string; createdAt: Date }> {
    const result = await this.auth.api.createApiKey({
      body: {
        userId: params.userId,
        name: params.label,
        prefix: API_KEY_PREFIX,
        expiresIn: Math.max(1, Math.ceil((params.expiresAt.getTime() - Date.now()) / 1000)),
        metadata: { scopes: params.scopes },
      },
    })

    const createdRecord =
      (
        result as {
          apiKey?: { id: string; prefix?: string | null; start?: string | null; createdAt: Date }
        }
      ).apiKey ??
      (result as { id: string; prefix?: string | null; start?: string | null; createdAt: Date })
    const rawKey =
      (result as { key?: string }).key ?? (createdRecord as unknown as { key?: string }).key ?? ''

    return {
      id: createdRecord.id,
      rawKey,
      prefix: createdRecord.prefix ?? createdRecord.start ?? rawKey.slice(0, PREFIX_INDEX_LEN),
      createdAt: createdRecord.createdAt,
    }
  }

  async listApiKeysByUser(userId: UserId) {
    const rows = await this.apiKeys.listByUserId(userId)
    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      prefix: row.prefix,
      scopes: row.scopes,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt,
    }))
  }

  async revokeApiKey(id: string, userId: UserId): Promise<void> {
    const revoked = await this.apiKeys.markRevoked(id, userId)
    if (!revoked) {
      return
    }
    if ('deleteApiKey' in this.auth.api) {
      await (
        this.auth.api as never as { deleteApiKey: (input: unknown) => Promise<unknown> }
      ).deleteApiKey({
        body: { keyId: id },
      })
    }
  }
}
