'use server'

import { auth } from '@clerk/nextjs/server'
import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
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
