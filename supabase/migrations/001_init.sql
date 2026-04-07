create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor',
  added_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_path text not null,
  original_filename text not null,
  bpm_detected numeric,
  offset_ms integer not null default 0,
  duration_ms integer,
  sample_rate integer,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  track_id uuid references public.tracks(id) on delete set null,
  author_id uuid not null references auth.users(id) on delete cascade,
  timestamp_ms integer not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_versions enable row level security;
alter table public.tracks enable row level security;
alter table public.comments enable row level security;

create policy "project members can read projects" on public.projects
for select using (
  auth.uid() = owner_id
  or exists (
    select 1 from public.project_members pm
    where pm.project_id = id and pm.user_id = auth.uid()
  )
);

create policy "owners can create projects" on public.projects
for insert with check (auth.uid() = owner_id);

create policy "project members can read tracks" on public.tracks
for select using (
  exists (
    select 1 from public.projects p
    left join public.project_members pm on pm.project_id = p.id
    where p.id = tracks.project_id
      and (p.owner_id = auth.uid() or pm.user_id = auth.uid())
  )
);

create policy "project members can insert tracks" on public.tracks
for insert with check (
  exists (
    select 1 from public.projects p
    left join public.project_members pm on pm.project_id = p.id
    where p.id = tracks.project_id
      and (p.owner_id = auth.uid() or pm.user_id = auth.uid())
  )
);

create policy "project members can read comments" on public.comments
for select using (
  exists (
    select 1 from public.projects p
    left join public.project_members pm on pm.project_id = p.id
    where p.id = comments.project_id
      and (p.owner_id = auth.uid() or pm.user_id = auth.uid())
  )
);

create policy "project members can insert comments" on public.comments
for insert with check (
  exists (
    select 1 from public.projects p
    left join public.project_members pm on pm.project_id = p.id
    where p.id = comments.project_id
      and (p.owner_id = auth.uid() or pm.user_id = auth.uid())
  )
);
