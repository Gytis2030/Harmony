import { and, eq } from 'drizzle-orm'
import { db } from '../index'
import { users, workspaceInvites, workspaceMembers } from '../schema'

export async function getWorkspaceMembers(workspaceId: string) {
  return db
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      displayName: users.displayName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      joinedAt: workspaceMembers.joinedAt,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
}

export async function getWorkspacePendingInvites(workspaceId: string) {
  return db
    .select({
      id: workspaceInvites.id,
      workspaceId: workspaceInvites.workspaceId,
      email: workspaceInvites.email,
      role: workspaceInvites.role,
      token: workspaceInvites.token,
      status: workspaceInvites.status,
      expiresAt: workspaceInvites.expiresAt,
      createdAt: workspaceInvites.createdAt,
    })
    .from(workspaceInvites)
    .where(
      and(eq(workspaceInvites.workspaceId, workspaceId), eq(workspaceInvites.status, 'pending'))
    )
}

export async function getWorkspaceInviteByToken(token: string) {
  const rows = await db
    .select({
      id: workspaceInvites.id,
      workspaceId: workspaceInvites.workspaceId,
      invitedBy: workspaceInvites.invitedBy,
      email: workspaceInvites.email,
      role: workspaceInvites.role,
      token: workspaceInvites.token,
      status: workspaceInvites.status,
      expiresAt: workspaceInvites.expiresAt,
      acceptedBy: workspaceInvites.acceptedBy,
      acceptedAt: workspaceInvites.acceptedAt,
      createdAt: workspaceInvites.createdAt,
      inviterName: users.displayName,
      inviterEmail: users.email,
    })
    .from(workspaceInvites)
    .innerJoin(users, eq(users.id, workspaceInvites.invitedBy))
    .where(eq(workspaceInvites.token, token))
    .limit(1)

  return rows[0] ?? null
}
