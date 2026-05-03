let _ctx: AudioContext | null = null

export const LOOKAHEAD = 0.1 // seconds — shared with audio-engine.ts and tests

export function getAudioContext(): AudioContext {
  if (typeof window === 'undefined') {
    throw new Error('AudioContext is only available in the browser')
  }
  if (!_ctx) {
    _ctx = new AudioContext({ sampleRate: 48000 })
  }
  return _ctx
}

export async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
}
