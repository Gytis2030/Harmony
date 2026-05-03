import { auth } from '@clerk/nextjs/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { audioFiles, projects, tracks, workspaceMembers } from '@/lib/db/schema'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { createPresignedGetUrl } from '@/lib/storage/r2'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { userId: clerkId } = auth()
  if (!clerkId) return new Response('Unauthorized', { status: 401 })

  const user = await getUserByClerkId(clerkId)
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Join track → project → workspace to get r2Key and verify membership in one pass
  const [row] = await db
    .select({
      r2Key: audioFiles.r2Key,
      workspaceId: projects.workspaceId,
    })
    .from(tracks)
    .innerJoin(audioFiles, eq(audioFiles.trackId, tracks.id))
    .innerJoin(projects, eq(projects.id, tracks.projectId))
    .where(eq(tracks.id, params.id))
    .limit(1)

  if (!row) return new Response('Not found', { status: 404 })

  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(eq(workspaceMembers.workspaceId, row.workspaceId), eq(workspaceMembers.userId, user.id))
    )
    .limit(1)

  if (!membership) return new Response('Forbidden', { status: 403 })

  const url = await createPresignedGetUrl({ key: row.r2Key })
  return Response.json({ url })
}
