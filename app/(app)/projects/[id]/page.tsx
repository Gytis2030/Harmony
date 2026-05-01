import { auth } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { getProjectById } from '@/lib/db/queries/projects'
import { getTracksForProject } from '@/lib/db/queries/tracks'
import { UploadWidget } from '@/components/editor/UploadWidget'

interface Props {
  params: { id: string }
}

export default async function ProjectEditorPage({ params }: Props) {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/sign-in')

  const project = await getProjectById(params.id, user.id)
  if (!project) notFound()

  const tracks = await getTracksForProject(params.id)

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">{project.name}</h1>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-500">Tracks</h2>

        {tracks.length === 0 ? (
          <p className="mb-6 text-sm text-gray-400">No tracks yet. Upload an audio file below.</p>
        ) : (
          <ul className="mb-6 divide-y divide-gray-200 rounded-lg border border-gray-200">
            {tracks.map((track) => (
              <li key={track.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex-1 font-medium">{track.name}</span>
                {track.audioFile && (
                  <span className="text-xs text-gray-400">{track.audioFile.mimeType}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <UploadWidget projectId={params.id} />
      </section>
    </main>
  )
}
