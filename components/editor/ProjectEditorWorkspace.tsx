'use client'

import { useEffect, useState } from 'react'
import ProjectTimeline from '@/components/editor/ProjectTimeline'
import CollaborationSidebar, { type CommentTarget } from '@/components/editor/CollaborationSidebar'
import type { CommentDto, CommentReplyDto } from '@/lib/actions/comments'
import { audioEngine } from '@/lib/audio/audio-engine'

type Track = {
  id: string
  name: string
  volume: number
  isMuted: boolean
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
  tracks: Track[]
  comments: CommentDto[]
  bpm: number | null
  timeSignature: string
}

export default function ProjectEditorWorkspace({
  projectId,
  tracks,
  comments: initialComments,
  bpm,
  timeSignature,
}: Props) {
  const [comments, setComments] = useState(initialComments)
  const [commentMode, setCommentMode] = useState(false)
  const [target, setTarget] = useState<CommentTarget | null>(null)
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null)

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

  return (
    <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px]">
      <ProjectTimeline
        projectId={projectId}
        tracks={tracks}
        comments={comments}
        bpm={bpm}
        timeSignature={timeSignature}
        commentMode={commentMode}
        selectedCommentId={selectedCommentId}
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
      />
    </div>
  )
}
