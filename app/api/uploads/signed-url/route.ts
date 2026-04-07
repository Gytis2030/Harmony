import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProjectMembership, canEditProject } from '@/lib/project-members';
import { createClient } from '@/lib/supabase/server';

const signedUrlSchema = z.object({
  projectId: z.string().uuid(),
  fileName: z.string().min(1)
});

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
}

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

  const membership = await getProjectMembership(supabase, parsed.data.projectId, user.id);

  if (!membership) {
    return NextResponse.json({ error: 'Project not found or access denied.' }, { status: 404 });
  }

  if (!canEditProject(membership.role)) {
    return NextResponse.json({ error: 'Only owners and editors can upload tracks.' }, { status: 403 });
  }

  const safeName = `${Date.now()}-${sanitizeFileName(parsed.data.fileName)}`;
  const storagePath = `${parsed.data.projectId}/${safeName}`;

  const { data: signed, error: signError } = await supabase.storage.from('tracks').createSignedUploadUrl(storagePath, { upsert: false });

  if (signError || !signed) {
    return NextResponse.json({ error: signError?.message ?? 'Failed to create upload URL' }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: signed.signedUrl, path: storagePath });
}
