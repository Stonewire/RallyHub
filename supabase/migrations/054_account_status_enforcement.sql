-- Make organizations.account_status meaningful:
--  • suspended: members can still sign in but cannot create new events or games.
--  • trial: the org's first activated event is free (€0), then normal billing.
--  • active: normal behaviour.

-- ── Block creates for suspended orgs ────────────────────────────────────────
create or replace function public.block_insert_when_suspended()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select lower(coalesce(account_status, 'active')) into v_status
  from public.organizations
  where id = new.organization_id;

  if v_status = 'suspended' then
    raise exception 'This organization is suspended and cannot create new %.', tg_argv[0]
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_events_block_suspended on public.events;
create trigger trg_events_block_suspended
  before insert on public.events
  for each row execute function public.block_insert_when_suspended('events');

drop trigger if exists trg_games_block_suspended on public.games;
create trigger trg_games_block_suspended
  before insert on public.games
  for each row execute function public.block_insert_when_suspended('games');

-- ── Trial first event free + (re-applies promo-code logic from 052) ─────────
create or replace function public.create_event_activation_invoice(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_plan text;
  v_account_status text;
  v_amount numeric(10, 2);
  v_discount numeric(10, 2);
  v_amount_due numeric(10, 2);
  v_status text;
  v_invoice_id uuid;
  v_redemption public.promo_code_redemptions%rowtype;
  v_promo_code_id uuid := null;
  v_existing_invoices int;
begin
  select id into v_invoice_id from public.invoices where event_id = p_event_id;
  if v_invoice_id is not null then
    return v_invoice_id;
  end if;

  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found: %', p_event_id;
  end if;

  select billing_plan, account_status into v_plan, v_account_status
  from public.organizations
  where id = v_event.organization_id;

  v_plan := lower(coalesce(trim(v_plan), 'free'));
  if v_plan = 'enterprise' then
    v_plan := 'partner';
  end if;
  v_account_status := lower(coalesce(trim(v_account_status), 'active'));

  v_amount := public.plan_per_event_price_eur(v_plan);

  select count(*) into v_existing_invoices
  from public.invoices
  where organization_id = v_event.organization_id;

  if v_plan = 'partner' then
    v_discount := v_amount;
    v_amount_due := 0;
    v_status := 'comped';
  elsif v_account_status = 'trial' and v_existing_invoices = 0 then
    -- Trial: the first activated event is free.
    v_discount := v_amount;
    v_amount_due := 0;
    v_status := 'comped';
  else
    v_discount := 0;
    v_amount_due := v_amount;
    v_status := 'unpaid';

    select * into v_redemption
    from public.promo_code_redemptions
    where organization_id = v_event.organization_id
      and purpose = 'event'
      and status = 'active'
    order by discount_percent desc
    limit 1;

    if found then
      v_discount := round(v_amount * v_redemption.discount_percent / 100.0, 2);
      v_amount_due := greatest(v_amount - v_discount, 0);
      v_promo_code_id := v_redemption.promo_code_id;
      if v_amount_due = 0 then
        v_status := 'comped';
      end if;
      update public.promo_code_redemptions
      set status = 'used', applied_at = now(), applied_event_id = p_event_id
      where id = v_redemption.id;
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
end;
$$;

notify pgrst, 'reload schema';
