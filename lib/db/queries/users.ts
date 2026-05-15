import { eq } from 'drizzle-orm'
import { db } from '../index'
import { users, workspaces, workspaceMembers } from '../schema'

export async function getUserByClerkId(clerkId: string) {
  const result = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1)
  return result[0] ?? null
}

// Called when a valid Clerk session exists but the webhook hasn't fired yet
// (common in dev without a tunnel). Creates user + personal workspace atomically.
export async function provisionUser(params: {
  clerkId: string
  email: string
  displayName: string | null
  avatarUrl: string | null
}) {
  return db.transaction(async (tx) => {
    const existing = await tx.select().from(users).where(eq(users.clerkId, params.clerkId)).limit(1)
    if (existing[0]) return existing[0]

    const [user] = await tx.insert(users).values(params).onConflictDoNothing().returning()

    if (!user) {
      const [found] = await tx
        .select()
        .from(users)
        .where(eq(users.clerkId, params.clerkId))
        .limit(1)
      return found ?? null
    }

    const emailLocal = params.email.split('@')[0] ?? 'user'
    const base =
      (params.displayName ?? emailLocal)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 34) || 'workspace'

    const slugConflict = await tx
      .select()
      .from(workspaces)
      .where(eq(workspaces.slug, base))
      .limit(1)
    const slug =
      slugConflict.length > 0
        ? `${base.slice(0, 33)}-${Math.random().toString(36).slice(2, 8)}`
        : base

    const [workspace] = await tx
      .insert(workspaces)
      .values({ name: 'My Projects', slug, ownerId: user.id })
      .returning()

    await tx
      .insert(workspaceMembers)
      .values({ workspaceId: workspace.id, userId: user.id, role: 'owner' })

    return user
  })
}
