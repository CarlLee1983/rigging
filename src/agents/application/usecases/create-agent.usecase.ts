import type { AuthContext, UserId } from '../../../auth/domain'
import { InsufficientScopeError } from '../../../auth/domain'
import type { IClock } from '../../../shared/application/ports/clock.port'
import { type Agent, newAgentId } from '../../domain'
import type { IAgentRepository } from '../ports/agent-repository.port'

export interface CreateAgentInput {
  name: string
}

export class CreateAgentUseCase {
  constructor(
    private readonly agentRepo: IAgentRepository,
    private readonly clock: IClock,
  ) {}

  async execute(ctx: AuthContext, input: CreateAgentInput): Promise<Agent> {
    if (!ctx.scopes.includes('*')) {
      throw new InsufficientScopeError('This operation requires scope *')
    }
    const now = this.clock.now()
    const newAgent: Agent = {
      id: newAgentId(),
      ownerId: ctx.userId as UserId,
      name: input.name.trim(),
      createdAt: now,
      updatedAt: now,
    }
    return this.agentRepo.create(newAgent)
  }
}
