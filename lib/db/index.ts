import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set.')
}

// max:1 — one connection per serverless invocation; idle_timeout/max_lifetime prevent stale PgBouncer connections
const isPgBouncer = process.env.DATABASE_URL.includes('pgbouncer=true')
const client = postgres(process.env.DATABASE_URL, {
  max: 1,
  idle_timeout: 20,
  max_lifetime: 1800,
  prepare: !isPgBouncer,
})

export const db = drizzle(client, { schema })
