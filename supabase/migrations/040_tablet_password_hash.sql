-- ═══════════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE — Phase 1 security (H15): tablet password hashing
-- ═══════════════════════════════════════════════════════════════════════════
-- Hashes existing plaintext tablet_password values. Adds org-scoped rate
-- limiting (5 failures → 15 minute lockout). sessionStorage client flag
-- remains a known limitation — see project security notes.

create table if not exists public.tablet_login_attempts (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  failed_count integer not null default 0,
  last_failed_at timestamptz,
  locked_until timestamptz
);

alter table public.tablet_login_attempts enable row level security;

revoke all on public.tablet_login_attempts from anon, authenticated, public;

-- Hash any existing plaintext passwords (skip rows already bcrypt-encoded).
update public.organizations
set tablet_password = crypt(tablet_password, gen_salt('bf'))
where tablet_password is not null
  and trim(tablet_password) <> ''
  and tablet_password not like '$2a$%'
  and tablet_password not like '$2b$%'
  and tablet_password not like '$2y$%';

create or replace function public.record_tablet_login_failure(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  max_attempts constant integer := 5;
  lock_minutes constant integer := 15;
begin
  insert into public.tablet_login_attempts (organization_id, failed_count, last_failed_at)
  values (p_org_id, 1, now())
  on conflict (organization_id) do update
  set
    failed_count = public.tablet_login_attempts.failed_count + 1,
    last_failed_at = now(),
    locked_until = case
      when public.tablet_login_attempts.failed_count + 1 >= max_attempts
        then now() + make_interval(mins => lock_minutes)
      else public.tablet_login_attempts.locked_until
    end;
end;
$$;

revoke all on function public.record_tablet_login_failure(uuid) from public;

create or replace function public.verify_tablet_password(p_org_id uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored text;
  attempts record;
  now_ts timestamptz := now();
  supplied text := coalesce(p_password, '');
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

  if stored is null or trim(stored) = '' then
    if supplied = '' then
      delete from public.tablet_login_attempts where organization_id = p_org_id;
      return true;
    end if;
    perform public.record_tablet_login_failure(p_org_id);
    return false;
  end if;

  if stored like '$2a$%' or stored like '$2b$%' or stored like '$2y$%' then
    if stored = crypt(supplied, stored) then
      delete from public.tablet_login_attempts where organization_id = p_org_id;
      return true;
    end if;
    perform public.record_tablet_login_failure(p_org_id);
    return false;
  end if;

  -- Legacy plaintext fallback (should not occur after migration).
  if stored = supplied then
    update public.organizations
    set tablet_password = crypt(stored, gen_salt('bf'))
    where id = p_org_id;
    delete from public.tablet_login_attempts where organization_id = p_org_id;
    return true;
  end if;

  perform public.record_tablet_login_failure(p_org_id);
  return false;
end;
$$;

grant execute on function public.verify_tablet_password(uuid, text) to anon, authenticated;

-- Hash plaintext tablet_password on admin save (settings UI writes plaintext).
create or replace function public.hash_tablet_password_on_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tablet_password is null or trim(new.tablet_password) = '' then
    return new;
  end if;
  if new.tablet_password like '$2a$%'
    or new.tablet_password like '$2b$%'
    or new.tablet_password like '$2y$%' then
    return new;
  end if;
  if tg_op = 'INSERT'
    or new.tablet_password is distinct from old.tablet_password then
    new.tablet_password := crypt(new.tablet_password, gen_salt('bf'));
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_hash_tablet_password on public.organizations;
create trigger organizations_hash_tablet_password
before insert or update of tablet_password on public.organizations
for each row
execute function public.hash_tablet_password_on_write();

comment on function public.verify_tablet_password(uuid, text) is
  'Compare tablet password against bcrypt hash with org-scoped lockout after 5 failures.';
comment on table public.tablet_login_attempts is
  'Rate limiting for tablet password verification (org-scoped, not IP-based).';
