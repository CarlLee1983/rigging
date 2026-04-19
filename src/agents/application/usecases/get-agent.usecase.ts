import type { AuthContext } from '../../../auth/domain'
import { ResourceNotFoundError } from '../../../shared/kernel/errors'
import type { Agent, AgentId } from '../../domain'
import type { IAgentRepository } from '../ports/agent-repository.port'

export interface GetAgentInput {
  agentId: AgentId
}

export class GetAgentUseCase {
  constructor(private readonly agentRepo: IAgentRepository) {}

  async execute(ctx: AuthContext, input: GetAgentInput): Promise<Agent> {
    const agent = await this.agentRepo.findById(input.agentId)
    if (!agent || agent.ownerId !== ctx.userId) {
      throw new ResourceNotFoundError('Resource not found')
    }
    return agent
  }
}
