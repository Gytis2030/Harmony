import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../index'
import {
  projects,
  workspaces,
  workspaceMembers,
  projectShareGrants,
  projectShareLinks,
} from '../schema'

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
  return db
    .select({
      id: projects.id,
      name: projects.name,
      workspaceId: projects.workspaceId,
      bpm: projects.bpm,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaceMembers.userId, userId), isNull(projects.deletedAt)))
}
