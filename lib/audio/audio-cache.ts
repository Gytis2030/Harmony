// Persistent browser cache for audio file bytes, keyed by audioFileId.
//
// Why: every project open used to re-download every stem from R2, because each
// signed URL is unique and the browser's normal HTTP cache never matches it.
// An audio file's bytes never change for a given audioFileId (a new upload gets
// a new id), so it is safe to keep them in Cache Storage indefinitely. Repeat
// opens then skip the network entirely and only pay for decoding.
//
// Everything here is best-effort: if Cache Storage is unavailable (private
// windows, old browsers, tests) or full, we silently fall back to the network.

const CACHE_NAME = 'harmony-audio-v1'

function cacheKey(audioFileId: string): string {
  // Cache Storage needs a URL-shaped key; it is never actually requested.
  return `/__harmony-audio-cache/${encodeURIComponent(audioFileId)}`
}

function cacheAvailable(): boolean {
  return typeof window !== 'undefined' && 'caches' in window
}

export async function readCachedAudio(audioFileId: string): Promise<ArrayBuffer | null> {
  if (!cacheAvailable()) return null
  try {
    const cache = await caches.open(CACHE_NAME)
    const hit = await cache.match(cacheKey(audioFileId))
    return hit ? await hit.arrayBuffer() : null
  } catch {
    return null
  }
}

export async function writeCachedAudio(audioFileId: string, bytes: ArrayBuffer): Promise<void> {
  if (!cacheAvailable()) return
  try {
    const cache = await caches.open(CACHE_NAME)
    // Callers pass a copy, because decodeAudioData detaches the buffer it decodes.
    await cache.put(cacheKey(audioFileId), new Response(bytes))
  } catch {
    /* quota exceeded or storage blocked — not worth failing the load over */
  }
}
