import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { agent } from './agent.schema'

export type PersistedEvalCase = { input: string; expectedOutput: string }

export const evalDataset = pgTable('eval_dataset', {
  id: text('id').primaryKey(),
  agentId: text('agent_id')
    .notNull()
    .references(() => agent.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  cases: jsonb('cases').notNull().$type<PersistedEvalCase[]>(),
  createdAt: timestamp('created_at').notNull(),
})
