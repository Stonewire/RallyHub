-- PAY-1 Stage 2b: Free-plan prepay.
--
-- The Free plan has no subscription, so there is nothing to gate activation on
-- and nothing to auto-charge against. Left as-is, a Free org could activate an
-- event and simply never pay the per-event fee. So Free must PREPAY: the event's
-- invoice has to be settled before it can go live.
--
-- That means the invoice must exist BEFORE activation, which breaks an
-- assumption in Stage 1: the monthly-event-limit counted events by invoiced_at,
-- and invoiced_at was only ever set at activation. Pre-creating invoices would
-- let never-activated events eat the monthly quota. So activation now has its
-- own marker, activated_at, and the limit counts that instead.

alter table public.events
  add column if not exists activated_at timestamptz;

-- Historically invoiced_at was only ever set at activation, so it is an exact
-- backfill for activated_at.
update public.events
set activated_at = invoiced_at
where invoiced_at is not null
  and activated_at is null;

create index if not exists events_org_activated_at_idx
  on public.events (organization_id, activated_at)
  where activated_at is not null;

-- Adding a third (defaulted) argument creates an OVERLOAD rather than replacing
-- the Stage 1 function, and the trigger's two-arg call would then match both
-- candidates ("function is not unique") — breaking every activation. Drop the old
-- signature first; the defaulted three-arg version still satisfies two-arg calls.
drop function if exists public.assert_event_activation_allowed(uuid, uuid);

-- p_check_prepay lets the prepay RPC run every other check (suspension, limits)
-- WITHOUT the prepay rule — otherwise creating the very invoice needed to
-- satisfy that rule would be blocked by it.
create or replace function public.assert_event_activation_allowed(
  p_org_id uuid,
  p_event_id uuid,
  p_check_prepay boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_account_status text;
  v_sub_status text;
  v_period_end timestamptz;
  v_event_limit int;
  v_team_limit int;
  v_month_count int;
  v_team_count int;
  v_invoice_status text;
begin
  select
    lower(coalesce(trim(billing_plan), 'rookie')),
    lower(coalesce(trim(account_status), 'active')),
    lower(nullif(trim(subscription_status), '')),
    subscription_current_period_end
    into v_plan, v_account_status, v_sub_status, v_period_end
  from public.organizations
  where id = p_org_id;

  if v_plan = 'free' then
    v_plan := 'rookie';
  elsif v_plan = 'starter' then
    v_plan := 'arena';
  elsif v_plan = 'enterprise' then
    v_plan := 'partner';
  end if;

  if v_account_status = 'suspended' then
    raise exception 'ORG_SUSPENDED: This organization is suspended and cannot activate events.'
      using errcode = 'check_violation';
  end if;

  -- Comped plans: no subscription, no limits, nothing to pay.
  if v_plan = 'partner' then
    return;
  end if;

  -- Paid plans need an active, paid-through subscription.
  if v_plan in ('arena', 'pro', 'max') then
    if v_sub_status is null
       or v_sub_status not in ('active', 'trialing')
       or v_period_end is null
       or v_period_end < now() then
      raise exception 'SUBSCRIPTION_REQUIRED: Start a subscription (paid for the current period) before activating events.'
        using errcode = 'check_violation';
    end if;
  end if;

  -- Monthly event limit — counts ACTIVATIONS this calendar month, not invoices,
  -- so a Free org's pre-created (unpaid, never-activated) invoices don't count.
  v_event_limit := public.plan_monthly_event_limit(v_plan);
  if v_event_limit is not null then
    select count(*) into v_month_count
    from public.events
    where organization_id = p_org_id
      and activated_at >= date_trunc('month', now())
      and id <> p_event_id;
    if v_month_count >= v_event_limit then
      raise exception 'EVENT_LIMIT_REACHED: Your plan allows % event(s) per month. Upgrade to run more.', v_event_limit
        using errcode = 'check_violation';
    end if;
  end if;

  -- Teams/players-per-event limit.
  v_team_limit := public.plan_team_limit(v_plan);
  if v_team_limit is not null then
    select coalesce(team_count, 0) into v_team_count
    from public.events where id = p_event_id;
    if v_team_count > v_team_limit then
      raise exception 'TEAM_LIMIT_EXCEEDED: Your plan allows % teams/players per event. Upgrade for more.', v_team_limit
        using errcode = 'check_violation';
    end if;
  end if;

  -- Free plan: no subscription to gate on and no saved card to auto-charge, so
  -- the per-event fee must already be settled. A 100%-promo invoice lands as
  -- 'comped', which counts as settled.
  if p_check_prepay and v_plan = 'rookie' then
    select status into v_invoice_status
    from public.invoices where event_id = p_event_id;

    if v_invoice_status is null or v_invoice_status not in ('paid', 'comped') then
      raise exception 'PREPAY_REQUIRED: Pay for this event before activating it.'
        using errcode = 'check_violation';
    end if;
  end if;
end $$;

-- Creates (or returns) the invoice for an event WITHOUT activating it, so a Free
-- org can pay before going live. Runs every activation check except the prepay
-- rule, so we never take money for an event they could not activate anyway
-- (suspended, over their monthly limit, too many teams).
create or replace function public.prepare_event_invoice(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.events where id = p_event_id;
  if v_org is null then
    raise exception 'Event not found';
  end if;

  if not (public.is_super_admin() or v_org = (select public.user_organization_id())) then
    raise exception 'Forbidden';
  end if;

  perform public.assert_event_activation_allowed(v_org, p_event_id, false);

  return public.create_event_activation_invoice(p_event_id);
end $$;

revoke all on function public.prepare_event_invoice(uuid) from public, anon;
grant execute on function public.prepare_event_invoice(uuid) to authenticated;

-- Create the invoice BEFORE asserting entitlement, and stamp activated_at.
--
-- The prepay rule checks the event's invoice status, so the invoice has to exist
-- by then. Otherwise a Free org holding a 100%-off promo code (which produces a
-- 'comped' invoice, nothing to pay) could never activate: the gate would look for
-- an invoice that the very next statement was about to create.
--
-- Safe because the trigger, the invoice insert and the promo-code consumption all
-- run in the SAME transaction as the status change: if the gate raises, the
-- invoice and the used promo code roll back with it. No orphan invoices.
create or replace function public.trg_event_activation_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and (old.status is distinct from 'active') then
    perform public.create_event_activation_invoice(new.id);
    perform public.assert_event_activation_allowed(new.organization_id, new.id);
    update public.events
      set activated_at = coalesce(activated_at, now())
      where id = new.id;
  end if;
  return new;
end;
$$;
