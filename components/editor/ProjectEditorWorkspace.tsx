'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Circle } from 'lucide-react'
import ProjectTimeline from '@/components/editor/ProjectTimeline'
import CollaborationSidebar, { type CommentTarget } from '@/components/editor/CollaborationSidebar'
import PresenceAvatars from '@/components/editor/PresenceAvatars'
import type { CommentDto, CommentReplyDto } from '@/lib/actions/comments'
import { fetchProjectComments } from '@/lib/actions/comments'
import type { RestoredTrackMix, VersionDto } from '@/lib/actions/versions'
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

interface Props {
  projectId: string
  projectName: string
  tracks: Track[]
  comments: CommentDto[]
  versions: VersionDto[]
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

// Inner component: lives inside RoomProvider so it can use Liveblocks hooks.
function ProjectEditorInner({
  projectId,
  projectName,
  tracks: initialTracks,
  comments: initialComments,
  versions: initialVersions,
  bpm,
  timeSignature,
}: Props) {
  const router = useRouter()
  const [comments, setComments] = useState(initialComments)
  const [versions, setVersions] = useState(initialVersions)
  const [tracks, setTracks] = useState(initialTracks)
  const [soloedTrackId, setSoloedTrackId] = useState<string | null>(
    () => initialTracks.find((t) => t.isSoloed)?.id ?? null
  )
  const [commentMode, setCommentMode] = useState(false)
  const [target, setTarget] = useState<CommentTarget | null>(null)
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null)

  // When router.refresh() brings updated server data (e.g. after a new upload), sync tracks state.
  useEffect(() => {
    setTracks(initialTracks)
  }, [initialTracks])

  // When another collaborator mutates comments, re-fetch from DB.
  // Liveblocks does not echo events back to the sender, so only remote changes
  // trigger this path — the local user's optimistic state is unaffected.
  useEventListener(({ event }) => {
    if (event.projectId !== projectId) return
    fetchProjectComments(projectId)
      .then((fresh) => setComments(fresh))
      .catch(() => {})
  })

  // Escape cancels comment mode (skip if a text field is focused)
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

  function handleCommentCreated(comment: CommentDto) {
    setComments((current) =>
      [...current, comment].sort((a, b) => a.timestampSeconds - b.timestampSeconds)
    )
    cancelComment()
    setSelectedCommentId(comment.id)
  }

  function handleCommentUpdated(comment: CommentDto) {
    setComments((current) =>
      current.map((item) =>
        item.id === comment.id
          ? { ...comment, replies: comment.replies.length > 0 ? comment.replies : item.replies }
          : item
      )
    )
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
  }

  function handleVersionCreated(version: VersionDto) {
    setVersions((current) => [version, ...current])
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

        <PresenceAvatars />
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
          onSoloChange={(trackId) =>
            setSoloedTrackId((current) => (current === trackId ? null : trackId))
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
          comments={comments}
          commentMode={commentMode}
          target={target}
          selectedCommentId={selectedCommentId}
          versions={versions}
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
        />
      </div>
    </>
  )
}
