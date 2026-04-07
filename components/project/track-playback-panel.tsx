'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WaveformPlayer } from '@/components/project/waveform-player';
import { useTimelineStore } from '@/store/timeline-store';

type PlaybackTrack = {
  id: string;
  name: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  durationSec: number | null;
  sampleRate: number | null;
  channelCount: number | null;
  offsetSec: number;
  signedUrl?: string;
};

type TrackPlaybackPanelProps = {
  tracks: PlaybackTrack[];
};

type TrackRuntime = {
  audio: HTMLAudioElement;
  durationSec: number;
};

function formatTime(seconds: number) {
  const clamped = Math.max(0, seconds);
  const mins = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60)
    .toString()
    .padStart(2, '0');
  return `${mins}:${secs}`;
}

export function TrackPlaybackPanel({ tracks }: TrackPlaybackPanelProps) {
  const setCursorMs = useTimelineStore((state) => state.setCursorMs);
  const runtimeRef = useRef<Record<string, TrackRuntime>>({});
  const rafRef = useRef<number | null>(null);
  const startClockRef = useRef<number | null>(null);
  const timelineAtStartRef = useRef(0);

  const [timelineSec, setTimelineSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mutedTrackIds, setMutedTrackIds] = useState<Record<string, boolean>>({});
  const [soloTrackIds, setSoloTrackIds] = useState<Record<string, boolean>>({});
  const [runtimeVersion, setRuntimeVersion] = useState(0);

  const projectDurationSec = useMemo(() => {
    return tracks.reduce((max, track) => {
      const loadedDuration = runtimeRef.current[track.id]?.durationSec ?? 0;
      const fallbackDuration = track.durationSec ?? loadedDuration;
      return Math.max(max, track.offsetSec + fallbackDuration);
    }, 0);
  }, [runtimeVersion, tracks]);

  const hasSolo = useMemo(() => Object.values(soloTrackIds).some(Boolean), [soloTrackIds]);

  const stopAllAudio = useCallback(() => {
    Object.values(runtimeRef.current).forEach(({ audio }) => {
      audio.pause();
    });
  }, []);

  const syncAudiosToTimeline = useCallback(
    (nextTimelineSec: number, shouldPlay: boolean) => {
      tracks.forEach((track) => {
        const runtime = runtimeRef.current[track.id];
        if (!runtime) return;

        const isMuted = !!mutedTrackIds[track.id];
        const isSoloed = !!soloTrackIds[track.id];
        const shouldBeAudible = hasSolo ? isSoloed : !isMuted;

        runtime.audio.muted = !shouldBeAudible;

        const localTime = nextTimelineSec - track.offsetSec;
        const clampedLocalTime = Math.max(0, Math.min(localTime, runtime.durationSec || 0));
        runtime.audio.currentTime = clampedLocalTime;

        const inTrackWindow = localTime >= 0 && localTime < runtime.durationSec;

        if (shouldPlay && inTrackWindow && shouldBeAudible) {
          void runtime.audio.play().catch(() => {
            // ignore autoplay interruptions in non-interactive situations
          });
        } else {
          runtime.audio.pause();
        }
      });
    },
    [hasSolo, mutedTrackIds, soloTrackIds, tracks]
  );

  const seekTimeline = useCallback(
    (nextTimelineSec: number) => {
      const bounded = Math.max(0, Math.min(nextTimelineSec, projectDurationSec || 0));
      setTimelineSec(bounded);
      setCursorMs(Math.floor(bounded * 1000));
      syncAudiosToTimeline(bounded, isPlaying);
    },
    [isPlaying, projectDurationSec, setCursorMs, syncAudiosToTimeline]
  );

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      startClockRef.current = null;
      return;
    }

    timelineAtStartRef.current = timelineSec;
    startClockRef.current = performance.now();

    const tick = () => {
      if (startClockRef.current == null) return;
      const elapsed = (performance.now() - startClockRef.current) / 1000;
      const next = timelineAtStartRef.current + elapsed;

      if (projectDurationSec > 0 && next >= projectDurationSec) {
        seekTimeline(projectDurationSec);
        setIsPlaying(false);
        return;
      }

      seekTimeline(next);
      rafRef.current = requestAnimationFrame(tick);
    };

    syncAudiosToTimeline(timelineSec, true);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, projectDurationSec, seekTimeline, syncAudiosToTimeline, timelineSec]);

  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, [stopAllAudio]);

  const handleTrackReady = useCallback((trackId: string, value: TrackRuntime) => {
    runtimeRef.current[trackId] = value;
    setRuntimeVersion((count) => count + 1);
  }, []);

  return (
    <div className="card p-4">
      <h2 className="text-lg font-medium">Project timeline</h2>
      <p className="mt-1 text-xs text-muted">Unified waveform playback with offset-aware stem alignment.</p>

      <div className="mt-4 rounded-lg border border-border bg-background p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button className="rounded bg-brand px-3 py-1 text-sm font-medium text-white" onClick={() => setIsPlaying(true)}>
            Play
          </button>
          <button className="rounded border border-border px-3 py-1 text-sm" onClick={() => setIsPlaying(false)}>
            Pause
          </button>
          <button
            className="rounded border border-border px-3 py-1 text-sm"
            onClick={() => {
              setIsPlaying(false);
              seekTimeline(0);
            }}
          >
            Stop
          </button>
          <p className="text-sm text-muted">
            {formatTime(timelineSec)} / {formatTime(projectDurationSec)}
          </p>
        </div>
        <input
          className="mt-3 w-full"
          type="range"
          min={0}
          max={Math.max(projectDurationSec, 0.001)}
          step={0.01}
          value={timelineSec}
          onChange={(event) => {
            seekTimeline(Number(event.target.value));
          }}
        />
      </div>

      <div className="mt-4 space-y-3">
        {tracks.length === 0 ? (
          <p className="text-sm text-muted">No tracks uploaded yet.</p>
        ) : (
          tracks.map((track) => {
            const runtimeDuration = runtimeRef.current[track.id]?.durationSec ?? track.durationSec ?? 0;
            const leftPct = projectDurationSec > 0 ? (track.offsetSec / projectDurationSec) * 100 : 0;
            const widthPct = projectDurationSec > 0 ? (runtimeDuration / projectDurationSec) * 100 : 100;
            const playheadPct = projectDurationSec > 0 ? (timelineSec / projectDurationSec) * 100 : 0;

            return (
              <div key={track.id} className="rounded-lg border border-border bg-background p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{track.name}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      className={`rounded border px-2 py-1 ${mutedTrackIds[track.id] ? 'border-brand text-brand' : 'border-border'}`}
                      onClick={() => setMutedTrackIds((prev) => ({ ...prev, [track.id]: !prev[track.id] }))}
                    >
                      Mute
                    </button>
                    <button
                      className={`rounded border px-2 py-1 ${soloTrackIds[track.id] ? 'border-brand text-brand' : 'border-border'}`}
                      onClick={() => setSoloTrackIds((prev) => ({ ...prev, [track.id]: !prev[track.id] }))}
                    >
                      Solo
                    </button>
                    <span className="text-muted">Offset: {track.offsetSec.toFixed(2)}s</span>
                  </div>
                </div>

                <div className="relative h-20 overflow-hidden rounded border border-border bg-background/60">
                  <div className="absolute bottom-0 top-0 w-0.5 bg-brand" style={{ left: `${playheadPct}%` }} />
                  <div className="absolute bottom-0 top-0" style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 2)}%` }}>
                    <WaveformPlayer trackId={track.id} audioUrl={track.signedUrl} onReady={handleTrackReady} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
