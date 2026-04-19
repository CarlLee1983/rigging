import type { AgentId, PromptVersionId } from './values/ids'

export interface PromptVersion {
  readonly id: PromptVersionId
  readonly agentId: AgentId
  readonly version: number
  readonly content: string
  readonly createdAt: Date
}
