'use client'

import { useState } from 'react'
import ProjectTimeline from '@/components/editor/ProjectTimeline'
import CollaborationSidebar, { type CommentTarget } from '@/components/editor/CollaborationSidebar'
import type { CommentDto, CommentReplyDto } from '@/lib/actions/comments'

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

  function startComment(target: CommentTarget) {
    setCommentMode(true)
    setTarget(target)
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
  }

  function handleCommentUpdated(comment: CommentDto) {
    setComments((current) =>
      current.map((item) =>
        item.id === comment.id
          ? {
              ...comment,
              replies: comment.replies.length > 0 ? comment.replies : item.replies,
            }
          : item
      )
    )
  }

  function handleCommentDeleted(commentId: string) {
    setComments((current) => current.filter((comment) => comment.id !== commentId))
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
        onProjectCommentTarget={(timestampSeconds) =>
          startComment({ trackId: null, trackName: null, timestampSeconds })
        }
        onTrackCommentTarget={(trackId, trackName, timestampSeconds) =>
          startComment({ trackId, trackName, timestampSeconds })
        }
      />

      <CollaborationSidebar
        projectId={projectId}
        comments={comments}
        commentMode={commentMode}
        target={target}
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
      />
    </div>
  )
}
