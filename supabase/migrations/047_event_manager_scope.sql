-- ═══════════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE — Restrict event_manager org settings + user scope
-- ═══════════════════════════════════════════════════════════════════════════

-- Profile/billing/tablet settings: client_admin of org only (super_admin has separate policy).
drop policy if exists "organizations_update_own" on public.organizations;
create policy "organizations_update_client_admin"
on public.organizations for update to authenticated
using (
  id = public.user_organization_id()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'client_admin'
      and p.organization_id = public.organizations.id
  )
)
with check (
  id = public.user_organization_id()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'client_admin'
      and p.organization_id = public.organizations.id
  )
);

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
declare
  v_actor_role public.app_role;
begin
  select me.role
  into v_actor_role
  from public.profiles me
  where me.id = auth.uid();

  if not exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'super_admin'
        or (
          me.role in ('client_admin', 'event_manager')
          and me.organization_id = p_org_id
        )
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
    and (
      v_actor_role in ('super_admin', 'client_admin')
      or p.role = 'facilitator'
    )
  order by p.created_at asc;
end;
$$;

create or replace function public.remove_organization_user(p_org_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_actor_role public.app_role;
  v_target_role public.app_role;
begin
  select me.role
  into v_actor_role
  from public.profiles me
  where me.id = auth.uid();

  if not exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and (
        me.role = 'super_admin'
        or (
          me.role in ('client_admin', 'event_manager')
          and me.organization_id = p_org_id
        )
      )
  ) then
    raise exception 'Forbidden';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Cannot remove yourself';
  end if;

  select p.role
  into v_target_role
  from public.profiles p
  where p.id = p_user_id
    and p.organization_id = p_org_id;

  if v_target_role is null then
    raise exception 'User not found in organization';
  end if;

  if v_actor_role = 'event_manager' and v_target_role is distinct from 'facilitator' then
    raise exception 'Event managers can only remove facilitator accounts';
  end if;

  select lower(u.email)::text
  into v_email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.id = p_user_id
    and p.organization_id = p_org_id;

  delete from public.organization_members
  where organization_id = p_org_id
    and lower(email) = v_email;

  update public.profiles
  set organization_id = null
  where id = p_user_id
    and organization_id = p_org_id;
end;
$$;

comment on policy "organizations_update_client_admin" on public.organizations is
  'Org profile/billing/tablet settings — client_admin of the org (not event_manager).';
