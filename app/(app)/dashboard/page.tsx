import Link from 'next/link';
import { CreateProjectForm } from '@/components/project/create-project-form';
import { createClient } from '@/lib/supabase/server';
import type { Project } from '@/types/database';

async function getProjects(): Promise<Project[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(12);

  if (error || !data) {
    return [];
  }

  return data as Project[];
}

export default async function DashboardPage() {
  const projects = await getProjects();

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <CreateProjectForm />
      <section className="card p-4">
        <h1 className="text-xl font-semibold">Projects</h1>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {projects.length === 0 ? (
            <p className="text-sm text-muted">No projects yet.</p>
          ) : (
            projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="rounded-lg border border-border bg-background p-4">
                <p className="font-medium">{project.name}</p>
                <p className="mt-2 text-sm text-muted">{project.description ?? 'No description'}</p>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
