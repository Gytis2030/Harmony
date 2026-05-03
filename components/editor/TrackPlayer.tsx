'use client'

import { useEffect, useReducer, useRef } from 'react'
import { audioEngine, type EngineState } from '@/lib/audio/audio-engine'
import { resumeAudioContext } from '@/lib/audio/audio-context'

interface Props {
  trackId: string
  audioFileId: string
  trackName: string
}

interface PlayerState {
  engineState: EngineState
  volume: number
  muted: boolean
  loadError: string | null
}

type Action =
  | { type: 'engine_state'; payload: EngineState }
  | { type: 'set_volume'; payload: number }
  | { type: 'toggle_mute' }
  | { type: 'load_error'; payload: string }

function reducer(state: PlayerState, action: Action): PlayerState {
  switch (action.type) {
    case 'engine_state':
      return { ...state, engineState: action.payload }
    case 'set_volume':
      return { ...state, volume: action.payload }
    case 'toggle_mute':
      return { ...state, muted: !state.muted }
    case 'load_error':
      return { ...state, engineState: 'idle', loadError: action.payload }
  }
}

export default function TrackPlayer({ trackId, audioFileId, trackName }: Props) {
  const [state, dispatch] = useReducer(reducer, {
    engineState: 'idle',
    volume: 1,
    muted: false,
    loadError: null,
  })

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Mirror engine state into local state for button rendering
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
        await audioEngine.loadTrack(audioFileId, url)
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
  }, [trackId, audioFileId])

  function handlePlay() {
    // resumeAudioContext + play in the same gesture satisfies browser autoplay policy
    resumeAudioContext()
    audioEngine.play(trackId, audioFileId)
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = parseFloat(e.target.value)
    dispatch({ type: 'set_volume', payload: value })
    audioEngine.setVolume(trackId, value)
  }

  function handleMuteToggle() {
    const next = !state.muted
    dispatch({ type: 'toggle_mute' })
    audioEngine.setMuted(trackId, next)
  }

  const isLoading = state.engineState === 'loading'
  const isPlaying = state.engineState === 'playing'

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="mb-3 font-medium">{trackName}</p>

      {state.loadError && <p className="mb-3 text-sm text-red-500">{state.loadError}</p>}

      <div className="flex items-center gap-2">
        {isPlaying ? (
          <button
            onClick={() => audioEngine.pause()}
            className="rounded bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
          >
            Pause
          </button>
        ) : (
          <button
            onClick={handlePlay}
            disabled={isLoading}
            className="rounded bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {isLoading ? 'Loading…' : 'Play'}
          </button>
        )}

        <button
          onClick={() => audioEngine.stop()}
          disabled={isLoading || state.engineState === 'idle'}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          Stop
        </button>

        <button
          onClick={handleMuteToggle}
          disabled={isLoading}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {state.muted ? 'Unmute' : 'Mute'}
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
          aria-label="Volume"
        />
      </div>
    </div>
  )
}
