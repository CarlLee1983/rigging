import { Type } from '@sinclair/typebox'
import { Elysia } from 'elysia'
import type { CreateApiKeyUseCase } from '../../application/usecases/create-api-key.usecase'
import type { ListApiKeysUseCase } from '../../application/usecases/list-api-keys.usecase'
import type { RevokeApiKeyUseCase } from '../../application/usecases/revoke-api-key.usecase'
import type { AuthContext, Scope } from '../../domain'
import { CreateApiKeyBodySchema, CreateApiKeyResponseSchema } from '../dtos/create-api-key.dto'
import { ListApiKeysResponseSchema } from '../dtos/list-api-keys.dto'

export interface ApiKeyControllerDeps {
  createApiKey: CreateApiKeyUseCase
  listApiKeys: ListApiKeysUseCase
  revokeApiKey: RevokeApiKeyUseCase
}

const DeleteApiKeyParamsSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
})

export function apiKeyController(deps: ApiKeyControllerDeps) {
  return new Elysia({ name: 'rigging/api-key-controller' })
    .post(
      '/api-keys',
      async (context) => {
        const authContext = (context as unknown as { authContext: AuthContext }).authContext
        const { body, set } = context
        const input = {
          label: body.label,
          scopes: body.scopes ?? ['*'],
          ...(body.userId !== undefined ? { userId: body.userId } : {}),
          ...(body.expiresAt !== undefined ? { expiresAt: new Date(body.expiresAt) } : {}),
        }
        const result = await deps.createApiKey.execute(authContext, input)

        set.status = 201
        return {
          ...result,
          expiresAt: result.expiresAt.toISOString(),
          createdAt: result.createdAt.toISOString(),
          scopes: [...result.scopes] as Scope[],
        }
      },
      {
        body: CreateApiKeyBodySchema,
        response: { 201: CreateApiKeyResponseSchema },
        requireAuth: true,
        detail: {
          summary: 'Create an API key',
          tags: ['api-keys'],
          security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        },
      },
    )
    .get(
      '/api-keys',
      async (context) => {
        const authContext = (context as unknown as { authContext: AuthContext }).authContext
        const rows = await deps.listApiKeys.execute(authContext)
        return rows.map((row) => ({
          ...row,
          expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
          createdAt: row.createdAt.toISOString(),
          revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
          scopes: [...row.scopes] as Scope[],
        }))
      },
      {
        response: { 200: ListApiKeysResponseSchema },
        requireAuth: true,
        detail: {
          summary: 'List the current user API keys',
          tags: ['api-keys'],
          security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        },
      },
    )
    .delete(
      '/api-keys/:id',
      async (context) => {
        const authContext = (context as unknown as { authContext: AuthContext }).authContext
        const { params, set } = context
        await deps.revokeApiKey.execute(authContext, params.id)
        set.status = 204
      },
      {
        params: DeleteApiKeyParamsSchema,
        requireAuth: true,
        detail: {
          summary: 'Revoke an API key',
          tags: ['api-keys'],
          security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        },
      },
    )
}
