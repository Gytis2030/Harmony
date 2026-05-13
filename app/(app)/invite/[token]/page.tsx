import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { getWorkspaceInviteByToken } from '@/lib/db/queries/workspaces'
import { db } from '@/lib/db'
import { workspaceMembers, workspaces } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { acceptInvite } from '@/lib/actions/invites'

interface Props {
  params: { token: string }
  searchParams: { project?: string }
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  editor: 'Editor',
  commenter: 'Commenter',
  viewer: 'Viewer',
}

export default async function AcceptInvitePage({ params, searchParams }: Props) {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/sign-in')

  const invite = await getWorkspaceInviteByToken(params.token)

  // Invalid token
  if (!invite) {
    return <ErrorCard message="This invite link is invalid or does not exist." />
  }

  // Already used or revoked
  if (invite.status !== 'pending') {
    return (
      <ErrorCard
        message={
          invite.status === 'accepted'
            ? 'This invite has already been accepted.'
            : 'This invite has been revoked.'
        }
        action={<DashboardLink />}
      />
    )
  }

  // Expired
  if (new Date(invite.expiresAt) < new Date()) {
    return (
      <ErrorCard message="This invite link has expired. Ask the workspace owner to send a new one." />
    )
  }

  // Sanitise the ?project= param — only accept a valid UUID-shaped string.
  const projectId =
    typeof searchParams.project === 'string' && /^[\w-]{36}$/.test(searchParams.project)
      ? searchParams.project
      : null
  const destination = projectId ? `/projects/${projectId}` : '/dashboard'

  // Already a member → send them straight to the project (or dashboard).
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

  if (existing) {
    redirect(destination)
  }

  // Fetch workspace name for display
  const [workspace] = await db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, invite.workspaceId))
    .limit(1)

  const workspaceName = workspace?.name ?? 'a workspace'
  const inviterName = invite.inviterName ?? invite.inviterEmail
  const roleName = ROLE_LABELS[invite.role] ?? invite.role

  async function accept() {
    'use server'
    await acceptInvite(params.token, destination)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07070b] px-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0c0c12] p-8">
        {/* Logo / brand */}
        <p className="mb-6 text-center text-sm font-semibold tracking-widest text-violet-400 uppercase">
          Harmony
        </p>

        <h1 className="text-center text-xl font-bold text-white">You&apos;ve been invited</h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          <span className="font-medium text-slate-200">{inviterName}</span> has invited you to join{' '}
          <span className="font-medium text-slate-200">{workspaceName}</span> as a{' '}
          <span className="inline-flex items-center rounded bg-violet-500/20 px-1.5 py-0.5 text-xs font-semibold text-violet-200">
            {roleName}
          </span>
          .
        </p>

        <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
          <p>
            Signed in as{' '}
            <span className="font-medium text-slate-200">{user.displayName ?? user.email}</span> (
            {user.email})
          </p>
        </div>

        <form action={accept} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-lg bg-[#7c3aed] py-3 text-sm font-semibold text-white transition hover:bg-[#8b5cf6]"
          >
            Accept invite &amp; join workspace
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-600">
          Not you?{' '}
          <Link href="/sign-in" className="text-slate-400 underline hover:text-white">
            Sign in with a different account
          </Link>
        </p>
      </div>
    </main>
  )
}

function ErrorCard({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07070b] px-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0c0c12] p-8 text-center">
        <p className="mb-6 text-sm font-semibold tracking-widest text-violet-400 uppercase">
          Harmony
        </p>
        <h1 className="text-xl font-bold text-white">Invite unavailable</h1>
        <p className="mt-3 text-sm text-slate-400">{message}</p>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </main>
  )
}

function DashboardLink() {
  return (
    <Link
      href="/dashboard"
      className="inline-block rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
    >
      Go to dashboard
    </Link>
  )
}
