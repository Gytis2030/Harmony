import { getAudioContext, resumeAudioContext, LOOKAHEAD } from './audio-context'

export type EngineState = 'idle' | 'loading' | 'playing' | 'paused'

class AudioEngine {
  private _state: EngineState = 'idle'
  private _listeners: Set<(state: EngineState) => void> = new Set()

  private _bufferCache: Map<string, AudioBuffer> = new Map()
  private _trackGains: Map<string, GainNode> = new Map()
  private _activeSources: Map<string, AudioBufferSourceNode> = new Map()
  private _volumeBeforeMute: Map<string, number> = new Map()

  private _masterGain: GainNode | null = null
  private _startedAt = 0
  private _pausedOffset = 0
  private _activeTrackId: string | null = null

  // ── Subscription ──────────────────────────────────────────────────────────

  subscribe(fn: (state: EngineState) => void): () => void {
    this._listeners.add(fn)
    return () => this._listeners.delete(fn)
  }

  private _emit(): void {
    this._listeners.forEach((fn) => fn(this._state))
  }

  // ── State & position ──────────────────────────────────────────────────────

  get state(): EngineState {
    return this._state
  }

  get position(): number {
    if (this._state === 'playing') {
      const ctx = getAudioContext()
      return this._pausedOffset + Math.max(0, ctx.currentTime - this._startedAt)
    }
    return this._pausedOffset
  }

  // ── Master gain (lazy) ────────────────────────────────────────────────────

  private _getMasterGain(): GainNode {
    if (!this._masterGain) {
      const ctx = getAudioContext()
      this._masterGain = ctx.createGain()
      this._masterGain.connect(ctx.destination)
    }
    return this._masterGain
  }

  // ── Per-track gain (lazy) ─────────────────────────────────────────────────

  private _getTrackGain(trackId: string): GainNode {
    if (!this._trackGains.has(trackId)) {
      const ctx = getAudioContext()
      const gain = ctx.createGain()
      gain.connect(this._getMasterGain())
      this._trackGains.set(trackId, gain)
    }
    return this._trackGains.get(trackId)!
  }

  // ── Load & decode ─────────────────────────────────────────────────────────

  async loadTrack(audioFileId: string, signedUrl: string): Promise<AudioBuffer> {
    if (this._bufferCache.has(audioFileId)) {
      return this._bufferCache.get(audioFileId)!
    }

    this._state = 'loading'
    this._emit()

    const ctx = getAudioContext()

    const response = await fetch(signedUrl)
    const arrayBuffer = await response.arrayBuffer()
    const decoded = await ctx.decodeAudioData(arrayBuffer)

    let buffer: AudioBuffer
    if (decoded.sampleRate === 48000) {
      buffer = decoded
    } else {
      // Resample to 48000Hz via OfflineAudioContext.
      // Safari ignores { sampleRate: 48000 } in the AudioContext constructor
      // and uses the system rate, so this path is the common case there.
      // See DECISIONS.md for the full rationale.
      const frameCount = Math.ceil(decoded.duration * 48000)
      const offline = new OfflineAudioContext(decoded.numberOfChannels, frameCount, 48000)
      const source = offline.createBufferSource()
      source.buffer = decoded
      source.connect(offline.destination)
      source.start(0)
      buffer = await offline.startRendering()
    }

    this._bufferCache.set(audioFileId, buffer)
    this._state = 'idle'
    this._emit()

    return buffer
  }

  // ── Playback controls ─────────────────────────────────────────────────────

  play(trackId: string, audioFileId: string): void {
    if (this._state === 'loading') return

    const buffer = this._bufferCache.get(audioFileId)
    if (!buffer) return

    const ctx = getAudioContext()
    resumeAudioContext()

    // Stop any existing source before creating a fresh one (prevents double-up)
    const existing = this._activeSources.get(trackId)
    if (existing) {
      existing.onended = null
      existing.stop()
      this._activeSources.delete(trackId)
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this._getTrackGain(trackId))
    source.onended = () => {
      this._activeSources.delete(trackId)
      if (this._state === 'playing' && this._activeTrackId === trackId) {
        this._pausedOffset = 0
        this._state = 'idle'
        this._emit()
      }
    }

    const startTime = ctx.currentTime + LOOKAHEAD
    source.start(startTime, this._pausedOffset)

    this._activeSources.set(trackId, source)
    this._activeTrackId = trackId
    // _startedAt matches the scheduled start so position() clamps to 0
    // during the lookahead window via Math.max(0, ctx.currentTime - _startedAt)
    this._startedAt = startTime
    this._state = 'playing'
    this._emit()
  }

  pause(): void {
    if (this._state !== 'playing' || !this._activeTrackId) return

    const ctx = getAudioContext()
    this._pausedOffset += Math.max(0, ctx.currentTime - this._startedAt)

    const source = this._activeSources.get(this._activeTrackId)
    if (source) {
      source.onended = null
      source.stop()
      this._activeSources.delete(this._activeTrackId)
    }

    this._state = 'paused'
    this._emit()
  }

  stop(): void {
    if (this._state === 'idle') return

    this._activeSources.forEach((source) => {
      source.onended = null
      source.stop()
    })
    this._activeSources.clear()

    this._pausedOffset = 0
    this._activeTrackId = null
    this._state = 'idle'
    this._emit()
  }

  // ── Volume & mute ─────────────────────────────────────────────────────────

  setVolume(trackId: string, value: number): void {
    this._getTrackGain(trackId).gain.value = value
    // Keep the pre-mute snapshot current so unmute restores the new value
    if (this._volumeBeforeMute.has(trackId)) {
      this._volumeBeforeMute.set(trackId, value)
    }
  }

  setMuted(trackId: string, muted: boolean): void {
    const gain = this._getTrackGain(trackId)
    if (muted) {
      this._volumeBeforeMute.set(trackId, gain.gain.value)
      gain.gain.value = 0
    } else {
      gain.gain.value = this._volumeBeforeMute.get(trackId) ?? 1.0
    }
  }
}

export const audioEngine = new AudioEngine()
