-- Phase 2 (start): org-level default language. New events inherit it as their
-- starting language (still overridable per event, per Phase 1). It also
-- resolves the two Phase 1 deferrals: the tablet kiosk's own chrome (an
-- org-level screen, not tied to one event) and the inventory purchase page on
-- a standalone deep-link / hard refresh (no join-flow language in memory yet).

alter table public.organizations
  add column if not exists default_language text not null default 'en'
    check (default_language in ('en', 'bg', 'es', 'fr', 'nl'));

comment on column public.organizations.default_language is
  'Default UI language for this org: pre-fills new events and drives org-level screens (tablet chrome) that are not tied to one event.';

-- ── Tenant RPCs: widen to also return default_language ─────────────────────
drop function if exists public.get_organization_tenant_public(uuid);
drop function if exists public.get_organization_tenant_by_subdomain(text);
drop function if exists public.get_organizations_by_tablet_slug(text);
drop function if exists public.resolve_tenant_by_host(text);

create or replace function public.get_organization_tenant_public(p_org_id uuid)
returns table (
  id uuid, subdomain text, custom_domain text, name text, logo_url text,
  primary_color text, secondary_color text, accent_color text, tablet_slug text,
  hide_platform_branding boolean,
  logo_light_url text, logo_dark_url text,
  brand_heading_font text, brand_body_font text,
  brand_heading_font_url text, brand_body_font_url text,
  default_language text
)
language sql stable security definer set search_path = public as $$
  select o.id, o.subdomain, o.custom_domain, o.name, o.logo_url,
    o.primary_color, o.secondary_color, o.accent_color, o.tablet_slug,
    o.hide_platform_branding,
    o.logo_light_url, o.logo_dark_url,
    o.brand_heading_font, o.brand_body_font,
    o.brand_heading_font_url, o.brand_body_font_url,
    o.default_language
  from public.organizations o where o.id = p_org_id limit 1;
$$;

create or replace function public.get_organization_tenant_by_subdomain(p_subdomain text)
returns table (
  id uuid, subdomain text, custom_domain text, name text, logo_url text,
  primary_color text, secondary_color text, accent_color text, tablet_slug text,
  hide_platform_branding boolean,
  logo_light_url text, logo_dark_url text,
  brand_heading_font text, brand_body_font text,
  brand_heading_font_url text, brand_body_font_url text,
  default_language text
)
language sql stable security definer set search_path = public as $$
  select o.id, o.subdomain, o.custom_domain, o.name, o.logo_url,
    o.primary_color, o.secondary_color, o.accent_color, o.tablet_slug,
    o.hide_platform_branding,
    o.logo_light_url, o.logo_dark_url,
    o.brand_heading_font, o.brand_body_font,
    o.brand_heading_font_url, o.brand_body_font_url,
    o.default_language
  from public.organizations o
  where lower(o.subdomain) = lower(trim(p_subdomain)) limit 1;
$$;

create or replace function public.get_organizations_by_tablet_slug(p_tablet_slug text)
returns table (
  id uuid,
  subdomain text,
  custom_domain text,
  name text,
  logo_url text,
  primary_color text,
  secondary_color text,
  accent_color text,
  tablet_slug text,
  default_language text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id,
    o.subdomain,
    o.custom_domain,
    o.name,
    o.logo_url,
    o.primary_color,
    o.secondary_color,
    o.accent_color,
    o.tablet_slug,
    o.default_language
  from public.organizations o
  where o.tablet_slug = trim(p_tablet_slug);
$$;

create or replace function public.resolve_tenant_by_host(p_host text)
returns table (
  id uuid, subdomain text, custom_domain text, name text, logo_url text,
  primary_color text, secondary_color text, accent_color text, tablet_slug text,
  hide_platform_branding boolean,
  logo_light_url text, logo_dark_url text,
  brand_heading_font text, brand_body_font text,
  brand_heading_font_url text, brand_body_font_url text,
  default_language text
)
language sql stable security definer set search_path = public as $$
  with host_clean as (select lower(split_part(trim(p_host), ':', 1)) as h)
  select o.id, o.subdomain, o.custom_domain, o.name, o.logo_url,
    o.primary_color, o.secondary_color, o.accent_color, o.tablet_slug,
    o.hide_platform_branding,
    o.logo_light_url, o.logo_dark_url,
    o.brand_heading_font, o.brand_body_font,
    o.brand_heading_font_url, o.brand_body_font_url,
    o.default_language
  from public.organizations o
  cross join host_clean hc
  where (o.custom_domain is not null and lower(o.custom_domain) = hc.h)
     or (hc.h like '%.app.rallyhub.games' and o.subdomain = split_part(hc.h, '.', 1))
     or (hc.h like '%.rallyhubapp.vercel.app' and o.subdomain = split_part(hc.h, '.', 1))
     or (hc.h like '%.localhost' and o.subdomain = split_part(hc.h, '.', 1))
  limit 1;
$$;

grant execute on function public.get_organization_tenant_public(uuid) to anon, authenticated;
grant execute on function public.get_organization_tenant_by_subdomain(text) to anon, authenticated;
grant execute on function public.get_organizations_by_tablet_slug(text) to anon, authenticated;
grant execute on function public.resolve_tenant_by_host(text) to anon, authenticated;

-- ── Inventory purchase page (standalone deep-link / hard refresh): the event's
-- own language already carries the right value once new events inherit the
-- org default, so just surface it alongside the item. Adding an output column
-- requires dropping first (create-or-replace can't widen a table return type).
drop function if exists public.get_inventory_item_for_purchase(uuid, uuid);

create or replace function public.get_inventory_item_for_purchase(
  p_public_code uuid,
  p_event_id uuid
)
returns table (
  id uuid,
  name text,
  description text,
  points_cost integer,
  image_url text,
  language text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_status text;
  v_language text;
begin
  if not public.live_join_token_matches_event(p_event_id) then
    raise exception 'Event access has expired. Open your team page and scan again.';
  end if;

  select e.organization_id, e.status, e.language
  into v_organization_id, v_status, v_language
  from public.events e
  where e.id = p_event_id;

  if v_organization_id is null or v_status not in ('active', 'demo') then
    raise exception 'This event is not live.';
  end if;

  return query
  select i.id, i.name, i.description, i.points_cost, i.image_url, v_language
  from public.inventory_items i
  where i.public_code = p_public_code
    and i.organization_id = v_organization_id
    and i.is_active;
end;
$$;

grant execute on function public.get_inventory_item_for_purchase(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
