-- P6 review fixes: settlement invoices, restart hardening, gate corrections.
--
-- Adversarial review of P6.2-P6.4 found that the open-joining team settlement
-- (20260827160000) almost never collects in practice: it only grows an UNPAID
-- activation invoice, but autoChargeEventInvoice pays that invoice minutes
-- after activation, and included-events / 100%-promo invoices are 'comped', so
-- by the time the event ends there is usually nothing unpaid to grow and the
-- surcharge was silently dropped. This migration implements the second-invoice
-- design: invoices carry a kind ('activation' | 'team_settlement'), and the
-- settlement lands on its own kind='team_settlement' invoice whenever the
-- activation invoice is already settled.
--
-- It also re-creates restart_recurring_event (supersede and refuse-unpaid must
-- cover BOTH kinds; invoiced_at must survive the restart or a later permanent
-- delete hard-deletes the event row and cascades away all paid history),
-- re-creates assert_event_activation_allowed (a custom subscription must be
-- backed by an active, paid-through subscription), and locks events.open_joining
-- while the event is live so the settlement cannot be dodged by flipping the
-- switch mid-event.
--
-- All function definitions here build on 20260827170000's versions. None of the
-- Phase 6 migrations has been applied anywhere yet, so the drop/create index
-- swap below runs against the 20260827170000 state.

-- ── invoices.kind: activation vs team settlement ─────────────────────────────

alter table public.invoices
  add column if not exists kind text not null default 'activation';

alter table public.invoices
  drop constraint if exists invoices_kind_check;
alter table public.invoices
  add constraint invoices_kind_check
  check (kind in ('activation', 'team_settlement'));

comment on column public.invoices.kind is
  'activation = the per-event bill raised when the event goes live. team_settlement = the end-of-event surcharge for an open-joining event whose activation invoice was already settled when the teams were counted. One current (non-superseded) invoice of each kind per event.';

-- One current invoice per event becomes one current invoice PER KIND per event:
-- the settlement design needs the activation invoice and the team-settlement
-- invoice to coexist. Replaces 20260827170000's single partial index.
drop index if exists public.invoices_event_id_current_unique;

create unique index if not exists invoices_event_activation_current_unique
  on public.invoices (event_id)
  where superseded = false and kind = 'activation';

create unique index if not exists invoices_event_settlement_current_unique
  on public.invoices (event_id)
  where superseded = false and kind = 'team_settlement';

-- ── create_event_activation_invoice: kind-aware, custom price is net ─────────
--
-- Copied from the current definition in 20260827170000_recurring_events.sql.
-- Signature unchanged (create or replace is safe, no overload is created).
-- Changes:
--   * the idempotency short-circuit, the ON CONFLICT arbiter and the
--     post-conflict re-select all target kind = 'activation' rows, matching
--     the new activation partial index (a team-settlement invoice on the same
--     event must never satisfy "already invoiced");
--   * inserts stamp kind = 'activation' explicitly;
--   * a staff-set custom_per_event_price_eur is the NEGOTIATED NET figure:
--     promo codes and the educational discount no longer apply to it (and the
--     promo code is not consumed). They still apply to plan-derived bases.
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
  -- Only the current (non-superseded) ACTIVATION invoice satisfies "already
  -- invoiced". A superseded invoice belongs to a finished run of a recurring
  -- event, and a team-settlement invoice is a separate end-of-event charge.
  select id into v_invoice_id
  from public.invoices
  where event_id = p_event_id
    and superseded = false
    and kind = 'activation';
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
  -- P6.3 (20260827160000): open-joining events bill NO team surcharge at
  -- activation; it settles at event end from actually-claimed teams. This
  -- re-creation must keep that behaviour or it would be silently lost.
  if coalesce(v_event.open_joining, false) then
    v_extra_team_count := 0;
  else
    v_extra_team_count := greatest(coalesce(v_event.team_count, 0) - v_included_team_count, 0);
  end if;
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
    -- capacity always remains EUR 10/team. A staff-set custom per-event price
    -- is the negotiated NET figure: no promo applies to it and the code is not
    -- consumed against it (nor against a 0 base, which has nothing to discount).
    if v_custom_per_event is null and v_base_amount > 0 then
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

    -- The educational discount only halves plan-derived bases: a negotiated
    -- custom per-event price is already the final agreed number.
    if v_educational = 'approved' and v_custom_per_event is null then
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
    kind,
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
    'activation',
    v_amount,
    v_discount,
    v_amount_due,
    v_status,
    v_promo_code_id,
    v_included_team_count,
    v_extra_team_count,
    v_extra_team_fee
  )
  on conflict (event_id) where superseded = false and kind = 'activation' do nothing
  returning id into v_invoice_id;

  if v_invoice_id is null then
    select id into v_invoice_id
    from public.invoices
    where event_id = p_event_id
      and superseded = false
      and kind = 'activation';
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
  'Creates the activation (kind=activation) invoice. custom_per_event_price_eur is the negotiated net base when set (0 = events included): promo and educational discounts only apply to plan-derived bases. Additional teams stay EUR 10 each. Superseded invoices and team-settlement invoices are ignored, so a re-armed recurring event bills its next run afresh.';

-- ── settle_open_joining_team_fees: second-invoice settlement ─────────────────
--
-- Rewritten from 20260827160000's version, which only ever grew an UNPAID
-- activation invoice and logged a notice otherwise. In the mainline the
-- activation invoice is paid (auto-charge) or comped (included events, 100%
-- promo) long before the event ends, so the surcharge was silently lost
-- exactly when it mattered. Now:
--   * an unpaid activation invoice still grows in place, exactly as before;
--   * a settled activation invoice gets a SECOND, kind='team_settlement'
--     invoice carrying the fee for the extra teams the activation invoice did
--     not already bill. Re-settlement (the event re-enters and re-leaves
--     'active') re-syncs the settlement invoice's amounts while it is unpaid;
--     a settlement invoice that has itself been paid is never grown (same
--     no-hidden-charges rule as before, notice-logged).
--
-- The settlement invoice is an ordinary unpaid invoice: Pay now works, the
-- rookie UNPAID_INVOICE activation gate nudges payment, and it supersedes with
-- the activation invoice on a recurring restart. Automatic collection (charging
-- the saved card the way activation invoices are auto-charged) is future work.
create or replace function public.settle_open_joining_team_fees(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_plan text;
  v_is_demo boolean;
  v_claimed integer;
  v_included integer := 5;      -- matches create_event_activation_invoice
  v_extra integer;
  v_fee numeric(10, 2);
  v_invoice public.invoices%rowtype;
  v_settlement public.invoices%rowtype;
  v_delta numeric(10, 2);
  v_settle_extra integer;
  v_settle_fee numeric(10, 2);
begin
  select * into v_event from public.events where id = p_event_id;
  if not found or not coalesce(v_event.open_joining, false) then
    return;
  end if;

  select lower(coalesce(trim(o.billing_plan), 'free')), coalesce(o.is_demo, false)
    into v_plan, v_is_demo
  from public.organizations o
  where o.id = v_event.organization_id;

  if v_plan = 'enterprise' then
    v_plan := 'partner';
  elsif v_plan = 'free' then
    v_plan := 'rookie';
  elsif v_plan = 'starter' then
    v_plan := 'arena';
  end if;

  -- Comped orgs and the demo sandbox settle at 0: nothing to add, and no
  -- settlement invoice is ever created for them.
  if v_plan = 'partner' or v_is_demo then
    return;
  end if;

  select count(*) into v_claimed
  from public.teams t
  where t.event_id = p_event_id
    and nullif(trim(t.name), '') is not null;

  v_extra := greatest(v_claimed - v_included, 0);
  v_fee := v_extra * 10;        -- EUR 10/team, same as the activation invoice

  -- The current activation invoice. The FOR UPDATE lock serialises concurrent
  -- settlements of the same event, which also makes the settlement-invoice
  -- insert below race-free.
  select * into v_invoice
  from public.invoices
  where event_id = p_event_id
    and kind = 'activation'
    and superseded = false
  for update;

  if not found then
    -- No activation invoice: the event never went through activation billing
    -- (nothing to settle against). Deliberate no-op.
    return;
  end if;

  if v_invoice.status = 'unpaid' then
    -- Still unpaid: fold the surcharge into the activation invoice, exactly as
    -- before. Counts absolute, amounts by delta, so re-settlement re-syncs.
    v_delta := v_fee - coalesce(v_invoice.extra_team_fee, 0);
    update public.invoices
    set extra_team_count = v_extra,
        extra_team_fee = v_fee,
        amount = amount + v_delta,
        amount_due = greatest(amount_due + v_delta, 0)
    where id = v_invoice.id;
    return;
  end if;

  -- The activation invoice is settled (paid, comped, or refunded): never grow
  -- it. Bill the extra teams it did NOT already cover on the team-settlement
  -- invoice instead. In the open-joining mainline the activation invoice
  -- billed 0 extra teams, so this is the whole fee; if a pre-payment
  -- settlement already grew the activation invoice, only the remainder lands
  -- here.
  v_settle_extra := greatest(v_extra - coalesce(v_invoice.extra_team_count, 0), 0);
  v_settle_fee := v_settle_extra * 10;

  select * into v_settlement
  from public.invoices
  where event_id = p_event_id
    and kind = 'team_settlement'
    and superseded = false
  for update;

  if found then
    if v_settlement.status = 'unpaid' then
      -- Re-settlement: write the amounts absolutely so the invoice re-syncs
      -- instead of accumulating. A recount down to zero comps the invoice so
      -- a EUR 0 unpaid row cannot block the rookie activation gate.
      update public.invoices
      set extra_team_count = v_settle_extra,
          extra_team_fee = v_settle_fee,
          amount = v_settle_fee,
          amount_due = v_settle_fee,
          status = case when v_settle_fee = 0 then 'comped' else 'unpaid' end
      where id = v_settlement.id;
    elsif v_settle_fee <> coalesce(v_settlement.extra_team_fee, 0) then
      -- The settlement invoice itself has been settled: growing it now would
      -- be a hidden charge. Log the difference, leave the invoice alone.
      raise notice 'settle_open_joining_team_fees: settlement invoice % for event % is %, leaving it untouched; team-fee difference of % EUR unbilled',
        v_settlement.id, p_event_id, v_settlement.status,
        v_settle_fee - coalesce(v_settlement.extra_team_fee, 0);
    end if;
    return;
  end if;

  if v_settle_fee > 0 then
    -- Fresh settlement invoice. plan_key is copied from the activation invoice
    -- so both rows of the event read as the same plan. The ON CONFLICT arbiter
    -- (the settlement partial index) is belt and braces: the activation-invoice
    -- lock above already serialises concurrent settlements.
    insert into public.invoices (
      event_id,
      organization_id,
      plan_key,
      kind,
      amount,
      discount,
      amount_due,
      status,
      included_team_count,
      extra_team_count,
      extra_team_fee
    ) values (
      p_event_id,
      v_invoice.organization_id,
      v_invoice.plan_key,
      'team_settlement',
      v_settle_fee,
      0,
      v_settle_fee,
      'unpaid',
      v_included,
      v_settle_extra,
      v_settle_fee
    )
    on conflict (event_id) where superseded = false and kind = 'team_settlement'
    do nothing;
  end if;
end $$;

revoke all on function public.settle_open_joining_team_fees(uuid)
  from public, anon, authenticated;

comment on function public.settle_open_joining_team_fees(uuid) is
  'End-of-event surcharge for an open-joining event, from actually-claimed teams (5 included, EUR 10 each). Grows the activation invoice while it is unpaid; otherwise raises/re-syncs a kind=team_settlement invoice for the uncovered teams. Comped and demo orgs settle at 0; settled invoices are never grown.';

-- ── open_joining is locked while the event is live ───────────────────────────
--
-- Nothing stopped an org flipping open_joining OFF mid-event (dodging the
-- end-of-event settlement entirely) or ON (undercutting an already-invoiced
-- team surcharge). The switch is now frozen for the whole 'active' window;
-- EditEventPage disables the control with the same message.

create or replace function public.trg_events_protect_open_joining_live()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'active' then
    raise exception 'Open joining cannot be changed while the event is live. End the event first.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.trg_events_protect_open_joining_live()
  from public, anon, authenticated;

drop trigger if exists events_protect_open_joining_live on public.events;
create trigger events_protect_open_joining_live
  before update on public.events
  for each row
  when (old.open_joining is distinct from new.open_joining)
  execute function public.trg_events_protect_open_joining_live();

-- With mid-active flips impossible, the settlement trigger can key off
-- OLD.open_joining at the leave-active transition: a row whose open_joining
-- somehow differs (historic data written before this trigger existed) settles
-- based on what was true WHILE the event ran, so a flip cannot evade the fee.
create or replace function public.trg_open_joining_settlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'active' and new.status is distinct from 'active'
     and coalesce(old.open_joining, false) then
    perform public.settle_open_joining_team_fees(new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.trg_open_joining_settlement()
  from public, anon, authenticated;

drop trigger if exists event_open_joining_settlement on public.events;
create trigger event_open_joining_settlement
  after update of status on public.events
  for each row
  execute function public.trg_open_joining_settlement();

-- ── assert_event_activation_allowed: custom subscription needs a live sub ────
--
-- Copied from the current definition in 20260827170000_recurring_events.sql.
-- Signature and parameter names unchanged. One change: an org with a staff-set
-- custom subscription price must hold an active, paid-through subscription
-- exactly like the paid plans, whatever the underlying billing_plan says.
-- Without this, stamping a custom price on a rookie org granted unlimited
-- events (the custom-subscription monthly-limit skip) with no subscription
-- paid at all. The unlimited-events skip itself stays.
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
  v_occurrence_count int;
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

  -- Paid plans need an active, paid-through subscription. So does a staff-set
  -- custom subscription: the negotiated price is still a subscription the
  -- client has to be paying, regardless of the underlying plan.
  if v_plan in ('arena', 'pro', 'max') or v_custom_subscription is not null then
    if v_sub_status is null
       or v_sub_status not in ('active', 'trialing')
       or v_period_end is null
       or v_period_end < now() then
      raise exception 'SUBSCRIPTION_REQUIRED: Start a subscription (paid for the current period) before activating events.'
        using errcode = 'check_violation';
    end if;
  end if;

  -- Monthly event limit, counting ACTIVATIONS this calendar month. An org on a
  -- staff-set custom subscription is unlimited, matching Pro. P6.4: finished
  -- runs of restarted recurring events live in event_occurrences (their
  -- events.activated_at was cleared on restart), so they are counted from
  -- there; every run consumes one slot of the monthly quota.
  v_event_limit := public.plan_monthly_event_limit(v_plan);
  if v_event_limit is not null and v_custom_subscription is null then
    select count(*) into v_month_count
    from public.events
    where organization_id = p_org_id
      and activated_at >= date_trunc('month', now())
      and id <> p_event_id;
    select count(*) into v_occurrence_count
    from public.event_occurrences
    where organization_id = p_org_id
      and activated_at >= date_trunc('month', now());
    v_month_count := v_month_count + v_occurrence_count;
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
  -- Superseded rows are always settled (the restart refuses unpaid ones), so
  -- filtering them out here can never hide real debt. Team-settlement invoices
  -- count like any other unpaid invoice: this is what nudges an open-joining
  -- org to pay its end-of-event surcharge.
  if p_enforce_payment and v_plan = 'rookie' then
    select count(*) into v_unpaid
    from public.invoices
    where organization_id = p_org_id
      and status = 'unpaid'
      and superseded = false
      and event_id <> p_event_id;

    if v_unpaid > 0 then
      raise exception 'UNPAID_INVOICE: Settle your outstanding event invoice before activating another event.'
        using errcode = 'check_violation';
    end if;
  end if;
end $$;

comment on function public.assert_event_activation_allowed(uuid, uuid, boolean) is
  'Raises when the org may not activate the event. A custom subscription (custom_subscription_price_eur set) removes the monthly event limit but must itself be active and paid through, like the paid plans. The monthly count includes event_occurrences (finished runs of recurring events); superseded invoices never block.';

-- ── restart_recurring_event: settlement-aware, history-preserving ────────────
--
-- Copied from the current definition in 20260827170000_recurring_events.sql.
-- Three changes:
--   * the refuse-while-unpaid check and the supersede step cover BOTH invoice
--     kinds, so an unpaid team-settlement invoice blocks the restart and a
--     settled one moves aside with the activation invoice;
--   * events.invoiced_at is KEPT. Clearing it flipped wipe_event_data's
--     invoiced_at-IS-NULL branch into hard-deleting the event row on a later
--     permanent delete, cascading away every invoice and occurrence (all paid
--     history). Nothing needs it null to re-activate: the billing trigger has
--     no invoiced_at condition, create_event_activation_invoice's idempotency
--     reads the invoices table (non-superseded activation row), and its stamp
--     is coalesce(invoiced_at, now()).
--   * the event_state wipe also resets store_open to its default (true,
--     20260808150000), so a run that closed the store does not leak a closed
--     store into the next run.
create or replace function public.restart_recurring_event(p_event_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_invoice public.invoices%rowtype;
  v_unpaid_count integer;
  v_occurrence_number integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Event-row lock first: matches reset_event_data's event-then-teams lock
  -- order (and the demo claim path, 20260827120000) so concurrent claims and
  -- restarts serialise instead of deadlocking. It also serialises two
  -- concurrent restarts, so the occurrence_number count below is race-free.
  select e.* into v_event
  from public.events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found';
  end if;

  -- Same authorization shape as precheck_event_activation (20260827120000):
  -- own org, or super admin.
  if v_event.organization_id is distinct from public.user_organization_id()
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    )
  then
    raise exception 'Not authorized to restart this event';
  end if;

  if not v_event.recurring then
    raise exception 'Only recurring events can be restarted';
  end if;

  if v_event.status = 'active' then
    raise exception 'This event is live. End the current run before starting the next one.';
  end if;

  if v_event.activated_at is null then
    raise exception 'This event has not run yet. Activate it as usual.';
  end if;

  -- The finished run's current activation invoice, if any, for the occurrence
  -- snapshot below.
  select i.* into v_invoice
  from public.invoices i
  where i.event_id = p_event_id
    and i.superseded = false
    and i.kind = 'activation';

  -- Refusing to supersede an UNPAID invoice OF EITHER KIND is the invariant
  -- that keeps the superseded-aware reads sound: a superseded invoice is
  -- always settled (paid/comped/refunded), so ignoring superseded rows in the
  -- unpaid gate and hiding their Pay now button can never lose money. The
  -- team-settlement invoice counts too: an open-joining run may not roll into
  -- its next run with the previous run's team fees unpaid.
  select count(*) into v_unpaid_count
  from public.invoices i
  where i.event_id = p_event_id
    and i.superseded = false
    and i.status = 'unpaid';

  if v_unpaid_count > 0 then
    raise exception 'UNPAID_INVOICE: Settle this event''s invoice before starting the next run.'
      using errcode = 'check_violation';
  end if;

  -- Snapshot the finished run BEFORE anything is cleared, so billing history
  -- and the entitlement gate's monthly count keep seeing it.
  select count(*) + 1 into v_occurrence_number
  from public.event_occurrences
  where event_id = p_event_id;

  insert into public.event_occurrences (
    event_id,
    organization_id,
    occurrence_number,
    activated_at,
    invoice_id
  ) values (
    p_event_id,
    v_event.organization_id,
    v_occurrence_number,
    v_event.activated_at,
    v_invoice.id
  );

  -- Move the settled invoices aside: the partial unique indexes only cover
  -- superseded = false, so the next activation (and its own eventual
  -- settlement) can insert fresh rows. Both kinds supersede together; history
  -- lives on via event_occurrences.invoice_id above.
  update public.invoices
  set superseded = true
  where event_id = p_event_id
    and superseded = false;

  -- Data wipe, duplicated verbatim from reset_event_data (20260721140000).
  -- reset_event_data's own never-activated guard (draft/ready/demo only) is
  -- deliberately NOT weakened for normal events; a recurring restart is the
  -- one sanctioned wipe of an activated event, so the statements live here.
  -- The teams delete cascades inventory_team_access (per-device team/purchase
  -- tokens), so a stale device's queued offline submissions from the finished
  -- run are refused server-side instead of landing in the next run.
  -- stages_config and the join token are never touched: the event's setup,
  -- printed QR codes and join links carry over to the next run.
  delete from public.chat_messages where event_id = p_event_id;
  delete from public.submissions where event_id = p_event_id;

  delete from public.bingo_team_cards
  where run_id in (
    select id from public.bingo_runs where event_id = p_event_id
  );

  delete from public.bingo_runs where event_id = p_event_id;
  delete from public.teams where event_id = p_event_id;

  if exists (select 1 from public.event_state where event_id = p_event_id) then
    update public.event_state
    set
      current_stage_index = 0,
      current_question_index = 0,
      timer_seconds = 7200,
      timer_running = false,
      quiz_timer_seconds = null,
      quiz_timer_running = false,
      show_scores = true,
      show_timer_on_display = true,
      hide_team_points = false,
      quiz_state = 'idle',
      bingo_state = 'waiting',
      bingo_revealed_track_ids = '[]'::jsonb,
      bingo_winner_team_id = null,
      bingo_announced_winner_ids = '[]'::jsonb,
      bingo_bonus_id = null,
      announcement = null,
      announcement_target = null,
      winner_reveal_stage = 0,
      break_timer_seconds = null,
      break_timer_running = false,
      submissions_open = true,
      store_open = true,
      updated_at = now()
    where event_id = p_event_id;
  else
    insert into public.event_state (event_id)
    values (p_event_id);
  end if;

  -- Re-arm the event. Clearing activated_at is the deliberate, documented
  -- exception to activated_at's one-way rule: scoped to recurring events only,
  -- inside this RPC only. The next activation then runs the normal billing
  -- trigger (create_event_activation_invoice, entitlement gate) and stamps a
  -- fresh activated_at, so the new run is charged and counted like a new
  -- event. invoice_paid resets so the fresh invoice tracks its own payment;
  -- invoiced_at deliberately stays: the event HAS been invoiced, and clearing
  -- it would make wipe_event_data hard-delete the row (and cascade away all
  -- paid history) on a later permanent delete.
  update public.events
  set
    status = 'ready',
    activated_at = null,
    invoice_paid = false
  where id = p_event_id;
end;
$$;

revoke execute on function public.restart_recurring_event(uuid) from public, anon;
grant execute on function public.restart_recurring_event(uuid) to authenticated;

comment on function public.restart_recurring_event(uuid) is
  'P6.4: re-arms a finished run of a recurring event. Snapshots the run into event_occurrences, supersedes its settled invoices (activation AND team settlement), wipes run data (teams, submissions, bingo, chat, live state incl. store_open), and sets the event back to ready with activated_at cleared (invoiced_at is kept for delete-history safety) so the next activation bills afresh. Refuses while the event is live, never run, not recurring, or any current invoice is unpaid.';

notify pgrst, 'reload schema';
