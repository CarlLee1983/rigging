import { Type } from '@sinclair/typebox'
import { Elysia } from 'elysia'
import type { AuthContext, Scope } from '../../domain'

const IdentityKindSchema = Type.Union([Type.Literal('human'), Type.Literal('agent')])

const MeResponseSchema = Type.Object({
  userId: Type.String(),
  identityKind: IdentityKindSchema,
  scopes: Type.Array(Type.String()),
  apiKeyId: Type.Optional(Type.String()),
  sessionId: Type.Optional(Type.String()),
})

export function meController() {
  return new Elysia({ name: 'rigging/me-controller' }).get(
    '/me',
    (context) => {
      const authContext = (context as unknown as { authContext: AuthContext }).authContext
      return {
        ...authContext,
        scopes: [...authContext.scopes] as Scope[],
      }
    },
    {
      requireAuth: true,
      response: { 200: MeResponseSchema },
      detail: {
        summary: 'Inspect the current AuthContext',
        tags: ['auth'],
        security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
      },
    },
  )
}
