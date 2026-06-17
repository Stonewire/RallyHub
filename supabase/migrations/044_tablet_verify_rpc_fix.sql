-- ═══════════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE — Fix verify_tablet_password HTTP 404 on tablet login
-- ═══════════════════════════════════════════════════════════════════════════
-- Safe to run after 040 and/or 043. Idempotent.
--
-- PostgREST RPC signature (parameter names must match exactly):
--   verify_tablet_password(p_org_id uuid, p_password text) → boolean
--
-- HTTP 404 on this RPC is often NOT a missing function: 040's bcrypt verify
-- calls crypt() when tablet_password is hashed; if pgcrypto is unavailable
-- PostgreSQL raises 42883 and PostgREST surfaces it as 404.
-- This migration switches to plaintext compare (default 1234) and removes
-- the bcrypt write trigger.

create extension if not exists "pgcrypto";

drop trigger if exists organizations_hash_tablet_password on public.organizations;
drop function if exists public.hash_tablet_password_on_write();
drop function if exists public.verify_tablet_password(uuid, text);

update public.organizations
set tablet_password = '1234'
where tablet_password is null
   or trim(tablet_password) = ''
   or tablet_password like '$2a$%'
   or tablet_password like '$2b$%'
   or tablet_password like '$2y$%';

alter table public.organizations
  alter column tablet_password set default '1234';

update public.organizations
set tablet_password = '1234'
where tablet_password is null or trim(tablet_password) = '';

create or replace function public.verify_tablet_password(p_org_id uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored text;
  expected text;
  attempts record;
  now_ts timestamptz := now();
  supplied text := trim(coalesce(p_password, ''));
begin
  select * into attempts
  from public.tablet_login_attempts
  where organization_id = p_org_id;

  if attempts.locked_until is not null and attempts.locked_until > now_ts then
    return false;
  end if;

  select tablet_password into stored
  from public.organizations
  where id = p_org_id;

  expected := coalesce(nullif(trim(stored), ''), '1234');

  if expected = supplied then
    delete from public.tablet_login_attempts where organization_id = p_org_id;
    return true;
  end if;

  perform public.record_tablet_login_failure(p_org_id);
  return false;
end;
$$;

grant execute on function public.verify_tablet_password(uuid, text) to anon, authenticated;

comment on function public.verify_tablet_password(uuid, text) is
  'Compare tablet kiosk PIN (plaintext, default 1234) with org-scoped lockout after 5 failures.';
