import { describe, it, expect } from 'vitest'
import { extractPeaks, getOrComputePeaks } from '@/lib/audio/peaks'

function makeBuffer(samples: Float32Array[], sampleRate = 48000): AudioBuffer {
  const length = samples[0].length
  return {
    sampleRate,
    duration: length / sampleRate,
    length,
    numberOfChannels: samples.length,
    getChannelData: (c: number) => samples[c],
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as unknown as AudioBuffer
}

describe('extractPeaks', () => {
  it('output length equals ceil(buffer.length / samplesPerPeak)', () => {
    const data = new Float32Array(5000).fill(0.5)
    const buffer = makeBuffer([data])
    const peaks = extractPeaks(buffer, 1024)
    expect(peaks.length).toBe(Math.ceil(5000 / 1024))
  })

  it('peak values approximate 0.5 for a constant-amplitude buffer', () => {
    const data = new Float32Array(4096).fill(0.5)
    const buffer = makeBuffer([data])
    const peaks = extractPeaks(buffer, 1024)
    for (const p of peaks) {
      expect(p).toBeCloseTo(0.5, 5)
    }
  })

  it('averages channels for stereo — mixed 1.0 and 0.0 channels yields ~0.5', () => {
    const ch0 = new Float32Array(1024).fill(1.0)
    const ch1 = new Float32Array(1024).fill(0.0)
    const buffer = makeBuffer([ch0, ch1])
    const peaks = extractPeaks(buffer, 1024)
    expect(peaks.length).toBe(1)
    expect(peaks[0]).toBeCloseTo(0.5, 5)
  })

  it('handles a buffer length that is not a multiple of samplesPerPeak', () => {
    const data = new Float32Array(1500).fill(0.8)
    const buffer = makeBuffer([data])
    const peaks = extractPeaks(buffer, 1024)
    // 2 windows: first 1024 samples, then 476 samples
    expect(peaks.length).toBe(2)
    for (const p of peaks) {
      expect(p).toBeCloseTo(0.8, 5)
    }
  })
})

describe('getOrComputePeaks', () => {
  it('returns the same Float32Array reference on a second call (cache hit)', () => {
    const data = new Float32Array(2048).fill(0.3)
    const buffer = makeBuffer([data])
    const first = getOrComputePeaks('cache-test-track', buffer)
    const second = getOrComputePeaks('cache-test-track', buffer)
    expect(first).toBe(second)
  })
})
