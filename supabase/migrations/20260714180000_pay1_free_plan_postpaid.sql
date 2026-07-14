-- Free plan no longer prepays (reverses 20260714150000).
--
-- It now activates like every other plan: the event goes live immediately, an
-- invoice is raised, and it is auto-charged to a saved card if the org has one,
-- otherwise settled manually with "Pay now". Free orgs have no subscription and
-- therefore usually no saved card, so in practice they pay manually.
--
-- One guard kept, because Free has nothing else holding it honest (paid plans are
-- gated by their subscription): a Free org cannot activate a NEW event while an
-- earlier one is still unpaid. The first activation is always instant; this only
-- bites on the second. Without it a Free org could keep activating events and
-- never pay for any of them.
--
-- Dropped and recreated (not create-or-replace) only because the parameter is
-- renamed; the SIGNATURE is unchanged (uuid, uuid, boolean). Adding or removing a
-- defaulted argument would create an OVERLOAD and make the trigger's two-arg call
-- ambiguous, which previously broke every activation.
drop function if exists public.assert_event_activation_allowed(uuid, uuid, boolean);

create function public.assert_event_activation_allowed(
  p_org_id uuid,
  p_event_id uuid,
  p_enforce_payment boolean default true
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
  v_unpaid int;
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

  -- Monthly event limit — counts ACTIVATIONS this calendar month.
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

  -- Free plan has no subscription to gate on, so the only thing keeping it honest
  -- is that it must settle what it already owes before running another event.
  if p_enforce_payment and v_plan = 'rookie' then
    select count(*) into v_unpaid
    from public.invoices
    where organization_id = p_org_id
      and status = 'unpaid'
      and event_id <> p_event_id;

    if v_unpaid > 0 then
      raise exception 'UNPAID_INVOICE: Settle your outstanding event invoice before activating another event.'
        using errcode = 'check_violation';
    end if;
  end if;
end $$;

-- Prepay is gone, so the RPC that created an invoice ahead of activation has no
-- caller left. Drop it rather than leave a reachable security-definer function.
drop function if exists public.prepare_event_invoice(uuid);
