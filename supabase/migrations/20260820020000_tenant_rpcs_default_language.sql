-- i18n reland fixup: the July org-level-language migration added
-- default_language to the tenant RPCs, but later demo-account migrations
-- re-created them (adding is_demo/demo_reset_at) from a pre-i18n definition
-- and dropped the column again. Re-add default_language on top of the
-- current definitions. Additive only: clients that don't read the key are
-- unaffected.

drop function if exists public.get_organization_tenant_public(uuid);
drop function if exists public.get_organization_tenant_by_subdomain(text);
drop function if exists public.resolve_tenant_by_host(text);

create or replace function public.get_organization_tenant_public(p_org_id uuid)
returns table (
  id uuid, subdomain text, custom_domain text, name text, logo_url text,
  primary_color text, secondary_color text, accent_color text, tablet_slug text,
  hide_platform_branding boolean,
  logo_light_url text, logo_dark_url text,
  brand_heading_font text, brand_body_font text,
  brand_heading_font_url text, brand_body_font_url text,
  is_demo boolean, demo_reset_at timestamptz,
  default_language text
)
language sql stable security definer set search_path = public as $$
  select o.id, o.subdomain, o.custom_domain, o.name, o.logo_url,
    o.primary_color, o.secondary_color, o.accent_color, o.tablet_slug,
    o.hide_platform_branding,
    o.logo_light_url, o.logo_dark_url,
    o.brand_heading_font, o.brand_body_font,
    o.brand_heading_font_url, o.brand_body_font_url,
    o.is_demo, o.demo_reset_at,
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
  is_demo boolean, demo_reset_at timestamptz,
  default_language text
)
language sql stable security definer set search_path = public as $$
  select o.id, o.subdomain, o.custom_domain, o.name, o.logo_url,
    o.primary_color, o.secondary_color, o.accent_color, o.tablet_slug,
    o.hide_platform_branding,
    o.logo_light_url, o.logo_dark_url,
    o.brand_heading_font, o.brand_body_font,
    o.brand_heading_font_url, o.brand_body_font_url,
    o.is_demo, o.demo_reset_at,
    o.default_language
  from public.organizations o
  where lower(o.subdomain) = lower(trim(p_subdomain)) limit 1;
$$;

create or replace function public.resolve_tenant_by_host(p_host text)
returns table (
  id uuid, subdomain text, custom_domain text, name text, logo_url text,
  primary_color text, secondary_color text, accent_color text, tablet_slug text,
  hide_platform_branding boolean,
  logo_light_url text, logo_dark_url text,
  brand_heading_font text, brand_body_font text,
  brand_heading_font_url text, brand_body_font_url text,
  is_demo boolean, demo_reset_at timestamptz,
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
    o.is_demo, o.demo_reset_at,
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
grant execute on function public.resolve_tenant_by_host(text) to anon, authenticated;

notify pgrst, 'reload schema';
