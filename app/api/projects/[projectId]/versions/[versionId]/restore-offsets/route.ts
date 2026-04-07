import { NextResponse } from 'next/server';
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

  for (const offset of offsets) {
    const { error } = await supabase
      .from('tracks')
      .update({ offset_sec: offset.offsetSec })
      .eq('project_id', params.projectId)
      .eq('id', offset.id);

    if (error) {
      return NextResponse.json({ error: error.message ?? 'Failed to restore offsets.' }, { status: 500 });
    }
  }

  return NextResponse.json({ restoredOffsets: offsets });
}
