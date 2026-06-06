-- Event activation billing: one invoice per event on first activation.

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan_key text not null,
  amount numeric(10, 2) not null,
  discount numeric(10, 2) not null default 0,
  amount_due numeric(10, 2) not null,
  status text not null check (status in ('unpaid', 'paid', 'comped')),
  created_at timestamptz not null default now(),
  constraint invoices_event_id_unique unique (event_id)
);

create index if not exists invoices_organization_id_idx
  on public.invoices (organization_id);

create index if not exists invoices_created_at_idx
  on public.invoices (created_at desc);

alter table public.events
  add column if not exists invoiced_at timestamptz null;

comment on table public.invoices is
  'Per-event activation bill. One row per event (first activation only).';
comment on column public.events.invoiced_at is
  'Set when an activation invoice is first generated for this event.';

-- Mirror src/lib/subscription-plans.ts per-event prices.
create or replace function public.plan_per_event_price_eur(p_plan text)
returns numeric
language sql
immutable
as $$
  select case lower(coalesce(trim(p_plan), 'free'))
    when 'starter' then 100
    when 'pro' then 50
    when 'partner' then 0
    when 'enterprise' then 0
    else 150
  end::numeric;
$$;

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
  end if;

  insert into public.invoices (
    event_id,
    organization_id,
    plan_key,
    amount,
    discount,
    amount_due,
    status
  ) values (
    p_event_id,
    v_event.organization_id,
    v_plan,
    v_amount,
    v_discount,
    v_amount_due,
    v_status
  )
  on conflict (event_id) do nothing
  returning id into v_invoice_id;

  if v_invoice_id is null then
    select id into v_invoice_id from public.invoices where event_id = p_event_id;
  end if;

  update public.events
  set
    invoiced_at = coalesce(invoiced_at, now()),
    invoice_paid = case
      when v_status = 'comped' then true
      else invoice_paid
    end
  where id = p_event_id;

  return v_invoice_id;
end;
$$;

create or replace function public.trg_event_activation_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and (old.status is distinct from 'active') then
    perform public.create_event_activation_invoice(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists event_activation_billing on public.events;
create trigger event_activation_billing
  after update of status on public.events
  for each row
  execute function public.trg_event_activation_billing();

alter table public.invoices enable row level security;

drop policy if exists "invoices_select_own" on public.invoices;
create policy "invoices_select_own"
on public.invoices for select to authenticated
using (organization_id = public.user_organization_id());

drop policy if exists "invoices_super_admin_all" on public.invoices;
create policy "invoices_super_admin_all"
on public.invoices for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  )
);

grant select on public.invoices to authenticated;
grant all on public.invoices to authenticated;
