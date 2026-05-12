'use client'

import { useEffect, useReducer, useRef } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { audioEngine, type EngineState } from '@/lib/audio/audio-engine'
import { updateTrackMix } from '@/lib/actions/tracks'
import Waveform from '@/components/editor/Waveform'

interface Props {
  trackId: string
  audioFileId: string
  trackName: string
  originalFilename: string
  sizeBytes: number
  initialVolume: number
  initialMuted: boolean
  soloed: boolean
  accentColor: string
  zoom: number
  projectDuration: number
  onTrackLoaded: (trackId: string, duration: number) => void
  onSoloChange: (trackId: string) => void
}

interface RowState {
  engineState: EngineState
  volume: number
  muted: boolean
  loadError: string | null
  audioBuffer: AudioBuffer | null
}

type Action =
  | { type: 'engine_state'; payload: EngineState }
  | { type: 'set_volume'; payload: number }
  | { type: 'toggle_mute' }
  | { type: 'load_error'; payload: string }
  | { type: 'load_success'; payload: AudioBuffer }

function reducer(state: RowState, action: Action): RowState {
  switch (action.type) {
    case 'engine_state':
      return { ...state, engineState: action.payload }
    case 'set_volume':
      return { ...state, volume: action.payload }
    case 'toggle_mute':
      return { ...state, muted: !state.muted }
    case 'load_error':
      return { ...state, engineState: 'idle', loadError: action.payload }
    case 'load_success':
      return { ...state, audioBuffer: action.payload }
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function TrackRow({
  trackId,
  audioFileId,
  trackName,
  originalFilename,
  sizeBytes,
  initialVolume,
  initialMuted,
  soloed,
  accentColor,
  zoom,
  projectDuration,
  onTrackLoaded,
  onSoloChange,
}: Props) {
  const [state, dispatch] = useReducer(reducer, {
    engineState: 'idle',
    volume: initialVolume,
    muted: initialMuted,
    loadError: null,
    audioBuffer: null,
  })

  const mountedRef = useRef(true)
  const didMountVolumeRef = useRef(false)
  const timelineRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    return audioEngine.subscribe((s) => dispatch({ type: 'engine_state', payload: s }))
  }, [])

  // Fetch signed URL and decode on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/tracks/${trackId}/url`)
        if (!res.ok) throw new Error(`Failed to get signed URL (${res.status})`)
        const { url } = (await res.json()) as { url: string }
        const buffer = await audioEngine.loadTrack(trackId, audioFileId, url)
        if (mountedRef.current) {
          dispatch({ type: 'load_success', payload: buffer })
          onTrackLoaded(trackId, buffer.duration)
        }
      } catch (err) {
        if (mountedRef.current) {
          dispatch({
            type: 'load_error',
            payload: err instanceof Error ? err.message : 'Load failed',
          })
        }
      }
    }
    load()
  }, [trackId, audioFileId, onTrackLoaded])

  useEffect(() => {
    audioEngine.setVolume(trackId, initialVolume)
    audioEngine.setMuted(trackId, initialMuted)
  }, [trackId, initialVolume, initialMuted])

  useEffect(() => {
    if (!didMountVolumeRef.current) {
      didMountVolumeRef.current = true
      return
    }

    const timeout = window.setTimeout(() => {
      void updateTrackMix({ trackId, volume: state.volume })
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [trackId, state.volume])

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = parseFloat(e.target.value)
    dispatch({ type: 'set_volume', payload: value })
    audioEngine.setVolume(trackId, value)
  }

  function handleMuteToggle() {
    const next = !state.muted
    dispatch({ type: 'toggle_mute' })
    audioEngine.setMuted(trackId, next)
    void updateTrackMix({ trackId, isMuted: next })
  }

  function handleSoloToggle() {
    const next = !soloed
    audioEngine.setSoloed(trackId, next)
    onSoloChange(trackId)
  }

  function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!timelineRef.current || projectDuration <= 0) return
    const rect = timelineRef.current.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    audioEngine.seek(Math.max(0, Math.min(ratio, 1)) * projectDuration)
  }

  const isLoading = state.engineState === 'loading'
  const durationLabel = state.audioBuffer ? formatDuration(state.audioBuffer.duration) : '--:--'

  return (
    <div className="relative z-10 grid min-h-24 grid-cols-[256px_minmax(560px,1fr)] border-b border-white/10">
      <div className="sticky left-0 z-20 border-r border-white/10 bg-[#101018]">
        <div className="flex h-full">
          <div className="w-1.5 shrink-0" style={{ backgroundColor: accentColor }} />
          <div className="min-w-0 flex-1 px-3 py-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100" title={trackName}>
                  {trackName}
                </p>
                <p className="mt-1 truncate text-[11px] text-slate-500" title={originalFilename}>
                  {durationLabel} / {formatFileSize(sizeBytes)}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
                aria-label={`${trackName} menu`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleMuteToggle}
                disabled={isLoading}
                aria-pressed={state.muted}
                className={`h-7 w-8 rounded border text-xs font-semibold disabled:opacity-50 ${
                  state.muted
                    ? 'border-orange-400/60 bg-orange-400/20 text-orange-200'
                    : 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                M
              </button>

              <button
                onClick={handleSoloToggle}
                disabled={isLoading}
                aria-pressed={soloed}
                className={`h-7 w-8 rounded border text-xs font-semibold disabled:opacity-50 ${
                  soloed
                    ? 'border-yellow-300/60 bg-yellow-300/20 text-yellow-100'
                    : 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                S
              </button>

              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={state.volume}
                onChange={handleVolumeChange}
                disabled={isLoading}
                className="h-1 min-w-0 flex-1 accent-[#7c3aed]"
                aria-label={`${trackName} volume`}
              />
            </div>
          </div>
        </div>
      </div>
      <div
        ref={timelineRef}
        onClick={handleTimelineClick}
        className="relative flex min-w-0 cursor-pointer items-center bg-[#0b0b12] py-3"
      >
        {state.loadError && <span className="text-xs text-red-300">{state.loadError}</span>}
        {isLoading && !state.loadError && !state.audioBuffer && (
          <span className="text-xs text-slate-500">Loading...</span>
        )}
        {state.audioBuffer && (
          <Waveform
            trackId={trackId}
            audioBuffer={state.audioBuffer}
            zoom={zoom}
            projectDuration={projectDuration}
            accentColor={accentColor}
          />
        )}
      </div>
    </div>
  )
}
