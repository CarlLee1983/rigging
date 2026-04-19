import { index, integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { agent } from './agent.schema'

export const promptVersion = pgTable(
  'prompt_version',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').notNull(),
  },
  (table) => [
    unique('prompt_version_agent_id_version_uq').on(table.agentId, table.version),
    index('prompt_version_agent_id_version_idx').on(table.agentId, table.version.desc()),
  ],
)
