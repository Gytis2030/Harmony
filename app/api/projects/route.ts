import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createProjectSchema } from '@/lib/validation/project';
import { createProjectVersion } from '@/lib/project-versions';

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = createProjectSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectInsert = {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    bpm: parsed.data.bpm ?? null,
    key_signature: parsed.data.keySignature ?? null,
    owner_id: user.id
  };

  const { data: project, error: projectError } = await supabase.from('projects').insert(projectInsert).select('id, name, description, bpm, key_signature').single();

  if (projectError || !project) {
    return NextResponse.json({ error: projectError?.message ?? 'Failed to create project' }, { status: 500 });
  }

  const { error: memberError } = await supabase.from('project_members').insert({
    project_id: project.id,
    user_id: user.id,
    role: 'owner'
  });

  if (memberError) {
    await supabase.from('projects').delete().eq('id', project.id);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  try {
    await createProjectVersion(supabase, {
      projectId: project.id,
      createdBy: user.id,
      label: 'Initial',
      notes: 'Automatic initial project snapshot.'
    });
  } catch (error) {
    await supabase.from('projects').delete().eq('id', project.id);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create initial version.' }, { status: 500 });
  }

  return NextResponse.json({ id: project.id });
}
