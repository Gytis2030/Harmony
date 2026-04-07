create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text null,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  name text not null,
  description text null,
  bpm integer null,
  key_signature text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table if not exists public.project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  label text not null,
  notes text null,
  snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  version_id uuid null references public.project_versions(id) on delete set null,
  name text not null,
  file_path text not null,
  file_size_bytes bigint null,
  mime_type text null,
  duration_sec numeric null,
  sample_rate integer null,
  channel_count integer null,
  offset_sec numeric not null default 0,
  waveform_peaks jsonb null,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  track_id uuid null references public.tracks(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  timestamp_sec numeric not null default 0,
  body text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.set_projects_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
before update on public.projects
for each row
execute function public.set_projects_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_versions enable row level security;
alter table public.tracks enable row level security;
alter table public.comments enable row level security;

create or replace function public.is_project_member(target_project_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.projects p
    left join public.project_members pm
      on pm.project_id = p.id
     and pm.user_id = auth.uid()
    where p.id = target_project_id
      and (p.owner_id = auth.uid() or pm.user_id is not null)
  );
$$;

create policy "profiles_select_self" on public.profiles
for select
using (auth.uid() = id);

create policy "profiles_insert_self" on public.profiles
for insert
with check (auth.uid() = id);

create policy "profiles_update_self" on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "projects_select_member" on public.projects
for select
using (public.is_project_member(id));

create policy "projects_insert_owner" on public.projects
for insert
with check (auth.uid() = owner_id);

create policy "projects_update_owner" on public.projects
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "projects_delete_owner" on public.projects
for delete
using (auth.uid() = owner_id);

create policy "project_members_select_member" on public.project_members
for select
using (public.is_project_member(project_id));

create policy "project_members_insert_owner" on public.project_members
for insert
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and p.owner_id = auth.uid()
  )
);

create policy "project_members_update_owner" on public.project_members
for update
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and p.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and p.owner_id = auth.uid()
  )
);

create policy "project_members_delete_owner" on public.project_members
for delete
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and p.owner_id = auth.uid()
  )
);

create policy "project_versions_select_member" on public.project_versions
for select
using (public.is_project_member(project_id));

create policy "project_versions_insert_member" on public.project_versions
for insert
with check (public.is_project_member(project_id) and auth.uid() = created_by);

create policy "project_versions_update_member" on public.project_versions
for update
using (public.is_project_member(project_id))
with check (public.is_project_member(project_id));

create policy "project_versions_delete_member" on public.project_versions
for delete
using (public.is_project_member(project_id));

create policy "tracks_select_member" on public.tracks
for select
using (public.is_project_member(project_id));

create policy "tracks_insert_member" on public.tracks
for insert
with check (public.is_project_member(project_id) and auth.uid() = uploaded_by);

create policy "tracks_update_member" on public.tracks
for update
using (public.is_project_member(project_id))
with check (public.is_project_member(project_id));

create policy "tracks_delete_member" on public.tracks
for delete
using (public.is_project_member(project_id));

create policy "comments_select_member" on public.comments
for select
using (public.is_project_member(project_id));

create policy "comments_insert_member" on public.comments
for insert
with check (public.is_project_member(project_id) and auth.uid() = author_id);

create policy "comments_update_member" on public.comments
for update
using (public.is_project_member(project_id))
with check (public.is_project_member(project_id));

create policy "comments_delete_member" on public.comments
for delete
using (public.is_project_member(project_id));

insert into storage.buckets (id, name, public)
values ('tracks', 'tracks', false)
on conflict (id) do nothing;

create policy "tracks_storage_read" on storage.objects
for select
using (
  bucket_id = 'tracks'
  and public.is_project_member(split_part(name, '/', 1)::uuid)
);

create policy "tracks_storage_insert" on storage.objects
for insert
with check (
  bucket_id = 'tracks'
  and public.is_project_member(split_part(name, '/', 1)::uuid)
);

create policy "tracks_storage_update" on storage.objects
for update
using (
  bucket_id = 'tracks'
  and public.is_project_member(split_part(name, '/', 1)::uuid)
)
with check (
  bucket_id = 'tracks'
  and public.is_project_member(split_part(name, '/', 1)::uuid)
);

create policy "tracks_storage_delete" on storage.objects
for delete
using (
  bucket_id = 'tracks'
  and public.is_project_member(split_part(name, '/', 1)::uuid)
);
