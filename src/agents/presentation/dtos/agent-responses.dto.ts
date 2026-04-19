import { Type } from '@sinclair/typebox'
import { EvalCaseSchema } from './create-eval-dataset.dto'

export const AgentResponseSchema = Type.Object({
  id: Type.String(),
  ownerId: Type.String(),
  name: Type.String(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})

export const AgentListResponseSchema = Type.Array(AgentResponseSchema)

export const PromptVersionResponseSchema = Type.Object({
  id: Type.String(),
  agentId: Type.String(),
  version: Type.Integer({ minimum: 1 }),
  content: Type.String(),
  createdAt: Type.String({ format: 'date-time' }),
})

export const PromptVersionListResponseSchema = Type.Array(PromptVersionResponseSchema)

export const EvalDatasetResponseSchema = Type.Object({
  id: Type.String(),
  agentId: Type.String(),
  name: Type.String(),
  cases: Type.Array(EvalCaseSchema),
  createdAt: Type.String({ format: 'date-time' }),
})

export const EvalDatasetListResponseSchema = Type.Array(EvalDatasetResponseSchema)
