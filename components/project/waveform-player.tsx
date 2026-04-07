'use client';

import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

type WaveformPlayerProps = {
  trackId: string;
  audioUrl?: string;
  onReady: (trackId: string, value: { audio: HTMLAudioElement; durationSec: number }) => void;
};

export function WaveformPlayer({ trackId, audioUrl, onReady }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    if (!containerRef.current || !audioUrl) {
      return;
    }
    setStatus('loading');

    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = audioUrl;

    const waveSurfer = WaveSurfer.create({
      container: containerRef.current,
      media: audio,
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

    const handleReady = () => {
      setStatus('ready');
      onReady(trackId, { audio, durationSec: waveSurfer.getDuration() || audio.duration || 0 });
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
      waveSurfer.destroy();
      audio.pause();
      audio.src = '';
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
