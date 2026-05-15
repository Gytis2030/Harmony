'use server'

import { auth } from '@clerk/nextjs/server'
import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { projects, workspaces, workspaceMembers } from '@/lib/db/schema'

export async function createProject(formData: FormData) {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/sign-in')

  const name = (formData.get('name') as string | null)?.trim()
  if (!name) throw new Error('Project name is required.')

  const user = await getUserByClerkId(clerkId)
  if (!user) throw new Error('User record not found.')

  // Find the user's personal workspace (the one they own).
  const [membership] = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(eq(workspaceMembers.userId, user.id), eq(workspaces.ownerId, user.id)))
    .limit(1)

  if (!membership) throw new Error('No workspace found for this user.')

  const [project] = await db
    .insert(projects)
    .values({
      workspaceId: membership.workspaceId,
      name,
      bpm: null,
      createdBy: user.id,
    })
    .returning({ id: projects.id })

  redirect(`/projects/${project.id}`)
}

export async function archiveProject(projectId: string) {
  const { userId: clerkId } = auth()
  if (!clerkId) throw new Error('Unauthorized')

  const user = await getUserByClerkId(clerkId)
  if (!user) throw new Error('User not found')

  const [row] = await db
    .select({ workspaceId: projects.workspaceId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!row) throw new Error('Project not found')

  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(eq(workspaceMembers.workspaceId, row.workspaceId), eq(workspaceMembers.userId, user.id))
    )
    .limit(1)

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Forbidden')
  }

  await db
    .update(projects)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(projects.id, projectId))

  revalidatePath('/dashboard')
}

export async function updateProjectTempo(params: {
  projectId: string
  bpm: number | null
  timeSignatureNumerator: number
  timeSignatureDenominator: number
}) {
  const { userId: clerkId } = auth()
  if (!clerkId) throw new Error('Unauthorized')

  const user = await getUserByClerkId(clerkId)
  if (!user) throw new Error('User not found')

  const [row] = await db
    .select({ workspaceId: projects.workspaceId })
    .from(projects)
    .where(eq(projects.id, params.projectId))
    .limit(1)

  if (!row) throw new Error('Project not found')

  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(eq(workspaceMembers.workspaceId, row.workspaceId), eq(workspaceMembers.userId, user.id))
    )
    .limit(1)

  if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
    throw new Error('Forbidden')
  }

  const bpm = params.bpm !== null ? Math.max(20, Math.min(300, Math.round(params.bpm))) : null

  await db
    .update(projects)
    .set({
      bpm,
      timeSignatureNumerator: Math.max(1, Math.min(16, params.timeSignatureNumerator)),
      timeSignatureDenominator: Math.max(1, Math.min(16, params.timeSignatureDenominator)),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, params.projectId))

  revalidatePath(`/projects/${params.projectId}`)
}
