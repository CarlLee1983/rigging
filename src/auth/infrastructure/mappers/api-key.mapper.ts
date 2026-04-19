import type { ApiKeyRow } from '../../application/ports/api-key-repository.port'

export type ApiKeyDbRow = {
  id: string
  name: string | null
  start: string | null
  prefix: string | null
  key: string
  referenceId: string
  enabled: boolean | null
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
  metadata: string | null
}

function parseScopes(metadata: string | null): ReadonlyArray<string> {
  if (!metadata) return []
  try {
    const value = JSON.parse(metadata) as { scopes?: unknown }
    if (!value || !Array.isArray(value.scopes)) return []
    return value.scopes.filter((scope): scope is string => typeof scope === 'string')
  } catch {
    return []
  }
}

export const ApiKeyMapper = {
  toDomain(row: ApiKeyDbRow): ApiKeyRow {
    return {
      id: row.id,
      userId: row.referenceId as ApiKeyRow['userId'],
      label: row.name ?? '',
      prefix: row.prefix ?? row.start ?? '',
      hash: row.key,
      scopes: parseScopes(row.metadata),
      expiresAt: row.expiresAt,
      revokedAt: row.enabled === false ? row.updatedAt : null,
      createdAt: row.createdAt,
    }
  },
}
