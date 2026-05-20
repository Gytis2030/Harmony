import { desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectActivity, users } from '@/lib/db/schema'

export type ActivityType =
  | 'track.uploaded'
  | 'comment.created'
  | 'comment.replied'
  | 'comment.resolved'
  | 'comment.reopened'
  | 'version.created'
  | 'version.restored'
  | 'share_link.created'
  | 'share_link.accessed'
  | 'share_grant.created'
  | 'share_grant.revoked'

export async function recordActivity(params: {
  projectId: string
  actorUserId?: string | null
  type: ActivityType
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown> | null
}): Promise<void> {
  await db.insert(projectActivity).values({
    projectId: params.projectId,
    actorUserId: params.actorUserId ?? null,
    type: params.type,
    targetType: params.targetType ?? null,
    targetId: params.targetId ?? null,
    metadata: params.metadata ?? null,
  })
}

export type ActivityRow = {
  id: string
  projectId: string
  actorUserId: string | null
  actorName: string | null
  actorEmail: string | null
  type: string
  targetType: string | null
  targetId: string | null
  metadata: unknown
  createdAt: Date
}

export type ActivityDto = {
  id: string
  projectId: string
  actorUserId: string | null
  actorName: string | null
  type: string
  targetType: string | null
  targetId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export function toActivityDto(r: ActivityRow): ActivityDto {
  return {
    id: r.id,
    projectId: r.projectId,
    actorUserId: r.actorUserId,
    actorName: r.actorName ?? r.actorEmail ?? null,
    type: r.type,
    targetType: r.targetType,
    targetId: r.targetId,
    metadata: r.metadata as Record<string, unknown> | null,
    createdAt: r.createdAt.toISOString(),
  }
}

export async function getRecentActivity(projectId: string, limit = 50): Promise<ActivityRow[]> {
  return db
    .select({
      id: projectActivity.id,
      projectId: projectActivity.projectId,
      actorUserId: projectActivity.actorUserId,
      actorName: users.displayName,
      actorEmail: users.email,
      type: projectActivity.type,
      targetType: projectActivity.targetType,
      targetId: projectActivity.targetId,
      metadata: projectActivity.metadata,
      createdAt: projectActivity.createdAt,
    })
    .from(projectActivity)
    .leftJoin(users, eq(users.id, projectActivity.actorUserId))
    .where(eq(projectActivity.projectId, projectId))
    .orderBy(desc(projectActivity.createdAt))
    .limit(limit)
}

export async function getDashboardActivity(
  projectIds: string[],
  limit = 10
): Promise<ActivityRow[]> {
  if (projectIds.length === 0) return []
  return db
    .select({
      id: projectActivity.id,
      projectId: projectActivity.projectId,
      actorUserId: projectActivity.actorUserId,
      actorName: users.displayName,
      actorEmail: users.email,
      type: projectActivity.type,
      targetType: projectActivity.targetType,
      targetId: projectActivity.targetId,
      metadata: projectActivity.metadata,
      createdAt: projectActivity.createdAt,
    })
    .from(projectActivity)
    .leftJoin(users, eq(users.id, projectActivity.actorUserId))
    .where(inArray(projectActivity.projectId, projectIds))
    .orderBy(desc(projectActivity.createdAt))
    .limit(limit)
}
