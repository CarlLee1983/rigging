import type { AuthContext } from '../../../auth/domain'
import { InsufficientScopeError } from '../../../auth/domain'
import type { IClock } from '../../../shared/application/ports/clock.port'
import { ResourceNotFoundError } from '../../../shared/kernel/errors'
import { type AgentId, type EvalCase, type EvalDataset, newEvalDatasetId } from '../../domain'
import type { IAgentRepository } from '../ports/agent-repository.port'
import type { IEvalDatasetRepository } from '../ports/eval-dataset-repository.port'

export interface CreateEvalDatasetInput {
  agentId: AgentId
  name: string
  cases: ReadonlyArray<EvalCase>
}

export class CreateEvalDatasetUseCase {
  constructor(
    private readonly agentRepo: IAgentRepository,
    private readonly evalDatasetRepo: IEvalDatasetRepository,
    private readonly clock: IClock,
  ) {}

  async execute(ctx: AuthContext, input: CreateEvalDatasetInput): Promise<EvalDataset> {
    if (!ctx.scopes.includes('*')) {
      throw new InsufficientScopeError('This operation requires scope *')
    }
    const agent = await this.agentRepo.findById(input.agentId)
    if (!agent || agent.ownerId !== ctx.userId) {
      throw new ResourceNotFoundError('Resource not found')
    }
    const now = this.clock.now()
    const dataset: EvalDataset = {
      id: newEvalDatasetId(),
      agentId: input.agentId,
      name: input.name.trim(),
      cases: [...input.cases],
      createdAt: now,
    }
    return this.evalDatasetRepo.create(dataset)
  }
}
