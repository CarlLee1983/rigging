import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { user } from '../../../auth/infrastructure/schema/user.schema'

export const agent = pgTable('agent', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})
