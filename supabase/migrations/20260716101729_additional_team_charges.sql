-- Five teams are included with every standard event. Additional teams are
-- snapshotted and charged at €10 each when the activation invoice is created.
-- The browser only previews this calculation; Postgres remains authoritative.

alter table public.events
  alter column team_count set default 5;

alter table public.invoices
  add column if not exists included_team_count integer not null default 5
    check (included_team_count >= 0),
  add column if not exists extra_team_count integer not null default 0
    check (extra_team_count >= 0),
  add column if not exists extra_team_fee numeric(10, 2) not null default 0
    check (extra_team_fee >= 0);

comment on column public.invoices.included_team_count is
  'Included team allowance snapshotted when the event invoice is created.';
comment on column public.invoices.extra_team_count is
  'Teams above the included allowance, snapshotted at event activation.';
comment on column public.invoices.extra_team_fee is
  'Total additional-team charge snapshotted at event activation.';

-- Five is an included allowance, not an activation ceiling. The existing gate
-- calls this helper; returning NULL removes the old hard block while retaining
-- the gate for any future plan that genuinely needs a hard maximum.
create or replace function public.plan_team_limit(p_plan text)
returns integer
language sql
immutable
set search_path = public
as $$
  select null::integer
$$;

comment on function public.plan_team_limit(text) is
  'Hard team ceiling, currently none. Standard plans include 5 teams and invoice each additional team at EUR 10.';

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
  elsif v_plan = 'free' then
    v_plan := 'rookie';
  elsif v_plan = 'starter' then
    v_plan := 'arena';
  end if;

  v_base_amount := public.plan_per_event_price_eur(v_plan);
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
    -- capacity always remains EUR 10/team.
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
