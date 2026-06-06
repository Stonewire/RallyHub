-- Billing period for organization subscription (monthly or yearly)

alter table public.organizations
  add column if not exists billing_period text not null default 'monthly';

alter table public.organizations
  drop constraint if exists organizations_billing_period_check;

alter table public.organizations
  add constraint organizations_billing_period_check
  check (billing_period in ('monthly', 'yearly'));

comment on column public.organizations.billing_period is
  'Subscription billing cadence: monthly or yearly.';
