import type { UserId } from '../../../auth/domain'
import type { Agent, AgentId } from '../../domain'

export interface IAgentRepository {
  findById(id: AgentId): Promise<Agent | null>
  listByOwner(ownerId: UserId): Promise<Agent[]>
  create(agent: Agent): Promise<Agent>
  update(agent: Agent): Promise<Agent>
  delete(id: AgentId): Promise<boolean>
}
