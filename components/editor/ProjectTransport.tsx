'use client'

import { useEffect, useRef, useState } from 'react'
import { audioEngine, type EngineState } from '@/lib/audio/audio-engine'
import { resumeAudioContext } from '@/lib/audio/audio-context'

interface Props {
  zoom: number
  canZoomIn: boolean
  canZoomOut: boolean
  onZoomIn: () => void
  onZoomOut: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable
  )
}

export default function ProjectTransport({
  zoom,
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
}: Props) {
  // Lazy initializer reads real engine state on first render — prevents stale
  // button state when the component remounts mid-session.
  const [engineState, setEngineState] = useState<EngineState>(() => audioEngine.state)
  const [masterVolume, setMasterVolume] = useState(1)

  const positionSpanRef = useRef<HTMLSpanElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const unsub = audioEngine.subscribe(setEngineState)
    return () => {
      unsub()
      audioEngine.unloadAllTracks()
    }
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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return

      if (e.code === 'Space') {
        e.preventDefault()
        handlePlayPause()
        return
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        audioEngine.seekBy(-5)
        return
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        audioEngine.seekBy(5)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  function handleMasterVolume(e: React.ChangeEvent<HTMLInputElement>) {
    const value = parseFloat(e.target.value)
    setMasterVolume(value)
    audioEngine.setMasterVolume(value)
  }

  const isLoading = engineState === 'loading'
  const isPlaying = engineState === 'playing'

  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
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
        <span className="text-xs text-gray-400">Zoom</span>
        <button
          onClick={onZoomOut}
          disabled={!canZoomOut}
          className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-50"
          aria-label="Zoom out"
        >
          -
        </button>
        <span className="w-10 text-center text-xs tabular-nums text-gray-500">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={onZoomIn}
          disabled={!canZoomIn}
          className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-50"
          aria-label="Zoom in"
        >
          +
        </button>
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
