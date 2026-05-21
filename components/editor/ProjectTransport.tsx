'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Minus, Pause, Play, Plus, Square } from 'lucide-react'
import { audioEngine, type EngineState } from '@/lib/audio/audio-engine'
import { resumeAudioContext } from '@/lib/audio/audio-context'
import { updateProjectTempo } from '@/lib/actions/projects'

interface Props {
  projectId: string
  zoom: number
  bpm: number | null
  timeSignature: string
  canEditTempo?: boolean
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
  projectId,
  zoom,
  bpm,
  timeSignature,
  canEditTempo = false,
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
}: Props) {
  const volumeKey = `harmony:project:${projectId}:masterVolume`

  // Parse timeSignature string "4/4" into parts
  const [tsNum, tsDen] = timeSignature.split('/').map(Number)

  // Tempo edit state
  const [tempoEditing, setTempoEditing] = useState(false)
  const [editBpm, setEditBpm] = useState<string>(bpm !== null ? String(bpm) : '')
  const [editTsNum, setEditTsNum] = useState<number>(tsNum || 4)
  const [editTsDen, setEditTsDen] = useState<number>(tsDen || 4)
  const [tempoSaving, setTempoSaving] = useState(false)

  async function handleTempoSave() {
    setTempoSaving(true)
    try {
      const parsed = editBpm.trim() ? parseInt(editBpm, 10) : null
      await updateProjectTempo({
        projectId,
        bpm: parsed && !isNaN(parsed) ? parsed : null,
        timeSignatureNumerator: editTsNum,
        timeSignatureDenominator: editTsDen,
      })
    } finally {
      setTempoSaving(false)
      setTempoEditing(false)
    }
  }

  // Lazy initializer reads real engine state on first render — prevents stale
  // button state when the component remounts mid-session.
  const [engineState, setEngineState] = useState<EngineState>(() => audioEngine.state)
  const [masterVolume, setMasterVolume] = useState(() => {
    try {
      const stored = localStorage.getItem(`harmony:project:${projectId}:masterVolume`)
      return stored !== null ? parseFloat(stored) : 1
    } catch {
      return 1
    }
  })

  const positionSpanRef = useRef<HTMLSpanElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const unsub = audioEngine.subscribe(setEngineState)
    return () => {
      unsub()
      audioEngine.unloadAllTracks()
    }
  }, [])

  // Apply persisted volume to engine on mount and whenever it changes.
  useEffect(() => {
    audioEngine.setMasterVolume(masterVolume)
    try {
      localStorage.setItem(volumeKey, String(masterVolume))
    } catch {
      // localStorage may be unavailable (private browsing, quota exceeded)
    }
  }, [masterVolume, volumeKey])

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
    setMasterVolume(parseFloat(e.target.value))
  }

  const isLoading = engineState === 'loading'
  const isPlaying = engineState === 'playing'

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* Playback controls */}
      <div className="flex items-center overflow-hidden rounded-lg border border-white/[0.08] bg-black/25">
        <button
          onClick={handlePlayPause}
          disabled={isLoading}
          className="inline-flex h-9 w-11 items-center justify-center bg-violet-600 text-white transition hover:bg-violet-500 disabled:opacity-50"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <span className="h-2 w-2 rounded-full bg-white opacity-70" />
          ) : isPlaying ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current" />
          )}
        </button>
        <button
          onClick={() => audioEngine.stop()}
          disabled={isLoading || engineState === 'idle'}
          className="inline-flex h-9 w-9 items-center justify-center border-l border-white/[0.08] text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-200 disabled:opacity-30"
          aria-label="Stop"
        >
          <Square className="h-3 w-3 fill-current" />
        </button>
      </div>

      {/* Position */}
      <span
        ref={positionSpanRef}
        className="min-w-[96px] rounded-lg border border-white/[0.08] bg-black/25 px-3 py-1.5 font-mono text-sm tabular-nums text-slate-200"
      >
        0:00
      </span>

      {/* Tempo */}
      {tempoEditing && canEditTempo ? (
        <div className="flex items-center gap-2 rounded-lg border border-violet-500/30 bg-black/25 px-3 py-1.5 text-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            Tempo
          </span>
          <input
            type="number"
            min={20}
            max={300}
            value={editBpm}
            onChange={(e) => setEditBpm(e.target.value)}
            placeholder="BPM"
            className="w-14 rounded border border-white/[0.1] bg-[#09090f] px-2 py-1 text-xs tabular-nums text-slate-100 outline-none focus:border-violet-500/50"
            autoFocus
          />
          <select
            value={editTsNum}
            onChange={(e) => setEditTsNum(Number(e.target.value))}
            className="rounded border border-white/[0.1] bg-[#09090f] px-1.5 py-1 text-xs text-slate-200 outline-none focus:border-violet-500/50"
          >
            {[2, 3, 4, 5, 6, 7, 9, 12].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-slate-700">/</span>
          <select
            value={editTsDen}
            onChange={(e) => setEditTsDen(Number(e.target.value))}
            className="rounded border border-white/[0.1] bg-[#09090f] px-1.5 py-1 text-xs text-slate-200 outline-none focus:border-violet-500/50"
          >
            {[2, 4, 8, 16].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleTempoSave}
            disabled={tempoSaving}
            className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
            {tempoSaving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setTempoEditing(false)}
            className="text-slate-600 hover:text-slate-300"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div
          onClick={
            canEditTempo
              ? () => {
                  setEditBpm(bpm !== null ? String(bpm) : '')
                  setEditTsNum(tsNum || 4)
                  setEditTsDen(tsDen || 4)
                  setTempoEditing(true)
                }
              : undefined
          }
          className={[
            'flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-black/20 px-3 py-1.5 text-xs',
            canEditTempo
              ? 'cursor-pointer hover:border-white/[0.14] hover:bg-white/[0.04]'
              : 'opacity-70',
          ].join(' ')}
          title={canEditTempo ? 'Click to set tempo' : undefined}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            Tempo
          </span>
          <span className="tabular-nums text-slate-300">{bpm ? `${bpm} BPM` : '— BPM'}</span>
          <span className="text-slate-700">/</span>
          <span className="tabular-nums text-slate-300">{timeSignature}</span>
        </div>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2.5">
        {/* Zoom controls */}
        <div className="flex items-center gap-1 rounded-lg border border-white/[0.07] bg-black/20 px-2 py-1">
          <span className="pr-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            Zoom
          </span>
          <button
            onClick={onZoomOut}
            disabled={!canZoomOut}
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-white/[0.08] text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-200 disabled:opacity-30"
            aria-label="Zoom out"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="w-9 text-center text-[11px] tabular-nums text-slate-500">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={onZoomIn}
            disabled={!canZoomIn}
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-white/[0.08] text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-200 disabled:opacity-30"
            aria-label="Zoom in"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {/* Master volume */}
        <label className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-black/20 px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            Master
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={masterVolume}
            onChange={handleMasterVolume}
            className="h-1 w-20 accent-[#7c3aed]"
            aria-label="Master volume"
          />
        </label>
      </div>
    </div>
  )
}
