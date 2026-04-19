import type { AuthContext } from '../../../auth/domain'
import { ResourceNotFoundError } from '../../../shared/kernel/errors'
import type { AgentId, PromptVersion } from '../../domain'
import type { IAgentRepository } from '../ports/agent-repository.port'
import type { IPromptVersionRepository } from '../ports/prompt-version-repository.port'

export interface ListPromptVersionsInput {
  agentId: AgentId
}

export class ListPromptVersionsUseCase {
  constructor(
    private readonly agentRepo: IAgentRepository,
    private readonly promptVersionRepo: IPromptVersionRepository,
  ) {}

  async execute(ctx: AuthContext, input: ListPromptVersionsInput): Promise<PromptVersion[]> {
    const agent = await this.agentRepo.findById(input.agentId)
    if (!agent || agent.ownerId !== ctx.userId) {
      throw new ResourceNotFoundError('Resource not found')
    }
    return this.promptVersionRepo.listByAgent(input.agentId)
  }
}
