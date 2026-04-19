import type { AuthContext } from '../../../auth/domain'
import { InsufficientScopeError } from '../../../auth/domain'
import type { IClock } from '../../../shared/application/ports/clock.port'
import { ResourceNotFoundError } from '../../../shared/kernel/errors'
import type { Agent, AgentId } from '../../domain'
import type { IAgentRepository } from '../ports/agent-repository.port'

export interface UpdateAgentInput {
  agentId: AgentId
  name: string
}

export class UpdateAgentUseCase {
  constructor(
    private readonly agentRepo: IAgentRepository,
    private readonly clock: IClock,
  ) {}

  async execute(ctx: AuthContext, input: UpdateAgentInput): Promise<Agent> {
    if (!ctx.scopes.includes('*')) {
      throw new InsufficientScopeError('This operation requires scope *')
    }
    const agent = await this.agentRepo.findById(input.agentId)
    if (!agent || agent.ownerId !== ctx.userId) {
      throw new ResourceNotFoundError('Resource not found')
    }
    const updated: Agent = { ...agent, name: input.name.trim(), updatedAt: this.clock.now() }
    return this.agentRepo.update(updated)
  }
}
