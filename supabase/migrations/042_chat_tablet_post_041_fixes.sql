-- Post-041 fixes: tablet event list + comments for chat join-token scoping.
--
-- Tablet: get_tablet_events_for_org used RETURNS SETOF events (fragile after
-- join_token column) and excluded demo events that teams join from the kiosk.
-- Chat: REST uses x-join-token; Realtime WebSockets do not carry that header,
-- so live panels also broadcast new messages on a token-scoped channel (client).

drop function if exists public.get_tablet_events_for_org(uuid);

create or replace function public.get_tablet_events_for_org(p_org_id uuid)
returns table (
  id uuid,
  organization_id uuid,
  name text,
  event_date timestamptz,
  status text,
  team_count integer,
  branding_enabled boolean,
  logo_url text,
  brand_colors jsonb,
  teams_config jsonb,
  stages_config jsonb,
  display_layout text,
  display_text_color text,
  list_order integer,
  invoice_paid boolean,
  invoiced_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.organization_id,
    e.name,
    e.event_date,
    e.status,
    e.team_count,
    e.branding_enabled,
    e.logo_url,
    e.brand_colors,
    e.teams_config,
    e.stages_config,
    e.display_layout,
    e.display_text_color,
    e.list_order,
    e.invoice_paid,
    e.invoiced_at,
    e.created_at
  from public.events e
  where e.organization_id = p_org_id
    and e.status in ('active', 'ready', 'demo')
  order by e.event_date asc nulls last;
$$;

grant execute on function public.get_tablet_events_for_org(uuid) to anon, authenticated;

comment on function public.get_tablet_events_for_org(uuid) is
  'Tablet kiosk event list for an org (active, ready, demo). Omits join_token.';
