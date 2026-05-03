'use client'

import { useEffect, useRef, useState } from 'react'
import { audioEngine, type EngineState } from '@/lib/audio/audio-engine'
import { resumeAudioContext } from '@/lib/audio/audio-context'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function ProjectTransport() {
  const [engineState, setEngineState] = useState<EngineState>('idle')
  const [masterVolume, setMasterVolume] = useState(1)

  const positionSpanRef = useRef<HTMLSpanElement>(null)
  const rafRef = useRef<number>(0)

  // Mirror engine state for button rendering
  useEffect(() => {
    return audioEngine.subscribe(setEngineState)
  }, [])

  // RAF loop: update position display directly in the DOM to avoid re-rendering
  // the React tree on every frame.
  useEffect(() => {
    function tick() {
      if (positionSpanRef.current) {
        const pos = audioEngine.position
        const total = audioEngine
          .loadedTrackIds()
          .reduce((max, id) => Math.max(max, audioEngine.getTrackDuration(id)), 0)
        positionSpanRef.current.textContent =
          total > 0 ? `${formatTime(pos)} / ${formatTime(total)}` : formatTime(pos)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  function handlePlayPause() {
    if (engineState === 'playing') {
      audioEngine.pause()
    } else {
      resumeAudioContext()
      audioEngine.play()
    }
  }

  function handleMasterVolume(e: React.ChangeEvent<HTMLInputElement>) {
    const value = parseFloat(e.target.value)
    setMasterVolume(value)
    audioEngine.setMasterVolume(value)
  }

  const isLoading = engineState === 'loading'
  const isPlaying = engineState === 'playing'

  return (
    <div className="mb-6 flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <button
        onClick={handlePlayPause}
        disabled={isLoading}
        className="rounded bg-gray-800 px-4 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {isLoading ? 'Loading…' : isPlaying ? 'Pause' : 'Play'}
      </button>

      <button
        onClick={() => audioEngine.stop()}
        disabled={isLoading || engineState === 'idle'}
        className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-50"
      >
        Stop
      </button>

      <span
        ref={positionSpanRef}
        className="min-w-[90px] font-mono text-sm tabular-nums text-gray-600"
      >
        0:00
      </span>

      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-gray-400">Master</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={masterVolume}
          onChange={handleMasterVolume}
          className="w-24"
          aria-label="Master volume"
        />
      </div>
    </div>
  )
}
