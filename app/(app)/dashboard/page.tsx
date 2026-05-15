import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getUserByClerkId, provisionUser } from '@/lib/db/queries/users'
import { getProjectsForUser } from '@/lib/db/queries/projects'
import { CreateProjectDialog } from '@/components/editor/CreateProjectDialog'
import ProjectCard from '@/components/editor/ProjectCard'

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

  const allProjects = await getProjectsForUser(user.id)
  const myProjects = allProjects.filter((p) => p.isOwned)
  const sharedProjects = allProjects.filter((p) => !p.isOwned)

  const hasAnyProject = allProjects.length > 0

  return (
    <main className="min-h-screen bg-[#07070b] text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">
              {!hasAnyProject ? 'No projects yet — create one to get started.' : null}
            </p>
          </div>
          <CreateProjectDialog />
        </div>

        {!hasAnyProject ? (
          <div className="mt-24 flex flex-col items-center gap-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-[#0f0f1a]">
              <svg
                className="h-8 w-8 text-violet-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"
                />
              </svg>
            </div>
            <div>
              <p className="text-lg font-medium text-slate-200">Start your first project</p>
              <p className="mt-1 text-sm text-slate-500">
                Upload stems, collaborate in real time, and leave comments on every moment.
              </p>
            </div>
            <CreateProjectDialog label="Create your first project" />
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            {myProjects.length > 0 && (
              <section>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  My Projects
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {myProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      id={project.id}
                      name={project.name}
                      stemCount={project.stemCount}
                      updatedAt={project.updatedAt}
                    />
                  ))}
                </div>
              </section>
            )}

            {sharedProjects.length > 0 && (
              <section>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Shared with me
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sharedProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      id={project.id}
                      name={project.name}
                      stemCount={project.stemCount}
                      updatedAt={project.updatedAt}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
