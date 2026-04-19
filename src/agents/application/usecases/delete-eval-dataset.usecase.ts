import type { AuthContext } from '../../../auth/domain'
import { InsufficientScopeError } from '../../../auth/domain'
import { ResourceNotFoundError } from '../../../shared/kernel/errors'
import type { AgentId, EvalDatasetId } from '../../domain'
import type { IAgentRepository } from '../ports/agent-repository.port'
import type { IEvalDatasetRepository } from '../ports/eval-dataset-repository.port'

export interface DeleteEvalDatasetInput {
  agentId: AgentId
  datasetId: EvalDatasetId
}

export class DeleteEvalDatasetUseCase {
  constructor(
    private readonly agentRepo: IAgentRepository,
    private readonly evalDatasetRepo: IEvalDatasetRepository,
  ) {}

  async execute(ctx: AuthContext, input: DeleteEvalDatasetInput): Promise<void> {
    if (!ctx.scopes.includes('*')) {
      throw new InsufficientScopeError('This operation requires scope *')
    }
    const agent = await this.agentRepo.findById(input.agentId)
    if (!agent || agent.ownerId !== ctx.userId) {
      throw new ResourceNotFoundError('Resource not found')
    }
    const dataset = await this.evalDatasetRepo.findById(input.datasetId)
    if (!dataset || dataset.agentId !== input.agentId) {
      throw new ResourceNotFoundError('Resource not found')
    }
    await this.evalDatasetRepo.delete(input.datasetId)
  }
}
