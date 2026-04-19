import { Type } from '@sinclair/typebox'
import { Elysia } from 'elysia'
import type { AuthContext } from '../../../auth/domain'
import type { CreatePromptVersionUseCase } from '../../application/usecases/create-prompt-version.usecase'
import type { GetLatestPromptVersionUseCase } from '../../application/usecases/get-latest-prompt-version.usecase'
import type { GetPromptVersionUseCase } from '../../application/usecases/get-prompt-version.usecase'
import type { ListPromptVersionsUseCase } from '../../application/usecases/list-prompt-versions.usecase'
import type { AgentId } from '../../domain'
import {
  PromptVersionListResponseSchema,
  PromptVersionResponseSchema,
} from '../dtos/agent-responses.dto'
import { CreatePromptVersionBodySchema } from '../dtos/create-prompt-version.dto'

export interface PromptVersionControllerDeps {
  createPromptVersion: CreatePromptVersionUseCase
  getLatestPromptVersion: GetLatestPromptVersionUseCase
  getPromptVersion: GetPromptVersionUseCase
  listPromptVersions: ListPromptVersionsUseCase
}

const AgentIdParamsSchema = Type.Object({ agentId: Type.String({ minLength: 1 }) })
const AgentIdAndVersionParamsSchema = Type.Object({
  agentId: Type.String({ minLength: 1 }),
  // Path segments are strings; validate digits and coerce in the handler.
  version: Type.String({ pattern: '^[1-9][0-9]*$' }),
})

function toPromptVersionResponse(pv: {
  id: string
  agentId: string
  version: number
  content: string
  createdAt: Date
}) {
  return {
    id: pv.id,
    agentId: pv.agentId,
    version: pv.version,
    content: pv.content,
    createdAt: pv.createdAt.toISOString(),
  }
}

export function promptVersionController(deps: PromptVersionControllerDeps) {
  return new Elysia({ name: 'rigging/prompt-version-controller', prefix: '/agents/:agentId' })
    .post(
      '/prompts',
      async (context) => {
        const authContext = (context as unknown as { authContext: AuthContext }).authContext
        const { params, body, set } = context
        const result = await deps.createPromptVersion.execute(authContext, {
          agentId: params.agentId as AgentId,
          content: body.content,
        })
        set.status = 201
        return toPromptVersionResponse(result)
      },
      {
        params: AgentIdParamsSchema,
        body: CreatePromptVersionBodySchema,
        response: { 201: PromptVersionResponseSchema },
        requireAuth: true,
        detail: {
          summary: 'Create a new prompt version',
          tags: ['agents/prompts'],
          security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        },
      },
    )
    .get(
      '/prompts/latest',
      async (context) => {
        const authContext = (context as unknown as { authContext: AuthContext }).authContext
        const { params } = context
        const result = await deps.getLatestPromptVersion.execute(authContext, {
          agentId: params.agentId as AgentId,
        })
        return toPromptVersionResponse(result)
      },
      {
        params: AgentIdParamsSchema,
        response: { 200: PromptVersionResponseSchema },
        requireAuth: true,
        detail: {
          summary: 'Get the latest prompt version (dogfood endpoint for DEMO-04)',
          tags: ['agents/prompts'],
          security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        },
      },
    )
    .get(
      '/prompts/:version',
      async (context) => {
        const authContext = (context as unknown as { authContext: AuthContext }).authContext
        const { params } = context
        const result = await deps.getPromptVersion.execute(authContext, {
          agentId: params.agentId as AgentId,
          version: Number.parseInt(params.version, 10),
        })
        return toPromptVersionResponse(result)
      },
      {
        params: AgentIdAndVersionParamsSchema,
        response: { 200: PromptVersionResponseSchema },
        requireAuth: true,
        detail: {
          summary: 'Get a specific prompt version',
          tags: ['agents/prompts'],
          security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        },
      },
    )
    .get(
      '/prompts',
      async (context) => {
        const authContext = (context as unknown as { authContext: AuthContext }).authContext
        const { params } = context
        const rows = await deps.listPromptVersions.execute(authContext, {
          agentId: params.agentId as AgentId,
        })
        return rows.map(toPromptVersionResponse)
      },
      {
        params: AgentIdParamsSchema,
        response: { 200: PromptVersionListResponseSchema },
        requireAuth: true,
        detail: {
          summary: 'List prompt versions (newest first)',
          tags: ['agents/prompts'],
          security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        },
      },
    )
}
