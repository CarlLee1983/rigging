import { desc, eq } from 'drizzle-orm'
import type { DrizzleDb } from '../../../shared/infrastructure/db/client'
import type { IEvalDatasetRepository } from '../../application/ports/eval-dataset-repository.port'
import type { AgentId, EvalDataset, EvalDatasetId } from '../../domain'
import { EvalDatasetMapper } from '../mappers/eval-dataset.mapper'
import { evalDataset } from '../schema/eval-dataset.schema'

export class DrizzleEvalDatasetRepository implements IEvalDatasetRepository {
  constructor(private readonly db: DrizzleDb) {}

  async findById(id: EvalDatasetId): Promise<EvalDataset | null> {
    const rows = await this.db.select().from(evalDataset).where(eq(evalDataset.id, id)).limit(1)
    return rows[0] ? EvalDatasetMapper.toDomain(rows[0]) : null
  }

  async listByAgent(agentId: AgentId): Promise<EvalDataset[]> {
    const rows = await this.db
      .select()
      .from(evalDataset)
      .where(eq(evalDataset.agentId, agentId))
      .orderBy(desc(evalDataset.createdAt))
    return rows.map((row) => EvalDatasetMapper.toDomain(row))
  }

  async create(input: EvalDataset): Promise<EvalDataset> {
    const [row] = await this.db
      .insert(evalDataset)
      .values({
        id: input.id,
        agentId: input.agentId,
        name: input.name,
        cases: [...input.cases],
        createdAt: input.createdAt,
      })
      .returning()
    if (!row) throw new Error('Failed to insert eval_dataset (no row returned)')
    return EvalDatasetMapper.toDomain(row)
  }

  async delete(id: EvalDatasetId): Promise<boolean> {
    const result = await this.db
      .delete(evalDataset)
      .where(eq(evalDataset.id, id))
      .returning({ id: evalDataset.id })
    return result.length > 0
  }
}
