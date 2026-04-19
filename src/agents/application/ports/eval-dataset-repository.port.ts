import type { AgentId, EvalDataset, EvalDatasetId } from '../../domain'

export interface IEvalDatasetRepository {
  findById(id: EvalDatasetId): Promise<EvalDataset | null>
  listByAgent(agentId: AgentId): Promise<EvalDataset[]>
  create(dataset: EvalDataset): Promise<EvalDataset>
  delete(id: EvalDatasetId): Promise<boolean>
}
