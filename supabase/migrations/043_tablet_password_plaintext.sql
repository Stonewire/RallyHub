-- ═══════════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE — Tablet password: org-readable venue code
-- ═══════════════════════════════════════════════════════════════════════════
-- 040 bcrypt-hashed tablet_password, which broke admin display/save (settings
-- reloaded a hash into the form). Tablet codes are low-sensitivity shared
-- venue PINs: store plaintext for org admins, keep verify + rate limiting.

drop trigger if exists organizations_hash_tablet_password on public.organizations;
drop function if exists public.hash_tablet_password_on_write();

-- Bcrypt values cannot be reversed; reset to default kiosk code.
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

comment on column public.organizations.tablet_password is
  'Org tablet kiosk PIN (readable by org admins). Defaults to 1234.';
comment on function public.verify_tablet_password(uuid, text) is
  'Compare tablet kiosk PIN (plaintext, default 1234) with org-scoped lockout after 5 failures.';
