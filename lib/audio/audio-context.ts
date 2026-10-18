let _ctx: AudioContext | null = null

export const LOOKAHEAD = 0.1 // seconds — shared with audio-engine.ts and tests

export function getAudioContext(): AudioContext {
  if (typeof window === 'undefined') {
    throw new Error('AudioContext is only available in the browser')
  }
  if (!_ctx) {
    // latencyHint 'playback' asks the browser for larger audio buffers. Harmony
    // plays back many stems at once and never records, so a few extra
    // milliseconds of output latency are invisible, while small buffers risk
    // underruns that are heard as crackles.
    _ctx = new AudioContext({ sampleRate: 48000, latencyHint: 'playback' })
  }
  return _ctx
}

export async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
}
