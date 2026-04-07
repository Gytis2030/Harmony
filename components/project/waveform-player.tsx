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
    if (!containerRef.current || waveSurferRef.current) return;

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
      const instance = waveSurferRef.current;
      if (!instance) return;
      try {
        instance.stop();
        instance.destroy();
      } catch (error) {
        console.warn(`[WaveformPlayer] destroy failed track=${trackId}`, error);
      } finally {
        waveSurferRef.current = null;
      }
    };
  }, [trackId]);

  useEffect(() => {
    const waveSurfer = waveSurferRef.current;
    if (!waveSurfer || !audioUrl) {
      setStatus('idle');
      return;
    }

    activeLoadIdRef.current += 1;
    const loadId = activeLoadIdRef.current;
    setStatus('loading');

    const handleReady = () => {
      if (!isMountedRef.current || activeLoadIdRef.current !== loadId) return;
      setStatus('ready');
      onReady(trackId, { waveSurfer, durationSec: waveSurfer.getDuration() || 0 });
    };

    const handleError = (error: unknown) => {
      if (!isMountedRef.current || activeLoadIdRef.current !== loadId) return;
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('AbortError') || errorMessage.includes('aborted')) {
        console.log(`[WaveformPlayer] ignored abort track=${trackId}`);
        return;
      }
      setStatus('error');
      console.warn(`[WaveformPlayer] error track=${trackId}`, error);
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
