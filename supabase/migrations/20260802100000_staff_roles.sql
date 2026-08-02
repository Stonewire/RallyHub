-- Internal RallyHub staff roles.
--
-- Staff sign in as role super_admin (so every existing platform policy keeps
-- working) and carry a staff_role that scopes what the panel shows them and
-- what the guards below let them write. Rumen decided the tiers:
--   owner           - everything (Rumen)
--   platform_admin  - manage clients, promo codes; no owner locks
--   support_agent   - support tickets; clients read-only
--   content_manager - platform game library only
--   finance         - payments view, promo codes
--
-- Owner-only, enforced here rather than in the UI:
--   1. changing a client's plan / period / account status / educational status
--   2. marking invoices paid or comped
--   3. changing anyone's staff_role
-- (4. deleting clients is owner-gated in the data-lifecycle edge function,
--  which runs with the service key and does its own caller check.)

alter table public.profiles
  add column if not exists staff_role text
  check (staff_role in ('owner', 'platform_admin', 'support_agent', 'content_manager', 'finance'));

-- Every existing super admin is Rumen; they all become owner.
update public.profiles set staff_role = 'owner' where role = 'super_admin' and staff_role is null;

-- A null staff_role on a super_admin counts as owner so the existing account
-- can never lock itself out; the create-staff path always sets a staff_role.
create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
      and coalesce(staff_role, 'owner') = 'owner'
  );
$$;

-- Staff (super_admin, any staff_role) but not the owner: the case the guards
-- below need to reject.
create or replace function public.is_non_owner_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
      and coalesce(staff_role, 'owner') <> 'owner'
  );
$$;

-- 1. Plan and account fields on organizations are owner-only among staff.
--    Clients and service-role jobs (auth.uid() is null) are untouched.
create or replace function public.guard_org_plan_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;
  if not public.is_non_owner_staff() then return new; end if;
  if new.billing_plan is distinct from old.billing_plan
     or new.billing_period is distinct from old.billing_period
     or new.account_status is distinct from old.account_status
     or new.trial_ends_at is distinct from old.trial_ends_at
     or new.educational_status is distinct from old.educational_status
     or new.hide_platform_branding is distinct from old.hide_platform_branding then
    raise exception 'Only the owner can change a client''s plan or account status.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_org_plan_columns on public.organizations;
create trigger guard_org_plan_columns
  before update on public.organizations
  for each row execute function public.guard_org_plan_columns();

-- 2. Invoice status (mark paid / comp) is owner-only among staff.
create or replace function public.guard_invoice_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;
  if not public.is_non_owner_staff() then return new; end if;
  if new.status is distinct from old.status then
    raise exception 'Only the owner can change an invoice''s status.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_invoice_status on public.invoices;
create trigger guard_invoice_status
  before update on public.invoices
  for each row execute function public.guard_invoice_status();

-- 3. staff_role assignments are owner-only for authenticated callers.
--    Service-role paths (the manage-staff edge function) check the caller
--    themselves before acting.
create or replace function public.guard_staff_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;
  if new.staff_role is distinct from old.staff_role
     and not public.is_platform_owner() then
    raise exception 'Only the owner can change staff roles.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_staff_role on public.profiles;
create trigger guard_staff_role
  before update on public.profiles
  for each row execute function public.guard_staff_role();
