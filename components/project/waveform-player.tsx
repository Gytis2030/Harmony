'use client';

import { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';

type WaveformPlayerProps = {
  trackId: string;
  audioUrl?: string;
  onReady: (trackId: string, value: { audio: HTMLAudioElement; durationSec: number }) => void;
};

export function WaveformPlayer({ trackId, audioUrl, onReady }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || !audioUrl) {
      return;
    }

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
      onReady(trackId, { audio, durationSec: waveSurfer.getDuration() || audio.duration || 0 });
    };

    waveSurfer.on('ready', handleReady);
    waveSurfer.load(audioUrl);

    return () => {
      waveSurfer.un('ready', handleReady);
      waveSurfer.destroy();
      audio.pause();
      audio.src = '';
    };
  }, [audioUrl, onReady, trackId]);

  if (!audioUrl) {
    return <p className="text-sm text-muted">Track file unavailable.</p>;
  }

  return <div ref={containerRef} />;
}
