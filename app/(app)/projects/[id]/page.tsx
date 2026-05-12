import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Circle } from 'lucide-react'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { getProjectById } from '@/lib/db/queries/projects'
import { getTracksForProject } from '@/lib/db/queries/tracks'
import { getCommentsForProject } from '@/lib/db/queries/comments'
import ProjectEditorWorkspace from '@/components/editor/ProjectEditorWorkspace'

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
  const comments = await getCommentsForProject(params.id, user.id)
  const commentDtos = comments.map((comment) => ({
    ...comment,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    replies: comment.replies.map((reply) => ({
      ...reply,
      createdAt: reply.createdAt.toISOString(),
      updatedAt: reply.updatedAt.toISOString(),
    })),
  }))

  return (
    <main className="min-h-screen bg-[#07070b] text-slate-100">
      <header className="flex min-h-16 items-center justify-between border-b border-white/10 bg-[#0c0c12]/95 px-4 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 text-slate-400 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-white sm:text-lg">
              {project.name}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <Circle className="h-2 w-2 fill-emerald-400 text-emerald-400" />
              <span>Saved</span>
              <span className="hidden sm:inline">Local session</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden text-right text-xs text-slate-500 sm:block">
            <p className="font-medium uppercase tracking-wide text-slate-400">Collaborators</p>
            <p>Presence coming soon</p>
          </div>
          <div className="flex -space-x-2">
            <div className="h-8 w-8 rounded-full border border-[#7c3aed]/40 bg-[#7c3aed]/25" />
            <div className="h-8 w-8 rounded-full border border-white/10 bg-white/10" />
          </div>
        </div>
      </header>

      <ProjectEditorWorkspace
        projectId={params.id}
        tracks={tracks}
        comments={commentDtos}
        bpm={project.bpm}
        timeSignature={`${project.timeSignatureNumerator}/${project.timeSignatureDenominator}`}
      />
    </main>
  )
}
