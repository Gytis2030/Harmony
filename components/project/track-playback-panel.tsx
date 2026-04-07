'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { WaveformPlayer } from '@/components/project/waveform-player';
import { autoSyncStemOffsets, type StemSyncResult } from '@/lib/audio/stem-auto-sync';
import { useTimelineStore } from '@/store/timeline-store';
import type { Json } from '@/types/database';

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

type ReviewComment = {
  id: string;
  projectId: string;
  trackId: string | null;
  authorId: string;
  authorName: string;
  timestampSec: number;
  body: string;
  resolved: boolean;
  createdAt: string;
};

type TrackPlaybackPanelProps = {
  projectId: string;
  tracks: PlaybackTrack[];
  initialComments: ReviewComment[];
  initialVersions: ProjectVersionItem[];
};

type ProjectVersionItem = {
  id: string;
  label: string;
  notes: string | null;
  createdAt: string;
  createdBy: string;
  creatorName: string;
  snapshotJson: Json;
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

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function TrackPlaybackPanel({ projectId, tracks, initialComments, initialVersions }: TrackPlaybackPanelProps) {
  const OFFSET_NUDGE_FINE = 0.01;
  const OFFSET_NUDGE_COARSE = 0.1;
  const cursorMs = useTimelineStore((state) => state.cursorMs);
  const setCursorMs = useTimelineStore((state) => state.setCursorMs);
  const selectedTrackId = useTimelineStore((state) => state.selectedTrackId);
  const setSelectedTrackId = useTimelineStore((state) => state.setSelectedTrackId);
  const pendingSeekMs = useTimelineStore((state) => state.pendingSeekMs);
  const clearPendingSeek = useTimelineStore((state) => state.clearPendingSeek);
  const runtimeRef = useRef<Record<string, TrackRuntime>>({});
  const rafRef = useRef<number | null>(null);
  const startClockRef = useRef<number | null>(null);
  const timelineAtStartRef = useRef(0);

  const [timelineSec, setTimelineSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackList, setTrackList] = useState(tracks);
  const [referenceTrackId, setReferenceTrackId] = useState(tracks[0]?.id ?? '');
  const [isSyncingStems, setIsSyncingStems] = useState(false);
  const [syncResults, setSyncResults] = useState<StemSyncResult[]>([]);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [mutedTrackIds, setMutedTrackIds] = useState<Record<string, boolean>>({});
  const [soloTrackIds, setSoloTrackIds] = useState<Record<string, boolean>>({});
  const [runtimeVersion, setRuntimeVersion] = useState(0);
  const [offsetInputs, setOffsetInputs] = useState<Record<string, string>>({});
  const [offsetSaving, setOffsetSaving] = useState<Record<string, boolean>>({});
  const [offsetErrorByTrack, setOffsetErrorByTrack] = useState<Record<string, string | null>>({});
  const [comments, setComments] = useState(initialComments);
  const [versions, setVersions] = useState(initialVersions);
  const [selectedVersionId, setSelectedVersionId] = useState(initialVersions[0]?.id ?? null);
  const [versionLabelInput, setVersionLabelInput] = useState('');
  const [versionNotesInput, setVersionNotesInput] = useState('');
  const [versionActionMessage, setVersionActionMessage] = useState<string | null>(null);
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const [isRestoringOffsets, setIsRestoringOffsets] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentTimestampSec, setCommentTimestampSec] = useState(0);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    setTrackList(tracks);
    setReferenceTrackId((prev) => (tracks.some((track) => track.id === prev) ? prev : tracks[0]?.id || ''));
    setOffsetInputs(Object.fromEntries(tracks.map((track) => [track.id, track.offsetSec.toFixed(2)])));
  }, [tracks]);

  useEffect(() => {
    setVersions(initialVersions);
    setSelectedVersionId((prev) => (initialVersions.some((version) => version.id === prev) ? prev : initialVersions[0]?.id ?? null));
  }, [initialVersions]);

  const trackNameById = useMemo(() => new Map(trackList.map((track) => [track.id, track.name])), [trackList]);

  const projectDurationSec = useMemo(() => {
    return trackList.reduce((max, track) => {
      const loadedDuration = runtimeRef.current[track.id]?.durationSec ?? 0;
      const fallbackDuration = track.durationSec ?? loadedDuration;
      return Math.max(max, track.offsetSec + fallbackDuration);
    }, 0);
  }, [runtimeVersion, trackList]);

  const hasSolo = useMemo(() => Object.values(soloTrackIds).some(Boolean), [soloTrackIds]);

  const sortedComments = useMemo(() => {
    return [...comments].sort((a, b) => a.timestampSec - b.timestampSec);
  }, [comments]);

  const selectedVersion = useMemo(() => versions.find((entry) => entry.id === selectedVersionId) ?? null, [selectedVersionId, versions]);

  const stopAllAudio = useCallback(() => {
    Object.values(runtimeRef.current).forEach(({ audio }) => {
      audio.pause();
    });
  }, []);

  const syncAudiosToTimeline = useCallback(
    (nextTimelineSec: number, shouldPlay: boolean) => {
      trackList.forEach((track) => {
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
    [hasSolo, mutedTrackIds, soloTrackIds, trackList]
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
    setCommentTimestampSec(cursorMs / 1000);
  }, [cursorMs]);

  useEffect(() => {
    if (pendingSeekMs == null) return;

    seekTimeline(pendingSeekMs / 1000);
    setIsPlaying(false);
    clearPendingSeek();
  }, [clearPendingSeek, pendingSeekMs, seekTimeline]);

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

  const handleTimelineClick = useCallback(
    (event: MouseEvent<HTMLDivElement>, totalDurationSec: number) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const ratio = (event.clientX - bounds.left) / bounds.width;
      const nextTimestamp = Math.max(0, Math.min(totalDurationSec, ratio * totalDurationSec));
      seekTimeline(nextTimestamp);
    },
    [seekTimeline]
  );

  const handleCreateComment = useCallback(async () => {
    if (!commentText.trim()) {
      setCommentError('Comment text is required.');
      return;
    }

    setCommentError(null);
    setIsSavingComment(true);

    const response = await fetch(`/api/projects/${projectId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestampSec: commentTimestampSec,
        body: commentText.trim(),
        trackId: selectedTrackId
      })
    });

    const payload = await response.json();

    if (!response.ok) {
      setCommentError(payload.error ?? 'Failed to create comment.');
      setIsSavingComment(false);
      return;
    }

    const created = payload.comment as {
      id: string;
      project_id: string;
      track_id: string | null;
      author_id: string;
      timestamp_sec: number;
      body: string;
      resolved: boolean;
      created_at: string;
      profiles?: { full_name: string | null; email: string | null } | null;
    };

    setComments((prev) => [
      ...prev,
      {
        id: created.id,
        projectId: created.project_id,
        trackId: created.track_id,
        authorId: created.author_id,
        timestampSec: created.timestamp_sec,
        body: created.body,
        resolved: created.resolved,
        createdAt: created.created_at,
        authorName: created.profiles?.full_name || created.profiles?.email || 'Unknown user'
      }
    ]);
    setCommentText('');
    setIsSavingComment(false);
  }, [commentText, commentTimestampSec, projectId, selectedTrackId]);

  const toggleResolved = useCallback(
    async (commentId: string, nextResolved: boolean) => {
      const response = await fetch(`/api/projects/${projectId}/comments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, resolved: nextResolved })
      });

      if (!response.ok) return;

      setComments((prev) => prev.map((comment) => (comment.id === commentId ? { ...comment, resolved: nextResolved } : comment)));
    },
    [projectId]
  );

  const handleAutoSync = useCallback(async () => {
    if (trackList.length === 0) {
      setSyncMessage('No tracks available to sync.');
      return;
    }

    const chosenReferenceId = referenceTrackId || trackList[0]?.id;
    if (!chosenReferenceId) return;

    setIsSyncingStems(true);
    setSyncMessage(null);
    setSyncResults([]);

    try {
      const results = await autoSyncStemOffsets(
        trackList.map((track) => ({ id: track.id, name: track.name, signedUrl: track.signedUrl })),
        chosenReferenceId
      );

      const response = await fetch(`/api/projects/${projectId}/tracks/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offsets: results.map((result) => ({
            trackId: result.trackId,
            offsetSec: result.offsetSec
          }))
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to save synced offsets.');
      }

      const nextOffsets = new Map(results.map((result) => [result.trackId, result.offsetSec]));
      setTrackList((prev) => prev.map((track) => ({ ...track, offsetSec: nextOffsets.get(track.id) ?? track.offsetSec })));
      setOffsetInputs((prev) => {
        const next = { ...prev };
        results.forEach((result) => {
          next[result.trackId] = result.offsetSec.toFixed(2);
        });
        return next;
      });
      setSyncResults(results);
      seekTimeline(timelineSec);

      const alignedCount = results.filter((entry) => entry.status === 'aligned').length;
      const fallbackCount = results.filter((entry) => entry.status !== 'aligned' && entry.status !== 'reference').length;
      setSyncMessage(`Auto sync complete. ${alignedCount} aligned, ${fallbackCount} fallback to 0s.`);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'Auto sync failed.');
    } finally {
      setIsSyncingStems(false);
    }
  }, [projectId, referenceTrackId, seekTimeline, timelineSec, trackList]);

  const persistTrackOffset = useCallback(
    async (trackId: string, nextOffsetSec: number) => {
      setOffsetSaving((prev) => ({ ...prev, [trackId]: true }));
      setOffsetErrorByTrack((prev) => ({ ...prev, [trackId]: null }));

      try {
        const response = await fetch(`/api/projects/${projectId}/tracks/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            offsets: [{ trackId, offsetSec: nextOffsetSec }]
          })
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? 'Failed to save track offset.');
        }
      } catch (error) {
        setOffsetErrorByTrack((prev) => ({
          ...prev,
          [trackId]: error instanceof Error ? error.message : 'Failed to save track offset.'
        }));
      } finally {
        setOffsetSaving((prev) => ({ ...prev, [trackId]: false }));
      }
    },
    [projectId]
  );

  const updateTrackOffset = useCallback(
    (trackId: string, nextOffsetSec: number) => {
      const sanitizedOffset = Number(Math.max(0, nextOffsetSec).toFixed(3));
      setTrackList((prev) => prev.map((track) => (track.id === trackId ? { ...track, offsetSec: sanitizedOffset } : track)));
      setOffsetInputs((prev) => ({ ...prev, [trackId]: sanitizedOffset.toFixed(2) }));
      seekTimeline(timelineSec);
      void persistTrackOffset(trackId, sanitizedOffset);
    },
    [persistTrackOffset, seekTimeline, timelineSec]
  );

  const createVersion = useCallback(async () => {
    if (!versionLabelInput.trim()) {
      setVersionActionMessage('Version label is required.');
      return;
    }

    setIsSavingVersion(true);
    setVersionActionMessage(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: versionLabelInput.trim(),
          notes: versionNotesInput.trim() || null
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to save version.');
      }

      const version = payload.version as {
        id: string;
        created_by: string;
        label: string;
        notes: string | null;
        created_at: string;
        snapshot_json: Json;
      };
      const createdVersion: ProjectVersionItem = {
        id: version.id,
        createdBy: version.created_by,
        label: version.label,
        notes: version.notes,
        createdAt: version.created_at,
        creatorName: 'You',
        snapshotJson: version.snapshot_json
      };
      setVersions((prev) => [createdVersion, ...prev]);
      setSelectedVersionId(version.id);
      setVersionLabelInput('');
      setVersionNotesInput('');
      setVersionActionMessage('Version saved.');
    } catch (error) {
      setVersionActionMessage(error instanceof Error ? error.message : 'Failed to save version.');
    } finally {
      setIsSavingVersion(false);
    }
  }, [projectId, versionLabelInput, versionNotesInput]);

  const restoreOffsetsFromVersion = useCallback(async () => {
    if (!selectedVersion) {
      setVersionActionMessage('Select a version first.');
      return;
    }

    setIsRestoringOffsets(true);
    setVersionActionMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/versions/${selectedVersion.id}/restore-offsets`, {
        method: 'POST'
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to restore offsets.');
      }

      const restoredOffsets = (payload.restoredOffsets ?? []) as Array<{ id: string; offsetSec: number }>;
      const nextOffsetMap = new Map(restoredOffsets.map((entry) => [entry.id, entry.offsetSec]));
      setTrackList((prev) => prev.map((track) => ({ ...track, offsetSec: nextOffsetMap.get(track.id) ?? track.offsetSec })));
      setOffsetInputs((prev) => {
        const next = { ...prev };
        restoredOffsets.forEach((entry) => {
          next[entry.id] = entry.offsetSec.toFixed(2);
        });
        return next;
      });
      seekTimeline(timelineSec);
      setVersionActionMessage('Track offsets restored from selected version.');
    } catch (error) {
      setVersionActionMessage(error instanceof Error ? error.message : 'Failed to restore offsets.');
    } finally {
      setIsRestoringOffsets(false);
    }
  }, [projectId, seekTimeline, selectedVersion, timelineSec]);

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="card p-4">
        <h2 className="text-lg font-medium">Project timeline</h2>
        <p className="mt-1 text-xs text-muted">Unified waveform playback with offset-aware stem alignment and review notes.</p>

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
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <label className="text-xs font-medium text-muted">Reference track</label>
            <select
              className="rounded border border-border bg-background px-2 py-1 text-sm"
              value={referenceTrackId}
              onChange={(event) => setReferenceTrackId(event.target.value)}
            >
              {trackList.map((track) => (
                <option key={`reference-${track.id}`} value={track.id}>
                  {track.name}
                </option>
              ))}
            </select>
            <button className="rounded border border-border px-3 py-1 text-sm" onClick={handleAutoSync} disabled={isSyncingStems}>
              {isSyncingStems ? 'Syncing…' : 'Auto Sync Stems'}
            </button>
          </div>
          {syncMessage ? <p className="mt-2 text-xs text-muted">{syncMessage}</p> : null}
          {syncResults.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {syncResults.map((result) => (
                <li key={`sync-result-${result.trackId}`}>
                  {trackNameById.get(result.trackId) ?? 'Track'}: {result.status} ({result.confidence.toFixed(2)}) — {result.detail}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="relative mt-3" onClick={(event) => handleTimelineClick(event, Math.max(projectDurationSec, 0.001))}>
            <input
              className="w-full"
              type="range"
              min={0}
              max={Math.max(projectDurationSec, 0.001)}
              step={0.01}
              value={timelineSec}
              onChange={(event) => {
                seekTimeline(Number(event.target.value));
              }}
            />
            {sortedComments.map((comment) => {
              const leftPct = projectDurationSec > 0 ? (comment.timestampSec / projectDurationSec) * 100 : 0;
              return (
                <button
                  key={`top-marker-${comment.id}`}
                  className={`absolute top-0 h-2 w-2 -translate-x-1/2 rounded-full ${comment.resolved ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ left: `${Math.min(Math.max(leftPct, 0), 100)}%` }}
                  title={comment.body}
                  onClick={() => seekTimeline(comment.timestampSec)}
                />
              );
            })}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {trackList.length === 0 ? (
            <p className="text-sm text-muted">No tracks uploaded yet.</p>
          ) : (
            trackList.map((track) => {
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
                        className={`rounded border px-2 py-1 ${selectedTrackId === track.id ? 'border-brand text-brand' : 'border-border'}`}
                        onClick={() => setSelectedTrackId(selectedTrackId === track.id ? null : track.id)}
                      >
                        {selectedTrackId === track.id ? 'Track Selected' : 'Select Track'}
                      </button>
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
                      <div className="flex items-center gap-1 rounded border border-border px-1 py-1">
                        <button
                          className="rounded border border-border px-2 py-0.5"
                          onClick={() => updateTrackOffset(track.id, track.offsetSec - OFFSET_NUDGE_COARSE)}
                          title={`Nudge left by ${OFFSET_NUDGE_COARSE}s`}
                        >
                          -0.1
                        </button>
                        <button
                          className="rounded border border-border px-2 py-0.5"
                          onClick={() => updateTrackOffset(track.id, track.offsetSec - OFFSET_NUDGE_FINE)}
                          title={`Nudge left by ${OFFSET_NUDGE_FINE}s`}
                        >
                          -0.01
                        </button>
                        <input
                          className="w-20 rounded border border-border bg-background px-2 py-0.5 text-right"
                          type="number"
                          min={0}
                          step={0.01}
                          value={offsetInputs[track.id] ?? track.offsetSec.toFixed(2)}
                          onChange={(event) => {
                            const value = event.target.value;
                            setOffsetInputs((prev) => ({ ...prev, [track.id]: value }));
                            const parsed = Number(value);
                            if (!Number.isNaN(parsed) && value !== '') {
                              setTrackList((prev) =>
                                prev.map((entry) => (entry.id === track.id ? { ...entry, offsetSec: Math.max(0, parsed) } : entry))
                              );
                              seekTimeline(timelineSec);
                            }
                          }}
                          onBlur={() => {
                            const parsed = Number(offsetInputs[track.id]);
                            updateTrackOffset(track.id, Number.isNaN(parsed) ? track.offsetSec : parsed);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              const parsed = Number(offsetInputs[track.id]);
                              updateTrackOffset(track.id, Number.isNaN(parsed) ? track.offsetSec : parsed);
                              (event.target as HTMLInputElement).blur();
                            }
                          }}
                          aria-label={`Offset for ${track.name} in seconds`}
                        />
                        <span className="text-muted">s</span>
                        <button
                          className="rounded border border-border px-2 py-0.5"
                          onClick={() => updateTrackOffset(track.id, track.offsetSec + OFFSET_NUDGE_FINE)}
                          title={`Nudge right by ${OFFSET_NUDGE_FINE}s`}
                        >
                          +0.01
                        </button>
                        <button
                          className="rounded border border-border px-2 py-0.5"
                          onClick={() => updateTrackOffset(track.id, track.offsetSec + OFFSET_NUDGE_COARSE)}
                          title={`Nudge right by ${OFFSET_NUDGE_COARSE}s`}
                        >
                          +0.1
                        </button>
                        <button className="rounded border border-border px-2 py-0.5" onClick={() => updateTrackOffset(track.id, 0)}>
                          Reset Offset
                        </button>
                      </div>
                      {offsetSaving[track.id] ? <span className="text-muted">Saving…</span> : null}
                    </div>
                  </div>
                  {offsetErrorByTrack[track.id] ? <p className="mb-2 text-xs text-red-500">{offsetErrorByTrack[track.id]}</p> : null}

                  <div
                    className="relative h-20 overflow-hidden rounded border border-border bg-background/60"
                    onClick={(event) => handleTimelineClick(event, Math.max(projectDurationSec, 0.001))}
                  >
                    <div className="absolute bottom-0 top-0 w-0.5 bg-brand" style={{ left: `${playheadPct}%` }} />
                    {sortedComments.map((comment) => {
                      if (comment.trackId && comment.trackId !== track.id) return null;
                      const markerLeftPct = projectDurationSec > 0 ? (comment.timestampSec / projectDurationSec) * 100 : 0;
                      return (
                        <button
                          key={`track-${track.id}-comment-${comment.id}`}
                          className={`absolute top-1 h-3 w-1 -translate-x-1/2 rounded ${comment.resolved ? 'bg-emerald-400' : 'bg-amber-400'}`}
                          style={{ left: `${Math.min(Math.max(markerLeftPct, 0), 100)}%` }}
                          onClick={() => seekTimeline(comment.timestampSec)}
                          title={`${comment.authorName}: ${comment.body}`}
                        />
                      );
                    })}
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

      <aside className="space-y-6">
        <section className="card p-4">
          <h2 className="text-lg font-medium">Save version</h2>
          <p className="mt-1 text-xs text-muted">Capture a named metadata snapshot of tracks, offsets, and comments context.</p>
          <div className="mt-3 space-y-2 rounded-lg border border-border bg-background p-3">
            <label className="block text-xs font-medium">Version label</label>
            <input
              className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
              value={versionLabelInput}
              onChange={(event) => setVersionLabelInput(event.target.value)}
              placeholder="Mix pass A"
            />
            <label className="block text-xs font-medium">Notes (optional)</label>
            <textarea
              className="min-h-20 w-full rounded border border-border bg-background px-2 py-1 text-sm"
              value={versionNotesInput}
              onChange={(event) => setVersionNotesInput(event.target.value)}
              placeholder="What changed in this snapshot?"
            />
            <button className="rounded bg-brand px-3 py-1 text-sm font-medium text-white" onClick={createVersion} disabled={isSavingVersion}>
              {isSavingVersion ? 'Saving…' : 'Save Version'}
            </button>
          </div>
        </section>

        <section className="card p-4">
          <h2 className="text-lg font-medium">Version history</h2>
          <p className="mt-1 text-xs text-muted">Metadata snapshots only. Binary files are referenced, not duplicated.</p>
          <ul className="mt-3 max-h-72 space-y-2 overflow-auto text-sm">
            {versions.length === 0 ? (
              <li className="text-muted">No versions yet.</li>
            ) : (
              versions.map((version) => (
                <li key={version.id}>
                  <button
                    className={`w-full rounded border p-2 text-left ${selectedVersionId === version.id ? 'border-brand' : 'border-border bg-background'}`}
                    onClick={() => setSelectedVersionId(version.id)}
                  >
                    <p className="font-medium">{version.label}</p>
                    <p className="text-xs text-muted">{version.creatorName}</p>
                    <p className="text-xs text-muted">{formatDate(version.createdAt)}</p>
                    {version.notes ? <p className="mt-1 text-xs text-muted">{version.notes}</p> : null}
                  </button>
                </li>
              ))
            )}
          </ul>
          {selectedVersion ? (
            <div className="mt-3 space-y-2 rounded-lg border border-border bg-background p-3">
              <h3 className="text-sm font-medium">Selected snapshot metadata</h3>
              <button
                className="rounded border border-border px-3 py-1 text-xs"
                onClick={restoreOffsetsFromVersion}
                disabled={isRestoringOffsets}
              >
                {isRestoringOffsets ? 'Restoring…' : 'Restore Offsets From Version'}
              </button>
              <pre className="max-h-64 overflow-auto rounded border border-border bg-black/20 p-2 text-xs">
                {JSON.stringify(selectedVersion.snapshotJson, null, 2)}
              </pre>
            </div>
          ) : null}
          {versionActionMessage ? <p className="mt-2 text-xs text-muted">{versionActionMessage}</p> : null}
        </section>

        <section className="card p-4">
        <h2 className="text-lg font-medium">Comments</h2>
        <p className="mt-1 text-xs text-muted">Add timeline notes like Figma or Frame.io, with optional track context.</p>

        <div className="mt-4 space-y-2 rounded-lg border border-border bg-background p-3">
          <label className="block text-xs font-medium">Timestamp (seconds)</label>
          <input
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
            type="number"
            min={0}
            step={0.01}
            value={commentTimestampSec}
            onChange={(event) => setCommentTimestampSec(Number(event.target.value))}
          />
          <p className="text-xs text-muted">Click the timeline/waveform to prefill this timestamp.</p>
          <label className="block text-xs font-medium">Track (optional)</label>
          <select
            value={selectedTrackId ?? ''}
            onChange={(event) => setSelectedTrackId(event.target.value || null)}
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="">General project comment</option>
            {trackList.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </select>
          <label className="block text-xs font-medium">Comment</label>
          <textarea
            className="min-h-20 w-full rounded border border-border bg-background px-2 py-1 text-sm"
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            placeholder="What should be changed at this point in the timeline?"
          />
          {commentError ? <p className="text-xs text-red-500">{commentError}</p> : null}
          <button className="rounded bg-brand px-3 py-1 text-sm font-medium text-white" onClick={handleCreateComment} disabled={isSavingComment}>
            {isSavingComment ? 'Saving…' : 'Add comment'}
          </button>
        </div>

        <ul className="mt-4 space-y-2 text-sm">
          {sortedComments.length === 0 ? (
            <li className="text-muted">No comments yet.</li>
          ) : (
            sortedComments.map((comment) => (
              <li key={comment.id} className={`rounded-lg border p-3 ${comment.resolved ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border bg-background'}`}>
                <button className="w-full text-left" onClick={() => seekTimeline(comment.timestampSec)}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{comment.authorName}</p>
                    <span className="text-xs text-muted">{formatTime(comment.timestampSec)}</span>
                  </div>
                  <p className="text-xs text-muted">{comment.trackId ? trackNameById.get(comment.trackId) ?? 'Unknown track' : 'All tracks'}</p>
                  <p className="mt-1">{comment.body}</p>
                  <p className="mt-1 text-xs text-muted">Created {formatDate(comment.createdAt)}</p>
                </button>
                <button
                  className="mt-2 rounded border border-border px-2 py-1 text-xs"
                  onClick={() => toggleResolved(comment.id, !comment.resolved)}
                >
                  Mark as {comment.resolved ? 'unresolved' : 'resolved'}
                </button>
              </li>
            ))
          )}
        </ul>
        </section>
      </aside>
    </div>
  );
}
