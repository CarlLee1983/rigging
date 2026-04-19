import type { AgentId, PromptVersion, PromptVersionId } from '../../domain'

export interface CreatePromptVersionCommand {
  readonly id: PromptVersionId
  readonly agentId: AgentId
  readonly version: number
  readonly content: string
  readonly createdAt: Date
}

export interface IPromptVersionRepository {
  // Atomic INSERT ... ON CONFLICT DO NOTHING RETURNING. Returns null on UNIQUE violation
  // so use case can retry with a fresh MAX(version) read (D-06, retry-3).
  createAtomic(cmd: CreatePromptVersionCommand): Promise<PromptVersion | null>
  findLatestByAgent(agentId: AgentId): Promise<PromptVersion | null>
  findByAgentAndVersion(agentId: AgentId, version: number): Promise<PromptVersion | null>
  listByAgent(agentId: AgentId): Promise<PromptVersion[]>
}
