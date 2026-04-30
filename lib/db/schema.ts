import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core'

// health_check — minimal table used by /api/health to confirm DB connectivity.
// No business logic. If this is queryable, the full stack (Supabase → pgbouncer → Drizzle → API) works.
export const healthCheck = pgTable('health_check', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
