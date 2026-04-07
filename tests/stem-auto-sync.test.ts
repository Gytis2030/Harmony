import test from 'node:test';
import assert from 'node:assert/strict';
import { crossCorrelateOffset, normalizeOffsetsToZero, normalizeSignal } from '../lib/audio/stem-auto-sync.ts';

test('crossCorrelateOffset finds lag for shifted envelope', () => {
  const reference = normalizeSignal(Float32Array.from([0, 0, 1, 2, 3, 1, 0, 0, 0, 0]));
  const shifted = normalizeSignal(Float32Array.from([0, 0, 0, 1, 2, 3, 1, 0, 0, 0]));

  const result = crossCorrelateOffset(reference, shifted, {
    targetHz: 2,
    windowMs: 50,
    maxLagSec: 5,
    maxAnalysisSec: 120,
    minOverlapSec: 1
  });

  assert.equal(result.ok, true);
  assert.equal(result.offsetSec, 0.5);
  assert.ok(result.confidence > 0.2);
});

test('normalizeOffsetsToZero lifts negative offsets while preserving deltas', () => {
  const normalized = normalizeOffsetsToZero([
    { trackId: 'a', offsetSec: -1.25, confidence: 1, status: 'aligned', detail: '' },
    { trackId: 'b', offsetSec: 0.25, confidence: 1, status: 'aligned', detail: '' }
  ]);

  assert.equal(normalized[0].offsetSec, 0);
  assert.equal(normalized[1].offsetSec, 1.5);
});
