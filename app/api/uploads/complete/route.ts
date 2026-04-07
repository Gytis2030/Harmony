import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProjectMembership, canEditProject } from '@/lib/project-members';
import { createClient } from '@/lib/supabase/server';

const completeUploadSchema = z.object({
  projectId: z.string().uuid(),
  fileName: z.string().min(1),
  filePath: z.string().min(1),
  mimeType: z.string().nullable(),
  fileSizeBytes: z.number().int().positive(),
  durationSec: z.number().positive().nullable(),
  sampleRate: z.number().int().positive().nullable(),
  channelCount: z.number().int().positive().nullable()
});

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = completeUploadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { projectId, fileName, filePath, mimeType, fileSizeBytes, durationSec, sampleRate, channelCount } = parsed.data;

  const membership = await getProjectMembership(supabase, projectId, user.id);
  if (!membership || !canEditProject(membership.role)) {
    return NextResponse.json({ error: 'Only owners and editors can upload tracks.' }, { status: 403 });
  }

  if (!filePath.startsWith(`${projectId}/`)) {
    return NextResponse.json({ error: 'Invalid storage path for project.' }, { status: 400 });
  }

  const trackInsert = {
    project_id: projectId,
    file_path: filePath,
    name: fileName,
    uploaded_by: user.id,
    mime_type: mimeType,
    file_size_bytes: fileSizeBytes,
    duration_sec: durationSec,
    sample_rate: sampleRate,
    channel_count: channelCount,
    offset_sec: 0
  } as never;

  const { data: insertedTrack, error } = await supabase.from('tracks').insert(trackInsert).select('*').single();

  if (error || !insertedTrack) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create track record.' }, { status: 500 });
  }

  return NextResponse.json({ track: insertedTrack });
}
