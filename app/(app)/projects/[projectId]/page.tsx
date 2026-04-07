import { WaveformPlayer } from '@/components/project/waveform-player';
import { UploadTrackForm } from '@/components/project/upload-track-form';
import { createClient } from '@/lib/supabase/server';
import type { Comment, Track } from '@/types/database';

async function getProjectData(projectId: string) {
  const supabase = createClient();
  const { data: tracks } = await supabase
    .from('tracks')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  const { data: comments } = await supabase
    .from('comments')
    .select('*')
    .eq('project_id', projectId)
    .order('timestamp_sec', { ascending: true })
    .limit(40);

  return { tracks: (tracks ?? []) as Track[], comments: (comments ?? []) as Comment[] };
}

async function getSignedTrackUrl(path: string | undefined) {
  if (!path) return undefined;

  const supabase = createClient();
  const { data } = await supabase.storage.from('tracks').createSignedUrl(path, 60);
  return data?.signedUrl;
}

export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const { tracks, comments } = await getProjectData(params.projectId);
  const primaryTrack = tracks[0];
  const audioUrl = await getSignedTrackUrl(primaryTrack?.file_path);

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Project Session</h1>
          <p className="text-sm text-muted">Track-level review, uploads, and version context.</p>
        </div>
        <UploadTrackForm projectId={params.projectId} />
      </section>

      <WaveformPlayer audioUrl={audioUrl} />

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="text-lg font-medium">Tracks & alignment metadata</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {tracks.length === 0 ? (
              <li className="text-muted">No tracks uploaded yet.</li>
            ) : (
              tracks.map((track) => (
                <li key={track.id} className="rounded-lg border border-border bg-background p-3">
                  <p className="font-medium">{track.name}</p>
                  <p className="mt-1 text-muted">
                    Offset: {track.offset_sec}s · Sample rate: {track.sample_rate ?? 'n/a'} · Duration: {track.duration_sec ?? 'n/a'}s
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="card p-4">
          <h2 className="text-lg font-medium">Timeline comments</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {comments.length === 0 ? (
              <li className="text-muted">No comments yet.</li>
            ) : (
              comments.map((comment) => (
                <li key={comment.id} className="rounded-lg border border-border bg-background p-3">
                  <p className="text-muted">@ {comment.timestamp_sec}s</p>
                  <p className="mt-1">{comment.body}</p>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
