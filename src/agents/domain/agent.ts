import type { UserId } from '../../auth/domain'
import type { AgentId } from './values/ids'

export interface Agent {
  readonly id: AgentId
  readonly ownerId: UserId
  readonly name: string
  readonly createdAt: Date
  readonly updatedAt: Date
}
