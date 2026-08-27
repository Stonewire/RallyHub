-- P6.2: custom subscriptions.
--
-- Staff can put a client on a negotiated subscription price: a bespoke amount
-- and interval, and optionally a bespoke per-event charge. Three columns on
-- organizations, all NULL-means-normal so the five standard plans are
-- completely untouched for orgs without custom pricing:
--
--   custom_subscription_price_eur  whole euros; NULL = no custom subscription.
--   custom_subscription_period     'monthly' | 'yearly'; interval for the above.
--   custom_per_event_price_eur     NULL = per-event charges follow the normal
--                                  plan price; 0 = events are included in the
--                                  subscription, no per-event charge.
--
-- organizations RLS lets a client_admin UPDATE any column of their own org
-- row, so all three are billing-relevant columns that must be staff-only:
-- the column-guard BEFORE UPDATE trigger below (same pattern as
-- protect_demo_organization_metadata in 20260730010000_demo_sandbox.sql)
-- silently reverts any change not made by service_role or a super_admin.
-- Staff edits go through the browser as an authenticated super_admin, so the
-- guard allows is_super_admin() (SECURITY DEFINER helper from migration 051)
-- as well as service_role.

alter table public.organizations
  add column if not exists custom_subscription_price_eur numeric
    check (custom_subscription_price_eur is null or custom_subscription_price_eur >= 0),
  add column if not exists custom_subscription_period text
    check (custom_subscription_period is null or custom_subscription_period in ('monthly', 'yearly')),
  add column if not exists custom_per_event_price_eur numeric
    check (custom_per_event_price_eur is null or custom_per_event_price_eur >= 0);

comment on column public.organizations.custom_subscription_price_eur is
  'Staff-set negotiated subscription price in whole euros. NULL = no custom subscription; the plan''s normal pricing applies.';
comment on column public.organizations.custom_subscription_period is
  'Billing interval for the custom subscription: monthly or yearly. Only meaningful while custom_subscription_price_eur is set.';
comment on column public.organizations.custom_per_event_price_eur is
  'Staff-set per-event price override in euros. NULL = the plan''s normal per-event price; 0 = events included, no per-event charge. Additional-team charges are unaffected.';

-- Column guard: only service_role (Edge Functions, scripts) or a super_admin
-- (staff panel) may change the custom pricing columns. Everyone else keeps the
-- old values silently, exactly like the demo-metadata guard. This trigger is
-- deliberately its own function and name so it stacks safely next to any other
-- column-guard trigger on organizations.
create or replace function public.protect_custom_subscription_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and not public.is_super_admin() then
    new.custom_subscription_price_eur := old.custom_subscription_price_eur;
    new.custom_subscription_period := old.custom_subscription_period;
    new.custom_per_event_price_eur := old.custom_per_event_price_eur;
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_protect_custom_subscription on public.organizations;
create trigger organizations_protect_custom_subscription
  before update on public.organizations
  for each row execute function public.protect_custom_subscription_columns();

revoke all on function public.protect_custom_subscription_columns() from public, anon, authenticated;

-- Entitlement gate: a custom subscription has no monthly event limit (same as
-- Pro). plan_monthly_event_limit(text) only knows the plan id, so the org-level
-- override lives here in the gate, which already reads the org row.
--
-- Copied from the current definition in 20260714180000_pay1_free_plan_postpaid.sql.
-- Signature and parameter names are unchanged (create or replace is safe, no
-- overload is created). The ONLY additions are reading
-- custom_subscription_price_eur and skipping the monthly limit when it is set.
create or replace function public.assert_event_activation_allowed(
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
  v_custom_subscription numeric;
begin
  select
    lower(coalesce(trim(billing_plan), 'rookie')),
    lower(coalesce(trim(account_status), 'active')),
    lower(nullif(trim(subscription_status), '')),
    subscription_current_period_end,
    custom_subscription_price_eur
    into v_plan, v_account_status, v_sub_status, v_period_end, v_custom_subscription
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

  -- Monthly event limit, counting ACTIVATIONS this calendar month. An org on a
  -- staff-set custom subscription is unlimited, matching Pro.
  v_event_limit := public.plan_monthly_event_limit(v_plan);
  if v_event_limit is not null and v_custom_subscription is null then
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

comment on function public.assert_event_activation_allowed(uuid, uuid, boolean) is
  'Raises when the org may not activate the event. Orgs with a custom subscription (custom_subscription_price_eur set) have no monthly event limit.';

-- Activation invoicing: respect custom_per_event_price_eur when set.
--
-- Copied from the current definition in 20260716101729_additional_team_charges.sql.
-- The only changes: custom_per_event_price_eur is read with the plan, replaces
-- the plan''s per-event price as the base amount when set (never on the comped
-- partner/enterprise path, which stays fully comped), and an event promo code
-- is no longer consumed against a 0 base amount (only reachable when the
-- custom override makes events included; every standard plan base is > 0).
-- Additional-team charges, promo and educational handling are otherwise
-- untouched.
create or replace function public.create_event_activation_invoice(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_plan text;
  v_base_amount numeric(10, 2);
  v_base_amount_due numeric(10, 2);
  v_amount numeric(10, 2);
  v_discount numeric(10, 2);
  v_amount_due numeric(10, 2);
  v_status text;
  v_invoice_id uuid;
  v_redemption public.promo_code_redemptions%rowtype;
  v_promo_code_id uuid := null;
  v_educational text;
  v_included_team_count integer := 5;
  v_extra_team_count integer;
  v_extra_team_fee numeric(10, 2);
  v_custom_per_event numeric;
begin
  select id into v_invoice_id from public.invoices where event_id = p_event_id;
  if v_invoice_id is not null then
    return v_invoice_id;
  end if;

  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found: %', p_event_id;
  end if;

  select billing_plan, educational_status, custom_per_event_price_eur
    into v_plan, v_educational, v_custom_per_event
  from public.organizations
  where id = v_event.organization_id;

  v_plan := lower(coalesce(trim(v_plan), 'free'));
  if v_plan = 'enterprise' then
    v_plan := 'partner';
  elsif v_plan = 'free' then
    v_plan := 'rookie';
  elsif v_plan = 'starter' then
    v_plan := 'arena';
  end if;

  v_base_amount := public.plan_per_event_price_eur(v_plan);
  -- P6.2: staff-set per-event override. NULL means the plan price above;
  -- 0 means events are included in the custom subscription. Partner (and
  -- Custom/enterprise, normalized to partner) stays fully comped regardless.
  if v_plan <> 'partner' and v_custom_per_event is not null then
    v_base_amount := v_custom_per_event;
  end if;
  v_extra_team_count := greatest(coalesce(v_event.team_count, 0) - v_included_team_count, 0);
  v_extra_team_fee := case
    when v_plan = 'partner' then 0
    else v_extra_team_count * 10
  end;
  v_amount := v_base_amount + v_extra_team_fee;

  if v_plan = 'partner' then
    v_discount := v_amount;
    v_amount_due := 0;
    v_status := 'comped';
  else
    v_base_amount_due := v_base_amount;
    v_status := 'unpaid';

    -- Event promo codes discount the base event fee only. Purchased team
    -- capacity always remains EUR 10/team. A 0 base (events included via the
    -- custom override) has nothing to discount, so the code is not consumed.
    if v_base_amount > 0 then
      select * into v_redemption
      from public.promo_code_redemptions
      where organization_id = v_event.organization_id
        and purpose = 'event'
        and status = 'active'
      order by discount_percent desc
      limit 1;

      if found then
        v_base_amount_due := greatest(
          round(v_base_amount * (1 - v_redemption.discount_percent / 100.0), 2),
          0
        );
        v_promo_code_id := v_redemption.promo_code_id;
        update public.promo_code_redemptions
        set status = 'used', applied_at = now(), applied_event_id = p_event_id
        where id = v_redemption.id;
      end if;
    end if;

    if v_educational = 'approved' then
      v_base_amount_due := round(v_base_amount_due / 2.0, 2);
    end if;

    v_amount_due := v_base_amount_due + v_extra_team_fee;
    v_discount := greatest(v_amount - v_amount_due, 0);
    if v_amount_due = 0 then
      v_status := 'comped';
    end if;
  end if;

  insert into public.invoices (
    event_id,
    organization_id,
    plan_key,
    amount,
    discount,
    amount_due,
    status,
    promo_code_id,
    included_team_count,
    extra_team_count,
    extra_team_fee
  ) values (
    p_event_id,
    v_event.organization_id,
    v_plan,
    v_amount,
    v_discount,
    v_amount_due,
    v_status,
    v_promo_code_id,
    v_included_team_count,
    v_extra_team_count,
    v_extra_team_fee
  )
  on conflict (event_id) do nothing
  returning id into v_invoice_id;

  if v_invoice_id is null then
    select id into v_invoice_id from public.invoices where event_id = p_event_id;
  end if;

  update public.events
  set
    invoiced_at = coalesce(invoiced_at, now()),
    invoice_paid = case when v_status = 'comped' then true else invoice_paid end
  where id = p_event_id;

  return v_invoice_id;
end $$;

revoke all on function public.create_event_activation_invoice(uuid)
  from public, anon, authenticated;

comment on function public.create_event_activation_invoice(uuid) is
  'Creates the activation invoice. custom_per_event_price_eur overrides the plan''s base per-event price when set (0 = events included); additional teams stay EUR 10 each.';
