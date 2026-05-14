'use server'

import { auth } from '@clerk/nextjs/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { workspaceMembers } from '@/lib/db/schema'

type Role = 'owner' | 'editor' | 'commenter' | 'viewer'

async function requireUser() {
  const { userId: clerkId } = auth()
  if (!clerkId) throw new Error('Unauthorized')
  const user = await getUserByClerkId(clerkId)
  if (!user) throw new Error('User not found')
  return user
}

async function requireOwner(workspaceId: string, userId: string): Promise<void> {
  const [row] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1)

  if (!row || row.role !== 'owner') {
    throw new Error('Only the workspace owner can manage members.')
  }
}

export async function removeMember(params: {
  workspaceId: string
  targetUserId: string
}): Promise<void> {
  const user = await requireUser()
  await requireOwner(params.workspaceId, user.id)

  if (params.targetUserId === user.id) {
    throw new Error('You cannot remove yourself from the workspace.')
  }

  const [target] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, params.workspaceId),
        eq(workspaceMembers.userId, params.targetUserId)
      )
    )
    .limit(1)

  if (!target) throw new Error('Member not found.')
  if (target.role === 'owner') throw new Error('Cannot remove an owner from the workspace.')

  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, params.workspaceId),
        eq(workspaceMembers.userId, params.targetUserId)
      )
    )
}

export async function updateMemberRole(params: {
  workspaceId: string
  targetUserId: string
  role: Role
}): Promise<void> {
  const user = await requireUser()
  await requireOwner(params.workspaceId, user.id)

  if (params.targetUserId === user.id) {
    throw new Error('You cannot change your own role.')
  }

  if (params.role === 'owner') {
    throw new Error('Cannot promote a member to owner.')
  }

  const [target] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, params.workspaceId),
        eq(workspaceMembers.userId, params.targetUserId)
      )
    )
    .limit(1)

  if (!target) throw new Error('Member not found.')
  if (target.role === 'owner') throw new Error('Cannot change the role of an owner.')

  await db
    .update(workspaceMembers)
    .set({ role: params.role })
    .where(
      and(
        eq(workspaceMembers.workspaceId, params.workspaceId),
        eq(workspaceMembers.userId, params.targetUserId)
      )
    )
}
