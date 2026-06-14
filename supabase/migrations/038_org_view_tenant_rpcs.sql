-- ═══════════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE — Phase 1 security (M9): org tenant enumeration
-- ═══════════════════════════════════════════════════════════════════════════
-- Self-contained: does not require migration 008 or organization_tenant_public.
-- Ensures every column referenced below exists, then creates scoped SECURITY
-- DEFINER RPCs, verify_tablet_password, and revokes anon direct SELECT on
-- public.organizations (organizations_live_select from 006).
--
-- Columns referenced by RPCs / verify_tablet_password on public.organizations:
--   id, name, logo_url, primary_color, secondary_color, accent_color,
--   subdomain, custom_domain, tablet_slug, tablet_password

create extension if not exists "pgcrypto";

-- ─── Prerequisites: add any missing org columns (do not assume 002/008 ran) ─

alter table public.organizations
  add column if not exists name text not null default 'My Organization',
  add column if not exists logo_url text,
  add column if not exists primary_color text not null default '#3E3D3E',
  add column if not exists secondary_color text not null default '#6f6f6f',
  add column if not exists accent_color text not null default '#FFCB03',
  add column if not exists tablet_password text,
  add column if not exists tablet_slug text default encode(gen_random_bytes(6), 'hex'),
  add column if not exists subdomain text,
  add column if not exists custom_domain text;

-- Backfill tablet_slug for rows created before the column existed.
update public.organizations
set tablet_slug = encode(gen_random_bytes(6), 'hex')
where tablet_slug is null;

alter table public.organizations
  alter column tablet_slug set not null;

create unique index if not exists organizations_tablet_slug_idx
  on public.organizations (tablet_slug);

create unique index if not exists organizations_subdomain_idx
  on public.organizations (subdomain)
  where subdomain is not null;

create unique index if not exists organizations_custom_domain_idx
  on public.organizations (custom_domain)
  where custom_domain is not null;

create or replace function public.slugify_org_name(raw text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(both '-' from regexp_replace(lower(coalesce(raw, '')), '[^a-z0-9]+', '-', 'g')),
    ''
  );
$$;

-- Backfill subdomains from org names (dedupe with numeric suffix).
do $$
declare
  r record;
  base_slug text;
  candidate text;
  n int;
begin
  for r in select id, name from public.organizations where subdomain is null order by created_at loop
    base_slug := public.slugify_org_name(r.name);
    if base_slug is null then
      base_slug := 'org';
    end if;
    candidate := base_slug;
    n := 2;
    while exists (select 1 from public.organizations o where o.subdomain = candidate and o.id <> r.id) loop
      candidate := base_slug || '-' || n;
      n := n + 1;
    end loop;
    update public.organizations set subdomain = candidate where id = r.id;
  end loop;
end $$;

alter table public.organizations
  alter column subdomain set not null;

-- Tablet password check without exposing stored value to clients (040 upgrades hashing).
create or replace function public.verify_tablet_password(p_org_id uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored text;
begin
  select tablet_password into stored
  from public.organizations
  where id = p_org_id;

  if stored is null or stored = '' then
    return coalesce(p_password, '') = '';
  end if;

  return stored = p_password;
end;
$$;

grant execute on function public.verify_tablet_password(uuid, text) to anon, authenticated;

-- ─── Scoped public org lookups (no tablet_password, no full-table SELECT) ──

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
comment on function public.resolve_tenant_by_host(text) is
  'Host-based tenant resolution for subdomain/custom-domain bootstrap.';

-- ─── Lock down anon direct organizations table access ──────────────────────

drop policy if exists "organizations_live_select" on public.organizations;

revoke select on public.organizations from anon;
