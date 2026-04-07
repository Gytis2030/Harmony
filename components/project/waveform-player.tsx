'use client';

import { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { useTimelineStore } from '@/store/timeline-store';

type WaveformPlayerProps = {
  audioUrl?: string;
};

export function WaveformPlayer({ audioUrl }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const setCursorMs = useTimelineStore((state) => state.setCursorMs);

  useEffect(() => {
    if (!containerRef.current || !audioUrl) {
      return;
    }

    const waveSurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#48486a',
      progressColor: '#6D5EF8',
      cursorColor: '#EAEAFF',
      height: 110,
      barWidth: 2,
      barGap: 1,
      barRadius: 2
    });

    waveSurfer.load(audioUrl);
    waveSurfer.on('timeupdate', (time) => setCursorMs(Math.floor(time * 1000)));

    return () => {
      waveSurfer.destroy();
    };
  }, [audioUrl, setCursorMs]);

  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">Waveform Timeline</h2>
      {audioUrl ? <div ref={containerRef} /> : <p className="text-sm text-muted">Upload a track to render waveform.</p>}
    </section>
  );
}
