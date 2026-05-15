'use client'

import { useEffect, useRef } from 'react'
import { audioEngine } from '@/lib/audio/audio-engine'

export default function Playhead() {
  const lineRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const widthRef = useRef<number>(0)

  // Track container width for pixel-perfect positioning (avoids sub-pixel thickness jitter).
  useEffect(() => {
    const parent = lineRef.current?.parentElement
    if (!parent) return
    widthRef.current = parent.clientWidth
    const observer = new ResizeObserver(([entry]) => {
      widthRef.current = entry.contentRect.width
    })
    observer.observe(parent)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    function tick() {
      if (lineRef.current) {
        const pos = audioEngine.position
        const duration = audioEngine
          .loadedTrackIds()
          .reduce((max, id) => Math.max(max, audioEngine.getTrackDuration(id)), 0)

        if (duration > 0) {
          const dpr = window.devicePixelRatio || 1
          const px = Math.round((pos / duration) * widthRef.current * dpr) / dpr
          lineRef.current.style.transform = `translateX(${px}px)`
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
      className="pointer-events-none absolute bottom-0 left-0 top-0 w-0.5 bg-[#a78bfa] shadow-[0_0_12px_rgba(167,139,250,0.65)] will-change-transform"
      style={{ display: 'none' }}
    />
  )
}
