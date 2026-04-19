import type { AgentId, EvalDatasetId } from './values/ids'

export interface EvalCase {
  readonly input: string
  readonly expectedOutput: string
}

export interface EvalDataset {
  readonly id: EvalDatasetId
  readonly agentId: AgentId
  readonly name: string
  readonly cases: ReadonlyArray<EvalCase>
  readonly createdAt: Date
}
