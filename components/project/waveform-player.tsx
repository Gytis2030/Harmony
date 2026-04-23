'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

type WaveformPlayerProps = {
  trackId: string;
  audioUrl?: string;
  onReady: (trackId: string, value: { waveSurfer: WaveSurfer; durationSec: number }) => void;
  onDestroy?: (trackId: string) => void;
};

export function WaveformPlayer({ trackId, audioUrl, onReady, onDestroy }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const isMountedRef = useRef(true);
  const isLoadingRef = useRef(false);
  const isReadyRef = useRef(false);
  const pendingDestroyReasonRef = useRef<string | null>(null);
  const shouldDestroyOnSettleRef = useRef(false);
  const lastLoadedUrlRef = useRef<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const destroyWaveSurfer = useCallback((reason: string) => {
    const instance = waveSurferRef.current;
    if (!instance) return;
    console.log(`[WaveformPlayer] destroy track=${trackId} reason=${reason}`);
    try {
      instance.stop();
      instance.destroy();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('AbortError') && !errorMessage.includes('aborted')) {
        console.warn(`[WaveformPlayer] destroy failed track=${trackId}`, error);
      }
    } finally {
      waveSurferRef.current = null;
      isLoadingRef.current = false;
      isReadyRef.current = false;
      shouldDestroyOnSettleRef.current = false;
      pendingDestroyReasonRef.current = null;
      lastLoadedUrlRef.current = null;
      onDestroy?.(trackId);
    }
  }, [onDestroy, trackId]);

  useEffect(() => {
    if (!containerRef.current || waveSurferRef.current) return;

    console.log(`[WaveformPlayer] init track=${trackId}`);
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
      backend: 'MediaElement',
      interact: false
    });
    waveSurferRef.current = waveSurfer;

    return () => {
      if (!waveSurferRef.current) return;
      if (isLoadingRef.current) {
        shouldDestroyOnSettleRef.current = true;
        pendingDestroyReasonRef.current = 'component-unmount';
        console.log(`[WaveformPlayer] skipped destroy due to loading track=${trackId} reason=component-unmount`);
        return;
      }
      destroyWaveSurfer('component-unmount');
    };
  }, [destroyWaveSurfer, trackId]);

  useEffect(() => {
    const waveSurfer = waveSurferRef.current;
    if (!waveSurfer || !audioUrl) {
      setStatus('idle');
      lastLoadedUrlRef.current = null;
      return;
    }
    if (lastLoadedUrlRef.current === audioUrl) return;

    lastLoadedUrlRef.current = audioUrl;
    isLoadingRef.current = true;
    isReadyRef.current = false;
    setStatus('loading');
    console.log(`[WaveformPlayer] load start track=${trackId} url=${audioUrl}`);

    const handleReady = () => {
      isLoadingRef.current = false;
      isReadyRef.current = true;
      console.log(`[WaveformPlayer] ready track=${trackId}`);
      if (!isMountedRef.current) {
        if (shouldDestroyOnSettleRef.current) {
          destroyWaveSurfer(pendingDestroyReasonRef.current ?? 'post-ready-unmount');
        }
        return;
      }
      setStatus('ready');
      onReady(trackId, { waveSurfer, durationSec: waveSurfer.getDuration() || 0 });
      if (shouldDestroyOnSettleRef.current) {
        destroyWaveSurfer(pendingDestroyReasonRef.current ?? 'post-ready-destroy');
      }
    };

    const handleError = (error: unknown) => {
      isLoadingRef.current = false;
      isReadyRef.current = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('AbortError') || errorMessage.includes('aborted')) {
        console.log(`[WaveformPlayer] ignored abort track=${trackId}`);
        if (shouldDestroyOnSettleRef.current) {
          destroyWaveSurfer(pendingDestroyReasonRef.current ?? 'post-abort-destroy');
        }
        return;
      }
      if (!isMountedRef.current) {
        if (shouldDestroyOnSettleRef.current) {
          destroyWaveSurfer(pendingDestroyReasonRef.current ?? 'post-error-unmount');
        }
        return;
      }
      setStatus('error');
      console.warn(`[WaveformPlayer] error track=${trackId}`, error);
      if (shouldDestroyOnSettleRef.current) {
        destroyWaveSurfer(pendingDestroyReasonRef.current ?? 'post-error-destroy');
      }
    };

    waveSurfer.on('ready', handleReady);
    waveSurfer.on('error', handleError);
    const loadResult = waveSurfer.load(audioUrl);
    if (loadResult && typeof loadResult === 'object' && 'catch' in loadResult && typeof loadResult.catch === 'function') {
      loadResult.catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('AbortError') || errorMessage.includes('aborted')) {
          console.log(`[WaveformPlayer] ignored abort track=${trackId}`);
          return;
        }
        console.warn(`[WaveformPlayer] load promise rejected track=${trackId}`, error);
      });
    }

    return () => {
      waveSurfer.un('ready', handleReady);
      waveSurfer.un('error', handleError);
    };
  }, [audioUrl, destroyWaveSurfer, onReady, trackId]);

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
