-- #12: new clients must start bare-bones — no demo games, no "Full Test Event",
-- no seeded teams. 009 added a trigger + RPC that seeded all of that on org
-- insert. Drop the trigger and neutralise the RPC so nothing is auto-created.
drop trigger if exists organizations_seed_defaults on public.organizations;

create or replace function public.seed_organization_defaults(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Intentionally a no-op. New organizations start empty (#12).
  return;
end;
$$;

comment on function public.seed_organization_defaults(uuid) is
  'No-op since #12 — new organizations start with no demo content.';
