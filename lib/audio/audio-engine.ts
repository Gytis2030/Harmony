import { getAudioContext, LOOKAHEAD } from './audio-context'
import { readCachedAudio, writeCachedAudio } from './audio-cache'

export type EngineState = 'idle' | 'loading' | 'playing' | 'paused'

// Length of the fade applied whenever playback starts or stops. Starting or
// cutting a waveform mid-cycle produces an audible click; ramping the output
// from/to silence over a few milliseconds removes it without being noticeable.
export const FADE_SECONDS = 0.012

class AudioEngine {
  private _state: EngineState = 'idle'
  private _listeners: Set<(state: EngineState) => void> = new Set()

  private _bufferCache: Map<string, AudioBuffer> = new Map()
  private _trackGains: Map<string, GainNode> = new Map()
  private _activeSources: Map<string, AudioBufferSourceNode> = new Map()

  // Per-track mix state — explicit booleans so _recomputeGains() has the full picture
  private _trackVolumes: Map<string, number> = new Map()
  private _trackMuted: Map<string, boolean> = new Map()
  private _soloedTracks: Set<string> = new Set()

  // trackId → audioFileId; populated by loadTrack(); drives multi-track play()
  private _trackToFile: Map<string, string> = new Map()

  // Tracks how many decodes are in-flight so concurrent loads don't prematurely
  // flip state back to 'idle' while another file is still being decoded.
  private _loadingSet: Set<string> = new Set()

  private _masterGain: GainNode | null = null
  // Sits after the master gain; only ever automated for start/stop fades, so it
  // never fights with the user's master volume.
  private _fadeGain: GainNode | null = null
  // Incremented by every play/pause/stop/seek, so a play() that is waiting for
  // the audio device to start can tell it has been superseded.
  private _playRequest = 0
  private _startedAt = 0
  private _pausedOffset = 0

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

  // ── Loaded track IDs ──────────────────────────────────────────────────────

  loadedTrackIds(): string[] {
    return Array.from(this._trackToFile.keys()).filter((id) =>
      this._bufferCache.has(this._trackToFile.get(id)!)
    )
  }

  getTrackDuration(trackId: string): number {
    const audioFileId = this._trackToFile.get(trackId)
    if (!audioFileId) return 0
    return this._bufferCache.get(audioFileId)?.duration ?? 0
  }

  // ── Master gain (lazy) ────────────────────────────────────────────────────

  private _getMasterGain(): GainNode {
    if (!this._masterGain) {
      const ctx = getAudioContext()
      this._masterGain = ctx.createGain()
      this._masterGain.connect(this._getFadeGain())
    }
    return this._masterGain
  }

  private _getFadeGain(): GainNode {
    if (!this._fadeGain) {
      const ctx = getAudioContext()
      this._fadeGain = ctx.createGain()
      this._fadeGain.connect(ctx.destination)
    }
    return this._fadeGain
  }

  // Ramp the output down to silence and stop every active source once it is
  // silent. Clears onended first — see the race note on pause().
  private _fadeOutAndStopSources(): void {
    if (this._activeSources.size === 0) return
    const ctx = getAudioContext()
    const now = ctx.currentTime
    const gain = this._getFadeGain().gain
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(gain.value, now)
    gain.linearRampToValueAtTime(0, now + FADE_SECONDS)
    this._activeSources.forEach((source) => {
      source.onended = null
      source.stop(now + FADE_SECONDS)
    })
    this._activeSources.clear()
  }

  setMasterVolume(value: number): void {
    this._getMasterGain().gain.value = value
  }

  // ── Per-track gain (lazy) ─────────────────────────────────────────────────

  private _getTrackGain(trackId: string): GainNode {
    let gain = this._trackGains.get(trackId)
    if (!gain) {
      const ctx = getAudioContext()
      gain = ctx.createGain()
      gain.connect(this._getMasterGain())
      this._trackGains.set(trackId, gain)
    }
    return gain
  }

  // ── Gain recompute ────────────────────────────────────────────────────────
  //
  // Called after any change to volumes, mutes, or solos — and also after a new
  // track finishes loading so a track buffered mid-session (when solo is already
  // active) gets the correct initial gain rather than defaulting to full volume.

  private _recomputeGains(): void {
    const hasSolo = this._soloedTracks.size > 0
    for (const trackId of this._trackToFile.keys()) {
      const gain = this._getTrackGain(trackId)
      const muted = this._trackMuted.get(trackId) ?? false
      const volume = this._trackVolumes.get(trackId) ?? 1.0
      if (hasSolo && !this._soloedTracks.has(trackId)) {
        gain.gain.value = 0
      } else if (muted) {
        gain.gain.value = 0
      } else {
        gain.gain.value = volume
      }
    }
  }

  // ── Load & decode ─────────────────────────────────────────────────────────

  // `source` is either a signed URL or a function that fetches one. Passing a
  // function lets a cache hit skip the signed-URL request entirely.
  async loadTrack(
    trackId: string,
    audioFileId: string,
    source: string | (() => Promise<string>)
  ): Promise<AudioBuffer> {
    this._trackToFile.set(trackId, audioFileId)

    if (this._bufferCache.has(audioFileId)) {
      return this._bufferCache.get(audioFileId)!
    }

    this._loadingSet.add(audioFileId)
    if (this._state === 'idle') {
      this._state = 'loading'
      this._emit()
    }

    try {
      const ctx = getAudioContext()

      // Cache Storage first (see audio-cache.ts); the network only on a miss.
      let arrayBuffer = await readCachedAudio(audioFileId)
      if (!arrayBuffer) {
        const url = typeof source === 'string' ? source : await source()
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Audio download failed (${response.status})`)
        arrayBuffer = await response.arrayBuffer()
        // Copy synchronously: decodeAudioData below detaches the original buffer.
        void writeCachedAudio(audioFileId, arrayBuffer.slice(0))
      }
      const decoded = await ctx.decodeAudioData(arrayBuffer)

      let buffer: AudioBuffer
      if (decoded.sampleRate === 48000) {
        buffer = decoded
      } else {
        // Resample to 48kHz — Safari ignores { sampleRate: 48000 } in the
        // AudioContext constructor and uses the system rate. See DECISIONS.md.
        const frameCount = Math.ceil(decoded.duration * 48000)
        const offline = new OfflineAudioContext(decoded.numberOfChannels, frameCount, 48000)
        const source = offline.createBufferSource()
        source.buffer = decoded
        source.connect(offline.destination)
        source.start(0)
        buffer = await offline.startRendering()
      }

      this._bufferCache.set(audioFileId, buffer)
      // Recompute gains so this track gets the correct level if solo is already active.
      this._recomputeGains()
      return buffer
    } finally {
      this._loadingSet.delete(audioFileId)
      if (this._loadingSet.size === 0 && this._state === 'loading') {
        this._state = 'idle'
        this._emit()
      }
    }
  }

  // ── Playback controls ─────────────────────────────────────────────────────
  //
  // State machine for play():
  //   'playing' → no-op (already running)
  //   'loading' → no-op (wait for tracks to finish decoding)
  //   'paused'  → resume all tracks from _pausedOffset
  //   'idle'    → schedule all buffered tracks fresh from position 0

  play(): void {
    if (this._state === 'playing' || this._state === 'loading') return

    const ctx = getAudioContext()
    const request = ++this._playRequest

    // Browsers create the AudioContext suspended until a user gesture. Scheduling
    // sources while the output device is still starting up is the main cause of
    // crackles in the first moments of playback, so wait until it is running.
    if (ctx.state !== 'running') {
      ctx.resume().then(
        () => {
          // Ignore if pause/stop/seek/another play happened meanwhile.
          if (request === this._playRequest) this.play()
        },
        () => {}
      )
      return
    }

    // Stop any lingering sources without triggering the onended state transition.
    this._activeSources.forEach((source) => {
      source.onended = null
      source.stop()
    })
    this._activeSources.clear()

    const startTime = ctx.currentTime + LOOKAHEAD

    // Fade in from silence at the scheduled start. Only events at or after
    // startTime are cancelled, so a fade-out still running from a seek survives.
    const fade = this._getFadeGain().gain
    fade.cancelScheduledValues(startTime)
    fade.setValueAtTime(0, startTime)
    fade.linearRampToValueAtTime(1, startTime + FADE_SECONDS)

    for (const [trackId, audioFileId] of this._trackToFile) {
      const buffer = this._bufferCache.get(audioFileId)
      if (!buffer) continue

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(this._getTrackGain(trackId))

      // Only transition to idle on natural completion (state === 'playing').
      // Guarding here prevents a race where pause()/stop() sets state to
      // 'paused'/'idle' first, and the synchronous onended from stop() then
      // incorrectly flips it back to 'idle'.
      source.onended = () => {
        this._activeSources.delete(trackId)
        if (this._state === 'playing' && this._activeSources.size === 0) {
          this._pausedOffset = 0
          this._state = 'idle'
          this._emit()
        }
      }

      source.start(startTime, this._pausedOffset)
      this._activeSources.set(trackId, source)
    }

    if (this._activeSources.size === 0) return // nothing buffered yet

    // _startedAt matches the scheduled wall-clock start so position() clamps to
    // 0 during the lookahead window via Math.max(0, ctx.currentTime - _startedAt).
    this._startedAt = startTime
    this._state = 'playing'
    this._emit()
  }

  pause(): void {
    if (this._state !== 'playing') return

    this._playRequest++
    const ctx = getAudioContext()
    this._pausedOffset += Math.max(0, ctx.currentTime - this._startedAt)

    // Set state BEFORE calling stop() — the mock (and real browser) fires
    // onended synchronously/microtask; the guard in onended checks _state so
    // it won't incorrectly flip back to 'idle'.
    this._state = 'paused'
    this._emit()

    this._fadeOutAndStopSources()
  }

  stop(): void {
    this._playRequest++
    if (this._state === 'idle') return

    // Set state BEFORE calling stop() for the same race reason as pause().
    this._pausedOffset = 0
    this._state = 'idle'
    this._emit()

    this._fadeOutAndStopSources()
  }

  // ── Volume, mute, solo ────────────────────────────────────────────────────

  setVolume(trackId: string, value: number): void {
    this._trackVolumes.set(trackId, value)
    this._recomputeGains()
  }

  setMuted(trackId: string, muted: boolean): void {
    this._trackMuted.set(trackId, muted)
    this._recomputeGains()
  }

  setSoloed(trackId: string, soloed: boolean): void {
    if (soloed) {
      this._soloedTracks.clear()
      this._soloedTracks.add(trackId)
    } else {
      this._soloedTracks.delete(trackId)
    }
    this._recomputeGains()
  }

  seek(seconds: number): void {
    const max = this._maxDuration()
    const clamped = Math.max(0, max > 0 ? Math.min(seconds, max) : seconds)

    if (this._state === 'playing') {
      // Fade out the old position; play() below fades in at the new one.
      this._fadeOutAndStopSources()
      // Set paused without emitting — play() below will emit 'playing'
      this._state = 'paused'
      this._pausedOffset = clamped
      this.play()
    } else {
      this._pausedOffset = clamped
    }
  }

  seekBy(deltaSeconds: number): void {
    this.seek(this.position + deltaSeconds)
  }

  private _maxDuration(): number {
    return this.loadedTrackIds().reduce((max, id) => Math.max(max, this.getTrackDuration(id)), 0)
  }

  unloadTrack(trackId: string): void {
    const source = this._activeSources.get(trackId)
    if (source) {
      source.onended = null
      try {
        source.stop()
      } catch {
        /* already stopped */
      }
      this._activeSources.delete(trackId)
    }
    const gain = this._trackGains.get(trackId)
    if (gain) {
      gain.disconnect()
      this._trackGains.delete(trackId)
    }
    this._trackToFile.delete(trackId)
    this._trackMuted.delete(trackId)
    this._trackVolumes.delete(trackId)
    this._soloedTracks.delete(trackId)
    this._loadingSet.delete(trackId)
  }

  // Keeps _bufferCache intact so re-decoding is skipped on fast re-navigation.
  unloadAllTracks(): void {
    this.stop()
    this._trackGains.forEach((gain) => gain.disconnect())
    this._trackGains.clear()
    this._trackToFile.clear()
    this._trackMuted.clear()
    this._trackVolumes.clear()
    this._soloedTracks.clear()
    this._loadingSet.clear()
  }
}

export const audioEngine = new AudioEngine()
