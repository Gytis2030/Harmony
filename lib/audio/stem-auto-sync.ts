export type StemSyncTrack = {
  id: string;
  name: string;
  signedUrl?: string;
};

export type StemSyncResult = {
  trackId: string;
  offsetSec: number;
  confidence: number;
  status: 'aligned' | 'fallback_no_signal' | 'fallback_low_confidence' | 'reference';
  detail: string;
};

type AnalysisConfig = {
  targetHz: number;
  windowMs: number;
  maxLagSec: number;
  maxAnalysisSec: number;
  minOverlapSec: number;
};

const DEFAULT_CONFIG: AnalysisConfig = {
  targetHz: 120,
  windowMs: 50,
  maxLagSec: 20,
  maxAnalysisSec: 120,
  minOverlapSec: 8
};

function downmixToMono(buffer: AudioBuffer): Float32Array {
  const { numberOfChannels, length } = buffer;
  const mono = new Float32Array(length);

  for (let channel = 0; channel < numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) mono[i] += data[i];
  }

  const inv = 1 / Math.max(numberOfChannels, 1);
  for (let i = 0; i < length; i += 1) mono[i] *= inv;
  return mono;
}

function buildEnergyEnvelope(samples: Float32Array, sampleRate: number, config: AnalysisConfig): Float32Array {
  const hop = Math.max(1, Math.floor(sampleRate / config.targetHz));
  const win = Math.max(1, Math.floor((config.windowMs / 1000) * sampleRate));
  const maxFrames = Math.floor((config.maxAnalysisSec * sampleRate) / hop);
  const frameCount = Math.max(1, Math.min(Math.floor(samples.length / hop), maxFrames));

  const env = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const center = frame * hop;
    const start = Math.max(0, center - Math.floor(win / 2));
    const end = Math.min(samples.length, start + win);
    let sumSquares = 0;

    for (let i = start; i < end; i += 1) {
      const v = samples[i];
      sumSquares += v * v;
    }

    const count = Math.max(1, end - start);
    env[frame] = Math.sqrt(sumSquares / count);
  }

  return env;
}

function normalizeSignal(values: Float32Array): Float32Array {
  let mean = 0;
  for (let i = 0; i < values.length; i += 1) mean += values[i];
  mean /= Math.max(1, values.length);

  let variance = 0;
  for (let i = 0; i < values.length; i += 1) {
    const centered = values[i] - mean;
    variance += centered * centered;
  }

  const std = Math.sqrt(variance / Math.max(1, values.length));
  const normalized = new Float32Array(values.length);
  const denom = std > 1e-6 ? std : 1;

  for (let i = 0; i < values.length; i += 1) normalized[i] = (values[i] - mean) / denom;

  return normalized;
}

function estimateSignalActivity(values: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) sum += Math.abs(values[i]);
  return sum / Math.max(1, values.length);
}

function crossCorrelateOffset(
  reference: Float32Array,
  target: Float32Array,
  config: AnalysisConfig
): { offsetSec: number; confidence: number; ok: boolean; detail: string } {
  const maxLagFrames = Math.floor(config.maxLagSec * config.targetHz);
  const minOverlapFrames = Math.floor(config.minOverlapSec * config.targetHz);
  let bestLag = 0;
  let bestScore = -Infinity;
  let secondBest = -Infinity;

  for (let lag = -maxLagFrames; lag <= maxLagFrames; lag += 1) {
    const refStart = Math.max(0, -lag);
    const targetStart = Math.max(0, lag);
    const overlap = Math.min(reference.length - refStart, target.length - targetStart);
    if (overlap < minOverlapFrames) continue;

    let sum = 0;
    for (let i = 0; i < overlap; i += 1) {
      sum += reference[refStart + i] * target[targetStart + i];
    }

    const score = sum / overlap;
    if (score > bestScore) {
      secondBest = bestScore;
      bestScore = score;
      bestLag = lag;
    } else if (score > secondBest) {
      secondBest = score;
    }
  }

  if (!Number.isFinite(bestScore)) {
    return { offsetSec: 0, confidence: 0, ok: false, detail: 'Not enough overlap to estimate.' };
  }

  const separation = Math.max(0, bestScore - (Number.isFinite(secondBest) ? secondBest : -1));
  const confidence = Math.max(0, Math.min(1, bestScore * 0.75 + separation * 0.8));

  if (bestScore < 0.08 || confidence < 0.2) {
    return {
      offsetSec: 0,
      confidence,
      ok: false,
      detail: `Low confidence (score ${bestScore.toFixed(3)}).`
    };
  }

  return {
    offsetSec: bestLag / config.targetHz,
    confidence,
    ok: true,
    detail: `Aligned with score ${bestScore.toFixed(3)}.`
  };
}

async function decodeTrack(context: AudioContext, url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio (${response.status}).`);
  }

  const data = await response.arrayBuffer();
  return context.decodeAudioData(data.slice(0));
}

export async function autoSyncStemOffsets(
  tracks: StemSyncTrack[],
  referenceTrackId: string,
  options?: Partial<AnalysisConfig>
): Promise<StemSyncResult[]> {
  const config: AnalysisConfig = { ...DEFAULT_CONFIG, ...options };
  const context = new AudioContext();

  try {
    const decodedById = new Map<string, AudioBuffer>();

    for (const track of tracks) {
      if (!track.signedUrl) continue;
      try {
        decodedById.set(track.id, await decodeTrack(context, track.signedUrl));
      } catch {
        // ignore decode failures and use fallback offset for that track
      }
    }

    const referenceBuffer = decodedById.get(referenceTrackId);
    if (!referenceBuffer) {
      return tracks.map((track) => ({
        trackId: track.id,
        offsetSec: 0,
        confidence: 0,
        status: track.id === referenceTrackId ? 'reference' : 'fallback_no_signal',
        detail: track.id === referenceTrackId ? 'Reference track.' : 'Reference track could not be decoded.'
      }));
    }

    const referenceSignal = normalizeSignal(buildEnergyEnvelope(downmixToMono(referenceBuffer), referenceBuffer.sampleRate, config));
    const results: StemSyncResult[] = [];

    for (const track of tracks) {
      if (track.id === referenceTrackId) {
        results.push({
          trackId: track.id,
          offsetSec: 0,
          confidence: 1,
          status: 'reference',
          detail: 'Reference track.'
        });
        continue;
      }

      const targetBuffer = decodedById.get(track.id);
      if (!targetBuffer) {
        results.push({
          trackId: track.id,
          offsetSec: 0,
          confidence: 0,
          status: 'fallback_no_signal',
          detail: 'Track decode failed. Used offset 0s.'
        });
        continue;
      }

      const targetSignal = normalizeSignal(buildEnergyEnvelope(downmixToMono(targetBuffer), targetBuffer.sampleRate, config));
      const activity = estimateSignalActivity(targetSignal);
      if (activity < 0.15) {
        results.push({
          trackId: track.id,
          offsetSec: 0,
          confidence: 0,
          status: 'fallback_no_signal',
          detail: 'Signal too quiet/flat. Used offset 0s.'
        });
        continue;
      }

      const estimate = crossCorrelateOffset(referenceSignal, targetSignal, config);
      if (!estimate.ok) {
        results.push({
          trackId: track.id,
          offsetSec: 0,
          confidence: estimate.confidence,
          status: estimate.detail.includes('Low confidence') ? 'fallback_low_confidence' : 'fallback_no_signal',
          detail: `${estimate.detail} Used offset 0s.`
        });
        continue;
      }

      results.push({
        trackId: track.id,
        offsetSec: estimate.offsetSec,
        confidence: estimate.confidence,
        status: 'aligned',
        detail: estimate.detail
      });
    }

    // Keep all offsets non-negative so timeline still starts at 0.
    const minOffset = results.reduce((min, entry) => Math.min(min, entry.offsetSec), 0);
    return results.map((entry) => ({
      ...entry,
      offsetSec: Number((entry.offsetSec - minOffset).toFixed(3))
    }));
  } finally {
    await context.close();
  }
}
