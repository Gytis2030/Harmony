'use client'

import { MessageSquare } from 'lucide-react'
import { audioEngine } from '@/lib/audio/audio-engine'
import type { CommentDto } from '@/lib/actions/comments'

interface Props {
  duration: number
  markers: number[]
  comments: CommentDto[]
  commentMode: boolean
  onCommentTarget: (timestampSeconds: number) => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function TimelineMarkers({
  duration,
  markers,
  comments,
  commentMode,
  onCommentTarget,
}: Props) {
  const style = { marginLeft: 'var(--waveform-col-left)', marginRight: 'var(--waveform-col-right)' }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (duration <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    const timestampSeconds = Math.max(0, Math.min(ratio, 1)) * duration

    if (commentMode) {
      onCommentTarget(timestampSeconds)
      return
    }

    audioEngine.seek(timestampSeconds)
  }

  if (duration <= 0) {
    return (
      <div
        className="sticky top-0 z-20 h-9 border-b border-white/10 bg-[#0d0d15]"
        style={style}
        aria-hidden="true"
      />
    )
  }

  return (
    <div
      onClick={handleClick}
      className={[
        'sticky top-0 z-20 h-9 cursor-pointer border-b border-white/10 bg-[#0d0d15] text-[10px] tabular-nums text-slate-500',
        commentMode ? 'cursor-crosshair' : '',
      ].join(' ')}
      style={style}
      aria-label="Timeline ruler"
    >
      {markers.map((seconds) => (
        <div
          key={seconds}
          className="absolute top-0 flex h-full items-start border-l border-white/10 pl-1.5 pt-2"
          style={{ left: `${(seconds / duration) * 100}%` }}
        >
          {formatTime(seconds)}
        </div>
      ))}
      {comments.map((comment) => (
        <button
          key={comment.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            audioEngine.seek(comment.timestampSeconds)
          }}
          className="absolute top-1 z-20 inline-flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-white/20 bg-[#141421] text-violet-100 shadow-[0_0_14px_rgba(124,58,237,0.35)] transition hover:border-violet-300/60 hover:bg-[#7c3aed]"
          style={{ left: `${(comment.timestampSeconds / duration) * 100}%` }}
          aria-label={`Seek to project comment at ${formatTime(comment.timestampSeconds)}`}
          title={comment.body}
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}
