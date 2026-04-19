import { and, desc, eq, gt, isNull, or } from 'drizzle-orm'
import type { DrizzleDb } from '../../../shared/infrastructure/db/client'
import type { ApiKeyRow, IApiKeyRepository } from '../../application/ports/api-key-repository.port'
import { ApiKeyMapper } from '../mappers/api-key.mapper'
import { apikey } from '../schema/api-key.schema'

export class DrizzleApiKeyRepository implements IApiKeyRepository {
  constructor(private readonly db: DrizzleDb) {}

  async findByPrefix(prefix: string): Promise<ApiKeyRow | null> {
    const rows = await this.db
      .select()
      .from(apikey)
      .where(
        and(
          eq(apikey.prefix, prefix),
          eq(apikey.enabled, true),
          or(isNull(apikey.expiresAt), gt(apikey.expiresAt, new Date())),
        ),
      )
      .limit(1)
    const row = rows[0] ?? null
    if (!row) return null
    const mapped = ApiKeyMapper.toDomain(row)
    if (mapped.revokedAt !== null) return null
    return mapped
  }

  async findByKeyHash(keyHashHex: string): Promise<ApiKeyRow | null> {
    const rows = await this.db
      .select()
      .from(apikey)
      .where(
        and(
          eq(apikey.key, keyHashHex),
          eq(apikey.enabled, true),
          or(isNull(apikey.expiresAt), gt(apikey.expiresAt, new Date())),
        ),
      )
      .limit(1)
    const row = rows[0] ?? null
    if (!row) return null
    const mapped = ApiKeyMapper.toDomain(row)
    if (mapped.revokedAt !== null) return null
    return mapped
  }

  async listByUserId(userId: ApiKeyRow['userId']): Promise<ApiKeyRow[]> {
    const rows = await this.db
      .select()
      .from(apikey)
      .where(eq(apikey.referenceId, userId))
      .orderBy(desc(apikey.createdAt))
    return rows.map((row) => ApiKeyMapper.toDomain(row))
  }

  async markRevoked(id: string, userId: ApiKeyRow['userId']): Promise<boolean> {
    const result = await this.db
      .update(apikey)
      .set({
        enabled: false,
        updatedAt: new Date(),
      })
      .where(and(eq(apikey.id, id), eq(apikey.referenceId, userId), eq(apikey.enabled, true)))
      .returning({ id: apikey.id })
    return result.length > 0
  }
}
