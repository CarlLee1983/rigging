import type { AgentId, PromptVersion, PromptVersionId } from '../../domain'

export type PromptVersionDbRow = {
  id: string
  agentId: string
  version: number
  content: string
  createdAt: Date
}

export const PromptVersionMapper = {
  toDomain(row: PromptVersionDbRow): PromptVersion {
    return {
      id: row.id as PromptVersionId,
      agentId: row.agentId as AgentId,
      version: row.version,
      content: row.content,
      createdAt: row.createdAt,
    }
  },
}
