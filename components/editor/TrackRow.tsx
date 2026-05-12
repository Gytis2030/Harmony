'use client'

import { useEffect, useReducer, useRef } from 'react'
import { audioEngine, type EngineState } from '@/lib/audio/audio-engine'
import { updateTrackMix } from '@/lib/actions/tracks'
import Waveform from '@/components/editor/Waveform'

interface Props {
  trackId: string
  audioFileId: string
  trackName: string
  initialVolume: number
  initialMuted: boolean
  zoom: number
  projectDuration: number
  onTrackLoaded: (trackId: string, duration: number) => void
}

interface RowState {
  engineState: EngineState
  volume: number
  muted: boolean
  soloed: boolean
  loadError: string | null
  audioBuffer: AudioBuffer | null
}

type Action =
  | { type: 'engine_state'; payload: EngineState }
  | { type: 'set_volume'; payload: number }
  | { type: 'toggle_mute' }
  | { type: 'toggle_solo' }
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
    case 'toggle_solo':
      return { ...state, soloed: !state.soloed }
    case 'load_error':
      return { ...state, engineState: 'idle', loadError: action.payload }
    case 'load_success':
      return { ...state, audioBuffer: action.payload }
  }
}

export default function TrackRow({
  trackId,
  audioFileId,
  trackName,
  initialVolume,
  initialMuted,
  zoom,
  projectDuration,
  onTrackLoaded,
}: Props) {
  const [state, dispatch] = useReducer(reducer, {
    engineState: 'idle',
    volume: initialVolume,
    muted: initialMuted,
    soloed: false,
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
    const next = !state.soloed
    dispatch({ type: 'toggle_solo' })
    audioEngine.setSoloed(trackId, next)
  }

  function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!timelineRef.current || projectDuration <= 0) return
    const rect = timelineRef.current.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    audioEngine.seek(Math.max(0, Math.min(ratio, 1)) * projectDuration)
  }

  const isLoading = state.engineState === 'loading'

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-2">
      <span className="w-44 shrink-0 truncate font-medium" title={trackName}>
        {trackName}
      </span>

      <div
        ref={timelineRef}
        onClick={handleTimelineClick}
        className="flex min-w-0 flex-1 cursor-pointer items-center"
      >
        {state.loadError && <span className="text-xs text-red-500">{state.loadError}</span>}
        {isLoading && !state.loadError && !state.audioBuffer && (
          <span className="text-xs text-gray-400">Loading…</span>
        )}
        {state.audioBuffer && (
          <Waveform
            trackId={trackId}
            audioBuffer={state.audioBuffer}
            zoom={zoom}
            projectDuration={projectDuration}
          />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={handleMuteToggle}
          disabled={isLoading}
          aria-pressed={state.muted}
          className={`rounded border px-2.5 py-1 text-xs disabled:opacity-50 ${
            state.muted
              ? 'border-orange-400 bg-orange-100 text-orange-700'
              : 'border-gray-300 hover:bg-gray-50'
          }`}
        >
          M
        </button>

        <button
          onClick={handleSoloToggle}
          disabled={isLoading}
          aria-pressed={state.soloed}
          className={`rounded border px-2.5 py-1 text-xs disabled:opacity-50 ${
            state.soloed
              ? 'border-yellow-400 bg-yellow-100 text-yellow-700'
              : 'border-gray-300 hover:bg-gray-50'
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
          className="w-24"
          aria-label={`${trackName} volume`}
        />
      </div>
    </div>
  )
}
