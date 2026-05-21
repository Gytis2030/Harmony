import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Music2 } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import { getUserByClerkId, provisionUser } from '@/lib/db/queries/users'
import { getProjectsForUser } from '@/lib/db/queries/projects'
import { getDashboardActivity } from '@/lib/db/queries/activity'
import { CreateProjectDialog } from '@/components/editor/CreateProjectDialog'
import DashboardShell, {
  type DashboardProject,
  type DashboardActivityItem,
} from '@/components/dashboard/DashboardShell'

export default async function DashboardPage() {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/sign-in')

  let user = await getUserByClerkId(clerkId)
  if (!user) {
    const clerkUser = await currentUser()
    if (!clerkUser) redirect('/sign-in')
    const email =
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
        ?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      ''
    const displayName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null
    user = await provisionUser({
      clerkId,
      email,
      displayName,
      avatarUrl: clerkUser.imageUrl ?? null,
    })
  }
  if (!user) redirect('/sign-in')

  const allProjectsRaw = await getProjectsForUser(user.id)

  const projectIds = allProjectsRaw.map((p) => p.id)
  const activityRows = await getDashboardActivity(projectIds, 12)

  const projectNameMap = new Map(allProjectsRaw.map((p) => [p.id, p.name]))

  const allProjects: DashboardProject[] = allProjectsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    stemCount: p.stemCount,
    updatedAt: p.updatedAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
    isOwned: p.isOwned,
    role: p.role,
    ownerName: p.ownerName,
  }))

  const activity: DashboardActivityItem[] = activityRows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    projectName: projectNameMap.get(r.projectId) ?? 'a project',
    actorUserId: r.actorUserId,
    actorName: r.actorName ?? r.actorEmail ?? null,
    type: r.type,
    metadata: r.metadata as Record<string, unknown> | null,
    createdAt: r.createdAt.toISOString(),
  }))

  const hasAnyProject = allProjects.length > 0

  return (
    <div className="min-h-screen bg-[#07080d]">
      {/* ── Top nav / app shell ── */}
      <nav className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#07080d]/95 px-5 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-violet-500/25">
            <Music2 className="h-3.5 w-3.5 text-violet-400" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-slate-100">Harmony</span>
        </div>
        <div className="flex items-center gap-3">
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>

      <main className="text-slate-100">
        <div className="mx-auto max-w-5xl px-5 py-10">
          {/* Page header */}
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-100">Project rooms</h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Private rooms for stems, timestamped notes, and revision history.
              </p>
            </div>
            <div className="shrink-0">
              <CreateProjectDialog label="New project room" />
            </div>
          </div>

          {/* Empty state */}
          {!hasAnyProject ? (
            <div className="mt-20 flex flex-col items-center gap-6 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#0d1018]">
                <svg
                  className="h-9 w-9 text-violet-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.4}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"
                  />
                </svg>
              </div>
              <div className="max-w-sm">
                <p className="text-lg font-semibold text-slate-200">
                  Create your first project room
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Upload stems, invite collaborators, collect timestamped feedback, and track every
                  revision — all in one private room.
                </p>
              </div>
              <CreateProjectDialog label="New project room" />
            </div>
          ) : (
            <DashboardShell allProjects={allProjects} activity={activity} currentUserId={user.id} />
          )}
        </div>
      </main>
    </div>
  )
}
