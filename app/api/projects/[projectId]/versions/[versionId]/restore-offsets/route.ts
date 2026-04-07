import { NextResponse } from 'next/server';
import { canEditProject, getProjectMembership } from '@/lib/project-members';
import { createClient } from '@/lib/supabase/server';
import type { ProjectVersionSnapshotV1 } from '@/lib/project-versions';
import type { Json } from '@/types/database';

function isSnapshotV1(value: Json): value is ProjectVersionSnapshotV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const schemaVersion = (value as { schemaVersion?: string }).schemaVersion;
  return schemaVersion === 'project_snapshot_v1';
}

export async function POST(_: Request, { params }: { params: { projectId: string; versionId: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const membership = await getProjectMembership(supabase, params.projectId, user.id);
  if (!membership || !canEditProject(membership.role)) {
    return NextResponse.json({ error: 'Only owners and editors can restore offsets.' }, { status: 403 });
  }

  const { data: version, error: versionError } = await supabase
    .from('project_versions')
    .select('id, snapshot_json')
    .eq('id', params.versionId)
    .eq('project_id', params.projectId)
    .single();

  if (versionError || !version) {
    return NextResponse.json({ error: versionError?.message ?? 'Version not found.' }, { status: 404 });
  }

  if (!isSnapshotV1(version.snapshot_json)) {
    return NextResponse.json({ error: 'Unsupported snapshot format.' }, { status: 400 });
  }

  const offsets = version.snapshot_json.tracks.map((track: { id: string; offsetSec: number }) => ({
    id: track.id,
    offsetSec: track.offsetSec
  }));

  const { data: updatedOffsets, error: updateError } = await supabase.rpc('update_project_track_offsets_atomic', {
    target_project_id: params.projectId,
    offset_updates: offsets.map((offset) => ({ trackId: offset.id, offsetSec: offset.offsetSec }))
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message ?? 'Failed to restore offsets.' }, { status: 500 });
  }

  return NextResponse.json({ restoredOffsets: updatedOffsets ?? [] });
}
