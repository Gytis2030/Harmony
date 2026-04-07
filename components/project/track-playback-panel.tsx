'use client';

import { useMemo, useState } from 'react';
import { WaveformPlayer } from '@/components/project/waveform-player';

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

function formatFileSize(bytes: number | null) {
  if (bytes == null) return 'n/a';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

export function TrackPlaybackPanel({ tracks }: TrackPlaybackPanelProps) {
  const [selectedTrackId, setSelectedTrackId] = useState<string | undefined>(tracks[0]?.id);

  const selectedTrack = useMemo(() => tracks.find((track) => track.id === selectedTrackId) ?? tracks[0], [selectedTrackId, tracks]);

  return (
    <div className="card p-4">
      <h2 className="text-lg font-medium">Tracks & alignment metadata</h2>
      <p className="mt-1 text-xs text-muted">All playback runs through the waveform timeline for the selected track.</p>

      <ul className="mt-3 space-y-2 text-sm">
        {tracks.length === 0 ? (
          <li className="text-muted">No tracks uploaded yet.</li>
        ) : (
          tracks.map((track) => {
            const isSelected = selectedTrack?.id === track.id;

            return (
              <li
                key={track.id}
                className={`cursor-pointer space-y-1 rounded-lg border bg-background p-3 transition ${
                  isSelected ? 'border-brand' : 'border-border'
                }`}
                onClick={() => setSelectedTrackId(track.id)}
              >
                <p className="font-medium">{track.name}</p>
                <p className="text-muted">MIME: {track.mimeType ?? 'n/a'} · Size: {formatFileSize(track.fileSizeBytes)} · Offset: {track.offsetSec}s</p>
                <p className="text-muted">
                  Duration: {track.durationSec ?? 'n/a'}s · Sample rate: {track.sampleRate ?? 'n/a'} · Channels: {track.channelCount ?? 'n/a'}
                </p>
              </li>
            );
          })
        )}
      </ul>

      <div className="mt-4">
        <WaveformPlayer audioUrl={selectedTrack?.signedUrl} />
      </div>
    </div>
  );
}
