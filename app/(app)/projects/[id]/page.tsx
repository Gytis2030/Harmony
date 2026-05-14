import { auth } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'
import { getUserByClerkId } from '@/lib/db/queries/users'
import {
  getProjectByIdWithShareGrant,
  getShareGrantForUser,
  getActiveShareLinksForProject,
} from '@/lib/db/queries/projects'
import { getTracksForProject } from '@/lib/db/queries/tracks'
import { getCommentsForProject } from '@/lib/db/queries/comments'
import { getWorkspaceMembers, getWorkspacePendingInvites } from '@/lib/db/queries/workspaces'
import { listVersions } from '@/lib/actions/versions'
import type { ShareLinkDto } from '@/lib/actions/share-links'
import ProjectEditorWorkspace from '@/components/editor/ProjectEditorWorkspace'

interface Props {
  params: { id: string }
}

type Role = 'owner' | 'editor' | 'commenter' | 'viewer'

export default async function ProjectEditorPage({ params }: Props) {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/sign-in')

  const project = await getProjectByIdWithShareGrant(params.id, user.id)
  if (!project) notFound()

  const tracks = await getTracksForProject(params.id)
  const allMembers = await getWorkspaceMembers(project.workspaceId)
  const memberRecord = allMembers.find((m) => m.userId === user.id)

  let currentUserRole: Role
  let canComment: boolean
  let canManageComments: boolean
  let canUploadTracks: boolean
  let isWorkspaceMember: boolean
  let versions: Awaited<ReturnType<typeof listVersions>> = []
  let memberDtos: {
    userId: string
    displayName: string
    email: string
    role: Role
    joinedAt: string
  }[] = []
  let inviteDtos: {
    id: string
    workspaceId: string
    email: string
    role: Role
    token: string
    expiresAt: string
    createdAt: string
  }[] = []
  let shareLinkDtos: ShareLinkDto[] = []

  if (memberRecord) {
    isWorkspaceMember = true
    currentUserRole = memberRecord.role as Role
    canComment = currentUserRole !== 'viewer'
    canManageComments = currentUserRole === 'owner' || currentUserRole === 'editor'
    canUploadTracks = currentUserRole === 'owner' || currentUserRole === 'editor'

    const [invites, shareLinks, versionList] = await Promise.all([
      getWorkspacePendingInvites(project.workspaceId),
      getActiveShareLinksForProject(params.id),
      listVersions(params.id),
    ])
    versions = versionList

    memberDtos = allMembers.map((m) => ({
      userId: m.userId,
      displayName: m.displayName ?? m.email,
      email: m.email,
      role: m.role as Role,
      joinedAt: m.joinedAt.toISOString(),
    }))

    inviteDtos = invites.map((inv) => ({
      id: inv.id,
      workspaceId: inv.workspaceId,
      email: inv.email,
      role: inv.role as Role,
      token: inv.token,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    }))

    shareLinkDtos = shareLinks.map((l) => ({
      id: l.id,
      projectId: params.id,
      accessLevel: l.accessLevel,
      isActive: l.isActive,
      createdAt: l.createdAt.toISOString(),
    }))
  } else {
    const grant = await getShareGrantForUser(params.id, user.id)
    if (!grant) notFound()

    isWorkspaceMember = false
    currentUserRole = grant.accessLevel === 'comment' ? 'commenter' : 'viewer'
    canComment = grant.accessLevel === 'comment'
    canManageComments = false
    canUploadTracks = false
    // memberDtos / inviteDtos / shareLinkDtos / versions stay empty
  }

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
      <ProjectEditorWorkspace
        projectId={params.id}
        projectName={project.name}
        workspaceId={project.workspaceId}
        currentUserId={user.id}
        tracks={tracks}
        comments={commentDtos}
        versions={versions}
        members={memberDtos}
        invites={inviteDtos}
        shareLinks={shareLinkDtos}
        currentUserRole={currentUserRole}
        canComment={canComment}
        canManageComments={canManageComments}
        canUploadTracks={canUploadTracks}
        isWorkspaceMember={isWorkspaceMember}
        bpm={project.bpm}
        timeSignature={`${project.timeSignatureNumerator}/${project.timeSignatureDenominator}`}
      />
    </main>
  )
}
