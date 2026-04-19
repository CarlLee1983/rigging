import type { AuthContext } from '../../../auth/domain'
import { ResourceNotFoundError } from '../../../shared/kernel/errors'
import type { AgentId, PromptVersion } from '../../domain'
import type { IAgentRepository } from '../ports/agent-repository.port'
import type { IPromptVersionRepository } from '../ports/prompt-version-repository.port'

export interface GetLatestPromptVersionInput {
  agentId: AgentId
}

export class GetLatestPromptVersionUseCase {
  constructor(
    private readonly agentRepo: IAgentRepository,
    private readonly promptVersionRepo: IPromptVersionRepository,
  ) {}

  async execute(ctx: AuthContext, input: GetLatestPromptVersionInput): Promise<PromptVersion> {
    const agent = await this.agentRepo.findById(input.agentId)
    if (!agent || agent.ownerId !== ctx.userId) {
      throw new ResourceNotFoundError('Resource not found')
    }
    const latest = await this.promptVersionRepo.findLatestByAgent(input.agentId)
    if (!latest) {
      throw new ResourceNotFoundError('Resource not found')
    }
    return latest
  }
}
