-- P6.1: per-client feature flags.
--
-- One jsonb column on organizations drives what a client may CREATE or
-- configure. Semantics: an ABSENT key means allowed, so every existing client
-- keeps everything. Supported keys:
--   allowed_game_types   text[] of GameType values (absent = all six)
--   store_enabled        boolean (absent = true)
--   offline_enabled      boolean (absent = true)
--   allowed_stage_types  text[] of 'open'|'quiz'|'bingo'|'break' (absent = all)
--
-- Live rendering of already-built content is never gated here: only creation
-- paths read the flags, plus one cheap games INSERT backstop below.

alter table public.organizations
  add column if not exists feature_flags jsonb not null default '{}'::jsonb;

-- Column guard: organizations RLS lets a client_admin UPDATE any column of
-- their own org row, so the entitlement column must be protected the same way
-- protect_demo_organization_metadata protects demo metadata. Staff panel
-- writes go through supabase as an authenticated super_admin (use-rallyhub
-- updates organizations directly), so super_admin profiles are allowed as
-- well as service_role. The revert is silent, mirroring the demo guard, so a
-- client's full-row settings save never errors; it simply cannot move the
-- flags.
create or replace function public.protect_organization_feature_flags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.feature_flags is distinct from old.feature_flags
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and not public.is_super_admin() then
    new.feature_flags := old.feature_flags;
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_protect_feature_flags on public.organizations;
create trigger organizations_protect_feature_flags
  before update on public.organizations
  for each row execute function public.protect_organization_feature_flags();

revoke all on function public.protect_organization_feature_flags() from public, anon, authenticated;

-- Server-side backstop: refuse creating a game whose type the org's flags do
-- not allow. Existing games of a newly disallowed type keep working: an UPDATE
-- is only checked when it changes the type, so editing, reordering, archiving
-- and live play of existing games are untouched. service_role paths (demo
-- reset, seeds) bypass. Cheap: one PK lookup per insert or type change.
create or replace function public.enforce_game_type_allowed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed jsonb;
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.type is not distinct from old.type then
    return new;
  end if;

  select o.feature_flags -> 'allowed_game_types'
  into v_allowed
  from public.organizations o
  where o.id = new.organization_id;

  -- Absent key, or junk that is not an array, means allowed.
  if v_allowed is null or jsonb_typeof(v_allowed) <> 'array' then
    return new;
  end if;

  if not (v_allowed ? new.type) then
    raise exception 'The % game type is not enabled for this organisation', new.type
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists games_enforce_org_feature_flags on public.games;
create trigger games_enforce_org_feature_flags
  before insert or update on public.games
  for each row execute function public.enforce_game_type_allowed();

revoke all on function public.enforce_game_type_allowed() from public, anon, authenticated;

-- Tenant RPCs: the participant surface gates its offline package downloads on
-- the org's flags, and anon live pages cannot read organizations directly, so
-- feature_flags rides on the tenant-public RPCs. Additive only: the full
-- current return table (including default_language, see 20260820020000) is
-- copied, with feature_flags appended.

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
  default_language text,
  feature_flags jsonb
)
language sql stable security definer set search_path = public as $$
  select o.id, o.subdomain, o.custom_domain, o.name, o.logo_url,
    o.primary_color, o.secondary_color, o.accent_color, o.tablet_slug,
    o.hide_platform_branding,
    o.logo_light_url, o.logo_dark_url,
    o.brand_heading_font, o.brand_body_font,
    o.brand_heading_font_url, o.brand_body_font_url,
    o.is_demo, o.demo_reset_at,
    o.default_language,
    o.feature_flags
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
  default_language text,
  feature_flags jsonb
)
language sql stable security definer set search_path = public as $$
  select o.id, o.subdomain, o.custom_domain, o.name, o.logo_url,
    o.primary_color, o.secondary_color, o.accent_color, o.tablet_slug,
    o.hide_platform_branding,
    o.logo_light_url, o.logo_dark_url,
    o.brand_heading_font, o.brand_body_font,
    o.brand_heading_font_url, o.brand_body_font_url,
    o.is_demo, o.demo_reset_at,
    o.default_language,
    o.feature_flags
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
  default_language text,
  feature_flags jsonb
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
    o.default_language,
    o.feature_flags
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
