import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { getProjectsForUser } from '@/lib/db/queries/projects'
import { CreateProjectDialog } from '@/components/editor/CreateProjectDialog'

export default async function DashboardPage() {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/sign-in')

  const projects = await getProjectsForUser(user.id)

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Projects</h1>
        <CreateProjectDialog />
      </div>

      {projects.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <p className="text-gray-500">No projects yet.</p>
          <CreateProjectDialog label="Create your first project" />
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <span className="font-medium">{project.name}</span>
                <span className="text-sm text-gray-400">
                  {new Date(project.updatedAt).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
