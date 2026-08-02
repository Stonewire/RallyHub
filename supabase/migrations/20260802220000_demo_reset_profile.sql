-- Restore the demo host's profile as part of a sandbox reset.
--
-- reset_demo_sandbox rebuilds the organisation, its games, events and teams,
-- but never touched profiles, because nothing on the demo profile was editable.
-- Now that My Account is a real, editable account on the demo, a visitor's
-- phone number and profile photo would otherwise outlive the reset and stay on
-- screen for the next person.
--
-- demo-session already re-upserts the name and username on every visit, so only
-- the two fields it leaves alone need clearing here.

create or replace function public.reset_demo_profile(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  update public.profiles
  set phone = null,
      avatar_url = null,
      first_name = 'Demo',
      last_name = 'Host',
      full_name = 'Demo Host',
      username = 'demo'
  where organization_id = p_organization_id
    and exists (
      select 1 from public.organizations o
      where o.id = p_organization_id and o.is_demo
    );
end;
$$;

revoke all on function public.reset_demo_profile(uuid) from public, anon, authenticated;
grant execute on function public.reset_demo_profile(uuid) to service_role;

notify pgrst, 'reload schema';
