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
  const hasErroredRef = useRef(false);
  const isLoadingRef = useRef(false);
  const isMountedRef = useRef(true);
  const activeLoadIdRef = useRef(0);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || !audioUrl || hasInitializedRef.current) {
      return;
    }
    hasInitializedRef.current = true;
    activeLoadIdRef.current += 1;
    const loadId = activeLoadIdRef.current;
    setStatus('loading');
    isReadyRef.current = false;
    hasErroredRef.current = false;
    isLoadingRef.current = true;

    if (waveSurferRef.current) {
      console.log(`[WaveformPlayer] existing instance detected; skipping re-init track=${trackId}`);
      return;
    }

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
    console.log(`[WaveformPlayer] load start track=${trackId} loadId=${loadId}`);

    const handleReady = () => {
      if (!isMountedRef.current || activeLoadIdRef.current !== loadId) {
        console.log(`[WaveformPlayer] ignore stale ready track=${trackId} loadId=${loadId}`);
        return;
      }
      isLoadingRef.current = false;
      isReadyRef.current = true;
      setStatus('ready');
      waveSurfer.setPlaybackRate(1);
      console.log(`[WaveformPlayer] ready track=${trackId} duration=${waveSurfer.getDuration()}`);
      onReady(trackId, { waveSurfer, durationSec: waveSurfer.getDuration() || 0 });
    };
    const handleError = (error: unknown) => {
      if (!isMountedRef.current || activeLoadIdRef.current !== loadId) {
        console.log(`[WaveformPlayer] ignore stale error track=${trackId} loadId=${loadId}`);
        return;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('AbortError') || errorMessage.includes('aborted')) {
        console.log(`[WaveformPlayer] ignored abort track=${trackId}: ${errorMessage}`);
        return;
      }
      isLoadingRef.current = false;
      isReadyRef.current = true;
      hasErroredRef.current = true;
      setStatus('error');
      console.warn(`[WaveformPlayer] error track=${trackId}`, error);
    };

    waveSurfer.on('ready', handleReady);
    waveSurfer.on('error', handleError);

    return () => {
      const instance = waveSurferRef.current;
      if (!instance) return;

      instance.un('ready', handleReady);
      instance.un('error', handleError);

      if (isLoadingRef.current) {
        console.log(`[WaveformPlayer] skip destroy while loading track=${trackId}`);
        waveSurferRef.current = null;
        return;
      }
      if (!isReadyRef.current && !hasErroredRef.current) {
        console.log(`[WaveformPlayer] skip destroy because instance is not ready/errored track=${trackId}`);
        waveSurferRef.current = null;
        return;
      }

      try {
        console.log(`[WaveformPlayer] destroy track=${trackId}`);
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
