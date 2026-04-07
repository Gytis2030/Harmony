import { NextResponse } from 'next/server';
import { getProjectMembership } from '@/lib/project-members';
import { createClient } from '@/lib/supabase/server';

export async function POST(_: Request, { params }: { params: { projectId: string; trackId: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const membership = await getProjectMembership(supabase, params.projectId, user.id);
  if (!membership) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  }

  const { data: track, error: trackError } = await supabase
    .from('tracks')
    .select('id, file_path')
    .eq('id', params.trackId)
    .eq('project_id', params.projectId)
    .maybeSingle();

  if (trackError || !track) {
    return NextResponse.json({ error: trackError?.message ?? 'Track not found.' }, { status: 404 });
  }

  const expiresInSec = 60 * 5;
  const { data: signed, error: signError } = await supabase.storage.from('tracks').createSignedUrl(track.file_path, expiresInSec);
  if (signError || !signed) {
    return NextResponse.json({ error: signError?.message ?? 'Failed to refresh playback URL.' }, { status: 500 });
  }

  return NextResponse.json({
    signedUrl: signed.signedUrl,
    expiresAtMs: Date.now() + expiresInSec * 1000
  });
}
