import { auth } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'
import { getUserByClerkId } from '@/lib/db/queries/users'
import {
  getProjectByIdWithShareGrant,
  getShareGrantForUser,
  getActiveShareLinksForProject,
  getProjectShareGrantUsers,
  getLinkReviewerIds,
} from '@/lib/db/queries/projects'
import { getTracksForProject } from '@/lib/db/queries/tracks'
import { createPresignedGetUrl } from '@/lib/storage/r2'
import { getCommentsForProject } from '@/lib/db/queries/comments'
import { getWorkspaceMembers, getWorkspacePendingInvites } from '@/lib/db/queries/workspaces'
import { getRecentActivity } from '@/lib/db/queries/activity'
import { listVersions } from '@/lib/actions/versions'
import type { ShareLinkDto } from '@/lib/actions/share-links'
import type { ShareGrantDto } from '@/lib/actions/share-grants'
import type { ActivityDto } from '@/lib/db/queries/activity'
import { getReviewerAlias } from '@/lib/reviewer-alias'
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

  // These three only depend on the project, so fetch them together instead of
  // one after another: each sequential query is a full round trip to the database.
  const [trackRows, allMembers, comments] = await Promise.all([
    getTracksForProject(params.id),
    getWorkspaceMembers(project.workspaceId),
    getCommentsForProject(params.id, user.id),
  ])

  // Sign each stem's download URL now (local signing, no network call), so the
  // browser can start downloading immediately instead of asking for a URL per track.
  // r2Key stays on the server.
  const tracks = await Promise.all(
    trackRows.map(async ({ audioFile, ...track }) => {
      if (!audioFile) return { ...track, audioFile: null }
      const { r2Key, ...file } = audioFile
      const signedUrl = await createPresignedGetUrl({ key: r2Key }).catch(() => null)
      return { ...track, audioFile: { ...file, signedUrl } }
    })
  )
  const memberRecord = allMembers.find((m) => m.userId === user.id)

  let currentUserRole: Role
  let canComment: boolean
  let canManageComments: boolean
  let canUploadTracks: boolean
  let isWorkspaceMember: boolean
  let versions: Awaited<ReturnType<typeof listVersions>> = []
  let activityDtos: ActivityDto[] = []
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
  let shareGrantDtos: ShareGrantDto[] = []

  // Helper: substitute link-reviewer aliases in an activity row array.
  async function applyAliasesToActivity(
    rows: Awaited<ReturnType<typeof getRecentActivity>>
  ): Promise<ActivityDto[]> {
    const actorIds = [
      ...new Set(rows.map((r) => r.actorUserId).filter((id): id is string => id !== null)),
    ]
    const reviewerIds = new Set(await getLinkReviewerIds(params.id, actorIds))
    return rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      actorUserId: r.actorUserId,
      actorName:
        r.actorUserId && reviewerIds.has(r.actorUserId)
          ? getReviewerAlias(params.id, r.actorUserId)
          : (r.actorName ?? r.actorEmail ?? null),
      type: r.type,
      targetType: r.targetType,
      targetId: r.targetId,
      metadata: r.metadata as Record<string, unknown> | null,
      createdAt: r.createdAt.toISOString(),
    }))
  }

  if (memberRecord) {
    isWorkspaceMember = true
    currentUserRole = memberRecord.role as Role
    canComment = currentUserRole !== 'viewer'
    canManageComments = currentUserRole === 'owner' || currentUserRole === 'editor'
    canUploadTracks = currentUserRole === 'owner' || currentUserRole === 'editor'

    const [invites, shareLinks, shareGrantUsers, versionList, activityRows] = await Promise.all([
      getWorkspacePendingInvites(project.workspaceId, params.id),
      getActiveShareLinksForProject(params.id),
      getProjectShareGrantUsers(params.id),
      listVersions(params.id),
      getRecentActivity(params.id).catch(() => []),
    ])
    versions = versionList
    activityDtos = await applyAliasesToActivity(activityRows)

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

    shareGrantDtos = shareGrantUsers.map((g) => {
      const isLinkReviewer = g.shareLinkId !== null
      return {
        userId: g.userId,
        displayName: g.displayName ?? null,
        email: g.email,
        accessLevel: g.accessLevel,
        grantedAt: g.grantedAt.toISOString(),
        isLinkReviewer,
        alias: isLinkReviewer ? getReviewerAlias(params.id, g.userId) : null,
      }
    })
  } else {
    const grant = await getShareGrantForUser(params.id, user.id)
    if (!grant) notFound()

    isWorkspaceMember = false

    if (grant.accessLevel === 'edit') {
      currentUserRole = 'editor'
      canComment = true
      canManageComments = true
      canUploadTracks = true

      const [shareLinks, shareGrantUsers, versionList, activityRows] = await Promise.all([
        getActiveShareLinksForProject(params.id),
        getProjectShareGrantUsers(params.id),
        listVersions(params.id),
        getRecentActivity(params.id).catch(() => []),
      ])
      versions = versionList
      activityDtos = await applyAliasesToActivity(activityRows)

      shareLinkDtos = shareLinks.map((l) => ({
        id: l.id,
        projectId: params.id,
        accessLevel: l.accessLevel,
        isActive: l.isActive,
        createdAt: l.createdAt.toISOString(),
      }))

      shareGrantDtos = shareGrantUsers.map((g) => {
        const isLinkReviewer = g.shareLinkId !== null
        return {
          userId: g.userId,
          displayName: g.displayName ?? null,
          email: g.email,
          accessLevel: g.accessLevel,
          grantedAt: g.grantedAt.toISOString(),
          isLinkReviewer,
          alias: isLinkReviewer ? getReviewerAlias(params.id, g.userId) : null,
        }
      })
    } else {
      currentUserRole = grant.accessLevel === 'comment' ? 'commenter' : 'viewer'
      canComment = grant.accessLevel === 'comment'
      canManageComments = false
      canUploadTracks = false

      const SHARE_GRANT_ACTIVITY_TYPES = new Set([
        'track.uploaded',
        'comment.created',
        'comment.replied',
        'comment.resolved',
        'comment.reopened',
        'version.created',
        'version.restored',
      ])
      const activityRows = await getRecentActivity(params.id).catch(() => [])
      const filtered = activityRows.filter((r) => SHARE_GRANT_ACTIVITY_TYPES.has(r.type))
      activityDtos = await applyAliasesToActivity(filtered)
    }
  }

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
        shareGrants={shareGrantDtos}
        activity={activityDtos}
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
