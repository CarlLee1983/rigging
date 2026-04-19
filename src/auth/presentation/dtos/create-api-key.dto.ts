import { type Static, Type } from '@sinclair/typebox'
import { ALLOWED_SCOPES } from '../../domain'

const [fullAccessScope, readOnlyScope] = ALLOWED_SCOPES
export const ScopeSchema = Type.Union([Type.Literal(fullAccessScope), Type.Literal(readOnlyScope)])

export const CreateApiKeyBodySchema = Type.Object({
  userId: Type.Optional(Type.String({ minLength: 1 })),
  label: Type.String({ minLength: 1, maxLength: 64 }),
  scopes: Type.Optional(Type.Array(ScopeSchema)),
  expiresAt: Type.Optional(Type.String({ format: 'date-time' })),
})

export const CreateApiKeyResponseSchema = Type.Object({
  id: Type.String(),
  key: Type.String(),
  prefix: Type.String(),
  label: Type.String(),
  scopes: Type.Array(ScopeSchema),
  expiresAt: Type.String({ format: 'date-time' }),
  createdAt: Type.String({ format: 'date-time' }),
})

export type CreateApiKeyBody = Static<typeof CreateApiKeyBodySchema>
export type CreateApiKeyResponse = Static<typeof CreateApiKeyResponseSchema>
