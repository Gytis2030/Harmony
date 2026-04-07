import type { Json } from '@/types/database';

/**
 * Explicit project version snapshot format (V1).
 *
 * This is metadata/state snapshotting only. It does NOT duplicate or copy binary assets.
 * `fileReferences` points at existing storage/object paths already attached to tracks.
 */
export type ProjectVersionSnapshotV1 = {
  schemaVersion: 'project_snapshot_v1';
  createdAt: string;
  project: {
    id: string;
    name: string;
    description: string | null;
    bpm: number | null;
    keySignature: string | null;
    updatedAt: string;
  };
  tracks: Array<{
    id: string;
    name: string;
    offsetSec: number;
    durationSec: number | null;
    versionId: string | null;
    uploadedBy: string;
    createdAt: string;
  }>;
  fileReferences: Array<{
    trackId: string;
    filePath: string;
    mimeType: string | null;
    fileSizeBytes: number | null;
  }>;
  comments: {
    total: number;
    unresolved: number;
    latestAt: string | null;
    recent: Array<{
      id: string;
      trackId: string | null;
      authorId: string;
      timestampSec: number;
      body: string;
      resolved: boolean;
      createdAt: string;
    }>;
  };
};

type SnapshotRows = {
  project: {
    id: string;
    name: string;
    description: string | null;
    bpm: number | null;
    key_signature: string | null;
    updated_at: string;
  };
  tracks: Array<{
    id: string;
    name: string;
    offset_sec: number;
    duration_sec: number | null;
    version_id: string | null;
    uploaded_by: string;
    created_at: string;
    file_path: string;
    mime_type: string | null;
    file_size_bytes: number | null;
  }>;
  comments: Array<{
    id: string;
    track_id: string | null;
    author_id: string;
    timestamp_sec: number;
    body: string;
    resolved: boolean;
    created_at: string;
  }>;
  createdAt?: string;
};

export function buildProjectVersionSnapshotFromRows(rows: SnapshotRows): ProjectVersionSnapshotV1 {
  const trackRows = rows.tracks ?? [];
  const commentRows = rows.comments ?? [];

  return {
    schemaVersion: 'project_snapshot_v1',
    createdAt: rows.createdAt ?? new Date().toISOString(),
    project: {
      id: rows.project.id,
      name: rows.project.name,
      description: rows.project.description,
      bpm: rows.project.bpm,
      keySignature: rows.project.key_signature,
      updatedAt: rows.project.updated_at
    },
    tracks: trackRows.map((track) => ({
      id: track.id,
      name: track.name,
      offsetSec: track.offset_sec,
      durationSec: track.duration_sec,
      versionId: track.version_id,
      uploadedBy: track.uploaded_by,
      createdAt: track.created_at
    })),
    fileReferences: trackRows.map((track) => ({
      trackId: track.id,
      filePath: track.file_path,
      mimeType: track.mime_type,
      fileSizeBytes: track.file_size_bytes
    })),
    comments: {
      total: commentRows.length,
      unresolved: commentRows.filter((comment) => !comment.resolved).length,
      latestAt: commentRows[0]?.created_at ?? null,
      recent: commentRows.map((comment) => ({
        id: comment.id,
        trackId: comment.track_id,
        authorId: comment.author_id,
        timestampSec: comment.timestamp_sec,
        body: comment.body,
        resolved: comment.resolved,
        createdAt: comment.created_at
      }))
    }
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildProjectVersionSnapshot(client: any, projectId: string): Promise<ProjectVersionSnapshotV1> {
  const [{ data: project, error: projectError }, { data: tracks, error: tracksError }, { data: comments, error: commentsError }] = await Promise.all([
    client.from('projects').select('id, name, description, bpm, key_signature, updated_at').eq('id', projectId).single(),
    client
      .from('tracks')
      .select('id, name, offset_sec, duration_sec, version_id, uploaded_by, created_at, file_path, mime_type, file_size_bytes')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true }),
    client
      .from('comments')
      .select('id, track_id, author_id, timestamp_sec, body, resolved, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(50)
  ]);

  if (projectError || !project) {
    throw new Error(projectError?.message ?? 'Failed to load project metadata for version snapshot.');
  }
  if (tracksError) {
    throw new Error(tracksError.message ?? 'Failed to load tracks for version snapshot.');
  }
  if (commentsError) {
    throw new Error(commentsError.message ?? 'Failed to load comments for version snapshot.');
  }

  return buildProjectVersionSnapshotFromRows({
    project,
    tracks: tracks ?? [],
    comments: comments ?? []
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createProjectVersion(client: any, options: { projectId: string; createdBy: string; label: string; notes?: string | null }) {
  const snapshot = await buildProjectVersionSnapshot(client, options.projectId);

  const { data: version, error: versionError } = await client
    .from('project_versions')
    .insert({
      project_id: options.projectId,
      created_by: options.createdBy,
      label: options.label,
      notes: options.notes ?? null,
      snapshot_json: snapshot as Json
    })
    .select('id, project_id, created_by, label, notes, snapshot_json, created_at')
    .single();

  if (versionError || !version) {
    throw new Error(versionError?.message ?? 'Failed to save project version.');
  }

  return { version, snapshot };
}
