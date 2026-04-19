import type { AuthContext } from '../../../auth/domain'
import { InsufficientScopeError } from '../../../auth/domain'
import type { IClock } from '../../../shared/application/ports/clock.port'
import { ResourceNotFoundError } from '../../../shared/kernel/errors'
import {
  type AgentId,
  newPromptVersionId,
  type PromptVersion,
  PromptVersionConflictError,
} from '../../domain'
import type { IAgentRepository } from '../ports/agent-repository.port'
import type { IPromptVersionRepository } from '../ports/prompt-version-repository.port'

export interface CreatePromptVersionInput {
  agentId: AgentId
  content: string
}

const MAX_RETRY = 3

export class CreatePromptVersionUseCase {
  constructor(
    private readonly agentRepo: IAgentRepository,
    private readonly promptVersionRepo: IPromptVersionRepository,
    private readonly clock: IClock,
  ) {}

  async execute(ctx: AuthContext, input: CreatePromptVersionInput): Promise<PromptVersion> {
    if (!ctx.scopes.includes('*')) {
      throw new InsufficientScopeError('This operation requires scope *')
    }
    const agent = await this.agentRepo.findById(input.agentId)
    if (!agent || agent.ownerId !== ctx.userId) {
      throw new ResourceNotFoundError('Resource not found')
    }

    for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
      const latest = await this.promptVersionRepo.findLatestByAgent(input.agentId)
      const nextVersion = (latest?.version ?? 0) + 1
      const created = await this.promptVersionRepo.createAtomic({
        id: newPromptVersionId(),
        agentId: input.agentId,
        version: nextVersion,
        content: input.content,
        createdAt: this.clock.now(),
      })
      if (created) return created
    }

    throw new PromptVersionConflictError(
      `Concurrent writes prevented version assignment for agent ${input.agentId} after ${MAX_RETRY} attempts`,
    )
  }
}
