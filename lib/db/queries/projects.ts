import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../index'
import { projects, workspaces, workspaceMembers } from '../schema'

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
