import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const signedUrlSchema = z.object({
  projectId: z.string().uuid(),
  fileName: z.string().min(1)
});

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = signedUrlSchema.safeParse(payload);

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

  const safeName = `${Date.now()}-${parsed.data.fileName.replace(/\s+/g, '-').toLowerCase()}`;
  const storagePath = `${parsed.data.projectId}/${safeName}`;

  const { data: signed, error: signError } = await supabase.storage.from('tracks').createSignedUploadUrl(storagePath, { upsert: false });

  if (signError || !signed) {
    return NextResponse.json({ error: signError?.message ?? 'Failed to create upload URL' }, { status: 500 });
  }

  await supabase.from('tracks').insert({
    project_id: parsed.data.projectId,
    file_path: storagePath,
    name: parsed.data.fileName,
    uploaded_by: user.id,
    offset_sec: 0
  });

  return NextResponse.json({ signedUrl: signed.signedUrl, path: storagePath });
}
