import type { AuthContext } from '../../../auth/domain'
import { ResourceNotFoundError } from '../../../shared/kernel/errors'
import type { AgentId, PromptVersion } from '../../domain'
import type { IAgentRepository } from '../ports/agent-repository.port'
import type { IPromptVersionRepository } from '../ports/prompt-version-repository.port'

export interface GetPromptVersionInput {
  agentId: AgentId
  version: number
}

export class GetPromptVersionUseCase {
  constructor(
    private readonly agentRepo: IAgentRepository,
    private readonly promptVersionRepo: IPromptVersionRepository,
  ) {}

  async execute(ctx: AuthContext, input: GetPromptVersionInput): Promise<PromptVersion> {
    const agent = await this.agentRepo.findById(input.agentId)
    if (!agent || agent.ownerId !== ctx.userId) {
      throw new ResourceNotFoundError('Resource not found')
    }
    const pv = await this.promptVersionRepo.findByAgentAndVersion(input.agentId, input.version)
    if (!pv) {
      throw new ResourceNotFoundError('Resource not found')
    }
    return pv
  }
}
