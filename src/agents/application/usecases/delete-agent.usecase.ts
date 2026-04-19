import type { AuthContext } from '../../../auth/domain'
import { InsufficientScopeError } from '../../../auth/domain'
import { ResourceNotFoundError } from '../../../shared/kernel/errors'
import type { AgentId } from '../../domain'
import type { IAgentRepository } from '../ports/agent-repository.port'

export interface DeleteAgentInput {
  agentId: AgentId
}

export class DeleteAgentUseCase {
  constructor(private readonly agentRepo: IAgentRepository) {}

  async execute(ctx: AuthContext, input: DeleteAgentInput): Promise<void> {
    if (!ctx.scopes.includes('*')) {
      throw new InsufficientScopeError('This operation requires scope *')
    }
    const agent = await this.agentRepo.findById(input.agentId)
    if (!agent || agent.ownerId !== ctx.userId) {
      throw new ResourceNotFoundError('Resource not found')
    }
    await this.agentRepo.delete(input.agentId)
  }
}
