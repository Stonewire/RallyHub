-- New design, My Account "Danger Zone": let a signed-in user delete their own
-- account. `remove_organization_user` deliberately refuses self-deletion
-- ("Cannot remove yourself"), because it is the org-admin path for removing
-- *someone else*. This is the self-service sibling.
--
-- Guards, in order:
--   * super_admin is refused. RallyHub staff accounts are removed manually.
--   * the last remaining client_admin of an org is refused, otherwise the
--     organisation is orphaned with no one able to administer or delete it.
--     Deleting the whole organisation is a separate, deliberate action on the
--     Organisation page.
--   * demo organisations are refused, matching how the public demo suppresses
--     every other destructive action.
--
-- Deleting the auth.users row cascades to public.profiles and the rest, exactly
-- as migration 062 relies on.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role;
  v_org_id uuid;
  v_is_demo boolean;
  v_other_admins int;
  v_email text;
begin
  if v_user_id is null then
    raise exception 'Not signed in';
  end if;

  select p.role, p.organization_id
  into v_role, v_org_id
  from public.profiles p
  where p.id = v_user_id;

  if v_role is null then
    raise exception 'Profile not found';
  end if;

  if v_role = 'super_admin' then
    raise exception 'Platform staff accounts cannot be self-deleted';
  end if;

  if v_org_id is not null then
    select o.is_demo into v_is_demo
    from public.organizations o
    where o.id = v_org_id;

    if coalesce(v_is_demo, false) then
      raise exception 'Account deletion is disabled in the demo';
    end if;

    if v_role = 'client_admin' then
      select count(*)
      into v_other_admins
      from public.profiles p
      where p.organization_id = v_org_id
        and p.role = 'client_admin'
        and p.id <> v_user_id;

      if v_other_admins = 0 then
        raise exception 'You are the only admin. Add another admin first, or delete the whole organisation from Organisation settings.';
      end if;
    end if;

    select lower(u.email)::text
    into v_email
    from auth.users u
    where u.id = v_user_id;

    delete from public.organization_members
    where organization_id = v_org_id
      and lower(email) = v_email;
  end if;

  -- Cascades to public.profiles via the FK from migration 062.
  delete from auth.users where id = v_user_id;
end;
$$;

revoke execute on function public.delete_own_account() from PUBLIC, anon;
grant execute on function public.delete_own_account() to authenticated;
