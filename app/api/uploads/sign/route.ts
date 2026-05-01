import { auth } from '@clerk/nextjs/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects, workspaceMembers } from '@/lib/db/schema'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { createPresignedPutUrl } from '@/lib/storage/r2'

const ALLOWED_MIME_TYPES = new Set([
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mpeg3',
  'audio/x-mpeg-3',
])

const MAX_SIZE_BYTES = 100 * 1024 * 1024

export async function POST(req: Request) {
  const { userId: clerkId } = auth()
  if (!clerkId) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).filename !== 'string' ||
    typeof (body as Record<string, unknown>).contentType !== 'string' ||
    typeof (body as Record<string, unknown>).sizeBytes !== 'number' ||
    typeof (body as Record<string, unknown>).projectId !== 'string'
  ) {
    return new Response('Missing or invalid fields: filename, contentType, sizeBytes, projectId', {
      status: 400,
    })
  }

  const { filename, contentType, sizeBytes, projectId } = body as {
    filename: string
    contentType: string
    sizeBytes: number
    projectId: string
  }

  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    return new Response(`Unsupported content type: ${contentType}`, { status: 400 })
  }

  if (sizeBytes > MAX_SIZE_BYTES) {
    return new Response('File exceeds 100 MB limit', { status: 400 })
  }

  // Verify the user is a workspace member of this project's workspace.
  const user = await getUserByClerkId(clerkId)
  if (!user) {
    return new Response('User not found', { status: 403 })
  }

  const [project] = await db
    .select({ workspaceId: projects.workspaceId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project) {
    return new Response('Project not found', { status: 403 })
  }

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

  if (!membership) {
    return new Response('Forbidden', { status: 403 })
  }

  // Build a safe key: strip any path traversal chars from the filename.
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const r2Key = `audio/${projectId}/${crypto.randomUUID()}-${safeFilename}`

  const url = await createPresignedPutUrl({ key: r2Key, contentType, sizeBytes })

  return Response.json({ url, r2Key })
}
