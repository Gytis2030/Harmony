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
  const { data: profileMatches, error: profileLookupError } = await supabase.rpc('find_profile_by_email_for_project', {
    target_project_id: params.projectId,
    target_email: normalizedEmail
  });

  if (profileLookupError) {
    return NextResponse.json({ error: profileLookupError.message ?? 'Failed to resolve invite email.' }, { status: 500 });
  }

  const profileRow = (profileMatches?.[0] as { id: string; email: string } | undefined) ?? null;

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

  const { error } = await supabase
    .from('project_members')
    .insert({
      project_id: params.projectId,
      user_id: profileRow.id,
      role: parsed.data.role
    })
    .select('user_id')
    .single();

  if (error) {
    return NextResponse.json({ error: error?.message ?? 'Failed to add member.' }, { status: 500 });
  }

  const { data: memberRows, error: memberLookupError } = await supabase.rpc('list_project_members_with_profiles', {
    target_project_id: params.projectId
  });

  if (memberLookupError) {
    return NextResponse.json({ error: memberLookupError.message ?? 'Member added, but failed to load member profile.' }, { status: 500 });
  }

  const member = memberRows?.find((entry: { user_id: string }) => entry.user_id === profileRow.id);
  if (!member) {
    return NextResponse.json({ error: 'Member added, but failed to load member profile.' }, { status: 500 });
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
