'use client'

import { useEffect, useReducer, useRef, useState } from 'react'
import { MessageSquare, MoreHorizontal, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { audioEngine, type EngineState } from '@/lib/audio/audio-engine'
import { removeTrack, updateTrackMix } from '@/lib/actions/tracks'
import Waveform from '@/components/editor/Waveform'
import type { CommentDto } from '@/lib/actions/comments'

interface Props {
  projectId: string
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
  comments: CommentDto[]
  commentMode: boolean
  selectedCommentId: string | null
  canEditMix?: boolean
  onTrackLoaded: (trackId: string, duration: number) => void
  onSoloChange: (trackId: string) => void
  onCommentTarget: (trackId: string, trackName: string, timestampSeconds: number) => void
  onCommentSelect: (commentId: string) => void
  onRemove?: () => void
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
  | { type: 'set_muted'; payload: boolean }
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
    case 'set_muted':
      return { ...state, muted: action.payload }
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
  projectId,
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
  comments,
  commentMode,
  selectedCommentId,
  canEditMix = false,
  onTrackLoaded,
  onSoloChange,
  onCommentTarget,
  onCommentSelect,
  onRemove,
}: Props) {
  const [state, dispatch] = useReducer(reducer, {
    engineState: 'idle',
    volume: initialVolume,
    muted: initialMuted,
    loadError: null,
    audioBuffer: null,
  })

  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)
  const didMountVolumeRef = useRef(false)
  const prevInitialVolumeRef = useRef(initialVolume)
  const timelineRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    return audioEngine.subscribe((s) => dispatch({ type: 'engine_state', payload: s }))
  }, [])

  useEffect(() => {
    async function load() {
      const MAX_RETRIES = 3
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, 1000 * attempt))
          if (!mountedRef.current) return
        }
        try {
          const res = await fetch(`/api/tracks/${trackId}/url`)
          // Retry on 404 — the DB row may not be visible to this connection yet.
          if (!res.ok && attempt < MAX_RETRIES) continue
          if (!res.ok) throw new Error(`Failed to get signed URL (${res.status})`)
          const { url } = (await res.json()) as { url: string }
          const buffer = await audioEngine.loadTrack(trackId, audioFileId, url)
          if (mountedRef.current) {
            dispatch({ type: 'load_success', payload: buffer })
            onTrackLoaded(trackId, buffer.duration)
          }
          return
        } catch (err) {
          if (attempt < MAX_RETRIES) continue
          if (mountedRef.current) {
            dispatch({
              type: 'load_error',
              payload: err instanceof Error ? err.message : 'Load failed',
            })
          }
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
    audioEngine.setSoloed(trackId, soloed)
  }, [trackId, soloed])

  // Sync local UI state when props change from outside (e.g. after a version restore).
  useEffect(() => {
    if (prevInitialVolumeRef.current === initialVolume) return
    prevInitialVolumeRef.current = initialVolume
    dispatch({ type: 'set_volume', payload: initialVolume })
  }, [initialVolume])

  useEffect(() => {
    dispatch({ type: 'set_muted', payload: initialMuted })
  }, [initialMuted])

  useEffect(() => {
    if (!didMountVolumeRef.current) {
      didMountVolumeRef.current = true
      return
    }
    if (!canEditMix) return

    const timeout = window.setTimeout(() => {
      void updateTrackMix({ trackId, volume: state.volume }).catch(() => {})
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [trackId, state.volume, canEditMix])

  // Close the three-dot menu on outside click.
  useEffect(() => {
    if (!menuOpen) return
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setConfirmRemove(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen])

  async function handleRemoveConfirm() {
    setIsRemoving(true)
    try {
      await removeTrack({ trackId, projectId })
    } catch {
      setIsRemoving(false)
      setMenuOpen(false)
      setConfirmRemove(false)
      return
    }
    audioEngine.unloadTrack(trackId)
    onRemove?.()
    router.refresh()
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
    if (canEditMix) void updateTrackMix({ trackId, isMuted: next }).catch(() => {})
  }

  function handleSoloToggle() {
    const next = !soloed
    audioEngine.setSoloed(trackId, next)
    onSoloChange(trackId)
    if (canEditMix) void updateTrackMix({ trackId, isSoloed: next }).catch(() => {})
  }

  function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!timelineRef.current || projectDuration <= 0) return
    const rect = timelineRef.current.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    const timestampSeconds = Math.max(0, Math.min(ratio, 1)) * projectDuration
    if (commentMode) {
      onCommentTarget(trackId, trackName, timestampSeconds)
      return
    }
    audioEngine.seek(timestampSeconds)
  }

  const isLoading = state.engineState === 'loading'
  const durationLabel = state.audioBuffer ? formatDuration(state.audioBuffer.duration) : '--:--'

  return (
    <div className="relative grid min-h-[88px] grid-cols-[256px_minmax(560px,1fr)] border-b border-white/[0.06]">
      {/* Track label / controls */}
      <div className="sticky left-0 z-40 border-r border-white/[0.06] bg-[#0c0e18]">
        <div className="flex h-full">
          <div className="w-1 shrink-0" style={{ backgroundColor: accentColor }} />
          <div className="min-w-0 flex-1 px-3 py-3">
            <div className="flex items-start gap-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-200" title={trackName}>
                  {trackName}
                </p>
                <p
                  className="mt-0.5 truncate font-mono text-[10px] tabular-nums text-slate-600"
                  title={originalFilename}
                >
                  {durationLabel} · {formatFileSize(sizeBytes)}
                </p>
              </div>
              {canEditMix && (
                <div ref={menuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen((o) => !o)
                      setConfirmRemove(false)
                    }}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-700 transition hover:bg-white/[0.06] hover:text-slate-300"
                    aria-label={`${trackName} menu`}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-7 z-50 min-w-[148px] overflow-hidden rounded-xl border border-white/[0.1] bg-[#141924] shadow-2xl">
                      {!confirmRemove ? (
                        <button
                          type="button"
                          onClick={() => setConfirmRemove(true)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-300 transition hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove stem
                        </button>
                      ) : (
                        <div className="px-3 py-2.5">
                          <p className="mb-2 text-[11px] text-slate-400">Remove this stem?</p>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => setConfirmRemove(false)}
                              disabled={isRemoving}
                              className="flex items-center gap-1 rounded-lg border border-white/[0.1] px-2.5 py-1 text-[10px] text-slate-500 hover:bg-white/[0.05]"
                            >
                              <X className="h-3 w-3" />
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleRemoveConfirm}
                              disabled={isRemoving}
                              className="rounded-lg bg-red-600 px-2.5 py-1 text-[10px] font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
                            >
                              {isRemoving ? 'Removing…' : 'Remove'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-2.5 flex items-center gap-1.5">
              <button
                onClick={handleMuteToggle}
                disabled={isLoading || !canEditMix}
                aria-pressed={state.muted}
                className={`h-6 w-7 rounded border text-[10px] font-semibold disabled:opacity-40 ${
                  state.muted
                    ? 'border-orange-400/50 bg-orange-400/15 text-orange-300'
                    : 'border-white/[0.08] text-slate-600 hover:border-white/[0.16] hover:text-slate-300'
                }`}
              >
                M
              </button>

              <button
                onClick={handleSoloToggle}
                disabled={isLoading || !canEditMix}
                aria-pressed={soloed}
                className={`h-6 w-7 rounded border text-[10px] font-semibold disabled:opacity-40 ${
                  soloed
                    ? 'border-yellow-300/50 bg-yellow-300/15 text-yellow-200'
                    : 'border-white/[0.08] text-slate-600 hover:border-white/[0.16] hover:text-slate-300'
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
                disabled={isLoading || !canEditMix}
                className="h-1 min-w-0 flex-1 accent-[#7c3aed] disabled:opacity-40"
                aria-label={`${trackName} volume`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Waveform / timeline area */}
      <div
        ref={timelineRef}
        onClick={handleTimelineClick}
        className={[
          'relative flex min-w-0 cursor-pointer items-center bg-[#090a12] py-3',
          commentMode ? 'cursor-crosshair' : '',
        ].join(' ')}
      >
        {state.loadError && <span className="ml-3 text-xs text-red-400">{state.loadError}</span>}
        {isLoading && !state.loadError && !state.audioBuffer && (
          <span className="ml-3 text-xs text-slate-700">Loading…</span>
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
        {projectDuration > 0 &&
          comments.map((comment) => {
            const isSelected = selectedCommentId === comment.id
            const isResolved = comment.status === 'resolved'
            return (
              <button
                key={comment.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onCommentSelect(comment.id)
                }}
                className={[
                  'absolute top-2 z-20 inline-flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border transition',
                  isSelected
                    ? 'scale-110 border-violet-400 bg-violet-600 text-white shadow-[0_0_16px_rgba(124,58,237,0.65)]'
                    : isResolved
                      ? 'border-white/[0.08] bg-[#111120] text-slate-600 opacity-40 hover:opacity-70'
                      : 'border-white/[0.15] bg-[#141421] text-violet-300 shadow-[0_0_10px_rgba(124,58,237,0.28)] hover:border-violet-400/50 hover:bg-violet-600',
                ].join(' ')}
                style={{ left: `${(comment.timestampSeconds / projectDuration) * 100}%` }}
                aria-label={`Open comment at ${formatDuration(comment.timestampSeconds)}`}
                title={comment.body}
              >
                <MessageSquare className="h-3 w-3" />
              </button>
            )
          })}
      </div>
    </div>
  )
}
