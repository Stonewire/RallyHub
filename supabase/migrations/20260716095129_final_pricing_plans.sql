-- Final public pricing: Pay Per Event / Starter / Pro / Custom.
-- There are no active customers on the retired Business plan, so any leftover
-- test/demo rows are moved to Pro before the old plan id disappears from the app.

update public.organizations
set billing_plan = 'pro'
where lower(coalesce(trim(billing_plan), '')) = 'max';

create or replace function public.plan_per_event_price_eur(p_plan text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case lower(coalesce(trim(p_plan), 'rookie'))
    when 'rookie' then 199 when 'free' then 199
    when 'arena' then 149 when 'starter' then 149
    when 'pro' then 99
    when 'enterprise' then 0
    when 'partner' then 0
    else 199
  end
$$;

comment on function public.plan_per_event_price_eur(text) is
  'Per-event EUR fee: Pay Per Event 199, Starter 149, Pro 99, negotiated/comped plans 0.';

create or replace function public.plan_monthly_event_limit(p_plan text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case lower(coalesce(trim(p_plan), 'rookie'))
    when 'arena' then 2
    when 'starter' then 2
    else null
  end
$$;

comment on function public.plan_monthly_event_limit(text) is
  'Monthly activation allowance: Starter 2; Pay Per Event, Pro, Custom and Partner unlimited.';

create or replace function public.plan_team_limit(p_plan text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case lower(coalesce(trim(p_plan), 'rookie'))
    when 'rookie' then 5 when 'free' then 5
    when 'arena' then 5 when 'starter' then 5
    when 'pro' then 5
    else null
  end
$$;

comment on function public.plan_team_limit(text) is
  'Included teams per event: Pay Per Event, Starter and Pro 5; extra capacity requires a separately purchased add-on.';
