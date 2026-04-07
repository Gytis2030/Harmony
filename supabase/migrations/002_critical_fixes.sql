create or replace function public.is_project_member(target_project_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.projects p
    where p.id = target_project_id
      and (
        p.owner_id = current_user_id
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = p.id
            and pm.user_id = current_user_id
        )
      )
  );
end;
$$;

create or replace function public.validate_comment_track_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.track_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.tracks t
    where t.id = new.track_id
      and t.project_id = new.project_id
  ) then
    raise exception 'Track does not belong to project.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_comments_track_project_integrity on public.comments;
create trigger trg_comments_track_project_integrity
before insert or update on public.comments
for each row
execute function public.validate_comment_track_project();

create or replace function public.find_profile_by_email_for_project(target_project_id uuid, target_email text)
returns table (
  id uuid,
  email text,
  full_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  normalized_email text;
begin
  current_user_id := auth.uid();
  normalized_email := lower(trim(target_email));

  if current_user_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.projects p
    where p.id = target_project_id
      and p.owner_id = current_user_id
  ) then
    return;
  end if;

  return query
  select pr.id, pr.email, pr.full_name
  from public.profiles pr
  where lower(trim(pr.email)) = normalized_email
  limit 1;
end;
$$;

create or replace function public.list_project_members_with_profiles(target_project_id uuid)
returns table (
  user_id uuid,
  role text,
  created_at timestamptz,
  full_name text,
  email text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_project_member(target_project_id) then
    return;
  end if;

  return query
  select pm.user_id, pm.role, pm.created_at, pr.full_name, pr.email
  from public.project_members pm
  left join public.profiles pr on pr.id = pm.user_id
  where pm.project_id = target_project_id
  order by pm.created_at asc;
end;
$$;

create or replace function public.update_project_track_offsets_atomic(target_project_id uuid, offset_updates jsonb)
returns table (
  id uuid,
  offset_sec numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  updates_count integer;
  matched_count integer;
begin
  if not public.is_project_member(target_project_id) then
    raise exception 'Access denied.';
  end if;

  with input as (
    select distinct
      (entry->>'trackId')::uuid as track_id,
      greatest(0, (entry->>'offsetSec')::numeric) as offset_sec
    from jsonb_array_elements(offset_updates) entry
  )
  select count(*) into updates_count from input;

  if coalesce(updates_count, 0) = 0 then
    raise exception 'No track offsets provided.';
  end if;

  with input as (
    select distinct
      (entry->>'trackId')::uuid as track_id,
      greatest(0, (entry->>'offsetSec')::numeric) as offset_sec
    from jsonb_array_elements(offset_updates) entry
  )
  select count(*)
  into matched_count
  from input i
  join public.tracks t
    on t.id = i.track_id
   and t.project_id = target_project_id;

  if matched_count <> updates_count then
    raise exception 'One or more tracks are invalid for this project.';
  end if;

  return query
  with input as (
    select distinct
      (entry->>'trackId')::uuid as track_id,
      greatest(0, (entry->>'offsetSec')::numeric) as next_offset_sec
    from jsonb_array_elements(offset_updates) entry
  ),
  updated as (
    update public.tracks t
    set offset_sec = i.next_offset_sec
    from input i
    where t.id = i.track_id
      and t.project_id = target_project_id
    returning t.id, t.offset_sec
  )
  select updated.id, updated.offset_sec
  from updated;
end;
$$;
