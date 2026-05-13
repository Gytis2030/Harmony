import { auth } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'
import { getUserByClerkId } from '@/lib/db/queries/users'
import { getProjectById } from '@/lib/db/queries/projects'
import { getTracksForProject } from '@/lib/db/queries/tracks'
import { getCommentsForProject } from '@/lib/db/queries/comments'
import { listVersions } from '@/lib/actions/versions'
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
  const [comments, versions] = await Promise.all([
    getCommentsForProject(params.id, user.id),
    listVersions(params.id),
  ])
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
      <ProjectEditorWorkspace
        projectId={params.id}
        projectName={project.name}
        tracks={tracks}
        comments={commentDtos}
        versions={versions}
        bpm={project.bpm}
        timeSignature={`${project.timeSignatureNumerator}/${project.timeSignatureDenominator}`}
      />
    </main>
  )
}
