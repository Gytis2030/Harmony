import { NextResponse } from 'next/server';
import { z } from 'zod';
import { canEditProject, getProjectMembership } from '@/lib/project-members';
import { createClient } from '@/lib/supabase/server';
import { createProjectVersion } from '@/lib/project-versions';

const createVersionSchema = z.object({
  label: z.string().min(1).max(120),
  notes: z.string().max(2000).optional().nullable()
});

export async function POST(request: Request, { params }: { params: { projectId: string } }) {
  const payload = await request.json();
  const parsed = createVersionSchema.safeParse(payload);

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

  const membership = await getProjectMembership(supabase, params.projectId, user.id);
  if (!membership || !canEditProject(membership.role)) {
    return NextResponse.json({ error: 'Only owners and editors can save versions.' }, { status: 403 });
  }

  try {
    const { version } = await createProjectVersion(supabase, {
      projectId: params.projectId,
      createdBy: user.id,
      label: parsed.data.label.trim(),
      notes: parsed.data.notes?.trim() || null
    });
    return NextResponse.json({ version });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save project version.' }, { status: 500 });
  }
}
