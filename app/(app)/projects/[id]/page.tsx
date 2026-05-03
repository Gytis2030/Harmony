import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { getProjectById } from '@/lib/db/queries/projects'
import { getTracksForProject } from '@/lib/db/queries/tracks'
import { UploadWidget } from '@/components/editor/UploadWidget'
import ProjectTransport from '@/components/editor/ProjectTransport'
import TrackRow from '@/components/editor/TrackRow'

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

  const audioTracks = tracks.flatMap((t) =>
    t.audioFile ? [{ trackId: t.id, audioFileId: t.audioFile.id, name: t.name }] : []
  )

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center text-sm text-gray-400 hover:text-gray-700"
      >
        ← Back to Dashboard
      </Link>
      <h1 className="mb-6 text-2xl font-semibold">{project.name}</h1>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-500">Tracks</h2>

        {tracks.length === 0 ? (
          <p className="mb-6 text-sm text-gray-400">No tracks yet. Upload an audio file below.</p>
        ) : (
          <>
            {audioTracks.length > 0 && <ProjectTransport />}

            <div className="mb-6 flex flex-col gap-2">
              {tracks.map((track) =>
                track.audioFile ? (
                  <TrackRow
                    key={track.id}
                    trackId={track.id}
                    audioFileId={track.audioFile.id}
                    trackName={track.name}
                  />
                ) : (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3"
                  >
                    <span className="font-medium">{track.name}</span>
                    <span className="ml-auto text-xs text-gray-400">No audio file</span>
                  </div>
                )
              )}
            </div>
          </>
        )}

        <UploadWidget projectId={params.id} />
      </section>
    </main>
  )
}
