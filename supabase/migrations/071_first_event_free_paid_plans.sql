-- First event free for PAID plans only (Starter/arena, Pro, Max). The Free
-- (rookie) plan gets NO free event; Partner is already comped. Detected by the
-- org having zero prior invoices. Recreates create_event_activation_invoice
-- from migration 059 with the first-event comp added ahead of promo/educational.

create or replace function public.create_event_activation_invoice(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_plan text;
  v_amount numeric(10, 2);
  v_discount numeric(10, 2);
  v_amount_due numeric(10, 2);
  v_status text;
  v_invoice_id uuid;
  v_redemption public.promo_code_redemptions%rowtype;
  v_promo_code_id uuid := null;
  v_educational text;
  v_prior_count integer;
begin
  select id into v_invoice_id from public.invoices where event_id = p_event_id;
  if v_invoice_id is not null then
    return v_invoice_id;
  end if;

  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found: %', p_event_id;
  end if;

  select billing_plan, educational_status
    into v_plan, v_educational
  from public.organizations
  where id = v_event.organization_id;

  v_plan := lower(coalesce(trim(v_plan), 'free'));
  if v_plan = 'enterprise' then
    v_plan := 'partner';
  end if;
  if v_plan = 'free' then
    v_plan := 'rookie';
  elsif v_plan = 'starter' then
    v_plan := 'arena';
  end if;

  v_amount := public.plan_per_event_price_eur(v_plan);

  -- Has this org ever been invoiced for an event before (this one excluded)?
  select count(*) into v_prior_count
  from public.invoices
  where organization_id = v_event.organization_id
    and event_id <> p_event_id;

  if v_plan = 'partner' then
    v_discount := v_amount;
    v_amount_due := 0;
    v_status := 'comped';
  elsif v_prior_count = 0 and v_plan in ('arena', 'pro', 'max') then
    -- First event free on a paid plan. Free (rookie) plan is excluded and pays
    -- the per-event fee even on its first event. Promo codes are left unused.
    v_discount := v_amount;
    v_amount_due := 0;
    v_status := 'comped';
  else
    v_discount := 0;
    v_amount_due := v_amount;
    v_status := 'unpaid';

    -- Apply the best active event promo code, if any.
    select * into v_redemption
    from public.promo_code_redemptions
    where organization_id = v_event.organization_id
      and purpose = 'event'
      and status = 'active'
    order by discount_percent desc
    limit 1;

    if found then
      v_amount_due := greatest(round(v_amount * (1 - v_redemption.discount_percent / 100.0), 2), 0);
      v_promo_code_id := v_redemption.promo_code_id;
      update public.promo_code_redemptions
      set status = 'used', applied_at = now(), applied_event_id = p_event_id
      where id = v_redemption.id;
    end if;

    -- Stack the educational 50% discount on top of any promo discount.
    if v_educational = 'approved' then
      v_amount_due := round(v_amount_due / 2.0, 2);
    end if;

    v_discount := greatest(v_amount - v_amount_due, 0);
    if v_amount_due = 0 then
      v_status := 'comped';
    end if;
  end if;

  insert into public.invoices (
    event_id, organization_id, plan_key, amount, discount, amount_due, status, promo_code_id
  ) values (
    p_event_id, v_event.organization_id, v_plan, v_amount, v_discount, v_amount_due, v_status, v_promo_code_id
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
