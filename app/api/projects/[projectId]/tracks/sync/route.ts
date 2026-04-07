import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const syncTracksSchema = z.object({
  offsets: z
    .array(
      z.object({
        trackId: z.string().uuid(),
        offsetSec: z.number().min(0)
      })
    )
    .min(1)
});

export async function POST(request: Request, { params }: { params: { projectId: string } }) {
  const payload = await request.json();
  const parsed = syncTracksSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  for (const entry of parsed.data.offsets) {
    const { error } = await supabase
      .from('tracks')
      .update({ offset_sec: entry.offsetSec })
      .eq('id', entry.trackId)
      .eq('project_id', params.projectId);

    if (error) {
      return NextResponse.json({ error: error.message ?? 'Failed to save track offsets.' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
