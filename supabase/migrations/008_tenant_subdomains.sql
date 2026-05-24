-- Tenant subdomains for multi-tenant URLs ({slug}.rallyhubapp.vercel.app)

alter table public.organizations
  add column if not exists subdomain text,
  add column if not exists custom_domain text;

create unique index if not exists organizations_subdomain_idx
  on public.organizations (subdomain)
  where subdomain is not null;

create unique index if not exists organizations_custom_domain_idx
  on public.organizations (custom_domain)
  where custom_domain is not null;

-- Slugify helper for backfill
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

-- Backfill subdomains from org names (dedupe with numeric suffix)
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

-- Public tenant branding view (no tablet_password)
create or replace view public.organization_tenant_public as
select
  id,
  subdomain,
  custom_domain,
  name,
  logo_url,
  primary_color,
  secondary_color,
  accent_color,
  tablet_slug
from public.organizations;

grant select on public.organization_tenant_public to anon, authenticated;

-- Restrict anon full-table org access; use view for live/tenant resolution
drop policy if exists "organizations_live_select" on public.organizations;

-- Verify tablet password without exposing hash/plaintext to clients
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

-- Resolve tenant by subdomain or custom domain (for login page bootstrap)
create or replace function public.resolve_tenant_by_host(p_host text)
returns setof public.organization_tenant_public
language sql
stable
security definer
set search_path = public
as $$
  with host_clean as (
    select lower(split_part(trim(p_host), ':', 1)) as h
  )
  select o.*
  from public.organization_tenant_public o
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

grant execute on function public.resolve_tenant_by_host(text) to anon, authenticated;
