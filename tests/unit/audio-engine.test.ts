import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LOOKAHEAD } from '@/lib/audio/audio-context'

// ── Mock types ───────────────────────────────────────────────────────────────

type MockSource = Pick<AudioBufferSourceNode, 'buffer' | 'connect' | 'start' | 'stop'> & {
  onended: (() => void) | null
}

interface AudioEngineInternals {
  _bufferCache: Map<string, AudioBuffer>
  _activeSources: Map<string, unknown>
  _trackGains: Map<string, { gain: { value: number } }>
  _trackVolumes: Map<string, number>
  _trackMuted: Map<string, boolean>
  _soloedTracks: Set<string>
  _trackToFile: Map<string, string>
  _loadingSet: Set<string>
  _masterGain: { gain: { value: number } } | null
  _pausedOffset: number
  _startedAt: number
}

// ── Minimal Web Audio mocks ──────────────────────────────────────────────────

function makeGainNode() {
  return { gain: { value: 1 }, connect: vi.fn() }
}

function makeSource(): MockSource {
  let onended: (() => void) | null = null
  return {
    buffer: null as AudioBuffer | null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(() => {
      onended?.()
    }),
    set onended(fn: (() => void) | null) {
      onended = fn
    },
    get onended() {
      return onended
    },
  }
}

function makeMockContext(currentTimeRef: { value: number }) {
  return {
    get currentTime() {
      return currentTimeRef.value
    },
    sampleRate: 48000,
    state: 'running' as AudioContextState,
    destination: {},
    createGain: vi.fn(() => makeGainNode()),
    createBufferSource: vi.fn(() => makeSource()),
    decodeAudioData: vi.fn(),
    resume: vi.fn(),
  }
}

const currentTimeRef = { value: 0 }
const mockCtx = makeMockContext(currentTimeRef)

vi.mock('@/lib/audio/audio-context', () => ({
  LOOKAHEAD: 0.1,
  getAudioContext: () => mockCtx,
  resumeAudioContext: vi.fn(),
}))

// Import engine AFTER the mock is registered
const { audioEngine } = await import('@/lib/audio/audio-engine')

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeBuffer(sampleRate: number, duration: number, channels = 2): AudioBuffer {
  const length = Math.ceil(duration * sampleRate)
  return {
    sampleRate,
    duration,
    length,
    numberOfChannels: channels,
    getChannelData: () => new Float32Array(length),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer
}

function internals() {
  return audioEngine as unknown as AudioEngineInternals
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AudioEngine', () => {
  beforeEach(() => {
    currentTimeRef.value = 0
    vi.clearAllMocks()
    audioEngine.stop()
    internals()._bufferCache.clear()
    internals()._activeSources.clear()
    internals()._trackGains.clear()
    internals()._trackVolumes.clear()
    internals()._trackMuted.clear()
    internals()._soloedTracks.clear()
    internals()._trackToFile.clear()
    internals()._loadingSet.clear()
    internals()._masterGain = null
    internals()._pausedOffset = 0
    internals()._startedAt = 0
  })

  // ── Phase 4a tests (preserved) ────────────────────────────────────────────

  // Test 1 — Resample: 44.1kHz buffer resampled to 48kHz preserves duration within 0.1%
  it('resamples a 44100Hz buffer to 48000Hz within 0.1% duration tolerance', async () => {
    const originalDuration = 10.0
    const src44k = makeBuffer(44100, originalDuration)

    const frameCount = Math.ceil(originalDuration * 48000)
    const rendered48k = makeBuffer(48000, frameCount / 48000)
    vi.stubGlobal(
      'OfflineAudioContext',
      class {
        destination = {}
        createBufferSource() {
          return { buffer: null as AudioBuffer | null, connect: vi.fn(), start: vi.fn() }
        }
        startRendering() {
          return Promise.resolve(rendered48k)
        }
      }
    )

    mockCtx.decodeAudioData.mockResolvedValue(src44k)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      })
    )

    const result = await audioEngine.loadTrack(
      'track-44k',
      'file-44k',
      'https://example.com/file.wav'
    )

    const tolerance = Math.abs(result.duration - originalDuration) / originalDuration
    expect(tolerance).toBeLessThan(0.001)
  })

  // Test 2 — State machine: play → pause → play resumes from correct offset
  it('resumes from the correct position after pause', () => {
    const TRACK = 'track-1'
    const FILE = 'file-1'
    internals()._trackToFile.set(TRACK, FILE)
    internals()._bufferCache.set(FILE, makeBuffer(48000, 30))

    currentTimeRef.value = 0
    audioEngine.play()
    expect(audioEngine.state).toBe('playing')

    // Advance time 2 seconds past the lookahead window
    currentTimeRef.value = LOOKAHEAD + 2

    audioEngine.pause()
    expect(audioEngine.state).toBe('paused')
    expect(internals()._pausedOffset).toBeCloseTo(2.0, 1)

    audioEngine.play()
    expect(audioEngine.state).toBe('playing')
  })

  // Test 3 — Double play() without stop() does not create two active sources
  it('does not double up sources when play() is called twice', () => {
    const TRACK = 'track-2'
    const FILE = 'file-2'
    internals()._trackToFile.set(TRACK, FILE)
    internals()._bufferCache.set(FILE, makeBuffer(48000, 30))

    audioEngine.play()
    audioEngine.play()

    expect(internals()._activeSources.size).toBe(1)
  })

  // Test 4 — Lookahead clamp: pause within the lookahead window leaves pausedOffset = 0
  it('leaves _pausedOffset at 0 when paused within the lookahead window', () => {
    const TRACK = 'track-3'
    const FILE = 'file-3'
    internals()._trackToFile.set(TRACK, FILE)
    internals()._bufferCache.set(FILE, makeBuffer(48000, 30))

    currentTimeRef.value = 0
    audioEngine.play()

    // 0.05s is inside the 0.1s lookahead window — position should still be 0
    currentTimeRef.value = 0.05
    audioEngine.pause()

    expect(internals()._pausedOffset).toBe(0)
  })

  // ── Phase 4b tests ────────────────────────────────────────────────────────

  // Test 8 — Multi-track sync: both sources scheduled at the exact same start time
  it('schedules all loaded tracks at the same start time (sample precision)', () => {
    const TRACK_A = 'track-a',
      FILE_A = 'file-a'
    const TRACK_B = 'track-b',
      FILE_B = 'file-b'
    internals()._trackToFile.set(TRACK_A, FILE_A)
    internals()._trackToFile.set(TRACK_B, FILE_B)
    internals()._bufferCache.set(FILE_A, makeBuffer(48000, 30))
    internals()._bufferCache.set(FILE_B, makeBuffer(48000, 30))

    currentTimeRef.value = 0
    audioEngine.play()

    const sources = Array.from(internals()._activeSources.values()) as MockSource[]
    expect(sources).toHaveLength(2)
    const t1 = (sources[0].start as ReturnType<typeof vi.fn>).mock.calls[0][0] as number
    const t2 = (sources[1].start as ReturnType<typeof vi.fn>).mock.calls[0][0] as number
    expect(t1).toBe(t2)
    expect(t1).toBe(LOOKAHEAD) // currentTime = 0, so startTime = 0 + LOOKAHEAD
  })

  // Test 9a — Solo A: A plays at its volume, B is silenced
  it('solo A → A gain = volume, B gain = 0', () => {
    const TRACK_A = 'solo-a',
      FILE_A = 'solo-file-a'
    const TRACK_B = 'solo-b',
      FILE_B = 'solo-file-b'
    internals()._trackToFile.set(TRACK_A, FILE_A)
    internals()._trackToFile.set(TRACK_B, FILE_B)
    audioEngine.setVolume(TRACK_A, 0.8)
    audioEngine.setVolume(TRACK_B, 0.6)

    audioEngine.setSoloed(TRACK_A, true)

    expect(internals()._trackGains.get(TRACK_A)!.gain.value).toBe(0.8)
    expect(internals()._trackGains.get(TRACK_B)!.gain.value).toBe(0)
  })

  // Test 9b — Solo A and B: both play at their volumes
  it('solo A + B → both play at their volumes', () => {
    const TRACK_A = 'dual-a',
      FILE_A = 'dual-file-a'
    const TRACK_B = 'dual-b',
      FILE_B = 'dual-file-b'
    internals()._trackToFile.set(TRACK_A, FILE_A)
    internals()._trackToFile.set(TRACK_B, FILE_B)
    audioEngine.setVolume(TRACK_A, 0.8)
    audioEngine.setVolume(TRACK_B, 0.6)

    audioEngine.setSoloed(TRACK_A, true)
    audioEngine.setSoloed(TRACK_B, true)

    expect(internals()._trackGains.get(TRACK_A)!.gain.value).toBe(0.8)
    expect(internals()._trackGains.get(TRACK_B)!.gain.value).toBe(0.6)
  })

  // Test 9c — Unsolo A while B still soloed: A goes silent, B stays
  it('unsolo A while B soloed → A = 0, B = volume', () => {
    const TRACK_A = 'un-a',
      FILE_A = 'un-file-a'
    const TRACK_B = 'un-b',
      FILE_B = 'un-file-b'
    internals()._trackToFile.set(TRACK_A, FILE_A)
    internals()._trackToFile.set(TRACK_B, FILE_B)
    audioEngine.setVolume(TRACK_A, 0.8)
    audioEngine.setVolume(TRACK_B, 0.6)

    audioEngine.setSoloed(TRACK_A, true)
    audioEngine.setSoloed(TRACK_B, true)
    audioEngine.setSoloed(TRACK_A, false) // unsolo A

    expect(internals()._trackGains.get(TRACK_A)!.gain.value).toBe(0)
    expect(internals()._trackGains.get(TRACK_B)!.gain.value).toBe(0.6)
  })

  // Test 9d — Unsolo last: all tracks return to their volumes
  it('unsolo last soloed track → all tracks return to volume', () => {
    const TRACK_A = 'last-a',
      FILE_A = 'last-file-a'
    const TRACK_B = 'last-b',
      FILE_B = 'last-file-b'
    internals()._trackToFile.set(TRACK_A, FILE_A)
    internals()._trackToFile.set(TRACK_B, FILE_B)
    audioEngine.setVolume(TRACK_A, 0.8)
    audioEngine.setVolume(TRACK_B, 0.6)

    audioEngine.setSoloed(TRACK_B, true)
    audioEngine.setSoloed(TRACK_B, false) // unsolo last

    expect(internals()._trackGains.get(TRACK_A)!.gain.value).toBe(0.8)
    expect(internals()._trackGains.get(TRACK_B)!.gain.value).toBe(0.6)
  })

  // Test 10 — Master volume
  it('setMasterVolume(0.5) sets masterGain.gain.value to 0.5', () => {
    audioEngine.setMasterVolume(0.5)
    expect(internals()._masterGain!.gain.value).toBe(0.5)
  })

  // Test 11 — Pause race: state stays 'paused' after onended fires for both sources
  it('state remains paused after onended fires for all sources on pause()', () => {
    const TRACK_A = 'race-a',
      FILE_A = 'race-file-a'
    const TRACK_B = 'race-b',
      FILE_B = 'race-file-b'
    internals()._trackToFile.set(TRACK_A, FILE_A)
    internals()._trackToFile.set(TRACK_B, FILE_B)
    internals()._bufferCache.set(FILE_A, makeBuffer(48000, 30))
    internals()._bufferCache.set(FILE_B, makeBuffer(48000, 30))

    currentTimeRef.value = 0
    audioEngine.play()
    expect(audioEngine.state).toBe('playing')

    // pause() sets state to 'paused' THEN calls stop() on each source.
    // The mock's stop() fires onended synchronously. The guard in onended
    // checks state === 'playing', so it must NOT flip state back to 'idle'.
    audioEngine.pause()
    expect(audioEngine.state).toBe('paused')
  })

  // Test 12 — loadTrack while soloed: new track's gain is silenced immediately
  it('loadTrack of new track while another is soloed yields gain 0 for new track', async () => {
    const TRACK_A = 'mid-a',
      FILE_A = 'mid-file-a'
    const TRACK_B = 'mid-b',
      FILE_B = 'mid-file-b'

    // Track A is already loaded and soloed
    internals()._trackToFile.set(TRACK_A, FILE_A)
    internals()._bufferCache.set(FILE_A, makeBuffer(48000, 30))
    audioEngine.setSoloed(TRACK_A, true)

    // Now load Track B — stub fetch/decode so loadTrack() completes
    mockCtx.decodeAudioData.mockResolvedValue(makeBuffer(48000, 30))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      })
    )

    await audioEngine.loadTrack(TRACK_B, FILE_B, 'https://example.com/b.wav')

    // B is not in the solo set, so its gain must be 0
    expect(internals()._trackGains.get(TRACK_B)!.gain.value).toBe(0)
    // A should still be at its full gain
    expect(internals()._trackGains.get(TRACK_A)!.gain.value).toBe(1.0)
  })

  // Test 13 — unloadAllTracks() resets session state but preserves buffer cache
  it('unloadAllTracks() clears per-track state and stops playback, preserves buffers', () => {
    const TRACK_A = 'ul-a',
      FILE_A = 'ul-file-a'
    const TRACK_B = 'ul-b',
      FILE_B = 'ul-file-b'
    internals()._trackToFile.set(TRACK_A, FILE_A)
    internals()._trackToFile.set(TRACK_B, FILE_B)
    internals()._bufferCache.set(FILE_A, makeBuffer(48000, 30))
    internals()._bufferCache.set(FILE_B, makeBuffer(48000, 30))
    audioEngine.setVolume(TRACK_A, 0.7)
    audioEngine.setMuted(TRACK_B, true)
    audioEngine.setSoloed(TRACK_A, true)
    audioEngine.play()
    expect(audioEngine.state).toBe('playing')

    audioEngine.unloadAllTracks()

    expect(audioEngine.state).toBe('idle')
    expect(internals()._activeSources.size).toBe(0)
    expect(internals()._trackToFile.size).toBe(0)
    expect(internals()._trackMuted.size).toBe(0)
    expect(internals()._trackVolumes.size).toBe(0)
    expect(internals()._soloedTracks.size).toBe(0)
    // Buffer cache must be intact for fast re-navigation
    expect(internals()._bufferCache.size).toBe(2)
  })

  // Test 14 — state getter is synchronous (validates the lazy useState initializer pattern)
  it('audioEngine.state getter returns current state without subscribing', () => {
    expect(audioEngine.state).toBe('idle')
    ;(internals() as unknown as { _state: string })._state = 'paused'
    expect(audioEngine.state).toBe('paused')
  })
})
