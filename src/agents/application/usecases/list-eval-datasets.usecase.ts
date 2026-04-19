import type { AuthContext } from '../../../auth/domain'
import { ResourceNotFoundError } from '../../../shared/kernel/errors'
import type { AgentId, EvalDataset } from '../../domain'
import type { IAgentRepository } from '../ports/agent-repository.port'
import type { IEvalDatasetRepository } from '../ports/eval-dataset-repository.port'

export interface ListEvalDatasetsInput {
  agentId: AgentId
}

export class ListEvalDatasetsUseCase {
  constructor(
    private readonly agentRepo: IAgentRepository,
    private readonly evalDatasetRepo: IEvalDatasetRepository,
  ) {}

  async execute(ctx: AuthContext, input: ListEvalDatasetsInput): Promise<EvalDataset[]> {
    const agent = await this.agentRepo.findById(input.agentId)
    if (!agent || agent.ownerId !== ctx.userId) {
      throw new ResourceNotFoundError('Resource not found')
    }
    return this.evalDatasetRepo.listByAgent(input.agentId)
  }
}
