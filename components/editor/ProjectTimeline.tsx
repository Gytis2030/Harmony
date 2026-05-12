'use client'

import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ProjectTransport from '@/components/editor/ProjectTransport'
import TrackRow from '@/components/editor/TrackRow'
import Playhead from '@/components/editor/Playhead'
import TimelineMarkers from '@/components/editor/TimelineMarkers'
import UploadWidget from '@/components/editor/UploadWidget'
import type { CommentDto } from '@/lib/actions/comments'

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
  commentMode: boolean
  selectedCommentId: string | null
  onProjectCommentTarget: (timestampSeconds: number) => void
  onTrackCommentTarget: (trackId: string, trackName: string, timestampSeconds: number) => void
  onCommentSelect: (commentId: string | null) => void
}

const ZOOM_LEVELS = [1, 1.5, 2, 3] as const
const TRACK_ACCENTS = ['#7c3aed', '#06b6d4', '#22c55e', '#f59e0b', '#ec4899', '#f97316']

function buildMarkers(duration: number): number[] {
  if (duration <= 0) return []
  const interval = duration <= 120 ? 10 : duration <= 600 ? 30 : 60
  const markers: number[] = []
  for (let seconds = 0; seconds <= duration; seconds += interval) {
    markers.push(seconds)
  }
  if (markers[markers.length - 1] !== duration) {
    markers.push(duration)
  }
  return markers
}

const TRACK_LABEL_WIDTH = 256

export default function ProjectTimeline({
  projectId,
  tracks,
  comments,
  bpm,
  timeSignature,
  commentMode,
  selectedCommentId,
  onProjectCommentTarget,
  onTrackCommentTarget,
  onCommentSelect,
}: Props) {
  const [zoomIndex, setZoomIndex] = useState(0)
  const [trackDurations, setTrackDurations] = useState<Record<string, number>>({})
  const [soloedTrackId, setSoloedTrackId] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)

  const zoom = ZOOM_LEVELS[zoomIndex]
  const hasAudioTracks = tracks.some((track) => track.audioFile)
  const duration = useMemo(
    () => Object.values(trackDurations).reduce((max, value) => Math.max(max, value), 0),
    [trackDurations]
  )

  const handleTrackLoaded = useCallback((trackId: string, nextDuration: number) => {
    setTrackDurations((current) => {
      if (current[trackId] === nextDuration) return current
      return { ...current, [trackId]: nextDuration }
    })
  }, [])

  const handleSoloChange = useCallback((trackId: string) => {
    setSoloedTrackId((current) => (current === trackId ? null : trackId))
  }, [])

  // Scroll selected comment's timestamp into view when zoom > 1
  useEffect(() => {
    if (!selectedCommentId || !scrollRef.current || duration <= 0 || zoom <= 1) return
    const comment = comments.find((c) => c.id === selectedCommentId)
    if (!comment) return

    const container = scrollRef.current
    const waveformWidth = container.scrollWidth - TRACK_LABEL_WIDTH
    const pinLeft = TRACK_LABEL_WIDTH + (comment.timestampSeconds / duration) * waveformWidth
    const targetLeft = pinLeft - container.clientWidth / 2
    container.scrollTo({ left: targetLeft, behavior: 'smooth' })
  }, [selectedCommentId, comments, duration, zoom])

  const canZoomOut = zoomIndex > 0
  const canZoomIn = zoomIndex < ZOOM_LEVELS.length - 1
  const markers = useMemo(() => buildMarkers(duration), [duration])
  const projectComments = comments.filter((comment) => comment.trackId === null)

  return (
    <section className="min-w-0 bg-[#08080d]">
      <div className="border-b border-white/10 bg-[#101018] px-4 py-3 sm:px-5">
        <ProjectTransport
          zoom={zoom}
          bpm={bpm}
          timeSignature={timeSignature}
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
          onZoomIn={() => setZoomIndex((value) => Math.min(value + 1, ZOOM_LEVELS.length - 1))}
          onZoomOut={() => setZoomIndex((value) => Math.max(value - 1, 0))}
        />
      </div>

      <div ref={scrollRef} className="h-[calc(100vh-9rem)] overflow-auto bg-[#08080d]">
        <div
          className="relative flex flex-col"
          style={
            {
              '--waveform-col-left': '256px',
              '--waveform-col-right': '0px',
              minWidth: `${zoom * 100}%`,
            } as CSSProperties
          }
        >
          <TimelineMarkers
            duration={duration}
            markers={markers}
            comments={projectComments}
            commentMode={commentMode}
            selectedCommentId={selectedCommentId}
            onCommentTarget={onProjectCommentTarget}
            onCommentSelect={onCommentSelect}
          />

          {hasAudioTracks && markers.length > 0 && (
            <div
              className="pointer-events-none absolute bottom-0 top-9 z-0"
              style={{
                left: 'var(--waveform-col-left)',
                right: 'var(--waveform-col-right)',
              }}
              aria-hidden="true"
            >
              {markers.map((seconds) => (
                <div
                  key={seconds}
                  className="absolute top-0 h-full border-l border-white/[0.045]"
                  style={{ left: `${(seconds / duration) * 100}%` }}
                />
              ))}
            </div>
          )}

          {tracks.map((track, index) =>
            track.audioFile ? (
              <TrackRow
                key={track.id}
                trackId={track.id}
                audioFileId={track.audioFile.id}
                trackName={track.name}
                originalFilename={track.audioFile.originalFilename}
                sizeBytes={track.audioFile.sizeBytes}
                initialVolume={track.volume}
                initialMuted={track.isMuted}
                soloed={soloedTrackId === track.id}
                accentColor={track.color ?? TRACK_ACCENTS[index % TRACK_ACCENTS.length]}
                zoom={zoom}
                projectDuration={duration}
                comments={comments.filter((comment) => comment.trackId === track.id)}
                commentMode={commentMode}
                selectedCommentId={selectedCommentId}
                onTrackLoaded={handleTrackLoaded}
                onSoloChange={handleSoloChange}
                onCommentTarget={onTrackCommentTarget}
                onCommentSelect={onCommentSelect}
              />
            ) : (
              <div
                key={track.id}
                className="relative z-10 grid min-h-24 grid-cols-[256px_minmax(560px,1fr)] border-b border-white/10"
              >
                <div className="sticky left-0 z-20 flex items-center border-r border-white/10 bg-[#101018] px-4">
                  <span className="truncate text-sm font-medium text-slate-200">{track.name}</span>
                </div>
                <div className="flex items-center px-5 text-xs uppercase tracking-wide text-slate-600">
                  No audio file
                </div>
              </div>
            )
          )}

          <div className="relative z-10 grid min-h-24 grid-cols-[256px_minmax(560px,1fr)] border-b border-white/10">
            <div className="sticky left-0 z-20 flex items-center border-r border-white/10 bg-[#101018] px-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Add track
              </span>
            </div>
            <div className="px-4 py-3">
              <UploadWidget projectId={projectId} />
            </div>
          </div>

          {hasAudioTracks && (
            <div
              className="pointer-events-none absolute inset-y-0 z-30"
              style={{
                left: 'var(--waveform-col-left)',
                right: 'var(--waveform-col-right)',
              }}
            >
              <Playhead />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
