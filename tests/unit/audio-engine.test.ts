import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LOOKAHEAD } from '@/lib/audio/audio-context'

// ── Mock types ───────────────────────────────────────────────────────────────

// onended on the real AudioBufferSourceNode requires (this: AudioScheduledSourceNode, ev: Event),
// which our test double doesn't match — override it via intersection.
type MockSource = Pick<AudioBufferSourceNode, 'buffer' | 'connect' | 'start' | 'stop'> & {
  onended: (() => void) | null
}

// Typed access to AudioEngine private fields used in beforeEach and assertions.
interface AudioEngineInternals {
  _bufferCache: Map<string, AudioBuffer>
  _activeSources: Map<string, unknown> // we only access .size and .clear()
  _pausedOffset: number
  _startedAt: number
  _activeTrackId: string | null
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AudioEngine', () => {
  beforeEach(() => {
    currentTimeRef.value = 0
    vi.clearAllMocks()
    audioEngine.stop()
    ;(audioEngine as unknown as AudioEngineInternals)._bufferCache.clear()
    ;(audioEngine as unknown as AudioEngineInternals)._activeSources.clear()
    ;(audioEngine as unknown as AudioEngineInternals)._pausedOffset = 0
    ;(audioEngine as unknown as AudioEngineInternals)._startedAt = 0
    ;(audioEngine as unknown as AudioEngineInternals)._activeTrackId = null
  })

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

    const result = await audioEngine.loadTrack('file-44k', 'https://example.com/file.wav')

    const tolerance = Math.abs(result.duration - originalDuration) / originalDuration
    expect(tolerance).toBeLessThan(0.001)
  })

  // Test 2 — State machine: play → pause → play resumes from correct offset
  it('resumes from the correct position after pause', () => {
    const TRACK = 'track-1'
    const FILE = 'file-1'
    ;(audioEngine as unknown as AudioEngineInternals)._bufferCache.set(FILE, makeBuffer(48000, 30))

    currentTimeRef.value = 0
    audioEngine.play(TRACK, FILE)
    expect(audioEngine.state).toBe('playing')

    // Advance time 2 seconds past the lookahead window
    currentTimeRef.value = LOOKAHEAD + 2

    audioEngine.pause()
    expect(audioEngine.state).toBe('paused')
    expect((audioEngine as unknown as AudioEngineInternals)._pausedOffset).toBeCloseTo(2.0, 1)

    audioEngine.play(TRACK, FILE)
    expect(audioEngine.state).toBe('playing')
  })

  // Test 3 — Double play() without stop() does not create two active sources
  it('does not double up sources when play() is called twice', () => {
    const TRACK = 'track-2'
    const FILE = 'file-2'
    ;(audioEngine as unknown as AudioEngineInternals)._bufferCache.set(FILE, makeBuffer(48000, 30))

    audioEngine.play(TRACK, FILE)
    audioEngine.play(TRACK, FILE)

    expect((audioEngine as unknown as AudioEngineInternals)._activeSources.size).toBe(1)
  })

  // Test 4 — Lookahead clamp: pause within the lookahead window leaves pausedOffset = 0
  it('leaves _pausedOffset at 0 when paused within the lookahead window', () => {
    const TRACK = 'track-3'
    const FILE = 'file-3'
    ;(audioEngine as unknown as AudioEngineInternals)._bufferCache.set(FILE, makeBuffer(48000, 30))

    currentTimeRef.value = 0
    audioEngine.play(TRACK, FILE)

    // 0.05s is inside the 0.1s lookahead window — position should still be 0
    currentTimeRef.value = 0.05
    audioEngine.pause()

    expect((audioEngine as unknown as AudioEngineInternals)._pausedOffset).toBe(0)
  })
})
