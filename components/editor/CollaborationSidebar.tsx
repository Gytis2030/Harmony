'use client'

import { useState, useTransition } from 'react'
import {
  ArrowLeft,
  Check,
  Copy,
  Link as LinkIcon,
  MessageSquarePlus,
  Pin,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import {
  createComment,
  createCommentReply,
  deleteComment,
  setCommentPinned,
  setCommentStatus,
  type CommentDto,
  type CommentReplyDto,
} from '@/lib/actions/comments'
import { createInvite, revokeInvite, type InviteDto } from '@/lib/actions/invites'
import { removeMember, updateMemberRole } from '@/lib/actions/members'
import {
  createShareLink,
  revokeShareLink,
  type ShareLinkDto,
  type ShareLinkCreatedDto,
} from '@/lib/actions/share-links'
import {
  createVersion,
  restoreVersion,
  type RestoredTrackMix,
  type VersionDto,
} from '@/lib/actions/versions'
import {
  filterComments,
  sortComments,
  countByFilter,
  type CommentFilter,
} from '@/lib/comments/filter'
import { audioEngine } from '@/lib/audio/audio-engine'
import { useBroadcastEvent } from '@/lib/realtime/liveblocks'
import type { MemberDto } from '@/components/editor/ProjectEditorWorkspace'

export type CommentTarget = {
  trackId: string | null
  trackName: string | null
  timestampSeconds: number
}

export type ActivityDto = {
  id: string
  projectId: string
  actorUserId: string | null
  actorName: string | null
  type: string
  targetType: string | null
  targetId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

type SidebarTab = 'comments' | 'versions' | 'people' | 'activity'

type WorkspaceMemberRole = 'owner' | 'editor' | 'commenter' | 'viewer'

interface Props {
  projectId: string
  workspaceId: string
  currentUserId: string
  comments: CommentDto[]
  commentMode: boolean
  target: CommentTarget | null
  selectedCommentId: string | null
  versions: VersionDto[]
  members: MemberDto[]
  invites: InviteDto[]
  shareLinks: ShareLinkDto[]
  activity: ActivityDto[]
  currentUserRole: WorkspaceMemberRole
  canComment: boolean
  canManageComments: boolean
  onStartCommentMode: () => void
  onCancelComment: () => void
  onTargetChange: (target: CommentTarget) => void
  onCommentCreated: (comment: CommentDto) => void
  onCommentUpdated: (comment: CommentDto) => void
  onCommentDeleted: (commentId: string) => void
  onReplyCreated: (reply: CommentReplyDto) => void
  onCommentSelect: (commentId: string | null) => void
  onVersionCreated: (version: VersionDto) => void
  onRestoreComplete: (safetySnapshot: VersionDto, restoredTracks: RestoredTrackMix[]) => void
  onInviteCreated: (invite: InviteDto) => void
  onInviteRevoked: (inviteId: string) => void
  onMemberRemoved: (userId: string) => void
  onMemberRoleChanged: (userId: string, role: WorkspaceMemberRole) => void
  onShareLinkCreated: (link: ShareLinkCreatedDto) => void
  onShareLinkRevoked: (linkId: string) => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function CommentAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initial = (name || '?').charAt(0).toUpperCase()
  const cls =
    size === 'sm'
      ? 'h-5 w-5 shrink-0 rounded-full border border-violet-600/20 bg-violet-600/25 text-[9px] font-bold text-violet-200 flex items-center justify-center'
      : 'h-7 w-7 shrink-0 rounded-full border border-violet-600/20 bg-violet-600/25 text-xs font-bold text-violet-200 flex items-center justify-center'
  return <div className={cls}>{initial}</div>
}

const FILTER_LABELS: Record<CommentFilter, string> = {
  open: 'Open',
  resolved: 'Resolved',
  all: 'All',
}

export default function CollaborationSidebar({
  projectId,
  workspaceId,
  currentUserId,
  comments,
  commentMode,
  target,
  selectedCommentId,
  versions,
  members,
  invites,
  shareLinks,
  activity,
  currentUserRole,
  canComment,
  canManageComments,
  onStartCommentMode,
  onCancelComment,
  onTargetChange,
  onCommentCreated,
  onCommentUpdated,
  onCommentDeleted,
  onReplyCreated,
  onCommentSelect,
  onVersionCreated,
  onRestoreComplete,
  onInviteCreated,
  onInviteRevoked,
  onMemberRemoved,
  onMemberRoleChanged,
  onShareLinkCreated,
  onShareLinkRevoked,
}: Props) {
  const canManageVersions = currentUserRole === 'owner' || currentUserRole === 'editor'
  const [activeTab, setActiveTab] = useState<SidebarTab>('comments')
  const [filter, setFilter] = useState<CommentFilter>('open')
  const [body, setBody] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [composeError, setComposeError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [replyError, setReplyError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Version form state
  const [versionFormOpen, setVersionFormOpen] = useState(false)
  const [versionName, setVersionName] = useState('')
  const [versionDesc, setVersionDesc] = useState('')
  const [versionError, setVersionError] = useState<string | null>(null)
  const [versionSuccess, setVersionSuccess] = useState<string | null>(null)
  const [isVersionPending, startVersionTransition] = useTransition()

  // Version detail / restore state
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [restoreConfirm, setRestoreConfirm] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [isRestorePending, startRestoreTransition] = useTransition()

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<WorkspaceMemberRole>('viewer')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [newInviteToken, setNewInviteToken] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [isInvitePending, startInviteTransition] = useTransition()
  const [isRevokePending, startRevokeTransition] = useTransition()

  // Member management state
  const [memberActionError, setMemberActionError] = useState<string | null>(null)
  const [isMemberActionPending, startMemberActionTransition] = useTransition()

  // Share link state
  const [newShareTokens, setNewShareTokens] = useState<Record<string, string>>({}) // accessLevel → rawToken
  const [copiedShareLinkId, setCopiedShareLinkId] = useState<string | null>(null)
  const [shareLinkError, setShareLinkError] = useState<string | null>(null)
  const [isShareLinkPending, startShareLinkTransition] = useTransition()
  const [isShareRevokePending, startShareRevokeTransition] = useTransition()

  const broadcast = useBroadcastEvent()

  const counts = countByFilter(comments)
  const selectedComment = selectedCommentId
    ? (comments.find((c) => c.id === selectedCommentId) ?? null)
    : null

  const isThreadView = activeTab === 'comments' && !target && !!selectedComment
  const isListView = activeTab === 'comments' && !target && !selectedComment

  // ---- comment mode helpers ----
  function handleAddAtPlayhead() {
    onTargetChange({
      trackId: null,
      trackName: null,
      timestampSeconds: audioEngine.position,
    })
  }

  function handleCancel() {
    setBody('')
    setComposeError(null)
    onCancelComment()
  }

  // ---- compose ----
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!target) return

    startTransition(async () => {
      setComposeError(null)
      try {
        const comment = await createComment({
          projectId,
          trackId: target.trackId,
          timestampSeconds: target.timestampSeconds,
          body,
        })
        setBody('')
        onCommentCreated(comment)
        broadcast({ type: 'comment.created', projectId, commentId: comment.id })
      } catch (err) {
        setComposeError(err instanceof Error ? err.message : 'Could not save comment.')
      }
    })
  }

  // ---- status / pin / delete ----
  function handleStatus(comment: CommentDto, status: 'open' | 'resolved') {
    startTransition(async () => {
      setActionError(null)
      try {
        const updated = await setCommentStatus({ commentId: comment.id, status })
        onCommentUpdated(updated)
        broadcast({
          type: status === 'resolved' ? 'comment.resolved' : 'comment.reopened',
          projectId,
          commentId: comment.id,
        })
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Could not update comment.')
      }
    })
  }

  function handleDelete(comment: CommentDto) {
    startTransition(async () => {
      setActionError(null)
      try {
        const deleted = await deleteComment(comment.id)
        onCommentDeleted(deleted.id)
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Could not delete comment.')
      }
    })
  }

  function handlePinned(comment: CommentDto) {
    startTransition(async () => {
      setActionError(null)
      try {
        const updated = await setCommentPinned({
          commentId: comment.id,
          isPinned: !comment.isPinned,
        })
        onCommentUpdated(updated)
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Could not update pin.')
      }
    })
  }

  // ---- reply ----
  function handleReplySubmit(e: React.FormEvent, comment: CommentDto) {
    e.preventDefault()
    if (!replyBody.trim()) return

    startTransition(async () => {
      setReplyError(null)
      try {
        const reply = await createCommentReply({ commentId: comment.id, body: replyBody })
        setReplyBody('')
        onReplyCreated(reply)
        broadcast({ type: 'comment.replied', projectId, commentId: comment.id, replyId: reply.id })
      } catch (err) {
        setReplyError(err instanceof Error ? err.message : 'Could not save reply.')
      }
    })
  }

  // ---- save version ----
  function handleVersionSubmit(e: React.FormEvent) {
    e.preventDefault()
    startVersionTransition(async () => {
      setVersionError(null)
      setVersionSuccess(null)
      try {
        const version = await createVersion({
          projectId,
          name: versionName,
          description: versionDesc || undefined,
        })
        onVersionCreated(version)
        setVersionFormOpen(false)
        setVersionName('')
        setVersionDesc('')
        setVersionSuccess(`Version "${version.name}" saved`)
        setTimeout(() => setVersionSuccess(null), 4000)
      } catch (err) {
        setVersionError(err instanceof Error ? err.message : 'Could not save version.')
      }
    })
  }

  // ---- restore version ----
  function handleRestoreConfirm() {
    if (!selectedVersionId) return
    startRestoreTransition(async () => {
      setRestoreError(null)
      try {
        const { safetySnapshot, restoredTracks } = await restoreVersion({
          versionId: selectedVersionId,
          projectId,
        })
        onRestoreComplete(safetySnapshot, restoredTracks)
        setSelectedVersionId(null)
        setRestoreConfirm(false)
      } catch (err) {
        setRestoreError(err instanceof Error ? err.message : 'Could not restore version.')
      }
    })
  }

  // ---- invite ----
  function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault()
    startInviteTransition(async () => {
      setInviteError(null)
      setNewInviteToken(null)
      try {
        const invite = await createInvite({ workspaceId, email: inviteEmail, role: inviteRole })
        onInviteCreated(invite)
        setInviteEmail('')
        setNewInviteToken(invite.token)
      } catch (err) {
        setInviteError(err instanceof Error ? err.message : 'Could not create invite.')
      }
    })
  }

  function handleRevoke(inviteId: string) {
    startRevokeTransition(async () => {
      try {
        await revokeInvite({ inviteId })
        onInviteRevoked(inviteId)
        if (newInviteToken) {
          const revokedInvite = invites.find((i) => i.id === inviteId)
          if (revokedInvite?.token === newInviteToken) setNewInviteToken(null)
        }
      } catch {
        // silently ignore — UI state will stay until next refresh
      }
    })
  }

  function handleCopyLink(token: string) {
    const url = `${window.location.origin}/invite/${token}?project=${projectId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token)
      setTimeout(() => setCopiedToken((cur) => (cur === token ? null : cur)), 2000)
    })
  }

  function handleRemoveMember(userId: string) {
    startMemberActionTransition(async () => {
      setMemberActionError(null)
      try {
        await removeMember({ workspaceId, targetUserId: userId })
        onMemberRemoved(userId)
      } catch (err) {
        setMemberActionError(err instanceof Error ? err.message : 'Could not remove member.')
      }
    })
  }

  function handleUpdateMemberRole(userId: string, role: WorkspaceMemberRole) {
    startMemberActionTransition(async () => {
      setMemberActionError(null)
      try {
        await updateMemberRole({ workspaceId, targetUserId: userId, role })
        onMemberRoleChanged(userId, role)
      } catch (err) {
        setMemberActionError(err instanceof Error ? err.message : 'Could not update role.')
      }
    })
  }

  const canInvite = currentUserRole === 'owner' || currentUserRole === 'editor'
  const canManageLinks = currentUserRole === 'owner' || currentUserRole === 'editor'
  const invitableRoles: WorkspaceMemberRole[] =
    currentUserRole === 'owner' ? ['editor', 'commenter', 'viewer'] : ['commenter', 'viewer']

  function handleCreateShareLink(accessLevel: 'view' | 'comment') {
    startShareLinkTransition(async () => {
      setShareLinkError(null)
      try {
        const link = await createShareLink({ projectId, accessLevel })
        onShareLinkCreated(link)
        setNewShareTokens((cur) => ({ ...cur, [accessLevel]: link.rawToken }))
      } catch (err) {
        setShareLinkError(err instanceof Error ? err.message : 'Could not create share link.')
      }
    })
  }

  function handleRevokeShareLink(linkId: string, accessLevel: string) {
    startShareRevokeTransition(async () => {
      try {
        await revokeShareLink({ linkId })
        onShareLinkRevoked(linkId)
        setNewShareTokens((cur) => {
          const next = { ...cur }
          delete next[accessLevel]
          return next
        })
      } catch {
        // silently ignore
      }
    })
  }

  function handleCopyShareLink(accessLevel: string, rawToken: string, linkId: string) {
    const url = `${window.location.origin}/share/${rawToken}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedShareLinkId(linkId)
      setTimeout(() => setCopiedShareLinkId((cur) => (cur === linkId ? null : cur)), 2000)
    })
  }

  function handleDismissShareToken(accessLevel: string) {
    setNewShareTokens((cur) => {
      const next = { ...cur }
      delete next[accessLevel]
      return next
    })
  }

  const filteredSorted = sortComments(filterComments(comments, filter))

  return (
    <aside className="flex flex-col border-t border-white/10 bg-[#0b0b11] xl:border-l xl:border-t-0">
      {/* ── sticky header ── */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0b0b11]">
        {/* tab bar */}
        <div className="flex border-b border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('comments')}
            className={[
              'flex-1 py-2.5 text-xs font-semibold transition',
              activeTab === 'comments'
                ? 'border-b-2 border-violet-500 text-white'
                : 'text-slate-500 hover:text-slate-300',
            ].join(' ')}
          >
            Comments {counts.all > 0 ? `(${counts.all})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('versions')}
            className={[
              'flex-1 py-2.5 text-xs font-semibold transition',
              activeTab === 'versions'
                ? 'border-b-2 border-violet-500 text-white'
                : 'text-slate-500 hover:text-slate-300',
            ].join(' ')}
          >
            Versions {versions.length > 0 ? `(${versions.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('people')}
            className={[
              'flex-1 py-2.5 text-xs font-semibold transition',
              activeTab === 'people'
                ? 'border-b-2 border-violet-500 text-white'
                : 'text-slate-500 hover:text-slate-300',
            ].join(' ')}
          >
            People {members.length > 0 ? `(${members.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={[
              'flex-1 py-2.5 text-xs font-semibold transition',
              activeTab === 'activity'
                ? 'border-b-2 border-violet-500 text-white'
                : 'text-slate-500 hover:text-slate-300',
            ].join(' ')}
          >
            Activity
          </button>
        </div>

        {/* comments tab sub-header */}
        {activeTab === 'comments' && (
          <>
            <div className="flex items-center justify-between px-4 py-3">
              {isThreadView ? (
                <button
                  type="button"
                  onClick={() => onCommentSelect(null)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 transition hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Comments
                </button>
              ) : (
                <span className="text-sm font-semibold text-slate-200">
                  {commentMode ? 'New comment' : 'Comments'}
                </span>
              )}

              {commentMode ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-white/10 text-slate-400 transition hover:bg-white/5 hover:text-white"
                  aria-label="Cancel comment mode"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : !isThreadView && canComment ? (
                <button
                  type="button"
                  onClick={onStartCommentMode}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#7c3aed]/50 bg-[#7c3aed]/20 text-violet-100 transition hover:bg-[#7c3aed]/30"
                  aria-label="Add comment"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {/* filter tabs – list view only */}
            {isListView && (
              <div className="flex border-t border-white/10">
                {(Object.keys(FILTER_LABELS) as CommentFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={[
                      'flex-1 py-2 text-[11px] font-medium transition',
                      filter === f
                        ? 'border-b-2 border-violet-500 text-white'
                        : 'text-slate-500 hover:text-slate-300',
                    ].join(' ')}
                  >
                    {FILTER_LABELS[f]} {counts[f] > 0 ? `(${counts[f]})` : ''}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* people tab sub-header */}
        {activeTab === 'people' && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold text-slate-200">People</span>
            {canInvite && (
              <span className="text-[10px] text-slate-500">
                {invites.length > 0 ? `${invites.length} pending` : ''}
              </span>
            )}
          </div>
        )}

        {/* versions tab sub-header */}
        {activeTab === 'versions' && (
          <div className="flex items-center justify-between px-4 py-3">
            {selectedVersionId ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedVersionId(null)
                  setRestoreConfirm(false)
                  setRestoreError(null)
                }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 transition hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Versions
              </button>
            ) : (
              <>
                <span className="text-sm font-semibold text-slate-200">Versions</span>
                {canManageVersions && !versionFormOpen && (
                  <button
                    type="button"
                    onClick={() => {
                      setVersionFormOpen(true)
                      setVersionError(null)
                    }}
                    className="inline-flex items-center gap-1.5 rounded border border-[#7c3aed]/50 bg-[#7c3aed]/20 px-2.5 py-1.5 text-xs font-semibold text-violet-100 transition hover:bg-[#7c3aed]/30"
                  >
                    <Save className="h-3 w-3" />
                    Save Version
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── scrollable body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 px-4 py-4">
          {/* ── comments tab content ── */}
          {activeTab === 'comments' && (
            <>
              {/* comment mode indicator */}
              {commentMode && !target && (
                <div className="rounded border border-violet-400/25 bg-violet-400/8 px-3 py-3">
                  <p className="text-sm leading-5 text-violet-100">
                    Click the ruler or a track lane to leave a note.
                  </p>
                  <button
                    type="button"
                    onClick={handleAddAtPlayhead}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-violet-300 transition hover:text-violet-100"
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                    Add at playhead position
                  </button>
                  <p className="mt-2 text-[10px] text-violet-400/60">Press Esc to cancel</p>
                </div>
              )}

              {/* compose form */}
              {target && (
                <form
                  onSubmit={handleSubmit}
                  className="rounded border border-white/10 bg-black/25 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {target.trackName ?? 'Project'} / {formatTime(target.timestampSeconds)}
                    </p>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-white/5 hover:text-slate-200"
                      aria-label="Cancel composer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    className="w-full resize-none rounded border border-white/10 bg-[#09090f] px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-[#7c3aed]/70"
                    placeholder="Leave a note..."
                    disabled={isPending}
                    autoFocus
                  />
                  {composeError && <p className="mt-2 text-xs text-red-300">{composeError}</p>}
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="rounded border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/5 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPending || body.trim().length === 0}
                      className="rounded bg-[#7c3aed] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#8b5cf6] disabled:opacity-50"
                    >
                      {isPending ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
              )}

              {/* thread view */}
              {isThreadView && selectedComment && (
                <ThreadView
                  comment={selectedComment}
                  replyBody={replyBody}
                  replyError={replyError}
                  actionError={actionError}
                  isPending={isPending}
                  canComment={canComment}
                  canManageComments={canManageComments}
                  onReplyChange={setReplyBody}
                  onReplySubmit={handleReplySubmit}
                  onStatus={handleStatus}
                  onPinned={handlePinned}
                  onDelete={handleDelete}
                />
              )}

              {/* list view */}
              {isListView && (
                <CommentList
                  comments={filteredSorted}
                  filter={filter}
                  selectedCommentId={selectedCommentId}
                  actionError={actionError}
                  canComment={canComment}
                  onSelect={onCommentSelect}
                />
              )}
            </>
          )}

          {/* ── activity tab content ── */}
          {activeTab === 'activity' && (
            <ActivityFeed
              activity={activity}
              onSelectComment={(commentId) => {
                setActiveTab('comments')
                onCommentSelect(commentId)
              }}
              onSelectVersion={(versionId) => {
                setActiveTab('versions')
                setSelectedVersionId(versionId)
                setRestoreConfirm(false)
                setRestoreError(null)
                setVersionFormOpen(false)
              }}
            />
          )}

          {/* ── people tab content ── */}
          {activeTab === 'people' && (
            <PeopleTab
              members={members}
              invites={invites}
              shareLinks={shareLinks}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              canInvite={canInvite}
              canManageLinks={canManageLinks}
              invitableRoles={invitableRoles}
              inviteEmail={inviteEmail}
              inviteRole={inviteRole}
              inviteError={inviteError}
              shareLinkError={shareLinkError}
              memberActionError={memberActionError}
              newInviteToken={newInviteToken}
              copiedToken={copiedToken}
              newShareTokens={newShareTokens}
              copiedShareLinkId={copiedShareLinkId}
              isInvitePending={isInvitePending}
              isRevokePending={isRevokePending}
              isShareLinkPending={isShareLinkPending}
              isShareRevokePending={isShareRevokePending}
              isMemberActionPending={isMemberActionPending}
              onEmailChange={setInviteEmail}
              onRoleChange={setInviteRole}
              onSubmit={handleInviteSubmit}
              onCopy={handleCopyLink}
              onRevoke={handleRevoke}
              onDismissNewLink={() => setNewInviteToken(null)}
              onRemoveMember={handleRemoveMember}
              onUpdateMemberRole={handleUpdateMemberRole}
              onCreateShareLink={handleCreateShareLink}
              onRevokeShareLink={handleRevokeShareLink}
              onCopyShareLink={handleCopyShareLink}
              onDismissShareToken={handleDismissShareToken}
            />
          )}

          {/* ── versions tab content ── */}
          {activeTab === 'versions' && (
            <>
              {/* inline save version form — owner/editor only */}
              {canManageVersions && versionFormOpen && (
                <form
                  onSubmit={handleVersionSubmit}
                  className="rounded border border-white/10 bg-black/25 p-3"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      New version
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setVersionFormOpen(false)
                        setVersionError(null)
                      }}
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-white/5 hover:text-slate-200"
                      aria-label="Cancel"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    maxLength={200}
                    placeholder="Version name (e.g. Rough mix)"
                    className="w-full rounded border border-white/10 bg-[#09090f] px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-[#7c3aed]/70"
                    disabled={isVersionPending}
                    autoFocus
                  />
                  <textarea
                    value={versionDesc}
                    onChange={(e) => setVersionDesc(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Description (optional)"
                    className="mt-2 w-full resize-none rounded border border-white/10 bg-[#09090f] px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-[#7c3aed]/70"
                    disabled={isVersionPending}
                  />
                  {versionError && <p className="mt-2 text-xs text-red-300">{versionError}</p>}
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setVersionFormOpen(false)
                        setVersionError(null)
                      }}
                      className="rounded border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/5 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isVersionPending || versionName.trim().length === 0}
                      className="rounded bg-[#7c3aed] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#8b5cf6] disabled:opacity-50"
                    >
                      {isVersionPending ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
              )}

              {/* success message */}
              {versionSuccess && (
                <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  {versionSuccess}
                </div>
              )}

              {/* version list / detail */}
              {selectedVersionId ? (
                <VersionDetail
                  version={versions.find((v) => v.id === selectedVersionId)!}
                  restoreConfirm={restoreConfirm}
                  restoreError={restoreError}
                  isPending={isRestorePending}
                  canRestore={canManageVersions}
                  onRestoreClick={() => setRestoreConfirm(true)}
                  onRestoreCancel={() => {
                    setRestoreConfirm(false)
                    setRestoreError(null)
                  }}
                  onRestoreConfirm={handleRestoreConfirm}
                />
              ) : (
                <VersionList
                  versions={versions}
                  canManageVersions={canManageVersions}
                  onSelect={(id) => {
                    setSelectedVersionId(id)
                    setRestoreConfirm(false)
                    setRestoreError(null)
                    setVersionFormOpen(false)
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

// ─────────────────────────────────────────────
// Sub-components

interface ThreadViewProps {
  comment: CommentDto
  replyBody: string
  replyError: string | null
  actionError: string | null
  isPending: boolean
  canComment: boolean
  canManageComments: boolean
  onReplyChange: (value: string) => void
  onReplySubmit: (e: React.FormEvent, comment: CommentDto) => void
  onStatus: (comment: CommentDto, status: 'open' | 'resolved') => void
  onPinned: (comment: CommentDto) => void
  onDelete: (comment: CommentDto) => void
}

function ThreadView({
  comment,
  replyBody,
  replyError,
  actionError,
  isPending,
  canComment,
  canManageComments,
  onReplyChange,
  onReplySubmit,
  onStatus,
  onPinned,
  onDelete,
}: ThreadViewProps) {
  const isResolved = comment.status === 'resolved'
  return (
    <div className="space-y-4">
      {/* context line */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-medium">
          {comment.trackName ?? 'Project'}
        </span>
        <span>·</span>
        <span>{formatTime(comment.timestampSeconds)}</span>
        {comment.isPinned && (
          <>
            <span>·</span>
            <span className="flex items-center gap-0.5 text-violet-400">
              <Pin className="h-2.5 w-2.5" />
              Pinned
            </span>
          </>
        )}
        {isResolved && (
          <>
            <span>·</span>
            <span className="flex items-center gap-0.5 text-emerald-400">
              <Check className="h-2.5 w-2.5" />
              Resolved
            </span>
          </>
        )}
      </div>

      {/* original comment */}
      <div className="flex gap-2.5">
        <CommentAvatar name={comment.authorName} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-semibold text-slate-200">{comment.authorName}</p>
            <p className="shrink-0 text-[10px] text-slate-600">
              {formatRelativeDate(comment.createdAt)}
            </p>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-slate-200">
            {comment.body}
          </p>
        </div>
      </div>

      {/* replies */}
      {comment.replies.length > 0 && (
        <div className="space-y-3 border-l border-white/10 pl-3">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="flex gap-2">
              <CommentAvatar name={reply.authorName} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[11px] font-semibold text-slate-300">
                    {reply.authorName}
                  </p>
                  <p className="shrink-0 text-[10px] text-slate-600">
                    {formatRelativeDate(reply.createdAt)}
                  </p>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-slate-300">
                  {reply.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* reply form — only for users who can comment */}
      {canComment && (
        <form onSubmit={(e) => onReplySubmit(e, comment)}>
          <textarea
            value={replyBody}
            onChange={(e) => onReplyChange(e.target.value)}
            rows={2}
            maxLength={2000}
            className="w-full resize-none rounded border border-white/10 bg-[#09090f] px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-[#7c3aed]/70"
            placeholder="Write a reply…"
            disabled={isPending}
          />
          {replyError && <p className="mt-1 text-xs text-red-300">{replyError}</p>}
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={isPending || replyBody.trim().length === 0}
              className="rounded bg-[#7c3aed] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#8b5cf6] disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Reply'}
            </button>
          </div>
        </form>
      )}

      {/* actions row — only for workspace members who can manage comments */}
      {canManageComments && (
        <>
          {actionError && <p className="text-xs text-red-300">{actionError}</p>}
          <div className="flex items-center gap-2 border-t border-white/[0.06] pt-3">
            <button
              type="button"
              onClick={() => onStatus(comment, isResolved ? 'open' : 'resolved')}
              disabled={isPending}
              className={[
                'inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50',
                isResolved
                  ? 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-white'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20',
              ].join(' ')}
            >
              {isResolved ? (
                <>
                  <RotateCcw className="h-3 w-3" />
                  Reopen
                </>
              ) : (
                <>
                  <Check className="h-3 w-3" />
                  Resolve
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onPinned(comment)}
              disabled={isPending}
              className={[
                'inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50',
                comment.isPinned
                  ? 'border-violet-400/30 bg-violet-400/10 text-violet-200 hover:bg-violet-400/20'
                  : 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-white',
              ].join(' ')}
            >
              <Pin className="h-3 w-3" />
              {comment.isPinned ? 'Unpin' : 'Pin'}
            </button>

            <button
              type="button"
              onClick={() => onDelete(comment)}
              disabled={isPending}
              className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded border border-white/10 text-slate-500 transition hover:bg-red-400/10 hover:text-red-300 disabled:opacity-50"
              aria-label="Delete comment"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

interface CommentListProps {
  comments: CommentDto[]
  filter: CommentFilter
  selectedCommentId: string | null
  actionError: string | null
  canComment: boolean
  onSelect: (id: string) => void
}

function CommentList({
  comments,
  filter,
  selectedCommentId,
  actionError,
  canComment,
  onSelect,
}: CommentListProps) {
  if (comments.length === 0) {
    const emptyMessages: Record<CommentFilter, string> = {
      open: canComment ? 'No open comments yet. Click + to leave a note.' : 'No open comments yet.',
      resolved: 'No resolved comments.',
      all: canComment ? 'No comments yet. Click + to leave the first note.' : 'No comments yet.',
    }
    return <p className="text-sm leading-6 text-slate-500">{emptyMessages[filter]}</p>
  }

  return (
    <div className="space-y-2">
      {actionError && <p className="text-xs text-red-300">{actionError}</p>}
      {comments.map((comment) => {
        const isSelected = selectedCommentId === comment.id
        const isResolved = comment.status === 'resolved'
        return (
          <article
            key={comment.id}
            onClick={() => onSelect(comment.id)}
            className={[
              'cursor-pointer rounded border p-3 transition',
              isSelected
                ? 'border-violet-400/40 bg-violet-400/8 ring-1 ring-violet-400/20'
                : 'border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.045]',
            ].join(' ')}
          >
            <div className="flex gap-2.5">
              <CommentAvatar name={comment.authorName} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-200">
                      {comment.authorName}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                      <span className="rounded bg-white/[0.06] px-1 py-0.5 font-medium">
                        {comment.trackName ?? 'Project'}
                      </span>
                      <span>·</span>
                      <span>{formatTime(comment.timestampSeconds)}</span>
                      {comment.isPinned && (
                        <>
                          <span>·</span>
                          <Pin className="h-2.5 w-2.5 text-violet-400" />
                        </>
                      )}
                    </div>
                  </div>
                  <p className="shrink-0 text-[10px] text-slate-600">
                    {formatRelativeDate(comment.createdAt)}
                  </p>
                </div>
                <p
                  className={[
                    'mt-1.5 line-clamp-2 text-sm leading-5',
                    isResolved ? 'text-slate-500' : 'text-slate-200',
                  ].join(' ')}
                >
                  {comment.body}
                </p>
                {(comment.replies.length > 0 || isResolved) && (
                  <div className="mt-1.5 flex items-center gap-2.5">
                    {comment.replies.length > 0 && (
                      <span className="text-[10px] text-slate-500">
                        {comment.replies.length}{' '}
                        {comment.replies.length === 1 ? 'reply' : 'replies'}
                      </span>
                    )}
                    {isResolved && (
                      <span className="flex items-center gap-0.5 text-[10px] text-emerald-500">
                        <Check className="h-2.5 w-2.5" />
                        Resolved
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

interface VersionListProps {
  versions: VersionDto[]
  canManageVersions: boolean
  onSelect: (id: string) => void
}

function VersionList({ versions, canManageVersions, onSelect }: VersionListProps) {
  if (versions.length === 0) {
    return (
      <p className="text-sm leading-6 text-slate-500">
        {canManageVersions
          ? 'No versions saved yet. Click “Save Version” to capture the current state.'
          : 'No versions saved yet.'}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {versions.map((v, idx) => (
        <article
          key={v.id}
          onClick={() => onSelect(v.id)}
          className="cursor-pointer rounded border border-white/10 bg-white/[0.025] p-3 transition hover:border-white/20 hover:bg-white/[0.045]"
        >
          <div className="flex items-start gap-2.5">
            <CommentAvatar name={v.creatorName} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-200">{v.name}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    v{versions.length - idx} · {v.creatorName}
                  </p>
                </div>
                <p className="shrink-0 text-[10px] text-slate-600">
                  {formatRelativeTime(v.createdAt)}
                </p>
              </div>
              {v.description && (
                <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-slate-400">
                  {v.description}
                </p>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

interface VersionDetailProps {
  version: VersionDto
  restoreConfirm: boolean
  restoreError: string | null
  isPending: boolean
  canRestore: boolean
  onRestoreClick: () => void
  onRestoreCancel: () => void
  onRestoreConfirm: () => void
}

function VersionDetail({
  version,
  restoreConfirm,
  restoreError,
  isPending,
  canRestore,
  onRestoreClick,
  onRestoreCancel,
  onRestoreConfirm,
}: VersionDetailProps) {
  return (
    <div className="space-y-4">
      {/* version metadata */}
      <div>
        <p className="text-sm font-semibold text-slate-100">{version.name}</p>
        {version.description && (
          <p className="mt-1.5 text-sm leading-5 text-slate-400">{version.description}</p>
        )}
        <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-500">
          <CommentAvatar name={version.creatorName} size="sm" />
          <span>{version.creatorName}</span>
          <span>·</span>
          <span>{formatRelativeTime(version.createdAt)}</span>
        </div>
      </div>

      {/* restore section — workspace members only */}
      {canRestore && (
        <div className="border-t border-white/[0.06] pt-4">
          {!restoreConfirm ? (
            <button
              type="button"
              onClick={onRestoreClick}
              disabled={isPending}
              className="w-full rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
            >
              Restore this version
            </button>
          ) : (
            <div className="rounded border border-amber-500/30 bg-amber-500/8 p-3">
              <p className="text-xs font-semibold text-amber-200">
                Restore &ldquo;{version.name}&rdquo;?
              </p>
              <p className="mt-1.5 text-xs leading-4 text-slate-400">
                Track mix settings will be updated to match this snapshot. A safety backup of the
                current state will be saved automatically first.
              </p>
              {restoreError && <p className="mt-2 text-xs text-red-300">{restoreError}</p>}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onRestoreCancel}
                  disabled={isPending}
                  className="flex-1 rounded border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onRestoreConfirm}
                  disabled={isPending}
                  className="flex-1 rounded bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50"
                >
                  {isPending ? 'Restoring…' : 'Confirm restore'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Activity feed

function formatActivityText(event: ActivityDto): string {
  const actor = event.actorName ?? 'Someone'
  const meta = event.metadata ?? {}

  switch (event.type) {
    case 'track.uploaded':
      return `${actor} uploaded ${String(meta.filename ?? meta.trackName ?? 'a track')}`
    case 'comment.created': {
      const ts = typeof meta.timestampSeconds === 'number' ? meta.timestampSeconds : null
      const timeStr = ts !== null ? ` at ${formatTime(ts)}` : ''
      return `${actor} commented${timeStr}`
    }
    case 'comment.replied':
      return `${actor} replied to a comment`
    case 'comment.resolved':
      return `${actor} resolved a comment`
    case 'comment.reopened':
      return `${actor} reopened a comment`
    case 'version.created':
      return `${actor} saved version "${String(meta.versionName ?? 'Untitled')}"`
    case 'version.restored':
      return `${actor} restored version "${String(meta.versionName ?? 'Untitled')}"`
    case 'share_link.created': {
      const level = meta.accessLevel === 'comment' ? 'comment' : 'view'
      return `${actor} created a ${level} share link`
    }
    case 'share_link.accessed': {
      const level = meta.accessLevel === 'comment' ? 'commenter' : 'reviewer'
      return `A ${level} joined via share link`
    }
    default:
      return `${actor} did something`
  }
}

function activityIsClickable(event: ActivityDto): boolean {
  return (
    (event.type === 'comment.created' ||
      event.type === 'comment.replied' ||
      event.type === 'comment.resolved' ||
      event.type === 'comment.reopened') &&
    event.targetId !== null
  )
}

function activityIsVersion(event: ActivityDto): boolean {
  return (
    (event.type === 'version.created' || event.type === 'version.restored') &&
    event.targetId !== null
  )
}

interface ActivityFeedProps {
  activity: ActivityDto[]
  onSelectComment: (commentId: string) => void
  onSelectVersion: (versionId: string) => void
}

function ActivityFeed({ activity, onSelectComment, onSelectVersion }: ActivityFeedProps) {
  if (activity.length === 0) {
    return (
      <p className="text-sm leading-6 text-slate-500">
        No activity yet. Actions like uploading tracks, leaving comments, and saving versions will
        appear here.
      </p>
    )
  }

  return (
    <div className="space-y-1">
      {activity.map((event) => {
        const clickable = activityIsClickable(event)
        const isVersion = activityIsVersion(event)
        const text = formatActivityText(event)

        function handleClick() {
          if (clickable && event.targetId) {
            onSelectComment(event.targetId)
          } else if (isVersion && event.targetId) {
            onSelectVersion(event.targetId)
          }
        }

        const interactive = clickable || isVersion

        return (
          <div
            key={event.id}
            onClick={interactive ? handleClick : undefined}
            className={[
              'flex items-start gap-2.5 rounded px-2 py-2 transition',
              interactive ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-default',
            ].join(' ')}
          >
            <CommentAvatar name={event.actorName ?? '?'} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-xs leading-5 text-slate-300">{text}</p>
              <p className="text-[10px] text-slate-600">{formatRelativeTime(event.createdAt)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────
// People tab

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  editor: 'Editor',
  commenter: 'Commenter',
  viewer: 'Viewer',
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-500/20 text-amber-200',
  editor: 'bg-violet-500/20 text-violet-200',
  commenter: 'bg-sky-500/20 text-sky-200',
  viewer: 'bg-slate-700/60 text-slate-300',
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold',
        ROLE_COLORS[role] ?? 'bg-white/10 text-slate-300',
      ].join(' ')}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

function daysUntil(isoString: string): number {
  const diff = new Date(isoString).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

interface PeopleTabProps {
  members: MemberDto[]
  invites: InviteDto[]
  shareLinks: ShareLinkDto[]
  currentUserId: string
  currentUserRole: WorkspaceMemberRole
  canInvite: boolean
  canManageLinks: boolean
  invitableRoles: WorkspaceMemberRole[]
  inviteEmail: string
  inviteRole: WorkspaceMemberRole
  inviteError: string | null
  shareLinkError: string | null
  memberActionError: string | null
  newInviteToken: string | null
  copiedToken: string | null
  newShareTokens: Record<string, string>
  copiedShareLinkId: string | null
  isInvitePending: boolean
  isRevokePending: boolean
  isShareLinkPending: boolean
  isShareRevokePending: boolean
  isMemberActionPending: boolean
  onEmailChange: (v: string) => void
  onRoleChange: (v: WorkspaceMemberRole) => void
  onSubmit: (e: React.FormEvent) => void
  onCopy: (token: string) => void
  onRevoke: (id: string) => void
  onDismissNewLink: () => void
  onRemoveMember: (userId: string) => void
  onUpdateMemberRole: (userId: string, role: WorkspaceMemberRole) => void
  onCreateShareLink: (accessLevel: 'view' | 'comment') => void
  onRevokeShareLink: (linkId: string, accessLevel: string) => void
  onCopyShareLink: (accessLevel: string, rawToken: string, linkId: string) => void
  onDismissShareToken: (accessLevel: string) => void
}

const ACCESS_LEVEL_LABELS: Record<string, string> = {
  view: 'View only',
  comment: 'Can comment',
}

function PeopleTab({
  members,
  invites,
  shareLinks,
  currentUserId,
  currentUserRole,
  canInvite,
  canManageLinks,
  invitableRoles,
  inviteEmail,
  inviteRole,
  inviteError,
  shareLinkError,
  memberActionError,
  newInviteToken,
  copiedToken,
  newShareTokens,
  copiedShareLinkId,
  isInvitePending,
  isRevokePending,
  isShareLinkPending,
  isShareRevokePending,
  isMemberActionPending,
  onEmailChange,
  onRoleChange,
  onSubmit,
  onCopy,
  onRevoke,
  onDismissNewLink,
  onRemoveMember,
  onUpdateMemberRole,
  onCreateShareLink,
  onRevokeShareLink,
  onCopyShareLink,
  onDismissShareToken,
}: PeopleTabProps) {
  const canManageMembers = currentUserRole === 'owner'
  const changeableRoles: WorkspaceMemberRole[] = ['editor', 'commenter', 'viewer']

  return (
    <div className="space-y-5">
      {/* Members list */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Members
        </p>
        {memberActionError && <p className="mb-2 text-xs text-red-300">{memberActionError}</p>}
        <div className="space-y-1.5">
          {members.map((m) => {
            const isCurrentUser = m.userId === currentUserId
            const isOwner = m.role === 'owner'
            const canEdit = canManageMembers && !isCurrentUser && !isOwner
            return (
              <div key={m.userId} className="flex items-center gap-2">
                <CommentAvatar name={m.displayName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-200">{m.displayName}</p>
                  <p className="truncate text-[10px] text-slate-500">{m.email}</p>
                </div>
                {canEdit ? (
                  <select
                    value={m.role}
                    onChange={(e) =>
                      onUpdateMemberRole(m.userId, e.target.value as WorkspaceMemberRole)
                    }
                    disabled={isMemberActionPending}
                    className="rounded border border-white/10 bg-[#09090f] px-1.5 py-1 text-[10px] text-slate-200 outline-none focus:border-[#7c3aed]/70 disabled:opacity-50"
                  >
                    {changeableRoles.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <RoleBadge role={m.role} />
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onRemoveMember(m.userId)}
                    disabled={isMemberActionPending}
                    title="Remove member"
                    className="shrink-0 text-slate-600 transition hover:text-red-300 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Invite form — owner/editor only */}
      {canInvite && (
        <div className="border-t border-white/[0.06] pt-4">
          <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <UserPlus className="h-3 w-3" />
            Invite someone
          </p>
          <form onSubmit={onSubmit} className="space-y-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="Email address"
              required
              disabled={isInvitePending}
              className="w-full rounded border border-white/10 bg-[#09090f] px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-[#7c3aed]/70"
            />
            <div className="flex gap-2">
              <select
                value={inviteRole}
                onChange={(e) => onRoleChange(e.target.value as WorkspaceMemberRole)}
                disabled={isInvitePending}
                className="flex-1 rounded border border-white/10 bg-[#09090f] px-2 py-2 text-xs text-slate-200 outline-none focus:border-[#7c3aed]/70"
              >
                {invitableRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={isInvitePending || !inviteEmail.trim()}
                className="rounded bg-[#7c3aed] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#8b5cf6] disabled:opacity-50"
              >
                {isInvitePending ? 'Sending…' : 'Send invite'}
              </button>
            </div>
            {inviteError && <p className="text-xs text-red-300">{inviteError}</p>}
          </form>

          {/* Newly created invite link */}
          {newInviteToken && (
            <div className="mt-3 rounded border border-emerald-500/30 bg-emerald-500/8 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                  <LinkIcon className="h-3 w-3" />
                  Invite link ready
                </p>
                <button
                  type="button"
                  onClick={onDismissNewLink}
                  className="text-slate-500 hover:text-slate-300"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => onCopy(newInviteToken)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
              >
                <Copy className="h-3 w-3" />
                {copiedToken === newInviteToken ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="border-t border-white/[0.06] pt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Pending invites
          </p>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-2 rounded border border-white/10 bg-white/[0.025] px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-200">{inv.email}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <RoleBadge role={inv.role} />
                    <span className="text-[10px] text-slate-600">
                      expires in {daysUntil(inv.expiresAt)}d
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onCopy(inv.token)}
                  title="Copy invite link"
                  className="shrink-0 text-slate-500 transition hover:text-slate-200"
                >
                  {copiedToken === inv.token ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                {canInvite && (
                  <button
                    type="button"
                    onClick={() => onRevoke(inv.id)}
                    disabled={isRevokePending}
                    title="Revoke invite"
                    className="shrink-0 text-slate-600 transition hover:text-red-300 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share links — owner/editor only */}
      {canManageLinks && (
        <div className="border-t border-white/[0.06] pt-4">
          <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <LinkIcon className="h-3 w-3" />
            Share links
          </p>

          {shareLinkError && <p className="mb-2 text-xs text-red-300">{shareLinkError}</p>}

          <div className="space-y-2">
            {(['view', 'comment'] as const).map((level) => {
              const existing = shareLinks.find((l) => l.accessLevel === level)
              const rawToken = newShareTokens[level]

              return (
                <div key={level} className="rounded border border-white/10 bg-white/[0.025] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200">
                      {ACCESS_LEVEL_LABELS[level]}
                    </span>
                    {existing ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-emerald-400">Active</span>
                        <button
                          type="button"
                          onClick={() => onRevokeShareLink(existing.id, level)}
                          disabled={isShareRevokePending}
                          className="text-[10px] text-slate-500 transition hover:text-red-300 disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onCreateShareLink(level)}
                        disabled={isShareLinkPending}
                        className="text-[10px] font-semibold text-violet-300 transition hover:text-violet-100 disabled:opacity-50"
                      >
                        {isShareLinkPending ? 'Creating…' : 'Create link'}
                      </button>
                    )}
                  </div>

                  {/* One-time raw token copy — shown only immediately after creation */}
                  {existing && rawToken && (
                    <div className="mt-2">
                      <div className="mb-1.5 flex items-center justify-between gap-1">
                        <p className="text-[10px] text-amber-300">
                          Copy now — won&apos;t be shown again
                        </p>
                        <button
                          type="button"
                          onClick={() => onDismissShareToken(level)}
                          className="text-slate-600 hover:text-slate-400"
                          aria-label="Dismiss"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => onCopyShareLink(level, rawToken, existing.id)}
                        className="flex w-full items-center justify-center gap-1.5 rounded border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20"
                      >
                        <Copy className="h-3 w-3" />
                        {copiedShareLinkId === existing.id ? 'Copied!' : 'Copy link'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
