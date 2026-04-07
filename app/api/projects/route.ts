import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createProjectSchema } from '@/lib/validation/project';

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = createProjectSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({ name: parsed.data.name, description: parsed.data.description ?? null, owner_id: user.id })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
