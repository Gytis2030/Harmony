'use client';

import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

type WaveformPlayerProps = {
  trackId: string;
  audioUrl?: string;
  onReady: (trackId: string, value: { waveSurfer: WaveSurfer; durationSec: number }) => void;
};

export function WaveformPlayer({ trackId, audioUrl, onReady }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const hasInitializedRef = useRef(false);
  const isReadyRef = useRef(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    if (!containerRef.current || !audioUrl || hasInitializedRef.current) {
      return;
    }
    hasInitializedRef.current = true;
    setStatus('loading');
    isReadyRef.current = false;

    const waveSurfer = WaveSurfer.create({
      container: containerRef.current,
      url: audioUrl,
      waveColor: '#48486a',
      progressColor: '#6D5EF8',
      cursorWidth: 0,
      height: 80,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      interact: false
    });
    waveSurferRef.current = waveSurfer;

    const handleReady = () => {
      isReadyRef.current = true;
      setStatus('ready');
      waveSurfer.setPlaybackRate(1);
      console.log(`[WaveformPlayer] ready track=${trackId} duration=${waveSurfer.getDuration()}`);
      onReady(trackId, { waveSurfer, durationSec: waveSurfer.getDuration() || 0 });
    };
    const handleError = () => {
      isReadyRef.current = true;
      setStatus('error');
    };

    waveSurfer.on('ready', handleReady);
    waveSurfer.on('error', handleError);

    return () => {
      const instance = waveSurferRef.current;
      if (!instance) return;

      instance.un('ready', handleReady);
      instance.un('error', handleError);

      if (!isReadyRef.current) {
        console.log(`[WaveformPlayer] skip destroy while loading track=${trackId}`);
        waveSurferRef.current = null;
        return;
      }

      try {
        instance.stop();
        instance.destroy();
      } catch (error) {
        console.warn(`[WaveformPlayer] destroy failed track=${trackId}`, error);
      } finally {
        waveSurferRef.current = null;
      }
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
