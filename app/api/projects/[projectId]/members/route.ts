import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getProjectMembership } from '@/lib/project-members';

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['editor', 'viewer'])
});

const updateMemberRoleSchema = z.object({
  memberUserId: z.string().uuid(),
  role: z.enum(['editor', 'viewer'])
});

export async function POST(request: Request, { params }: { params: { projectId: string } }) {
  const payload = await request.json();
  const parsed = inviteMemberSchema.safeParse(payload);

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
  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: 'Only the project owner can add members.' }, { status: 403 });
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const { data: profile } = await supabase.from('profiles').select('id, email').eq('email', normalizedEmail).maybeSingle();

  const profileRow = profile as { id: string; email: string } | null;

  if (!profileRow) {
    return NextResponse.json({ error: 'That email is not connected to an account yet. Ask them to create an account first.' }, { status: 404 });
  }

  const { data: existingMembership } = await supabase
    .from('project_members')
    .select('user_id')
    .eq('project_id', params.projectId)
    .eq('user_id', profileRow.id)
    .maybeSingle();

  if (existingMembership) {
    return NextResponse.json({ error: 'That user is already a project member.' }, { status: 409 });
  }

  const { data: member, error } = await supabase
    .from('project_members')
    .insert({
      project_id: params.projectId,
      user_id: profileRow.id,
      role: parsed.data.role
    })
    .select('user_id, role, created_at, profiles:user_id(full_name, email)')
    .single();

  if (error || !member) {
    return NextResponse.json({ error: error?.message ?? 'Failed to add member.' }, { status: 500 });
  }

  return NextResponse.json({ member });
}

export async function PATCH(request: Request, { params }: { params: { projectId: string } }) {
  const payload = await request.json();
  const parsed = updateMemberRoleSchema.safeParse(payload);

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
  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: 'Only the project owner can update roles.' }, { status: 403 });
  }

  const { data: project } = await supabase.from('projects').select('owner_id').eq('id', params.projectId).maybeSingle();
  const projectRow = project as { owner_id: string } | null;

  if (!projectRow) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  if (parsed.data.memberUserId === projectRow.owner_id) {
    return NextResponse.json({ error: 'The owner role cannot be changed.' }, { status: 400 });
  }

  const { data: updatedMember, error } = await supabase
    .from('project_members')
    .update({ role: parsed.data.role })
    .eq('project_id', params.projectId)
    .eq('user_id', parsed.data.memberUserId)
    .select('user_id, role')
    .maybeSingle();

  if (error || !updatedMember) {
    return NextResponse.json({ error: error?.message ?? 'Failed to update member role.' }, { status: 500 });
  }

  return NextResponse.json({ member: updatedMember });
}
