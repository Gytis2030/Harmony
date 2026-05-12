const peaksCache = new Map<string, Float32Array>()

export function extractPeaks(buffer: AudioBuffer, samplesPerPeak = 1024): Float32Array {
  const numPeaks = Math.ceil(buffer.length / samplesPerPeak)
  const peaks = new Float32Array(numPeaks)
  const channelCount = buffer.numberOfChannels

  for (let i = 0; i < numPeaks; i++) {
    const start = i * samplesPerPeak
    const end = Math.min(start + samplesPerPeak, buffer.length)
    let sum = 0
    let count = 0
    for (let c = 0; c < channelCount; c++) {
      const channel = buffer.getChannelData(c)
      for (let j = start; j < end; j++) {
        sum += Math.abs(channel[j])
        count++
      }
    }
    peaks[i] = count > 0 ? sum / count : 0
  }
  return peaks
}

export function getOrComputePeaks(trackId: string, buffer: AudioBuffer): Float32Array {
  const cached = peaksCache.get(trackId)
  if (cached) return cached
  const peaks = extractPeaks(buffer)
  peaksCache.set(trackId, peaks)
  return peaks
}
