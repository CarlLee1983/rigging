import { Type } from '@sinclair/typebox'
import { Elysia } from 'elysia'
import type { AuthContext } from '../../../auth/domain'
import type { CreateEvalDatasetUseCase } from '../../application/usecases/create-eval-dataset.usecase'
import type { DeleteEvalDatasetUseCase } from '../../application/usecases/delete-eval-dataset.usecase'
import type { GetEvalDatasetUseCase } from '../../application/usecases/get-eval-dataset.usecase'
import type { ListEvalDatasetsUseCase } from '../../application/usecases/list-eval-datasets.usecase'
import type { AgentId, EvalDatasetId } from '../../domain'
import {
  EvalDatasetListResponseSchema,
  EvalDatasetResponseSchema,
} from '../dtos/agent-responses.dto'
import { CreateEvalDatasetBodySchema } from '../dtos/create-eval-dataset.dto'

export interface EvalDatasetControllerDeps {
  createEvalDataset: CreateEvalDatasetUseCase
  getEvalDataset: GetEvalDatasetUseCase
  listEvalDatasets: ListEvalDatasetsUseCase
  deleteEvalDataset: DeleteEvalDatasetUseCase
}

const AgentIdParamsSchema = Type.Object({ agentId: Type.String({ minLength: 1 }) })
const AgentIdAndDatasetParamsSchema = Type.Object({
  agentId: Type.String({ minLength: 1 }),
  datasetId: Type.String({ minLength: 1 }),
})

function toEvalDatasetResponse(d: {
  id: string
  agentId: string
  name: string
  cases: ReadonlyArray<{ input: string; expectedOutput: string }>
  createdAt: Date
}) {
  return {
    id: d.id,
    agentId: d.agentId,
    name: d.name,
    cases: d.cases.map((c) => ({ input: c.input, expectedOutput: c.expectedOutput })),
    createdAt: d.createdAt.toISOString(),
  }
}

export function evalDatasetController(deps: EvalDatasetControllerDeps) {
  return new Elysia({ name: 'rigging/eval-dataset-controller', prefix: '/agents/:agentId' })
    .post(
      '/eval-datasets',
      async (context) => {
        const authContext = (context as unknown as { authContext: AuthContext }).authContext
        const { params, body, set } = context
        const result = await deps.createEvalDataset.execute(authContext, {
          agentId: params.agentId as AgentId,
          name: body.name,
          cases: body.cases,
        })
        set.status = 201
        return toEvalDatasetResponse(result)
      },
      {
        params: AgentIdParamsSchema,
        body: CreateEvalDatasetBodySchema,
        response: { 201: EvalDatasetResponseSchema },
        requireAuth: true,
        detail: {
          summary: 'Create an immutable eval dataset',
          tags: ['agents/eval-datasets'],
          security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        },
      },
    )
    .get(
      '/eval-datasets',
      async (context) => {
        const authContext = (context as unknown as { authContext: AuthContext }).authContext
        const { params } = context
        const rows = await deps.listEvalDatasets.execute(authContext, {
          agentId: params.agentId as AgentId,
        })
        return rows.map(toEvalDatasetResponse)
      },
      {
        params: AgentIdParamsSchema,
        response: { 200: EvalDatasetListResponseSchema },
        requireAuth: true,
        detail: {
          summary: 'List eval datasets for an agent',
          tags: ['agents/eval-datasets'],
          security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        },
      },
    )
    .get(
      '/eval-datasets/:datasetId',
      async (context) => {
        const authContext = (context as unknown as { authContext: AuthContext }).authContext
        const { params } = context
        const result = await deps.getEvalDataset.execute(authContext, {
          agentId: params.agentId as AgentId,
          datasetId: params.datasetId as EvalDatasetId,
        })
        return toEvalDatasetResponse(result)
      },
      {
        params: AgentIdAndDatasetParamsSchema,
        response: { 200: EvalDatasetResponseSchema },
        requireAuth: true,
        detail: {
          summary: 'Get an eval dataset',
          tags: ['agents/eval-datasets'],
          security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        },
      },
    )
    .delete(
      '/eval-datasets/:datasetId',
      async (context) => {
        const authContext = (context as unknown as { authContext: AuthContext }).authContext
        const { params, set } = context
        await deps.deleteEvalDataset.execute(authContext, {
          agentId: params.agentId as AgentId,
          datasetId: params.datasetId as EvalDatasetId,
        })
        set.status = 204
      },
      {
        params: AgentIdAndDatasetParamsSchema,
        requireAuth: true,
        detail: {
          summary: 'Delete an eval dataset',
          tags: ['agents/eval-datasets'],
          security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],
        },
      },
    )
}
