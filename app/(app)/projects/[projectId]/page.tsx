import { notFound } from 'next/navigation';
import { ProjectMembersPanel } from '@/components/project/project-members-panel';
import { TrackPlaybackPanel } from '@/components/project/track-playback-panel';
import { UploadTrackForm } from '@/components/project/upload-track-form';
import { canEditProject, getProjectMembership, type ProjectRole } from '@/lib/project-members';
import { createClient } from '@/lib/supabase/server';
import type { Json, Track } from '@/types/database';

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

type ProjectMemberRecord = {
  user_id: string;
  role: ProjectRole;
  created_at: string;
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
};

type ProjectVersionRecord = {
  id: string;
  label: string;
  notes: string | null;
  created_at: string;
  created_by: string;
  snapshot_json: Json;
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
};

async function getProjectData(projectId: string) {
  const supabase = createClient();
  const [{ data: tracks }, { data: comments }, { data: versions }, { data: members }] = await Promise.all([
    supabase.from('tracks').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
    supabase
      .from('comments')
      .select('id, project_id, track_id, author_id, timestamp_sec, body, resolved, created_at, profiles:author_id(full_name, email)')
      .eq('project_id', projectId)
      .order('timestamp_sec', { ascending: true })
      .limit(200),
    supabase
      .from('project_versions')
      .select('id, label, notes, created_at, created_by, snapshot_json, profiles:created_by(full_name, email)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('project_members')
      .select('user_id, role, created_at, profiles:user_id(full_name, email)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
  ]);

  return {
    tracks: (tracks ?? []) as Track[],
    comments: (comments ?? []) as CommentRecord[],
    versions: (versions ?? []) as ProjectVersionRecord[],
    members: (members ?? []) as ProjectMemberRecord[]
  };
}

async function getSignedTrackUrl(path: string | undefined) {
  if (!path) return undefined;

  const supabase = createClient();
  const { data } = await supabase.storage.from('tracks').createSignedUrl(path, 60 * 5);
  return data?.signedUrl;
}

export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const membership = await getProjectMembership(supabase, params.projectId, user.id);
  if (!membership) {
    notFound();
  }

  const { tracks, comments, versions, members } = await getProjectData(params.projectId);
  const canEdit = canEditProject(membership.role);

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
        <UploadTrackForm projectId={params.projectId} canUpload={canEdit} />
      </section>

      <ProjectMembersPanel
        projectId={params.projectId}
        currentUserRole={membership.role}
        members={members.map((member) => ({
          userId: member.user_id,
          role: member.role,
          createdAt: member.created_at,
          fullName: member.profiles?.full_name ?? null,
          email: member.profiles?.email ?? null
        }))}
      />

      <TrackPlaybackPanel
        projectId={params.projectId}
        permissions={{
          role: membership.role,
          canEdit,
          canComment: true
        }}
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
        initialVersions={versions.map((version) => ({
          id: version.id,
          label: version.label,
          notes: version.notes,
          createdAt: version.created_at,
          createdBy: version.created_by,
          creatorName: version.profiles?.full_name || version.profiles?.email || 'Unknown user',
          snapshotJson: version.snapshot_json
        }))}
      />
    </div>
  );
}
