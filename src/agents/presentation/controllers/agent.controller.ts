import { Type } from '@sinclair/typebox'
import { Elysia } from 'elysia'
import type { AuthContext } from '../../../auth/domain'
import type { CreateAgentUseCase } from '../../application/usecases/create-agent.usecase'
import type { DeleteAgentUseCase } from '../../application/usecases/delete-agent.usecase'
import type { GetAgentUseCase } from '../../application/usecases/get-agent.usecase'
import type { ListAgentsUseCase } from '../../application/usecases/list-agents.usecase'
import type { UpdateAgentUseCase } from '../../application/usecases/update-agent.usecase'
import type { AgentId } from '../../domain'
import { AgentListResponseSchema, AgentResponseSchema } from '../dtos/agent-responses.dto'
import { CreateAgentBodySchema } from '../dtos/create-agent.dto'
import { UpdateAgentBodySchema } from '../dtos/update-agent.dto'

export interface AgentControllerDeps {
  createAgent: CreateAgentUseCase
  getAgent: GetAgentUseCase
  listAgents: ListAgentsUseCase
  updateAgent: UpdateAgentUseCase
  deleteAgent: DeleteAgentUseCase
}

const AgentIdParamsSchema = Type.Object({ agentId: Type.String({ minLength: 1 }) })

function toAgentResponse(a: {
  id: string
  ownerId: string
  name: string
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: a.id,
    ownerId: a.ownerId,
    name: a.name,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }
}

export function agentController(deps: AgentControllerDeps) {
  return new Elysia({ name: 'rigging/agent-controller' })
    .post(
      '/agents',
      async (context) => {
        const authContext = (context as unknown as { authContext: AuthContext }).authContext
        const { body, set } = context
        const result = await deps.createAgent.execute(authContext, { name: body.name })
        set.status = 201
        return toAgentResponse(result)
      },
      {
        body: CreateAgentBodySchema,
        response: { 201: AgentResponseSchema },
        requireAuth: true,
        detail: {
          summary: 'Create an agent',
          tags: ['agents'],
          security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        },
      },
    )
    .get(
      '/agents',
      async (context) => {
        const authContext = (context as unknown as { authContext: AuthContext }).authContext
        const rows = await deps.listAgents.execute(authContext)
        return rows.map(toAgentResponse)
      },
      {
        response: { 200: AgentListResponseSchema },
        requireAuth: true,
        detail: {
          summary: 'List agents owned by the authenticated user',
          tags: ['agents'],
          security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        },
      },
    )
    .get(
      '/agents/:agentId',
      async (context) => {
        const authContext = (context as unknown as { authContext: AuthContext }).authContext
        const { params } = context
        const result = await deps.getAgent.execute(authContext, {
          agentId: params.agentId as AgentId,
        })
        return toAgentResponse(result)
      },
      {
        params: AgentIdParamsSchema,
        response: { 200: AgentResponseSchema },
        requireAuth: true,
        detail: {
          summary: 'Get an agent by id',
          tags: ['agents'],
          security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        },
      },
    )
    .patch(
      '/agents/:agentId',
      async (context) => {
        const authContext = (context as unknown as { authContext: AuthContext }).authContext
        const { params, body } = context
        const result = await deps.updateAgent.execute(authContext, {
          agentId: params.agentId as AgentId,
          name: body.name,
        })
        return toAgentResponse(result)
      },
      {
        params: AgentIdParamsSchema,
        body: UpdateAgentBodySchema,
        response: { 200: AgentResponseSchema },
        requireAuth: true,
        detail: {
          summary: 'Update an agent',
          tags: ['agents'],
          security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        },
      },
    )
    .delete(
      '/agents/:agentId',
      async (context) => {
        const authContext = (context as unknown as { authContext: AuthContext }).authContext
        const { params, set } = context
        await deps.deleteAgent.execute(authContext, { agentId: params.agentId as AgentId })
        set.status = 204
      },
      {
        params: AgentIdParamsSchema,
        requireAuth: true,
        detail: {
          summary: 'Delete an agent (cascades prompt_version + eval_dataset)',
          tags: ['agents'],
          security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        },
      },
    )
}
