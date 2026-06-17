-- ═══════════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE — Org user temp passwords + unified user listing
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  'When true, user must set a new password before using the app (admin-created temp password).';

-- List all login accounts in an organization (replaces facilitator-only list).
drop function if exists public.get_organization_facilitators(uuid);

create or replace function public.get_organization_users(p_org_id uuid)
returns table (
  id uuid,
  username text,
  email text,
  first_name text,
  last_name text,
  role public.app_role,
  must_change_password boolean,
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
    p.role,
    p.must_change_password,
    p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.organization_id = p_org_id
    and p.role in ('facilitator', 'event_manager', 'client_admin')
  order by p.created_at asc;
end;
$$;

grant execute on function public.get_organization_users(uuid) to authenticated;

create or replace function public.clear_must_change_password()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set must_change_password = false
  where id = auth.uid();
$$;

grant execute on function public.clear_must_change_password() to authenticated;

create or replace function public.remove_organization_user(p_org_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
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

  if p_user_id = auth.uid() then
    raise exception 'Cannot remove yourself';
  end if;

  select lower(u.email)::text into v_email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.id = p_user_id
    and p.organization_id = p_org_id;

  if v_email is null then
    raise exception 'User not found in organization';
  end if;

  delete from public.organization_members
  where organization_id = p_org_id
    and lower(email) = v_email;

  update public.profiles
  set organization_id = null
  where id = p_user_id
    and organization_id = p_org_id;
end;
$$;

grant execute on function public.remove_organization_user(uuid, uuid) to authenticated;

-- Extend signup trigger for temp-password flag.
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
  v_must_change boolean := false;
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

  if lower(coalesce(meta ->> 'must_change_password', '')) in ('true', '1', 'yes') then
    v_must_change := true;
  end if;

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
    organization_id,
    must_change_password
  )
  values (
    new.id,
    v_username,
    v_full,
    v_first,
    v_last,
    v_role,
    v_org,
    v_must_change
  );

  return new;
end;
$$;

comment on function public.get_organization_users(uuid) is
  'Org login accounts for client_admin / super_admin (facilitator, event_manager, client_admin).';
