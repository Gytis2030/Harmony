'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Activity, ArrowLeft, Circle, Users } from 'lucide-react'
import ProjectTimeline from '@/components/editor/ProjectTimeline'
import CollaborationSidebar, {
  type CommentTarget,
  type ActivityDto,
  type SidebarTab,
} from '@/components/editor/CollaborationSidebar'
import PresenceAvatars from '@/components/editor/PresenceAvatars'
import type { CommentDto, CommentReplyDto } from '@/lib/actions/comments'
import { fetchProjectComments } from '@/lib/actions/comments'
import type { InviteDto } from '@/lib/actions/invites'
import type { ShareLinkDto } from '@/lib/actions/share-links'
import type { ShareGrantDto } from '@/lib/actions/share-grants'
import type { RestoredTrackMix, VersionDto } from '@/lib/actions/versions'
import { fetchProjectVersions } from '@/lib/actions/versions'
import { fetchProjectActivity } from '@/lib/actions/activity'
import type { CreatedTrack } from '@/lib/actions/tracks'
import { audioEngine } from '@/lib/audio/audio-engine'
import { RoomProvider, useEventListener } from '@/lib/realtime/liveblocks'

type Track = {
  id: string
  name: string
  volume: number
  isMuted: boolean
  isSoloed: boolean
  color: string | null
  audioFile: {
    id: string
    originalFilename: string
    sizeBytes: number
    durationSeconds: number | null
  } | null
}

export type MemberDto = {
  userId: string
  displayName: string
  email: string
  role: 'owner' | 'editor' | 'commenter' | 'viewer'
  joinedAt: string
}

interface Props {
  projectId: string
  projectName: string
  workspaceId: string
  currentUserId: string
  tracks: Track[]
  comments: CommentDto[]
  versions: VersionDto[]
  members: MemberDto[]
  invites: InviteDto[]
  shareLinks: ShareLinkDto[]
  shareGrants: ShareGrantDto[]
  activity: ActivityDto[]
  currentUserRole: 'owner' | 'editor' | 'commenter' | 'viewer'
  canComment: boolean
  canManageComments: boolean
  canUploadTracks: boolean
  isWorkspaceMember: boolean
  bpm: number | null
  timeSignature: string
}

export default function ProjectEditorWorkspace(props: Props) {
  return (
    <RoomProvider id={`project:${props.projectId}`} initialPresence={{}}>
      <ProjectEditorInner {...props} />
    </RoomProvider>
  )
}

function ProjectEditorInner({
  projectId,
  projectName,
  workspaceId,
  currentUserId,
  tracks: initialTracks,
  comments: initialComments,
  versions: initialVersions,
  members: initialMembers,
  invites: initialInvites,
  shareLinks: initialShareLinks,
  shareGrants: initialShareGrants,
  activity: initialActivity,
  currentUserRole,
  canComment,
  canManageComments,
  canUploadTracks,
  isWorkspaceMember,
  bpm,
  timeSignature,
}: Props) {
  const router = useRouter()
  const [tabRequest, setTabRequest] = useState<{ tab: SidebarTab; seq: number } | null>(null)
  const [comments, setComments] = useState(initialComments)
  const [versions, setVersions] = useState(initialVersions)
  const [members, setMembers] = useState(initialMembers)
  const [invites, setInvites] = useState(initialInvites)
  const [shareLinks, setShareLinks] = useState(initialShareLinks)
  const [shareGrants, setShareGrants] = useState(initialShareGrants)
  const [activity, setActivity] = useState(initialActivity)
  const [tracks, setTracks] = useState(initialTracks)
  const [soloedTrackId, setSoloedTrackId] = useState<string | null>(
    () => initialTracks.find((t) => t.isSoloed)?.id ?? null
  )
  const [commentMode, setCommentMode] = useState(false)
  const [target, setTarget] = useState<CommentTarget | null>(null)
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null)

  // Merge server state into local state rather than replacing it wholesale.
  // Replacing would drop any optimistically-added tracks that aren't in this
  // particular server snapshot yet (e.g. when updateTrackMix triggers a re-render
  // while a batch upload is still in flight).
  useEffect(() => {
    setTracks((current) => {
      const currentIds = new Set(current.map((t) => t.id))
      // Update existing tracks with server values (needed for version restore)
      const updated = current.map((t) => {
        const sv = initialTracks.find((st) => st.id === t.id)
        return sv ?? t
      })
      // Add any server-side tracks not already in local state
      const added = initialTracks.filter((st) => !currentIds.has(st.id))
      return [...updated, ...added]
    })
  }, [initialTracks])

  useEventListener(({ event }) => {
    if (event.projectId !== projectId) return

    if (event.type === 'version.created' || event.type === 'version.restored') {
      fetchProjectVersions(projectId)
        .then(setVersions)
        .catch(() => {})
      fetchProjectActivity(projectId)
        .then(setActivity)
        .catch(() => {})
      return
    }

    if (event.type === 'activity.created') {
      fetchProjectActivity(projectId)
        .then(setActivity)
        .catch(() => {})
      return
    }

    // comment.* events: refresh comments and activity
    fetchProjectComments(projectId)
      .then(setComments)
      .catch(() => {})
    fetchProjectActivity(projectId)
      .then(setActivity)
      .catch(() => {})
  })

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      const active = document.activeElement
      if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) return
      if (commentMode) cancelComment()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [commentMode])

  function handleCommentSelect(commentId: string | null) {
    setSelectedCommentId(commentId)
    if (commentId) {
      const comment = comments.find((c) => c.id === commentId)
      if (comment) audioEngine.seek(comment.timestampSeconds)
    }
  }

  function startComment(t: CommentTarget) {
    setCommentMode(true)
    setTarget(t)
  }

  function cancelComment() {
    setCommentMode(false)
    setTarget(null)
  }

  function refreshActivity() {
    fetchProjectActivity(projectId)
      .then(setActivity)
      .catch(() => {})
  }

  function handleCommentCreated(comment: CommentDto) {
    setComments((current) =>
      [...current, comment].sort((a, b) => a.timestampSeconds - b.timestampSeconds)
    )
    cancelComment()
    setSelectedCommentId(comment.id)
    refreshActivity()
  }

  function handleCommentUpdated(comment: CommentDto) {
    setComments((current) =>
      current.map((item) =>
        item.id === comment.id
          ? { ...comment, replies: comment.replies.length > 0 ? comment.replies : item.replies }
          : item
      )
    )
    refreshActivity()
  }

  function handleCommentDeleted(commentId: string) {
    setComments((current) => current.filter((c) => c.id !== commentId))
    setSelectedCommentId((current) => (current === commentId ? null : current))
  }

  function handleReplyCreated(reply: CommentReplyDto) {
    setComments((current) =>
      current.map((comment) =>
        comment.id === reply.commentId
          ? { ...comment, replies: [...comment.replies, reply] }
          : comment
      )
    )
    refreshActivity()
  }

  function handleTrackCreated(track: CreatedTrack) {
    setTracks((current) => {
      // Guard against the merge effect and this callback both adding the same track
      if (current.some((t) => t.id === track.id)) return current
      return [...current, track]
    })
    refreshActivity()
  }

  function handleVersionCreated(version: VersionDto) {
    setVersions((current) => [version, ...current])
    refreshActivity()
  }

  function handleRestoreComplete(safetySnapshot: VersionDto, restoredTracks: RestoredTrackMix[]) {
    setVersions((current) => [safetySnapshot, ...current])
    setTracks((current) =>
      current.map((t) => {
        const restored = restoredTracks.find((r) => r.id === t.id)
        if (!restored) return t
        return {
          ...t,
          volume: restored.volume,
          isMuted: restored.isMuted,
          isSoloed: restored.isSoloed,
        }
      })
    )
    setSoloedTrackId(restoredTracks.find((r) => r.isSoloed)?.id ?? null)
    router.refresh()
    refreshActivity()
  }

  return (
    <>
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
              {projectName}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <Circle className="h-2 w-2 fill-emerald-400 text-emerald-400" />
              <span>Saved</span>
              <span className="hidden sm:inline">Local session</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {(currentUserRole === 'owner' || currentUserRole === 'editor') && (
            <button
              type="button"
              onClick={() =>
                setTabRequest((prev) => ({ tab: 'people', seq: (prev?.seq ?? 0) + 1 }))
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-violet-500/40 bg-violet-500/10 px-3 text-sm font-semibold text-violet-300 transition hover:bg-violet-500/20 hover:text-violet-100"
            >
              <Users className="h-3.5 w-3.5" />
              Share
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              setTabRequest((prev) => ({ tab: 'activity', seq: (prev?.seq ?? 0) + 1 }))
            }
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-slate-400 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
            aria-label="View activity"
          >
            <Activity className="h-4 w-4" />
          </button>
          <PresenceAvatars />
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px]">
        <ProjectTimeline
          projectId={projectId}
          tracks={tracks}
          comments={comments}
          bpm={bpm}
          timeSignature={timeSignature}
          commentMode={commentMode}
          selectedCommentId={selectedCommentId}
          soloedTrackId={soloedTrackId}
          canUploadTracks={canUploadTracks}
          canEditMix={canUploadTracks}
          onTrackCreated={canUploadTracks ? handleTrackCreated : undefined}
          onSoloChange={(trackId) =>
            setSoloedTrackId((current) => (current === trackId ? null : trackId))
          }
          onTrackRemoved={(trackId) =>
            setTracks((current) => current.filter((t) => t.id !== trackId))
          }
          onProjectCommentTarget={(timestampSeconds) =>
            startComment({ trackId: null, trackName: null, timestampSeconds })
          }
          onTrackCommentTarget={(trackId, trackName, timestampSeconds) =>
            startComment({ trackId, trackName, timestampSeconds })
          }
          onCommentSelect={handleCommentSelect}
        />

        <CollaborationSidebar
          projectId={projectId}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          comments={comments}
          commentMode={commentMode}
          target={target}
          selectedCommentId={selectedCommentId}
          versions={versions}
          members={members}
          invites={invites}
          shareLinks={shareLinks}
          shareGrants={shareGrants}
          activity={activity}
          currentUserRole={currentUserRole}
          canComment={canComment}
          canManageComments={canManageComments}
          isWorkspaceMember={isWorkspaceMember}
          onStartCommentMode={() => {
            setCommentMode(true)
            setTarget(null)
          }}
          onCancelComment={cancelComment}
          onTargetChange={startComment}
          onCommentCreated={handleCommentCreated}
          onCommentUpdated={handleCommentUpdated}
          onCommentDeleted={handleCommentDeleted}
          onReplyCreated={handleReplyCreated}
          onCommentSelect={handleCommentSelect}
          onVersionCreated={handleVersionCreated}
          onRestoreComplete={handleRestoreComplete}
          onInviteCreated={(inv) => setInvites((cur) => [inv, ...cur])}
          onInviteRevoked={(id) => setInvites((cur) => cur.filter((i) => i.id !== id))}
          onMemberRemoved={(userId) => setMembers((cur) => cur.filter((m) => m.userId !== userId))}
          onMemberRoleChanged={(userId, role) =>
            setMembers((cur) => cur.map((m) => (m.userId === userId ? { ...m, role } : m)))
          }
          onShareLinkCreated={(link) => {
            setShareLinks((cur) => {
              // Replace existing link of same access level (auto-revoked on server)
              const filtered = cur.filter((l) => l.accessLevel !== link.accessLevel)
              return [
                ...filtered,
                {
                  id: link.id,
                  projectId: link.projectId,
                  accessLevel: link.accessLevel,
                  isActive: link.isActive,
                  createdAt: link.createdAt,
                },
              ]
            })
            refreshActivity()
          }}
          onShareLinkRevoked={(id) => setShareLinks((cur) => cur.filter((l) => l.id !== id))}
          onShareGrantCreated={(grant) =>
            setShareGrants((cur) => {
              const filtered = cur.filter((g) => g.userId !== grant.userId)
              return [...filtered, grant]
            })
          }
          onShareGrantRevoked={(userId) =>
            setShareGrants((cur) => cur.filter((g) => g.userId !== userId))
          }
          tabRequest={tabRequest}
        />
      </div>
    </>
  )
}
