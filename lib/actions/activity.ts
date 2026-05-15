'use server'

import { auth } from '@clerk/nextjs/server'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { getRecentActivity, toActivityDto, type ActivityDto } from '@/lib/db/queries/activity'
import { getShareGrantForUser } from '@/lib/db/queries/projects'
import { projects, workspaceMembers } from '@/lib/db/schema'

export type { ActivityDto }

const SHARE_GRANT_ACTIVITY_TYPES = new Set([
  'track.uploaded',
  'comment.created',
  'comment.replied',
  'comment.resolved',
  'comment.reopened',
  'version.created',
  'version.restored',
])

export async function fetchProjectActivity(projectId: string): Promise<ActivityDto[]> {
  const { userId: clerkId } = auth()
  if (!clerkId) throw new Error('Unauthorized')
  const user = await getUserByClerkId(clerkId)
  if (!user) throw new Error('User not found')

  const [project] = await db
    .select({ workspaceId: projects.workspaceId })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1)
  if (!project) throw new Error('Forbidden')

  const [member] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, project.workspaceId),
        eq(workspaceMembers.userId, user.id)
      )
    )
    .limit(1)

  const rows = await getRecentActivity(projectId)

  if (!member) {
    const grant = await getShareGrantForUser(projectId, user.id)
    if (!grant) throw new Error('Forbidden')
    return rows.filter((r) => SHARE_GRANT_ACTIVITY_TYPES.has(r.type)).map(toActivityDto)
  }

  return rows.map(toActivityDto)
}
