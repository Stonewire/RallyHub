-- ═══════════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE — Tablet session tokens (H15)
-- ═══════════════════════════════════════════════════════════════════════════
-- Replaces the forgeable sessionStorage '1' flag with a server-issued UUID
-- token stored in tablet_sessions. verify_tablet_password now returns the
-- token (text) on success or NULL on failure. A new validate_tablet_session
-- RPC lets the client verify the stored token on each page load.
-- Rate limiting (tablet_login_attempts) remains from migration 040.

-- Session store (SECURITY DEFINER functions manage all access; no direct grants)
create table if not exists public.tablet_sessions (
  id           uuid      default gen_random_uuid() primary key,
  organization_id uuid   not null references public.organizations(id) on delete cascade,
  token        text      not null unique,
  expires_at   timestamptz not null default now() + interval '12 hours',
  created_at   timestamptz not null default now()
);

alter table public.tablet_sessions enable row level security;
revoke all on public.tablet_sessions from anon, authenticated, public;

-- Replace boolean return with text (token | NULL)
drop function if exists public.verify_tablet_password(uuid, text);

create or replace function public.verify_tablet_password(p_org_id uuid, p_password text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  stored      text;
  expected    text;
  attempts    record;
  now_ts      timestamptz := now();
  supplied    text := trim(coalesce(p_password, ''));
  v_token     text;
begin
  select * into attempts
  from public.tablet_login_attempts
  where organization_id = p_org_id;

  if attempts.locked_until is not null and attempts.locked_until > now_ts then
    return null;
  end if;

  select tablet_password into stored
  from public.organizations
  where id = p_org_id;

  expected := coalesce(nullif(trim(stored), ''), '1234');

  if expected = supplied then
    delete from public.tablet_login_attempts where organization_id = p_org_id;
    -- Clean up expired sessions for this org before issuing a new one
    delete from public.tablet_sessions where organization_id = p_org_id and expires_at < now_ts;
    v_token := gen_random_uuid()::text;
    insert into public.tablet_sessions (organization_id, token, expires_at)
    values (p_org_id, v_token, now_ts + interval '12 hours');
    return v_token;
  end if;

  perform public.record_tablet_login_failure(p_org_id);
  return null;
end;
$$;

grant execute on function public.verify_tablet_password(uuid, text) to anon, authenticated;

comment on function public.verify_tablet_password(uuid, text) is
  'Verify tablet PIN; returns a server-issued session token on success or NULL on failure/lockout.';

-- Validate a session token on subsequent page loads
create or replace function public.validate_tablet_session(p_org_id uuid, p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Purge expired sessions lazily
  delete from public.tablet_sessions where expires_at < now();

  return exists (
    select 1 from public.tablet_sessions
    where organization_id = p_org_id
      and token = p_token
      and expires_at > now()
  );
end;
$$;

grant execute on function public.validate_tablet_session(uuid, text) to anon, authenticated;

comment on function public.validate_tablet_session(uuid, text) is
  'Returns true if the token is a valid, unexpired tablet session for the given org.';

notify pgrst, 'reload schema';
