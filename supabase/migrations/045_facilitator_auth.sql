-- ═══════════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE — Part 1: facilitator role + username login
-- ═══════════════════════════════════════════════════════════════════════════
-- Adds facilitator role, profile username/names, login email resolution RPC,
-- and org-admin facilitator listing. Does NOT change live-table write RLS.

alter type public.app_role add value if not exists 'facilitator';

alter table public.profiles
  add column if not exists username text,
  add column if not exists first_name text,
  add column if not exists last_name text;

-- Backfill username + names for existing auth users.
do $$
declare
  r record;
  base text;
  candidate text;
  n int;
  parts text[];
begin
  for r in
    select p.id, u.email, p.full_name
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.username is null or trim(p.username) = ''
  loop
    base := lower(regexp_replace(split_part(r.email, '@', 1), '[^a-z0-9_]', '', 'g'));
    if base = '' or length(base) < 2 then
      base := 'user';
    end if;
    candidate := base;
    n := 0;
    while exists (
      select 1 from public.profiles
      where lower(username) = lower(candidate) and id <> r.id
    ) loop
      n := n + 1;
      candidate := base || n::text;
    end loop;

    parts := regexp_split_to_array(trim(coalesce(r.full_name, '')), '\s+');

    update public.profiles
    set
      username = candidate,
      first_name = coalesce(
        nullif(trim(first_name), ''),
        nullif(parts[1], '')
      ),
      last_name = coalesce(
        nullif(trim(last_name), ''),
        nullif(trim(array_to_string(parts[2:array_length(parts, 1)], ' ')), '')
      )
    where id = r.id;
  end loop;
end $$;

alter table public.profiles
  alter column username set not null;

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

comment on column public.profiles.username is
  'Unique login handle (case-insensitive). Email login still supported.';
comment on column public.profiles.first_name is 'Given name (display + admin).';
comment on column public.profiles.last_name is 'Family name (display + admin).';

-- Resolve username → auth email for password login (anon callable pre-auth).
create or replace function public.resolve_login_email(p_identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  ident text := trim(coalesce(p_identifier, ''));
  resolved text;
begin
  if ident = '' then
    return null;
  end if;

  if position('@' in ident) > 0 then
    return lower(ident);
  end if;

  select lower(u.email)
  into resolved
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(ident)
  limit 1;

  return resolved;
end;
$$;

grant execute on function public.resolve_login_email(text) to anon, authenticated;

-- Org admins list facilitators in their organization.
create or replace function public.get_organization_facilitators(p_org_id uuid)
returns table (
  id uuid,
  username text,
  email text,
  first_name text,
  last_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'super_admin'
        or (me.role = 'client_admin' and me.organization_id = p_org_id)
      )
  ) then
    raise exception 'Forbidden';
  end if;

  return query
  select
    p.id,
    p.username,
    lower(u.email)::text as email,
    p.first_name,
    p.last_name,
    p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.organization_id = p_org_id
    and p.role = 'facilitator'
  order by p.created_at asc;
end;
$$;

grant execute on function public.get_organization_facilitators(uuid) to authenticated;

-- New auth users: username + names + role from signup metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text := nullif(trim(meta ->> 'username'), '');
  v_first text := nullif(trim(meta ->> 'first_name'), '');
  v_last text := nullif(trim(meta ->> 'last_name'), '');
  v_full text := nullif(trim(meta ->> 'full_name'), '');
  v_role public.app_role;
  v_org uuid;
begin
  if v_full is null then
    v_full := nullif(trim(concat_ws(' ', v_first, v_last)), '');
  end if;

  begin
    v_role := coalesce(nullif(trim(meta ->> 'role'), '')::public.app_role, 'event_manager');
  exception when others then
    v_role := 'event_manager';
  end;

  begin
    v_org := nullif(trim(meta ->> 'organization_id'), '')::uuid;
  exception when others then
    v_org := null;
  end;

  if v_username is null then
    v_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
  end if;

  insert into public.profiles (
    id,
    username,
    full_name,
    first_name,
    last_name,
    role,
    organization_id
  )
  values (
    new.id,
    v_username,
    v_full,
    v_first,
    v_last,
    v_role,
    v_org
  );

  return new;
end;
$$;

comment on function public.resolve_login_email(text) is
  'Login helper: returns email for username lookup or lowercased email input.';
comment on function public.get_organization_facilitators(uuid) is
  'Facilitator accounts for an org (client_admin or super_admin only).';
