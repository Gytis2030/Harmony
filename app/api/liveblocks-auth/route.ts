import { auth } from '@clerk/nextjs/server'
import { Liveblocks } from '@liveblocks/node'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { getProjectById } from '@/lib/db/queries/projects'

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY!,
})

const PRESENCE_COLORS = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

function getPresenceColor(userId: string): string {
  const sum = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return PRESENCE_COLORS[sum % PRESENCE_COLORS.length]
}

export async function POST(req: Request) {
  const { userId: clerkId } = auth()
  if (!clerkId) return new Response('Unauthorized', { status: 401 })

  const user = await getUserByClerkId(clerkId)
  if (!user) return new Response('Unauthorized', { status: 401 })

  let parsed: unknown
  try {
    parsed = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const room =
    typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>).room
      : undefined

  if (typeof room !== 'string' || !room.startsWith('project:')) {
    return new Response('Invalid room', { status: 400 })
  }

  const projectId = room.slice('project:'.length)
  const project = await getProjectById(projectId, user.id)
  if (!project) return new Response('Forbidden', { status: 403 })

  const session = liveblocks.prepareSession(user.id, {
    userInfo: {
      name: user.displayName ?? user.email,
      email: user.email,
      color: getPresenceColor(user.id),
    },
  })

  session.allow(room, session.FULL_ACCESS)

  const { status, body } = await session.authorize()
  return new Response(body, { status })
}
