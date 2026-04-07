import { TrackPlaybackPanel } from '@/components/project/track-playback-panel';
import { UploadTrackForm } from '@/components/project/upload-track-form';
import { createClient } from '@/lib/supabase/server';
import type { Track } from '@/types/database';

type ProjectTrack = Track & {
  signedUrl?: string;
};

type CommentRecord = {
  id: string;
  project_id: string;
  track_id: string | null;
  author_id: string;
  timestamp_sec: number;
  body: string;
  resolved: boolean;
  created_at: string;
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
};

async function getProjectData(projectId: string) {
  const supabase = createClient();
  const { data: tracks } = await supabase
    .from('tracks')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  const { data: comments } = await supabase
    .from('comments')
    .select('id, project_id, track_id, author_id, timestamp_sec, body, resolved, created_at, profiles:author_id(full_name, email)')
    .eq('project_id', projectId)
    .order('timestamp_sec', { ascending: true })
    .limit(200);

  return { tracks: (tracks ?? []) as Track[], comments: (comments ?? []) as CommentRecord[] };
}

async function getSignedTrackUrl(path: string | undefined) {
  if (!path) return undefined;

  const supabase = createClient();
  const { data } = await supabase.storage.from('tracks').createSignedUrl(path, 60 * 5);
  return data?.signedUrl;
}

export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const { tracks, comments } = await getProjectData(params.projectId);

  const tracksWithUrls: ProjectTrack[] = await Promise.all(
    tracks.map(async (track) => ({
      ...track,
      signedUrl: await getSignedTrackUrl(track.file_path)
    }))
  );

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Project Session</h1>
          <p className="text-sm text-muted">Track-level review, uploads, and version context.</p>
        </div>
        <UploadTrackForm projectId={params.projectId} />
      </section>

      <TrackPlaybackPanel
        projectId={params.projectId}
        tracks={tracksWithUrls.map((track) => ({
          id: track.id,
          name: track.name,
          mimeType: track.mime_type,
          fileSizeBytes: track.file_size_bytes,
          durationSec: track.duration_sec,
          sampleRate: track.sample_rate,
          channelCount: track.channel_count,
          offsetSec: track.offset_sec,
          signedUrl: track.signedUrl
        }))}
        initialComments={comments.map((comment) => ({
          id: comment.id,
          projectId: comment.project_id,
          trackId: comment.track_id,
          authorId: comment.author_id,
          authorName: comment.profiles?.full_name || comment.profiles?.email || 'Unknown user',
          timestampSec: comment.timestamp_sec,
          body: comment.body,
          resolved: comment.resolved,
          createdAt: comment.created_at
        }))}
      />
    </div>
  );
}
