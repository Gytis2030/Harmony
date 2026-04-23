'use client';

import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

type WaveformPlayerProps = {
  trackId: string;
  audioUrl?: string;
  onReady: (trackId: string, value: { durationSec: number }) => void;
  onDestroy?: (trackId: string) => void;
};

/**
 * WaveSurfer is visualization-only in Harmony V2.
 * Transport/playback must be handled by HTMLAudioElement in the parent.
 */
export function WaveformPlayer({ trackId, audioUrl, onReady, onDestroy }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    if (!containerRef.current) return;

    const waveSurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#48486a',
      progressColor: '#6D5EF8',
      cursorWidth: 0,
      height: 80,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: false,
      interact: false
    });

    waveSurferRef.current = waveSurfer;

    return () => {
      waveSurfer.destroy();
      waveSurferRef.current = null;
      onDestroy?.(trackId);
    };
  }, [onDestroy, trackId]);

  useEffect(() => {
    const waveSurfer = waveSurferRef.current;
    if (!waveSurfer || !audioUrl) {
      setStatus('idle');
      return;
    }

    setStatus('loading');

    const handleReady = () => {
      setStatus('ready');
      onReady(trackId, { durationSec: waveSurfer.getDuration() || 0 });
    };

    const handleError = () => {
      setStatus('error');
    };

    waveSurfer.on('ready', handleReady);
    waveSurfer.on('error', handleError);
    waveSurfer.load(audioUrl);

    return () => {
      waveSurfer.un('ready', handleReady);
      waveSurfer.un('error', handleError);
    };
  }, [audioUrl, onReady, trackId]);

  if (!audioUrl) {
    return <p className="text-sm text-muted">Track file unavailable.</p>;
  }

  return (
    <div className="h-full">
      {status === 'loading' ? <p className="mb-1 text-xs text-muted">Loading waveform…</p> : null}
      {status === 'error' ? <p className="mb-1 text-xs text-red-400">Unable to render waveform for this track.</p> : null}
      <div ref={containerRef} />
    </div>
  );
}
