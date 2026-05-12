'use client'

import { useEffect, useRef } from 'react'
import { audioEngine } from '@/lib/audio/audio-engine'

export default function Playhead() {
  const lineRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    function tick() {
      if (lineRef.current) {
        const pos = audioEngine.position
        const duration = audioEngine
          .loadedTrackIds()
          .reduce((max, id) => Math.max(max, audioEngine.getTrackDuration(id)), 0)

        if (duration > 0) {
          lineRef.current.style.left = `${(pos / duration) * 100}%`
          lineRef.current.style.display = ''
        } else {
          lineRef.current.style.display = 'none'
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div
      ref={lineRef}
      className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-[#a78bfa] shadow-[0_0_12px_rgba(167,139,250,0.65)]"
      style={{ display: 'none' }}
    />
  )
}
