'use client'

import { useState, useTransition } from 'react'
import { Check, MessageSquarePlus, Pin, Plus, Reply, Trash2, X } from 'lucide-react'
import {
  createComment,
  createCommentReply,
  deleteComment,
  setCommentPinned,
  setCommentStatus,
  type CommentDto,
  type CommentReplyDto,
} from '@/lib/actions/comments'
import { audioEngine } from '@/lib/audio/audio-engine'

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
  onStartCommentMode: () => void
  onCancelComment: () => void
  onTargetChange: (target: CommentTarget) => void
  onCommentCreated: (comment: CommentDto) => void
  onCommentUpdated: (comment: CommentDto) => void
  onCommentDeleted: (commentId: string) => void
  onReplyCreated: (reply: CommentReplyDto) => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function CollaborationSidebar({
  projectId,
  comments,
  commentMode,
  target,
  onStartCommentMode,
  onCancelComment,
  onTargetChange,
  onCommentCreated,
  onCommentUpdated,
  onCommentDeleted,
  onReplyCreated,
}: Props) {
  const [body, setBody] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAddAtPlayhead() {
    onTargetChange({
      trackId: null,
      trackName: null,
      timestampSeconds: audioEngine.position,
    })
  }

  function handleCancel() {
    setBody('')
    setError(null)
    onCancelComment()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!target) return

    startTransition(async () => {
      setError(null)
      try {
        const comment = await createComment({
          projectId,
          trackId: target.trackId,
          timestampSeconds: target.timestampSeconds,
          body,
        })
        onCommentCreated(comment)
        setBody('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save comment.')
      }
    })
  }

  function handleStatus(comment: CommentDto, status: 'open' | 'resolved') {
    startTransition(async () => {
      setError(null)
      try {
        const updated = await setCommentStatus({ commentId: comment.id, status })
        onCommentUpdated(updated)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update comment.')
      }
    })
  }

  function handleDelete(comment: CommentDto) {
    startTransition(async () => {
      setError(null)
      try {
        const deleted = await deleteComment(comment.id)
        onCommentDeleted(deleted.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not delete comment.')
      }
    })
  }

  function handlePinned(comment: CommentDto) {
    startTransition(async () => {
      setError(null)
      try {
        const updated = await setCommentPinned({
          commentId: comment.id,
          isPinned: !comment.isPinned,
        })
        onCommentUpdated(updated)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update pin.')
      }
    })
  }

  function handleReplySubmit(e: React.FormEvent, comment: CommentDto) {
    e.preventDefault()

    startTransition(async () => {
      setError(null)
      try {
        const reply = await createCommentReply({ commentId: comment.id, body: replyBody })
        onReplyCreated(reply)
        setReplyBody('')
        setReplyingToId(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save reply.')
      }
    })
  }

  function sortForSidebar(a: CommentDto, b: CommentDto) {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    return a.timestampSeconds - b.timestampSeconds
  }

  const openComments = comments.filter((comment) => comment.status === 'open').sort(sortForSidebar)
  const resolvedComments = comments
    .filter((comment) => comment.status === 'resolved')
    .sort(sortForSidebar)

  return (
    <aside className="border-t border-white/10 bg-[#0b0b11] xl:border-l xl:border-t-0">
      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Collaboration
        </p>
      </div>

      <div className="space-y-6 px-5 py-5">
        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-200">Comments</h2>
            {commentMode ? (
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-white/10 text-slate-400 transition hover:bg-white/5 hover:text-white"
                aria-label="Cancel comment"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartCommentMode}
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#7c3aed]/50 bg-[#7c3aed]/20 text-violet-100 transition hover:bg-[#7c3aed]/30"
                aria-label="Add comment"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleAddAtPlayhead}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
          >
            <MessageSquarePlus className="h-4 w-4" />
            Add at playhead
          </button>

          {commentMode && !target && (
            <p className="mt-3 rounded border border-violet-400/30 bg-violet-400/10 px-3 py-2 text-sm leading-5 text-violet-100">
              Click the ruler for a project note or a track lane for a track note.
            </p>
          )}

          {target && (
            <form
              onSubmit={handleSubmit}
              className="mt-4 rounded border border-white/10 bg-black/25 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="min-w-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
              />
              {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
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
                  Save
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="space-y-3">
          {openComments.length === 0 && (
            <p className="text-sm leading-6 text-slate-500">No open comments yet.</p>
          )}

          {openComments.map((comment) => (
            <article
              key={comment.id}
              className="rounded border border-white/10 bg-white/[0.03] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {comment.isPinned ? 'Pinned / ' : ''}
                    {comment.trackName ?? 'Project'} / {formatTime(comment.timestampSeconds)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{comment.authorName}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handlePinned(comment)}
                    disabled={isPending}
                    className={[
                      'inline-flex h-7 w-7 items-center justify-center rounded border border-white/10 disabled:opacity-50',
                      comment.isPinned
                        ? 'bg-violet-400/15 text-violet-100 hover:bg-violet-400/25'
                        : 'text-slate-400 hover:bg-violet-400/10 hover:text-violet-200',
                    ].join(' ')}
                    aria-label={comment.isPinned ? 'Unpin comment' : 'Pin comment'}
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setReplyBody('')
                      setReplyingToId((current) => (current === comment.id ? null : comment.id))
                    }}
                    disabled={isPending}
                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200 disabled:opacity-50"
                    aria-label="Reply to comment"
                  >
                    <Reply className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatus(comment, 'resolved')}
                    disabled={isPending}
                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-white/10 text-slate-400 hover:bg-emerald-400/10 hover:text-emerald-200 disabled:opacity-50"
                    aria-label="Resolve comment"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(comment)}
                    disabled={isPending}
                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-white/10 text-slate-400 hover:bg-red-400/10 hover:text-red-200 disabled:opacity-50"
                    aria-label="Delete comment"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-5 text-slate-200">
                {comment.body}
              </p>

              {comment.replies.length > 0 && (
                <div className="mt-3 space-y-2 border-l border-white/10 pl-3">
                  {comment.replies.map((reply) => (
                    <div key={reply.id}>
                      <p className="text-xs font-medium text-slate-500">{reply.authorName}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-slate-300">
                        {reply.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {replyingToId === comment.id && (
                <form onSubmit={(e) => handleReplySubmit(e, comment)} className="mt-3">
                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    className="w-full resize-none rounded border border-white/10 bg-[#09090f] px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-[#7c3aed]/70"
                    placeholder="Write a reply..."
                    disabled={isPending}
                  />
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyBody('')
                        setReplyingToId(null)
                      }}
                      className="rounded border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/5 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPending || replyBody.trim().length === 0}
                      className="rounded bg-[#7c3aed] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#8b5cf6] disabled:opacity-50"
                    >
                      Reply
                    </button>
                  </div>
                </form>
              )}
            </article>
          ))}
        </section>

        {resolvedComments.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-200">Resolved</h2>
            <div className="mt-3 space-y-2">
              {resolvedComments.map((comment) => (
                <div
                  key={comment.id}
                  className="flex items-center gap-2 rounded border border-white/10 bg-white/[0.02] px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => handleStatus(comment, 'open')}
                    disabled={isPending}
                    className="min-w-0 flex-1 truncate text-left text-xs text-slate-500 transition hover:text-slate-300 disabled:opacity-50"
                  >
                    {comment.isPinned ? 'Pinned / ' : ''}
                    {formatTime(comment.timestampSeconds)} / {comment.body}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePinned(comment)}
                    disabled={isPending}
                    className={[
                      'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/10 disabled:opacity-50',
                      comment.isPinned
                        ? 'bg-violet-400/15 text-violet-100 hover:bg-violet-400/25'
                        : 'text-slate-500 hover:bg-violet-400/10 hover:text-violet-200',
                    ].join(' ')}
                    aria-label={
                      comment.isPinned ? 'Unpin resolved comment' : 'Pin resolved comment'
                    }
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(comment)}
                    disabled={isPending}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/10 text-slate-500 hover:bg-red-400/10 hover:text-red-200 disabled:opacity-50"
                    aria-label="Delete resolved comment"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold text-slate-200">Versions</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Mix notes and stem revisions will be grouped here.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-200">Activity</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Uploads, comments, and approvals will appear as a project log.
          </p>
        </section>
      </div>
    </aside>
  )
}
