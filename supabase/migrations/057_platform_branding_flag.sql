-- Add opt-out flag for the "Powered by RallyHub" watermark shown on player surfaces.
-- Set to true for Max plan and Partner clients; super-admin manages per client.

alter table public.organizations
  add column if not exists hide_platform_branding boolean not null default false;

-- Re-declare all three tenant-public RPCs to include the new column.

create or replace function public.get_organization_tenant_public(p_org_id uuid)
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
  hide_platform_branding boolean
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
    o.hide_platform_branding
  from public.organizations o
  where o.id = p_org_id
  limit 1;
$$;

create or replace function public.get_organization_tenant_by_subdomain(p_subdomain text)
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
  hide_platform_branding boolean
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
    o.hide_platform_branding
  from public.organizations o
  where lower(o.subdomain) = lower(trim(p_subdomain))
  limit 1;
$$;

create or replace function public.resolve_tenant_by_host(p_host text)
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
  hide_platform_branding boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with host_clean as (
    select lower(split_part(trim(p_host), ':', 1)) as h
  )
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
    o.hide_platform_branding
  from public.organizations o
  cross join host_clean hc
  where (
    o.custom_domain is not null
    and lower(o.custom_domain) = hc.h
  )
  or (
    hc.h like '%.rallyhubapp.vercel.app'
    and o.subdomain = split_part(hc.h, '.', 1)
  )
  or (
    hc.h like '%.localhost'
    and o.subdomain = split_part(hc.h, '.', 1)
  )
  limit 1;
$$;

notify pgrst, 'reload schema';
