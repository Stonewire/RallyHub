-- Promo codes: super-admin-defined discount codes that clients add to their
-- account ("redeem"). An active event-purpose redemption is auto-applied when the
-- client next activates (and is billed for) an event. Subscription-purpose
-- redemptions are stored + displayed; they apply to recurring billing once Stripe
-- is connected.

-- ── Definitions (created by super admin) ────────────────────────────────────
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  purpose text not null check (purpose in ('event', 'subscription')),
  -- 0..100. 100 on an event purpose = completely free event.
  discount_percent int not null default 0 check (discount_percent between 0 and 100),
  -- Subscription only: how many months the discount applies for.
  duration_months int check (duration_months is null or duration_months > 0),
  -- Total times this code may be redeemed across all orgs. NULL = unlimited.
  max_redemptions int check (max_redemptions is null or max_redemptions > 0),
  redemption_count int not null default 0,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index if not exists promo_codes_code_idx on public.promo_codes (lower(code));

-- ── Redemptions (a code an org has added) ───────────────────────────────────
create table if not exists public.promo_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  purpose text not null,
  discount_percent int not null,
  duration_months int,
  -- active: waiting to apply · used: applied to an event/subscription
  status text not null default 'active' check (status in ('active', 'used', 'expired')),
  applied_at timestamptz,
  applied_event_id uuid references public.events (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (promo_code_id, organization_id)
);

create index if not exists promo_code_redemptions_org_idx
  on public.promo_code_redemptions (organization_id, purpose, status);

-- Optional traceability link on the invoice.
alter table public.invoices
  add column if not exists promo_code_id uuid references public.promo_codes (id) on delete set null;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.promo_codes enable row level security;
alter table public.promo_code_redemptions enable row level security;

-- Super admins manage every promo code. (is_super_admin() from migration 051.)
drop policy if exists "promo_codes_super_admin_all" on public.promo_codes;
create policy "promo_codes_super_admin_all"
on public.promo_codes for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- Org members read their own org's redemptions; super admins read all. Writes go
-- through the redeem_promo_code() RPC only (no direct insert policy).
drop policy if exists "promo_redemptions_select_own" on public.promo_code_redemptions;
create policy "promo_redemptions_select_own"
on public.promo_code_redemptions for select to authenticated
using (
  public.is_super_admin()
  or organization_id in (
    select organization_id from public.profiles where id = auth.uid()
  )
);

-- ── Redeem RPC: a client adds a code to their org ───────────────────────────
create or replace function public.redeem_promo_code(p_code text)
returns public.promo_code_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_code public.promo_codes%rowtype;
  v_redemption public.promo_code_redemptions%rowtype;
  v_norm text := lower(trim(coalesce(p_code, '')));
begin
  if v_norm = '' then
    raise exception 'Enter a promo code';
  end if;

  select organization_id into v_org from public.profiles where id = auth.uid();
  if v_org is null then
    raise exception 'No organization for this account';
  end if;

  select * into v_code from public.promo_codes where lower(code) = v_norm;
  if not found or not v_code.is_active then
    raise exception 'Invalid or inactive promo code';
  end if;

  if v_code.max_redemptions is not null
     and v_code.redemption_count >= v_code.max_redemptions then
    raise exception 'This promo code has reached its redemption limit';
  end if;

  if exists (
    select 1 from public.promo_code_redemptions
    where promo_code_id = v_code.id and organization_id = v_org
  ) then
    raise exception 'This promo code is already on your account';
  end if;

  insert into public.promo_code_redemptions (
    promo_code_id, organization_id, purpose, discount_percent, duration_months
  ) values (
    v_code.id, v_org, v_code.purpose, v_code.discount_percent, v_code.duration_months
  ) returning * into v_redemption;

  update public.promo_codes
  set redemption_count = redemption_count + 1
  where id = v_code.id;

  return v_redemption;
end;
$$;

grant execute on function public.redeem_promo_code(text) to authenticated;

-- ── Auto-apply an active event promo code at activation ─────────────────────
-- Re-defines create_event_activation_invoice (migration 027) to consume an active
-- event-purpose redemption: discount the bill (100% => free/comped) and mark the
-- redemption used. Partner (already comped) is left unchanged.
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
begin
  select id into v_invoice_id from public.invoices where event_id = p_event_id;
  if v_invoice_id is not null then
    return v_invoice_id;
  end if;

  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found: %', p_event_id;
  end if;

  select billing_plan into v_plan
  from public.organizations
  where id = v_event.organization_id;

  v_plan := lower(coalesce(trim(v_plan), 'free'));
  if v_plan = 'enterprise' then
    v_plan := 'partner';
  end if;

  v_amount := public.plan_per_event_price_eur(v_plan);

  if v_plan = 'partner' then
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
