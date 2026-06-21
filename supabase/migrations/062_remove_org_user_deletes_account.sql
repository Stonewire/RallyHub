-- #17: removing a user from an org team must fully delete their Supabase auth
-- account (not just detach the profile). All FKs to auth.users are ON DELETE
-- CASCADE / SET NULL, so deleting the auth row cleans up profiles + the rest.
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

  -- Full account removal. Cascades to public.profiles (FK on delete cascade).
  delete from auth.users where id = p_user_id;
end;
$$;
