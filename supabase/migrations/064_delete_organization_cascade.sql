-- #1: allow super_admins to fully delete a client. Deleting the org cascades
-- events/games/teams/submissions/invoices (all ON DELETE CASCADE). Member auth
-- accounts are deleted explicitly (which cascades their profiles).
create or replace function public.delete_organization_cascade(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Forbidden';
  end if;

  -- Remove every auth account that belongs to this org (cascades profiles).
  delete from auth.users
  where id in (
    select id from public.profiles where organization_id = p_org_id
  );

  -- Remove the org itself; FKs cascade events, games, invoices, etc.
  delete from public.organizations where id = p_org_id;
end;
$$;

grant execute on function public.delete_organization_cascade(uuid) to authenticated;
