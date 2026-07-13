-- Updated per-event pricing (2026-07-13 plan revamp). Mirrors
-- src/lib/subscription-plans.ts exactly — this function is the server-side
-- source of truth actually used by create_event_activation_invoice(), so it
-- must stay in sync with the TS plan definitions or invoices would be
-- generated at stale prices even though the UI shows the new ones.
--
-- New tier names: Free (rookie) / Starter (arena) / Pro (pro) / Business (max).
-- Enterprise and Partner remain 0 here — both are comped through the normal
-- per-event flow (create_event_activation_invoice already remaps 'enterprise'
-- to 'partner' before calling this function); their real billing, if any, is
-- arranged directly outside per-event invoicing.
create or replace function public.plan_per_event_price_eur(p_plan text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case lower(coalesce(trim(p_plan), 'free'))
    when 'rookie' then 199 when 'free' then 199
    when 'arena' then 149 when 'starter' then 149
    when 'pro' then 99
    when 'max' then 49
    when 'partner' then 0 when 'enterprise' then 0
    else 199
  end::numeric;
$$;
