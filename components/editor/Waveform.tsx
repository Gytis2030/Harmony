'use client'

import { useEffect, useRef } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { getOrComputePeaks } from '@/lib/audio/peaks'

interface Props {
  trackId: string
  audioBuffer: AudioBuffer
  zoom: number
  projectDuration: number
}

export default function Waveform({ trackId, audioBuffer, zoom, projectDuration }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widthPercent =
    projectDuration > 0 ? Math.min(100, (audioBuffer.duration / projectDuration) * 100) : 100

  useEffect(() => {
    if (!containerRef.current) return

    const peaks = getOrComputePeaks(trackId, audioBuffer)

    const ws = WaveSurfer.create({
      container: containerRef.current,
      peaks: [peaks],
      duration: audioBuffer.duration,
      height: 64,
      waveColor: 'hsl(var(--foreground) / 0.35)',
      progressColor: 'hsl(var(--foreground) / 0.15)',
      cursorWidth: 0,
      interact: false,
      normalize: true,
    })

    return () => {
      ws.destroy()
    }
  }, [trackId, audioBuffer, zoom, projectDuration])

  return (
    <div
      ref={containerRef}
      className="h-16 shrink-0 overflow-hidden rounded"
      style={{ width: `${widthPercent}%` }}
    />
  )
}
