'use server'

import { randomBytes } from 'crypto'
import { auth } from '@clerk/nextjs/server'
import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { getWorkspaceInviteByToken, getWorkspacePendingInvites } from '@/lib/db/queries/workspaces'
import { projectShareGrants, workspaceInvites, workspaceMembers } from '@/lib/db/schema'

export type InviteDto = {
  id: string
  workspaceId: string
  email: string
  role: 'owner' | 'editor' | 'commenter' | 'viewer'
  token: string
  expiresAt: string
  createdAt: string
}

type WorkspaceMemberRole = 'owner' | 'editor' | 'commenter' | 'viewer'

const INVITE_TTL_DAYS = 7

async function requireUser() {
  const { userId: clerkId } = auth()
  if (!clerkId) throw new Error('Unauthorized')
  const user = await getUserByClerkId(clerkId)
  if (!user) throw new Error('User not found')
  return user
}

async function requireWorkspaceMembership(
  workspaceId: string,
  userId: string
): Promise<WorkspaceMemberRole> {
  const [row] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1)

  if (!row) throw new Error('Forbidden')
  return row.role as WorkspaceMemberRole
}

function canInviteRole(callerRole: WorkspaceMemberRole, targetRole: WorkspaceMemberRole): boolean {
  if (callerRole === 'owner') {
    return targetRole !== 'owner'
  }
  if (callerRole === 'editor') {
    return targetRole === 'commenter' || targetRole === 'viewer'
  }
  return false
}

function toDto(row: {
  id: string
  workspaceId: string
  email: string
  role: WorkspaceMemberRole
  token: string
  expiresAt: Date
  createdAt: Date
}): InviteDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    email: row.email,
    role: row.role,
    token: row.token,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}

export async function createInvite(params: {
  workspaceId: string
  email: string
  role: WorkspaceMemberRole
  projectId?: string
}): Promise<InviteDto> {
  const user = await requireUser()
  const callerRole = await requireWorkspaceMembership(params.workspaceId, user.id)

  const email = params.email.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid email address is required.')
  }

  if (!canInviteRole(callerRole, params.role)) {
    throw new Error('You do not have permission to invite with that role.')
  }

  // Revoke any existing pending invite for the same email+workspace before creating a new one.
  await db
    .update(workspaceInvites)
    .set({ status: 'revoked' })
    .where(
      and(
        eq(workspaceInvites.workspaceId, params.workspaceId),
        eq(workspaceInvites.email, email),
        eq(workspaceInvites.status, 'pending')
      )
    )

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)

  const [invite] = await db
    .insert(workspaceInvites)
    .values({
      workspaceId: params.workspaceId,
      invitedBy: user.id,
      email,
      role: params.role,
      projectId: params.projectId ?? null,
      token,
      expiresAt,
    })
    .returning({
      id: workspaceInvites.id,
      workspaceId: workspaceInvites.workspaceId,
      email: workspaceInvites.email,
      role: workspaceInvites.role,
      token: workspaceInvites.token,
      expiresAt: workspaceInvites.expiresAt,
      createdAt: workspaceInvites.createdAt,
    })

  return toDto(invite as typeof invite & { role: WorkspaceMemberRole })
}

export async function revokeInvite(params: { inviteId: string }): Promise<void> {
  const user = await requireUser()

  const [invite] = await db
    .select({ workspaceId: workspaceInvites.workspaceId })
    .from(workspaceInvites)
    .where(eq(workspaceInvites.id, params.inviteId))
    .limit(1)

  if (!invite) throw new Error('Invite not found')

  const callerRole = await requireWorkspaceMembership(invite.workspaceId, user.id)
  if (callerRole !== 'owner' && callerRole !== 'editor') {
    throw new Error('Forbidden')
  }

  await db
    .update(workspaceInvites)
    .set({ status: 'revoked' })
    .where(eq(workspaceInvites.id, params.inviteId))
}

export async function listInvites(workspaceId: string): Promise<InviteDto[]> {
  const user = await requireUser()
  await requireWorkspaceMembership(workspaceId, user.id)

  const rows = await getWorkspacePendingInvites(workspaceId)
  return rows.map((r) => toDto({ ...r, role: r.role as WorkspaceMemberRole }))
}

// Called from the accept invite page via a Server Action form.
export async function acceptInvite(token: string, redirectTo?: string): Promise<void> {
  const user = await requireUser()

  const invite = await getWorkspaceInviteByToken(token)
  if (!invite) throw new Error('Invite not found.')
  if (invite.status !== 'pending') throw new Error('This invite has already been used or revoked.')
  if (new Date(invite.expiresAt) < new Date()) throw new Error('This invite has expired.')

  // Idempotent: if already a member, just redirect.
  const [existing] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, invite.workspaceId),
        eq(workspaceMembers.userId, user.id)
      )
    )
    .limit(1)

  if (!existing) {
    const isProjectScoped =
      invite.projectId !== null && (invite.role === 'viewer' || invite.role === 'commenter')

    await db.transaction(async (tx) => {
      if (isProjectScoped) {
        // Project-scoped invite: grant access to ONE project only, not the whole workspace.
        // shareLinkId is nullable (migration 0009) so invite-based grants omit it.
        await tx
          .insert(projectShareGrants)
          .values({
            projectId: invite.projectId!,
            userId: user.id,
            accessLevel: invite.role === 'commenter' ? 'comment' : 'view',
          })
          .onConflictDoUpdate({
            target: [projectShareGrants.projectId, projectShareGrants.userId],
            set: {
              accessLevel: invite.role === 'commenter' ? 'comment' : 'view',
              grantedAt: new Date(),
            },
          })
      } else {
        // Workspace-level invite (owner/editor): full workspace membership.
        await tx.insert(workspaceMembers).values({
          workspaceId: invite.workspaceId,
          userId: user.id,
          role: invite.role,
        })
      }
      await tx
        .update(workspaceInvites)
        .set({ status: 'accepted', acceptedBy: user.id, acceptedAt: new Date() })
        .where(eq(workspaceInvites.id, invite.id))
    })
  }

  redirect(redirectTo ?? '/dashboard')
}
