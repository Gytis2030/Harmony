import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set.')
}

const isPgBouncer = process.env.DATABASE_URL.includes('pgbouncer=true')
// In production each Vercel function invocation is its own process, so max:1 is correct
// (avoids exhausting pgbouncer's pool across many concurrent invocations).
// In development there is one long-lived process handling all requests; a higher limit
// prevents connection starvation during batch uploads.
const max = process.env.NODE_ENV === 'development' ? 10 : 1
const client = postgres(process.env.DATABASE_URL, {
  max,
  idle_timeout: 20,
  max_lifetime: 1800,
  prepare: !isPgBouncer,
})

export const db = drizzle(client, { schema })
