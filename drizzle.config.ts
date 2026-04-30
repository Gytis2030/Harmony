import { config } from 'dotenv'
import type { Config } from 'drizzle-kit'

// Load .env.local before drizzle-kit evaluates this file.
// Next.js loads this automatically at runtime, but drizzle-kit CLI does not.
config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Did you copy .env.local.example to .env.local?')
}

const drizzleConfig: Config = {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
}

export default drizzleConfig
