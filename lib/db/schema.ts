import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core'

// If this is queryable, the full stack (Supabase → pgbouncer → Drizzle → API) works.
export const healthCheck = pgTable('health_check', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
