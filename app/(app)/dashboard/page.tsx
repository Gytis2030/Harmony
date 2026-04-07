import Link from 'next/link';
import { Search } from 'lucide-react';
import { CreateProjectForm } from '@/components/project/create-project-form';
import { createClient } from '@/lib/supabase/server';

type DashboardProject = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  trackCount: number;
  latestVersionLabel: string | null;
};

async function getProjects(searchTerm?: string): Promise<DashboardProject[]> {
  const supabase = createClient();
  let query = supabase.from('projects').select('id, name, description, created_at').order('created_at', { ascending: false }).limit(50);

  const normalizedSearch = searchTerm?.trim();
  if (normalizedSearch) {
    query = query.ilike('name', `%${normalizedSearch}%`);
  }

  const { data: projectRows, error } = await query;

  if (error || !projectRows || projectRows.length === 0) {
    return [];
  }

  const projectIds = projectRows.map((project) => project.id);

  const [{ data: trackRows }, { data: versionRows }] = await Promise.all([
    supabase.from('tracks').select('project_id').in('project_id', projectIds),
    supabase.from('project_versions').select('project_id, label, created_at').in('project_id', projectIds).order('created_at', { ascending: false })
  ]);

  const trackCountByProject = new Map<string, number>();
  for (const track of trackRows ?? []) {
    trackCountByProject.set(track.project_id, (trackCountByProject.get(track.project_id) ?? 0) + 1);
  }

  const latestVersionByProject = new Map<string, string>();
  for (const version of versionRows ?? []) {
    if (!latestVersionByProject.has(version.project_id)) {
      latestVersionByProject.set(version.project_id, version.label);
    }
  }

  return projectRows.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    created_at: project.created_at,
    trackCount: trackCountByProject.get(project.id) ?? 0,
    latestVersionLabel: latestVersionByProject.get(project.id) ?? null
  }));
}

function formatCreatedDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value));
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: { search?: string };
}) {
  const searchValue = searchParams?.search ?? '';
  const projects = await getProjects(searchValue);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <CreateProjectForm />

      <section className="card p-5">
        <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Your Projects</h1>
            <p className="text-sm text-muted">Search, revisit, and jump back into sessions.</p>
          </div>
          <form method="GET" className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              name="search"
              defaultValue={searchValue}
              placeholder="Search by project name"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm"
            />
          </form>
        </div>

        {projects.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-border bg-background/50 p-8 text-center">
            <p className="text-base font-medium">No projects found</p>
            <p className="mt-2 text-sm text-muted">
              {searchValue ? 'Try a different search term or create a new project.' : 'Create your first project to start collaborating.'}
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="rounded-xl border border-border bg-background p-4 transition hover:-translate-y-0.5 hover:border-brand/60"
              >
                <p className="line-clamp-1 font-semibold">{project.name}</p>
                <p className="mt-2 min-h-10 text-sm text-muted line-clamp-2">{project.description ?? 'No description yet.'}</p>
                <div className="mt-4 space-y-1 text-xs text-muted">
                  <p>Created: {formatCreatedDate(project.created_at)}</p>
                  <p>Tracks: {project.trackCount}</p>
                  <p>Latest version: {project.latestVersionLabel ?? 'None yet'}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
