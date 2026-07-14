-- PAY-1: Paddle billing schema.
--
-- Adds Paddle customer/subscription linkage to organizations, a reconciliation
-- column on the existing per-event invoices table, and a new table for
-- recurring-subscription payment history (kept separate from `invoices`,
-- which is exclusively per-event and has event_id NOT NULL — retrofitting it
-- would touch working code for no benefit).

alter table public.organizations
  add column if not exists paddle_customer_id text,
  add column if not exists paddle_subscription_id text;

create index if not exists organizations_paddle_customer_id_idx
  on public.organizations (paddle_customer_id)
  where paddle_customer_id is not null;

create index if not exists organizations_paddle_subscription_id_idx
  on public.organizations (paddle_subscription_id)
  where paddle_subscription_id is not null;

-- Reconcile a per-event invoice with the Paddle transaction that paid it
-- (null for comped/free invoices, which never touch Paddle).
alter table public.invoices
  add column if not exists paddle_transaction_id text;

create table if not exists public.subscription_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  paddle_transaction_id text not null unique,
  paddle_subscription_id text,
  plan_key text not null,
  billing_period text not null,
  amount numeric(10, 2) not null,
  amount_due numeric(10, 2) not null,
  currency text not null default 'EUR',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscription_transactions_org_idx
  on public.subscription_transactions (organization_id, created_at desc);

create index if not exists subscription_transactions_paddle_subscription_idx
  on public.subscription_transactions (paddle_subscription_id)
  where paddle_subscription_id is not null;

alter table public.subscription_transactions enable row level security;

-- Mirrors the invoices table's RLS shape exactly: org members read their own,
-- super admins read/write everything. No authenticated insert/update policy —
-- all writes come from the paddle-checkout / paddle-webhook Edge Functions
-- via the service role, never directly from a client.
drop policy if exists "subscription_transactions_select_own" on public.subscription_transactions;
create policy "subscription_transactions_select_own"
  on public.subscription_transactions for select
  to authenticated
  using (organization_id = (select public.user_organization_id()));

drop policy if exists "subscription_transactions_super_admin_all" on public.subscription_transactions;
create policy "subscription_transactions_super_admin_all"
  on public.subscription_transactions for all
  to authenticated
  using ((select public.is_super_admin()));

-- Reuses the existing generic set_updated_at() trigger function.
drop trigger if exists subscription_transactions_set_updated_at on public.subscription_transactions;
create trigger subscription_transactions_set_updated_at
  before update on public.subscription_transactions
  for each row
  execute function public.set_updated_at();

revoke all on public.subscription_transactions from anon, authenticated;
grant select on public.subscription_transactions to authenticated;
