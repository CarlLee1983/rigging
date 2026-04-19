import { and, desc, eq } from 'drizzle-orm'
import type { DrizzleDb } from '../../../shared/infrastructure/db/client'
import type {
  CreatePromptVersionCommand,
  IPromptVersionRepository,
} from '../../application/ports/prompt-version-repository.port'
import type { AgentId, PromptVersion } from '../../domain'
import { PromptVersionMapper } from '../mappers/prompt-version.mapper'
import { promptVersion } from '../schema/prompt-version.schema'

export class DrizzlePromptVersionRepository implements IPromptVersionRepository {
  constructor(private readonly db: DrizzleDb) {}

  async findLatestByAgent(agentId: AgentId): Promise<PromptVersion | null> {
    const rows = await this.db
      .select()
      .from(promptVersion)
      .where(eq(promptVersion.agentId, agentId))
      .orderBy(desc(promptVersion.version))
      .limit(1)
    return rows[0] ? PromptVersionMapper.toDomain(rows[0]) : null
  }

  async findByAgentAndVersion(agentId: AgentId, version: number): Promise<PromptVersion | null> {
    const rows = await this.db
      .select()
      .from(promptVersion)
      .where(and(eq(promptVersion.agentId, agentId), eq(promptVersion.version, version)))
      .limit(1)
    return rows[0] ? PromptVersionMapper.toDomain(rows[0]) : null
  }

  async listByAgent(agentId: AgentId): Promise<PromptVersion[]> {
    const rows = await this.db
      .select()
      .from(promptVersion)
      .where(eq(promptVersion.agentId, agentId))
      .orderBy(desc(promptVersion.version))
    return rows.map((row) => PromptVersionMapper.toDomain(row))
  }

  async createAtomic(cmd: CreatePromptVersionCommand): Promise<PromptVersion | null> {
    const inserted = await this.db
      .insert(promptVersion)
      .values({
        id: cmd.id,
        agentId: cmd.agentId,
        version: cmd.version,
        content: cmd.content,
        createdAt: cmd.createdAt,
      })
      .onConflictDoNothing({ target: [promptVersion.agentId, promptVersion.version] })
      .returning()
    return inserted[0] ? PromptVersionMapper.toDomain(inserted[0]) : null
  }
}
