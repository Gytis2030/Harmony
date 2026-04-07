import { createClient } from '@/lib/supabase/server';

export type ProjectRole = 'owner' | 'editor' | 'viewer';

export type ProjectMembership = {
  user_id: string;
  role: ProjectRole;
};

type SupabaseServerClient = ReturnType<typeof createClient>;

export async function getProjectMembership(
  supabase: SupabaseServerClient,
  projectId: string,
  userId: string
): Promise<ProjectMembership | null> {
  const { data } = await supabase
    .from('project_members')
    .select('user_id, role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return null;

  const membership = data as { user_id: string; role: ProjectRole };

  return {
    user_id: membership.user_id,
    role: membership.role
  };
}

export function canEditProject(role: ProjectRole) {
  return role === 'owner' || role === 'editor';
}
