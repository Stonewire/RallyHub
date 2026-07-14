-- PAY-1 Stage 1: strong, server-enforced entitlement gate on event activation.
--
-- Activation goes through the event_activation_billing AFTER-trigger (migration
-- 027) when an event's status flips to 'active'. Raising here rolls back the
-- whole UPDATE, so the event never activates. This cannot be bypassed from the
-- client — it runs inside the same transaction as the status change.
--
-- Rules enforced:
--   • Paid plans (arena/pro/max) must have an active, paid-through subscription
--     (subscription_status active/trialing AND current period not yet ended).
--   • Suspended orgs cannot activate.
--   • Monthly event limit per plan.
--   • Teams/players-per-event limit per plan.
-- Comped plans (partner, enterprise) are exempt — their billing is arranged
-- directly. The Free (rookie) plan has no subscription so it skips the
-- subscription gate, but still obeys the monthly + team limits. (Free-plan
-- prepay is Stage 2.)

-- Subscription period tracking, fed by the paddle-webhook function.
alter table public.organizations
  add column if not exists subscription_status text,
  add column if not exists subscription_current_period_end timestamptz;

-- Plan limits, mirroring src/lib/subscription-plans.ts. Keep in sync with the TS
-- config (monthlyEventLimit / teamLimit). NULL = unlimited.
create or replace function public.plan_monthly_event_limit(p_plan text)
returns int language sql immutable set search_path = public as $$
  select case lower(coalesce(trim(p_plan), 'rookie'))
    when 'rookie' then 1
    when 'free' then 1
    when 'arena' then 10
    when 'starter' then 10
    when 'pro' then 20
    when 'max' then 40
    else null -- enterprise, partner: unlimited
  end
$$;

create or replace function public.plan_team_limit(p_plan text)
returns int language sql immutable set search_path = public as $$
  select case lower(coalesce(trim(p_plan), 'rookie'))
    when 'rookie' then 10
    when 'free' then 10
    when 'arena' then 20
    when 'starter' then 20
    when 'pro' then 30
    when 'max' then 50
    else null -- enterprise, partner: unlimited
  end
$$;

-- Raises if this org is not entitled to activate this event. Called by the
-- activation trigger before the invoice is written.
create or replace function public.assert_event_activation_allowed(p_org_id uuid, p_event_id uuid)
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
begin
  select
    lower(coalesce(trim(billing_plan), 'rookie')),
    lower(coalesce(trim(account_status), 'active')),
    lower(nullif(trim(subscription_status), '')),
    subscription_current_period_end
    into v_plan, v_account_status, v_sub_status, v_period_end
  from public.organizations
  where id = p_org_id;

  -- Normalize legacy / display plan ids to internal ones.
  if v_plan = 'free' then
    v_plan := 'rookie';
  elsif v_plan = 'starter' then
    v_plan := 'arena';
  elsif v_plan = 'enterprise' then
    v_plan := 'partner'; -- comped like partner for billing purposes
  end if;

  if v_account_status = 'suspended' then
    raise exception 'ORG_SUSPENDED: This organization is suspended and cannot activate events.'
      using errcode = 'check_violation';
  end if;

  -- Comped plans: no subscription, no limits.
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

  -- Monthly event limit (counts this calendar month's activations).
  v_event_limit := public.plan_monthly_event_limit(v_plan);
  if v_event_limit is not null then
    select count(*) into v_month_count
    from public.events
    where organization_id = p_org_id
      and invoiced_at >= date_trunc('month', now())
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
end $$;

-- Re-create the activation trigger to gate before invoicing.
create or replace function public.trg_event_activation_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and (old.status is distinct from 'active') then
    perform public.assert_event_activation_allowed(new.organization_id, new.id);
    perform public.create_event_activation_invoice(new.id);
  end if;
  return new;
end;
$$;
