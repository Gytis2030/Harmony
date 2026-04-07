import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createProjectSchema } from '@/lib/validation/project';

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

  const { error: versionError } = await supabase.from('project_versions').insert({
    project_id: project.id,
    created_by: user.id,
    label: 'Initial',
    snapshot_json: {
      metadata: {
        name: project.name,
        description: project.description,
        bpm: project.bpm,
        keySignature: project.key_signature
      },
      tracks: []
    }
  });

  if (versionError) {
    await supabase.from('projects').delete().eq('id', project.id);
    return NextResponse.json({ error: versionError.message }, { status: 500 });
  }

  return NextResponse.json({ id: project.id });
}
