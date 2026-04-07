import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectVersionSnapshotFromRows } from '../lib/project-versions.ts';

test('buildProjectVersionSnapshotFromRows returns expected metadata counts and mappings', () => {
  const snapshot = buildProjectVersionSnapshotFromRows({
    createdAt: '2026-01-01T00:00:00.000Z',
    project: {
      id: 'project-1',
      name: 'Demo',
      description: null,
      bpm: 120,
      key_signature: 'Am',
      updated_at: '2026-01-01T00:00:00.000Z'
    },
    tracks: [
      {
        id: 'track-1',
        name: 'Kick',
        offset_sec: 0.1,
        duration_sec: 10,
        version_id: null,
        uploaded_by: 'user-1',
        created_at: '2026-01-01T00:00:00.000Z',
        file_path: 'project-1/track-1.wav',
        mime_type: 'audio/wav',
        file_size_bytes: 1000
      }
    ],
    comments: [
      {
        id: 'c1',
        track_id: 'track-1',
        author_id: 'user-1',
        timestamp_sec: 1.2,
        body: 'Tighten transient',
        resolved: false,
        created_at: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'c2',
        track_id: null,
        author_id: 'user-2',
        timestamp_sec: 2,
        body: 'General note',
        resolved: true,
        created_at: '2025-12-31T23:59:00.000Z'
      }
    ]
  });

  assert.equal(snapshot.schemaVersion, 'project_snapshot_v1');
  assert.equal(snapshot.comments.total, 2);
  assert.equal(snapshot.comments.unresolved, 1);
  assert.equal(snapshot.fileReferences[0].trackId, 'track-1');
  assert.equal(snapshot.project.keySignature, 'Am');
});
