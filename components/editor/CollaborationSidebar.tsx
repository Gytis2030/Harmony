'use client'

import { useState, useTransition } from 'react'
import { ArrowLeft, Check, MessageSquarePlus, Pin, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import {
  createComment,
  createCommentReply,
  deleteComment,
  setCommentPinned,
  setCommentStatus,
  type CommentDto,
  type CommentReplyDto,
} from '@/lib/actions/comments'
import {
  filterComments,
  sortComments,
  countByFilter,
  type CommentFilter,
} from '@/lib/comments/filter'
import { audioEngine } from '@/lib/audio/audio-engine'
import { useBroadcastEvent } from '@/lib/realtime/liveblocks'

export type CommentTarget = {
  trackId: string | null
  trackName: string | null
  timestampSeconds: number
}

interface Props {
  projectId: string
  comments: CommentDto[]
  commentMode: boolean
  target: CommentTarget | null
  selectedCommentId: string | null
  onStartCommentMode: () => void
  onCancelComment: () => void
  onTargetChange: (target: CommentTarget) => void
  onCommentCreated: (comment: CommentDto) => void
  onCommentUpdated: (comment: CommentDto) => void
  onCommentDeleted: (commentId: string) => void
  onReplyCreated: (reply: CommentReplyDto) => void
  onCommentSelect: (commentId: string | null) => void
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
  comments,
  commentMode,
  target,
  selectedCommentId,
  onStartCommentMode,
  onCancelComment,
  onTargetChange,
  onCommentCreated,
  onCommentUpdated,
  onCommentDeleted,
  onReplyCreated,
  onCommentSelect,
}: Props) {
  const [filter, setFilter] = useState<CommentFilter>('open')
  const [body, setBody] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [composeError, setComposeError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [replyError, setReplyError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const broadcast = useBroadcastEvent()

  const counts = countByFilter(comments)
  const selectedComment = selectedCommentId
    ? (comments.find((c) => c.id === selectedCommentId) ?? null)
    : null

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

  const isThreadView = !target && !!selectedComment
  const isListView = !target && !selectedComment

  const filteredSorted = sortComments(filterComments(comments, filter))

  return (
    <aside className="flex flex-col border-t border-white/10 bg-[#0b0b11] xl:border-l xl:border-t-0">
      {/* ── sticky header ── */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0b0b11]">
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
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-200">Comments</span>
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-400">
                {counts.all}
              </span>
            </div>
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
          ) : !isThreadView ? (
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
      </div>

      {/* ── scrollable body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 px-4 py-4">
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
              onSelect={onCommentSelect}
            />
          )}

          {/* placeholders – always at bottom of list view */}
          {isListView && (
            <>
              <section className="border-t border-white/[0.06] pt-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Versions
                </h2>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  Mix notes and stem revisions will appear here.
                </p>
              </section>

              <section className="border-t border-white/[0.06] pt-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Activity
                </h2>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  Uploads, comments, and approvals will appear as a project log.
                </p>
              </section>
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

      {/* reply form */}
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

      {/* actions row */}
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
    </div>
  )
}

interface CommentListProps {
  comments: CommentDto[]
  filter: CommentFilter
  selectedCommentId: string | null
  actionError: string | null
  onSelect: (id: string) => void
}

function CommentList({
  comments,
  filter,
  selectedCommentId,
  actionError,
  onSelect,
}: CommentListProps) {
  if (comments.length === 0) {
    const emptyMessages: Record<CommentFilter, string> = {
      open: 'No open comments yet. Click + to leave a note.',
      resolved: 'No resolved comments.',
      all: 'No comments yet. Click + to leave the first note.',
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
