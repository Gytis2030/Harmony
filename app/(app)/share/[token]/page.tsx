import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createHash } from 'crypto'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { getShareLinkByTokenHash, getShareGrantForUser } from '@/lib/db/queries/projects'
import { getWorkspaceMembers } from '@/lib/db/queries/workspaces'
import { activateShareLink } from '@/lib/actions/share-links'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

interface Props {
  params: { token: string }
}

const ACCESS_LABELS: Record<string, string> = {
  view: 'View only',
  comment: 'Can comment',
}

const ACCESS_DESCRIPTIONS: Record<string, string> = {
  view: 'You can listen to the project and read comments, but cannot leave your own.',
  comment: 'You can listen to the project and leave comments.',
}

export default async function ShareAccessPage({ params }: Props) {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/sign-in')

  const tokenHash = createHash('sha256').update(params.token).digest('hex')
  const link = await getShareLinkByTokenHash(tokenHash)

  if (!link || !link.isActive) {
    return <ErrorCard message="This share link is invalid or has been revoked." />
  }

  // Workspace member → go straight to the project
  const members = await getWorkspaceMembers(
    (
      await db
        .select({ workspaceId: projects.workspaceId })
        .from(projects)
        .where(eq(projects.id, link.projectId))
        .limit(1)
    )[0]?.workspaceId ?? ''
  )
  if (members.some((m) => m.userId === user.id)) {
    redirect(`/projects/${link.projectId}`)
  }

  // Already has a grant → go straight to the project
  const existingGrant = await getShareGrantForUser(link.projectId, user.id)
  if (existingGrant) {
    redirect(`/projects/${link.projectId}`)
  }

  const [projectRow] = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, link.projectId))
    .limit(1)

  const projectName = projectRow?.name ?? 'a project'

  async function activate() {
    'use server'
    await activateShareLink(params.token)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07070b] px-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0c0c12] p-8">
        <p className="mb-6 text-center text-sm font-semibold tracking-widest text-violet-400 uppercase">
          Harmony
        </p>

        <h1 className="text-center text-xl font-bold text-white">
          You&apos;ve been shared a project
        </h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          You&apos;ve been granted access to{' '}
          <span className="font-medium text-slate-200">{projectName}</span> with{' '}
          <span className="inline-flex items-center rounded bg-violet-500/20 px-1.5 py-0.5 text-xs font-semibold text-violet-200">
            {ACCESS_LABELS[link.accessLevel] ?? link.accessLevel}
          </span>{' '}
          access.
        </p>

        <p className="mt-2 text-center text-sm text-slate-500">
          {ACCESS_DESCRIPTIONS[link.accessLevel]}
        </p>

        <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
          <p>
            Signed in as{' '}
            <span className="font-medium text-slate-200">{user.displayName ?? user.email}</span> (
            {user.email})
          </p>
        </div>

        <form action={activate} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-lg bg-[#7c3aed] py-3 text-sm font-semibold text-white transition hover:bg-[#8b5cf6]"
          >
            Open project
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

function ErrorCard({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07070b] px-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0c0c12] p-8 text-center">
        <p className="mb-6 text-sm font-semibold tracking-widest text-violet-400 uppercase">
          Harmony
        </p>
        <h1 className="text-xl font-bold text-white">Link unavailable</h1>
        <p className="mt-3 text-sm text-slate-400">{message}</p>
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-block rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
