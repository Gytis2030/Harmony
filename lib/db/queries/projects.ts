import { and, count, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '../index'
import {
  projects,
  tracks,
  users,
  workspaces,
  workspaceMembers,
  projectShareGrants,
  projectShareLinks,
} from '../schema'

const ownerUser = alias(users, 'owner_user')

export async function getProjectById(projectId: string, userId: string) {
  const result = await db
    .select({
      id: projects.id,
      name: projects.name,
      workspaceId: projects.workspaceId,
      bpm: projects.bpm,
      timeSignatureNumerator: projects.timeSignatureNumerator,
      timeSignatureDenominator: projects.timeSignatureDenominator,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(
        eq(projects.id, projectId),
        eq(workspaceMembers.userId, userId),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)
  return result[0] ?? null
}

export async function getProjectByIdWithShareGrant(projectId: string, userId: string) {
  // Workspace member path
  const workspaceResult = await getProjectById(projectId, userId)
  if (workspaceResult) return workspaceResult

  // Share grant path
  const [grantRow] = await db
    .select({
      id: projects.id,
      name: projects.name,
      workspaceId: projects.workspaceId,
      bpm: projects.bpm,
      timeSignatureNumerator: projects.timeSignatureNumerator,
      timeSignatureDenominator: projects.timeSignatureDenominator,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .innerJoin(projectShareGrants, eq(projectShareGrants.projectId, projects.id))
    .where(
      and(
        eq(projects.id, projectId),
        eq(projectShareGrants.userId, userId),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)

  return grantRow ?? null
}

export async function getShareGrantForUser(
  projectId: string,
  userId: string
): Promise<{ accessLevel: 'view' | 'comment' } | null> {
  const [row] = await db
    .select({ accessLevel: projectShareGrants.accessLevel })
    .from(projectShareGrants)
    .where(and(eq(projectShareGrants.projectId, projectId), eq(projectShareGrants.userId, userId)))
    .limit(1)

  return row ?? null
}

export async function getActiveShareLinksForProject(
  projectId: string
): Promise<{ id: string; accessLevel: 'view' | 'comment'; isActive: boolean; createdAt: Date }[]> {
  return db
    .select({
      id: projectShareLinks.id,
      accessLevel: projectShareLinks.accessLevel,
      isActive: projectShareLinks.isActive,
      createdAt: projectShareLinks.createdAt,
    })
    .from(projectShareLinks)
    .where(and(eq(projectShareLinks.projectId, projectId), eq(projectShareLinks.isActive, true)))
}

export async function getShareLinkByTokenHash(tokenHash: string) {
  const [row] = await db
    .select({
      id: projectShareLinks.id,
      projectId: projectShareLinks.projectId,
      accessLevel: projectShareLinks.accessLevel,
      isActive: projectShareLinks.isActive,
      createdAt: projectShareLinks.createdAt,
    })
    .from(projectShareLinks)
    .where(eq(projectShareLinks.tokenHash, tokenHash))
    .limit(1)

  return row ?? null
}

export async function getProjectsForUser(userId: string) {
  // Query 1: projects accessible via workspace membership
  const wsRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      workspaceId: projects.workspaceId,
      bpm: projects.bpm,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      ownerId: workspaces.ownerId,
      role: workspaceMembers.role,
      ownerDisplayName: ownerUser.displayName,
      ownerEmail: ownerUser.email,
    })
    .from(projects)
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .innerJoin(ownerUser, eq(ownerUser.id, workspaces.ownerId))
    .where(and(eq(workspaceMembers.userId, userId), isNull(projects.deletedAt)))

  // Query 2: projects accessible via direct share grant (project-specific only)
  const grantRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      workspaceId: projects.workspaceId,
      bpm: projects.bpm,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      ownerId: workspaces.ownerId,
      accessLevel: projectShareGrants.accessLevel,
      ownerDisplayName: ownerUser.displayName,
      ownerEmail: ownerUser.email,
    })
    .from(projectShareGrants)
    .innerJoin(projects, eq(projects.id, projectShareGrants.projectId))
    .innerJoin(workspaces, eq(workspaces.id, projects.workspaceId))
    .innerJoin(ownerUser, eq(ownerUser.id, workspaces.ownerId))
    .where(and(eq(projectShareGrants.userId, userId), isNull(projects.deletedAt)))

  // Deduplicate: workspace membership takes priority over share grants
  const wsProjectIds = new Set(wsRows.map((r) => r.id))

  const normalized: Array<{
    id: string
    name: string
    workspaceId: string
    bpm: number | null
    createdAt: Date
    updatedAt: Date
    isOwned: boolean
    role: string
    ownerName: string | null
  }> = [
    ...wsRows.map((r) => ({
      id: r.id,
      name: r.name,
      workspaceId: r.workspaceId,
      bpm: r.bpm,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      isOwned: r.ownerId === userId,
      role: r.role as string,
      ownerName: r.ownerDisplayName ?? r.ownerEmail ?? null,
    })),
    ...grantRows
      .filter((r) => !wsProjectIds.has(r.id))
      .map((r) => ({
        id: r.id,
        name: r.name,
        workspaceId: r.workspaceId,
        bpm: r.bpm,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        isOwned: false,
        role: r.accessLevel === 'comment' ? 'commenter' : 'viewer',
        ownerName: r.ownerDisplayName ?? r.ownerEmail ?? null,
      })),
  ]

  if (normalized.length === 0) return []

  const projectIds = normalized.map((r) => r.id)

  const stemCounts = await db
    .select({ projectId: tracks.projectId, stemCount: count(tracks.id) })
    .from(tracks)
    .innerJoin(projects, eq(projects.id, tracks.projectId))
    .where(isNull(projects.deletedAt))
    .groupBy(tracks.projectId)

  const countMap = new Map(
    stemCounts
      .filter((c) => projectIds.includes(c.projectId))
      .map((c) => [c.projectId, c.stemCount])
  )

  return normalized.map((row) => ({
    ...row,
    stemCount: countMap.get(row.id) ?? 0,
  }))
}

export async function getProjectShareGrantUsers(projectId: string) {
  return db
    .select({
      userId: projectShareGrants.userId,
      displayName: users.displayName,
      email: users.email,
      accessLevel: projectShareGrants.accessLevel,
      shareLinkId: projectShareGrants.shareLinkId,
      grantedAt: projectShareGrants.grantedAt,
    })
    .from(projectShareGrants)
    .innerJoin(users, eq(users.id, projectShareGrants.userId))
    .where(eq(projectShareGrants.projectId, projectId))
}

// Returns the subset of userIds that have a link-reviewer grant (shareLinkId IS NOT NULL) for the project.
export async function getLinkReviewerIds(projectId: string, userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return []
  const rows = await db
    .select({ userId: projectShareGrants.userId })
    .from(projectShareGrants)
    .where(
      and(
        eq(projectShareGrants.projectId, projectId),
        inArray(projectShareGrants.userId, userIds),
        isNotNull(projectShareGrants.shareLinkId)
      )
    )
  return rows.map((r) => r.userId)
}
