import { eq } from 'drizzle-orm'
import { db } from '../index'
import { users } from '../schema'

export async function getUserByClerkId(clerkId: string) {
  const result = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1)
  return result[0] ?? null
}
