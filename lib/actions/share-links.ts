'use server'

import { createHash, randomBytes } from 'crypto'
import { auth } from '@clerk/nextjs/server'
import { and, eq, isNull } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { getActiveShareLinksForProject, getShareLinkByTokenHash } from '@/lib/db/queries/projects'
import { recordActivity } from '@/lib/db/queries/activity'
import { projects, projectShareGrants, projectShareLinks, workspaceMembers } from '@/lib/db/schema'

export type ShareLinkDto = {
  id: string
  projectId: string
  accessLevel: 'view' | 'comment'
  isActive: boolean
  createdAt: string
}

export type ShareLinkCreatedDto = ShareLinkDto & { rawToken: string }

type ShareLinkAccess = 'view' | 'comment'

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

  if (!member || (member.role !== 'owner' && member.role !== 'editor')) {
    throw new Error('Forbidden')
  }
}

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

export async function createShareLink(params: {
  projectId: string
  accessLevel: ShareLinkAccess
}): Promise<ShareLinkCreatedDto> {
  const user = await requireUser()
  await requireOwnerOrEditor(params.projectId, user.id)

  // Revoke existing active link of the same access level for this project
  await db
    .update(projectShareLinks)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(projectShareLinks.projectId, params.projectId),
        eq(projectShareLinks.accessLevel, params.accessLevel),
        eq(projectShareLinks.isActive, true)
      )
    )

  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = hashToken(rawToken)

  const [link] = await db
    .insert(projectShareLinks)
    .values({
      projectId: params.projectId,
      createdBy: user.id,
      accessLevel: params.accessLevel,
      tokenHash,
    })
    .returning({
      id: projectShareLinks.id,
      projectId: projectShareLinks.projectId,
      accessLevel: projectShareLinks.accessLevel,
      isActive: projectShareLinks.isActive,
      createdAt: projectShareLinks.createdAt,
    })

  await recordActivity({
    projectId: params.projectId,
    actorUserId: user.id,
    type: 'share_link.created',
    targetType: 'share_link',
    targetId: link.id,
    metadata: { accessLevel: params.accessLevel },
  })

  return {
    id: link.id,
    projectId: link.projectId,
    accessLevel: link.accessLevel,
    isActive: link.isActive,
    createdAt: link.createdAt.toISOString(),
    rawToken,
  }
}

export async function revokeShareLink(params: { linkId: string }): Promise<void> {
  const user = await requireUser()

  const [link] = await db
    .select({ projectId: projectShareLinks.projectId })
    .from(projectShareLinks)
    .where(eq(projectShareLinks.id, params.linkId))
    .limit(1)

  if (!link) throw new Error('Share link not found')

  await requireOwnerOrEditor(link.projectId, user.id)

  await db
    .update(projectShareLinks)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(projectShareLinks.id, params.linkId))
}

export async function getProjectShareLinks(projectId: string): Promise<ShareLinkDto[]> {
  const user = await requireUser()
  await requireOwnerOrEditor(projectId, user.id)

  const links = await getActiveShareLinksForProject(projectId)
  return links.map((l) => ({
    id: l.id,
    projectId,
    accessLevel: l.accessLevel,
    isActive: l.isActive,
    createdAt: l.createdAt.toISOString(),
  }))
}

export async function activateShareLink(token: string): Promise<void> {
  const user = await requireUser()

  const tokenHash = hashToken(token)
  const link = await getShareLinkByTokenHash(tokenHash)

  if (!link) throw new Error('This share link is invalid.')
  if (!link.isActive) throw new Error('This share link has been revoked.')

  const [existingGrant] = await db
    .select({ grantedAt: projectShareGrants.grantedAt })
    .from(projectShareGrants)
    .where(
      and(eq(projectShareGrants.projectId, link.projectId), eq(projectShareGrants.userId, user.id))
    )
    .limit(1)

  await db
    .insert(projectShareGrants)
    .values({
      projectId: link.projectId,
      userId: user.id,
      accessLevel: link.accessLevel,
      shareLinkId: link.id,
    })
    .onConflictDoUpdate({
      target: [projectShareGrants.projectId, projectShareGrants.userId],
      set: {
        accessLevel: link.accessLevel,
        shareLinkId: link.id,
        grantedAt: new Date(),
      },
    })

  // Only record on first access, not on every re-visit via share link.
  if (!existingGrant) {
    await recordActivity({
      projectId: link.projectId,
      actorUserId: user.id,
      type: 'share_link.accessed',
      metadata: { accessLevel: link.accessLevel },
    })
  }

  redirect(`/projects/${link.projectId}`)
}
