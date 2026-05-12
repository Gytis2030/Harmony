'use client'

import type { CSSProperties } from 'react'
import { useEffect, useRef } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { getOrComputePeaks } from '@/lib/audio/peaks'

interface Props {
  trackId: string
  audioBuffer: AudioBuffer
  zoom: number
  projectDuration: number
  accentColor: string
}

export default function Waveform({
  trackId,
  audioBuffer,
  zoom,
  projectDuration,
  accentColor,
}: Props) {
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
      waveColor: accentColor,
      progressColor: 'rgba(255, 255, 255, 0.25)',
      cursorWidth: 0,
      interact: false,
      normalize: true,
    })

    return () => {
      ws.destroy()
    }
  }, [trackId, audioBuffer, zoom, projectDuration, accentColor])

  return (
    <div
      className="relative h-[68px] shrink-0 overflow-hidden rounded-md border bg-black/30 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
      style={
        {
          width: `${widthPercent}%`,
          borderColor: `${accentColor}66`,
          backgroundColor: `${accentColor}12`,
        } as CSSProperties
      }
    >
      <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: accentColor }} />
      <div ref={containerRef} className="h-full pl-2" />
    </div>
  )
}
