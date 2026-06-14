-- ═══════════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE — Phase 1 security (M9): org tenant view enumeration
-- ═══════════════════════════════════════════════════════════════════════════
-- Prevents anon/authenticated from SELECT * on organization_tenant_public.
-- Single-org lookups go through SECURITY DEFINER RPCs instead.

-- View reads base table with caller's privileges (blocks broad anon SELECT).
alter view public.organization_tenant_public set (security_invoker = true);

revoke select on public.organization_tenant_public from anon, authenticated;

-- Shared column list for tenant-safe org branding (no tablet_password).
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
  tablet_slug text
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
    o.tablet_slug
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
  tablet_slug text
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
    o.tablet_slug
  from public.organizations o
  where lower(o.subdomain) = lower(trim(p_subdomain))
  limit 1;
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
  tablet_slug text
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
    o.tablet_slug
  from public.organizations o
  where o.tablet_slug = trim(p_tablet_slug);
$$;

-- Host-based tenant resolution (query base table directly, not the invoker view).
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
  tablet_slug text
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
    o.tablet_slug
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

grant execute on function public.get_organization_tenant_public(uuid) to anon, authenticated;
grant execute on function public.get_organization_tenant_by_subdomain(text) to anon, authenticated;
grant execute on function public.get_organizations_by_tablet_slug(text) to anon, authenticated;
grant execute on function public.resolve_tenant_by_host(text) to anon, authenticated;

comment on function public.get_organization_tenant_public(uuid) is
  'Single-org public branding lookup for live panels (no enumeration).';
comment on function public.get_organization_tenant_by_subdomain(text) is
  'Single-org lookup by subdomain for tenant bootstrap.';
comment on function public.get_organizations_by_tablet_slug(text) is
  'Tablet URL resolution by access code; caller filters by org slug.';
