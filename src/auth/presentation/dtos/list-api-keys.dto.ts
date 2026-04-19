import { type Static, Type } from '@sinclair/typebox'
import { ALLOWED_SCOPES } from '../../domain'

const [fullAccessScope, readOnlyScope] = ALLOWED_SCOPES
export const ScopeSchema = Type.Union([Type.Literal(fullAccessScope), Type.Literal(readOnlyScope)])

export const ListApiKeysItemSchema = Type.Object({
  id: Type.String(),
  label: Type.String(),
  prefix: Type.String(),
  scopes: Type.Array(ScopeSchema),
  expiresAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  revokedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
})

export const ListApiKeysResponseSchema = Type.Array(ListApiKeysItemSchema)

export type ListApiKeysItem = Static<typeof ListApiKeysItemSchema>
export type ListApiKeysResponse = Static<typeof ListApiKeysResponseSchema>
