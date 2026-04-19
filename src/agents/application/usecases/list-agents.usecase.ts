import type { AuthContext, UserId } from '../../../auth/domain'
import type { Agent } from '../../domain'
import type { IAgentRepository } from '../ports/agent-repository.port'

export class ListAgentsUseCase {
  constructor(private readonly agentRepo: IAgentRepository) {}

  async execute(ctx: AuthContext): Promise<Agent[]> {
    return this.agentRepo.listByOwner(ctx.userId as UserId)
  }
}
