import type { AuthContext } from '../../../auth/domain'
import { ResourceNotFoundError } from '../../../shared/kernel/errors'
import type { AgentId, EvalDataset, EvalDatasetId } from '../../domain'
import type { IAgentRepository } from '../ports/agent-repository.port'
import type { IEvalDatasetRepository } from '../ports/eval-dataset-repository.port'

export interface GetEvalDatasetInput {
  agentId: AgentId
  datasetId: EvalDatasetId
}

export class GetEvalDatasetUseCase {
  constructor(
    private readonly agentRepo: IAgentRepository,
    private readonly evalDatasetRepo: IEvalDatasetRepository,
  ) {}

  async execute(ctx: AuthContext, input: GetEvalDatasetInput): Promise<EvalDataset> {
    const agent = await this.agentRepo.findById(input.agentId)
    if (!agent || agent.ownerId !== ctx.userId) {
      throw new ResourceNotFoundError('Resource not found')
    }
    const dataset = await this.evalDatasetRepo.findById(input.datasetId)
    if (!dataset || dataset.agentId !== input.agentId) {
      throw new ResourceNotFoundError('Resource not found')
    }
    return dataset
  }
}
