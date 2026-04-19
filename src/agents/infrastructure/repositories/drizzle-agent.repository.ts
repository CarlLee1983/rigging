import { desc, eq } from 'drizzle-orm'
import type { UserId } from '../../../auth/domain'
import type { DrizzleDb } from '../../../shared/infrastructure/db/client'
import type { IAgentRepository } from '../../application/ports/agent-repository.port'
import type { Agent, AgentId } from '../../domain'
import { AgentMapper } from '../mappers/agent.mapper'
import { agent } from '../schema/agent.schema'

export class DrizzleAgentRepository implements IAgentRepository {
  constructor(private readonly db: DrizzleDb) {}

  async findById(id: AgentId): Promise<Agent | null> {
    const rows = await this.db.select().from(agent).where(eq(agent.id, id)).limit(1)
    return rows[0] ? AgentMapper.toDomain(rows[0]) : null
  }

  async listByOwner(ownerId: UserId): Promise<Agent[]> {
    const rows = await this.db
      .select()
      .from(agent)
      .where(eq(agent.ownerId, ownerId))
      .orderBy(desc(agent.createdAt))
    return rows.map((row) => AgentMapper.toDomain(row))
  }

  async create(input: Agent): Promise<Agent> {
    const [row] = await this.db
      .insert(agent)
      .values({
        id: input.id,
        ownerId: input.ownerId,
        name: input.name,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
      })
      .returning()
    if (!row) throw new Error('Failed to insert agent (no row returned)')
    return AgentMapper.toDomain(row)
  }

  async update(input: Agent): Promise<Agent> {
    const [row] = await this.db
      .update(agent)
      .set({ name: input.name, updatedAt: input.updatedAt })
      .where(eq(agent.id, input.id))
      .returning()
    if (!row) throw new Error('Failed to update agent (no row returned)')
    return AgentMapper.toDomain(row)
  }

  async delete(id: AgentId): Promise<boolean> {
    const result = await this.db.delete(agent).where(eq(agent.id, id)).returning({ id: agent.id })
    return result.length > 0
  }
}
