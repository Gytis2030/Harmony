'use server'

import { auth } from '@clerk/nextjs/server'
import { and, count, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { audioFiles, projects, tracks, workspaceMembers } from '@/lib/db/schema'

export async function addTrack(params: {
  r2Key: string
  filename: string
  mimeType: string
  sizeBytes: number
  projectId: string
}) {
  const { userId: clerkId } = auth()
  if (!clerkId) throw new Error('Unauthorized')

  const user = await getUserByClerkId(clerkId)
  if (!user) throw new Error('User not found')

  // Verify the user is a member of the project's workspace.
  const [project] = await db
    .select({ workspaceId: projects.workspaceId })
    .from(projects)
    .where(eq(projects.id, params.projectId))
    .limit(1)

  if (!project) throw new Error('Project not found')

  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, project.workspaceId),
        eq(workspaceMembers.userId, user.id)
      )
    )
    .limit(1)

  if (!membership) throw new Error('Forbidden')

  // Determine the next track position.
  const [{ value: trackCount }] = await db
    .select({ value: count() })
    .from(tracks)
    .where(eq(tracks.projectId, params.projectId))

  const position = (trackCount ?? 0) + 1
  const trackName = params.filename.replace(/\.[^.]+$/, '') // strip extension

  await db.transaction(async (tx) => {
    const [track] = await tx
      .insert(tracks)
      .values({
        projectId: params.projectId,
        name: trackName,
        position,
      })
      .returning({ id: tracks.id })

    await tx.insert(audioFiles).values({
      trackId: track.id,
      uploadedBy: user.id,
      r2Key: params.r2Key,
      originalFilename: params.filename,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes,
    })
  })

  revalidatePath(`/projects/${params.projectId}`)
}
