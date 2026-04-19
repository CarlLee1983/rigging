import type { UserId } from '../../../auth/domain'
import type { Agent, AgentId } from '../../domain'

export type AgentDbRow = {
  id: string
  ownerId: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export const AgentMapper = {
  toDomain(row: AgentDbRow): Agent {
    return {
      id: row.id as AgentId,
      ownerId: row.ownerId as UserId,
      name: row.name,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  },
}
