'use client'

import { useCallback, useMemo, useState } from 'react'
import ProjectTransport from '@/components/editor/ProjectTransport'
import TrackRow from '@/components/editor/TrackRow'
import Playhead from '@/components/editor/Playhead'
import TimelineMarkers from '@/components/editor/TimelineMarkers'

type Track = {
  id: string
  name: string
  volume: number
  isMuted: boolean
  audioFile: {
    id: string
  } | null
}

interface Props {
  tracks: Track[]
}

const ZOOM_LEVELS = [1, 1.5, 2, 3] as const

export default function ProjectTimeline({ tracks }: Props) {
  const [zoomIndex, setZoomIndex] = useState(0)
  const [trackDurations, setTrackDurations] = useState<Record<string, number>>({})

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

  const canZoomOut = zoomIndex > 0
  const canZoomIn = zoomIndex < ZOOM_LEVELS.length - 1

  return (
    <>
      {hasAudioTracks && (
        <ProjectTransport
          zoom={zoom}
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
          onZoomIn={() => setZoomIndex((value) => Math.min(value + 1, ZOOM_LEVELS.length - 1))}
          onZoomOut={() => setZoomIndex((value) => Math.max(value - 1, 0))}
        />
      )}

      {/*
        The inner content grows with zoom. Labels and controls remain fixed-width,
        so the waveform column expands and stays aligned with markers/playhead.
      */}
      <div className="overflow-x-auto pb-2">
        <div
          className="relative flex flex-col gap-2"
          style={
            {
              '--waveform-col-left': '204px',
              '--waveform-col-right': '204px',
              minWidth: `${zoom * 100}%`,
            } as React.CSSProperties
          }
        >
          {hasAudioTracks && <TimelineMarkers duration={duration} />}

          {tracks.map((track) =>
            track.audioFile ? (
              <TrackRow
                key={track.id}
                trackId={track.id}
                audioFileId={track.audioFile.id}
                trackName={track.name}
                initialVolume={track.volume}
                initialMuted={track.isMuted}
                zoom={zoom}
                projectDuration={duration}
                onTrackLoaded={handleTrackLoaded}
              />
            ) : (
              <div
                key={track.id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3"
              >
                <span className="font-medium">{track.name}</span>
                <span className="ml-auto text-xs text-gray-400">No audio file</span>
              </div>
            )
          )}

          {hasAudioTracks && (
            <div
              className="pointer-events-none absolute bottom-0 top-8"
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
    </>
  )
}
