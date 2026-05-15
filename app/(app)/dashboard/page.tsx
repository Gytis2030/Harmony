import { auth, currentUser } from '@clerk/nextjs/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUserByClerkId, provisionUser } from '@/lib/db/queries/users'
import { getProjectsForUser } from '@/lib/db/queries/projects'
import { CreateProjectDialog } from '@/components/editor/CreateProjectDialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle className="text-base">{project.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-400">
                    Created {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
