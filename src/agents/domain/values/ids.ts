import { newUUID, type UUID } from '../../../shared/kernel/id'

export type AgentId = UUID<'AgentId'>
export type PromptVersionId = UUID<'PromptVersionId'>
export type EvalDatasetId = UUID<'EvalDatasetId'>

export const newAgentId = (): AgentId => newUUID<'AgentId'>()
export const newPromptVersionId = (): PromptVersionId => newUUID<'PromptVersionId'>()
export const newEvalDatasetId = (): EvalDatasetId => newUUID<'EvalDatasetId'>()
