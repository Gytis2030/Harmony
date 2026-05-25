'use server'

import { randomBytes } from 'crypto'
import { auth } from '@clerk/nextjs/server'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getUserByClerkId, getUserByEmail } from '@/lib/db/queries/users'
import { recordActivity } from '@/lib/db/queries/activity'
import { projects, projectShareGrants, workspaceInvites, workspaceMembers } from '@/lib/db/schema'

export type ShareGrantDto = {
  userId: string
  displayName: string | null
  email: string
  accessLevel: 'view' | 'comment' | 'edit'
  grantedAt: string
  isLinkReviewer: boolean
  alias: string | null
}

export type ShareResult =
  | { type: 'direct_grant'; grant: ShareGrantDto }
  | { type: 'invite_link'; token: string }

async function requireUser() {
  const { userId: clerkId } = auth()
  if (!clerkId) throw new Error('Unauthorized')
  const user = await getUserByClerkId(clerkId)
  if (!user) throw new Error('User not found')
  return user
}

async function requireOwnerOrEditor(projectId: string, userId: string) {
  const [member] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(projects, eq(projects.workspaceId, workspaceMembers.workspaceId))
    .where(
      and(
        eq(projects.id, projectId),
        eq(workspaceMembers.userId, userId),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)

  if (member?.role === 'owner' || member?.role === 'editor') return

  const [grant] = await db
    .select({ accessLevel: projectShareGrants.accessLevel })
    .from(projectShareGrants)
    .where(and(eq(projectShareGrants.projectId, projectId), eq(projectShareGrants.userId, userId)))
    .limit(1)

  if (grant?.accessLevel !== 'edit') throw new Error('Forbidden')
}

export async function shareProjectWithUser(params: {
  projectId: string
  email: string
  role: 'viewer' | 'commenter' | 'editor'
}): Promise<ShareResult> {
  const caller = await requireUser()
  await requireOwnerOrEditor(params.projectId, caller.id)

  const email = params.email.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid email address is required.')
  }

  if (email === caller.email.toLowerCase()) {
    throw new Error('You cannot share a project with yourself.')
  }

  const accessLevel =
    params.role === 'editor' ? 'edit' : params.role === 'commenter' ? 'comment' : ('view' as const)

  const recipient = await getUserByEmail(email)

  if (recipient) {
    // Direct grant path — recipient already has a Harmony account.
    const now = new Date()
    await db
      .insert(projectShareGrants)
      .values({
        projectId: params.projectId,
        userId: recipient.id,
        accessLevel,
      })
      .onConflictDoUpdate({
        target: [projectShareGrants.projectId, projectShareGrants.userId],
        set: { accessLevel, grantedAt: now },
      })

    await recordActivity({
      projectId: params.projectId,
      actorUserId: caller.id,
      type: 'share_grant.created',
      targetType: 'user',
      targetId: recipient.id,
      metadata: { email, accessLevel },
    })

    return {
      type: 'direct_grant',
      grant: {
        userId: recipient.id,
        displayName: recipient.displayName ?? null,
        email: recipient.email,
        accessLevel,
        grantedAt: now.toISOString(),
        isLinkReviewer: false,
        alias: null,
      },
    }
  }

  // Fallback path — no Harmony account yet; create a project-scoped invite link.
  const [project] = await db
    .select({ workspaceId: projects.workspaceId })
    .from(projects)
    .where(and(eq(projects.id, params.projectId), isNull(projects.deletedAt)))
    .limit(1)

  if (!project) throw new Error('Project not found')

  // Revoke any existing pending invite for this email + project.
  await db
    .update(workspaceInvites)
    .set({ status: 'revoked' })
    .where(
      and(
        eq(workspaceInvites.workspaceId, project.workspaceId),
        eq(workspaceInvites.email, email),
        eq(workspaceInvites.status, 'pending')
      )
    )

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await db.insert(workspaceInvites).values({
    workspaceId: project.workspaceId,
    invitedBy: caller.id,
    email,
    role:
      params.role === 'commenter' ? 'commenter' : params.role === 'editor' ? 'editor' : 'viewer',
    projectId: params.projectId,
    token,
    expiresAt,
  })

  return { type: 'invite_link', token }
}

export async function revokeShareGrant(params: {
  projectId: string
  userId: string
}): Promise<void> {
  const caller = await requireUser()
  await requireOwnerOrEditor(params.projectId, caller.id)

  await db
    .delete(projectShareGrants)
    .where(
      and(
        eq(projectShareGrants.projectId, params.projectId),
        eq(projectShareGrants.userId, params.userId)
      )
    )

  await recordActivity({
    projectId: params.projectId,
    actorUserId: caller.id,
    type: 'share_grant.revoked',
    targetType: 'user',
    targetId: params.userId,
  })
}
