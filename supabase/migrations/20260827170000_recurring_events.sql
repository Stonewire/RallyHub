-- P6.4: recurring events.
--
-- The SAME event repeats: join links and printed QR codes keep working (the
-- join token is never touched), gameplay data resets per run, and per-event
-- billing charges each run as a fresh activation. This deliberately extends
-- the one-activation-per-event model:
--
--   * events.recurring marks an event as restartable.
--   * event_occurrences snapshots every finished run (activation moment plus
--     its invoice) BEFORE the event is re-armed, so billing history and the
--     entitlement gate keep seeing runs whose events.activated_at was cleared.
--   * invoices moves from "unique per event" to "unique per event among
--     non-superseded rows": restarting marks the settled invoice
--     superseded = true, making room for the next run's invoice while the old
--     one lives on in history via event_occurrences.invoice_id.
--   * restart_recurring_event is the ONE sanctioned place that clears
--     events.activated_at (the documented exception to its one-way rule),
--     scoped to recurring events only, so the next activation runs the normal
--     billing trigger and creates a fresh charge.

-- ── events.recurring ─────────────────────────────────────────────────────────

alter table public.events
  add column if not exists recurring boolean not null default false;

comment on column public.events.recurring is
  'P6.4: the same event runs repeatedly. Join links/QR codes persist across runs; restart_recurring_event wipes run data and re-arms billing between runs.';

-- ── event_occurrences: one row per finished run ──────────────────────────────

create table if not exists public.event_occurrences (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  occurrence_number int not null,
  -- The run's events.activated_at, preserved here because the restart clears
  -- it on the event row. Defaults to now() as a backstop only; the RPC always
  -- writes the event's real activation moment.
  activated_at timestamptz not null default now(),
  -- The run's invoice, if one was raised (null for runs predating billing).
  -- Kept on invoice delete = event delete via the event_id cascade above.
  invoice_id uuid null references public.invoices (id) on delete set null,
  unique (event_id, occurrence_number)
);

comment on table public.event_occurrences is
  'P6.4: snapshot of each finished run of a recurring event, written by restart_recurring_event before the run''s data is wiped. Billing history and the monthly entitlement count read it.';

-- The entitlement gate counts an org's occurrences by activation month.
create index if not exists event_occurrences_org_activated_at_idx
  on public.event_occurrences (organization_id, activated_at);

alter table public.event_occurrences enable row level security;

-- Read for org members and staff, mirroring event_tasks
-- (20260811120000_checklists_tasks_prep_status.sql). Writes happen only inside
-- restart_recurring_event (SECURITY DEFINER), so no insert/update/delete
-- policies exist for authenticated at all.
drop policy if exists event_occurrences_org_select on public.event_occurrences;
create policy event_occurrences_org_select on public.event_occurrences
  for select to authenticated
  using ((organization_id = (select public.user_organization_id())) or (select public.is_super_admin()));

grant select on public.event_occurrences to authenticated;

-- ── invoices: allow one non-superseded invoice per event ─────────────────────

alter table public.invoices
  add column if not exists superseded boolean not null default false;

comment on column public.invoices.superseded is
  'P6.4: true once a recurring restart moved this settled invoice aside so the next run can raise a fresh one. Superseded rows stay in payment history (they were real charges) but never block activation and never show Pay now. restart_recurring_event refuses to supersede an unpaid invoice, so a superseded row is always paid/comped/refunded.';

-- One invoice per event becomes one CURRENT invoice per event. The partial
-- unique index replaces the table constraint so a restarted event can hold its
-- superseded history rows next to the next run's invoice.
alter table public.invoices
  drop constraint if exists invoices_event_id_unique;

create unique index if not exists invoices_event_id_current_unique
  on public.invoices (event_id)
  where superseded = false;

-- ── create_event_activation_invoice: target the partial index ────────────────
--
-- Copied from the current definition in 20260827153000_custom_subscription.sql.
-- Signature unchanged (create or replace is safe, no overload is created).
-- The ONLY changes are for P6.4's superseded invoices:
--   * the idempotency short-circuit and the post-conflict re-select read only
--     superseded = false rows, otherwise a restarted event would find its old
--     superseded invoice and the new run would never be billed;
--   * on conflict names the partial index predicate (a bare (event_id) target
--     no longer matches any index now the table constraint is gone). Inserts
--     always land with superseded = false (the column default), so the partial
--     index is always the right arbiter.
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
  -- P6.4: only the current (non-superseded) invoice satisfies "already
  -- invoiced". A superseded invoice belongs to a finished run of a recurring
  -- event; the new run must raise its own.
  select id into v_invoice_id
  from public.invoices
  where event_id = p_event_id and superseded = false;
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
    -- capacity always remains EUR 10/team. A 0 base (events included via the
    -- custom override) has nothing to discount, so the code is not consumed.
    if v_base_amount > 0 then
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
  on conflict (event_id) where superseded = false do nothing
  returning id into v_invoice_id;

  if v_invoice_id is null then
    select id into v_invoice_id
    from public.invoices
    where event_id = p_event_id and superseded = false;
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
  'Creates the activation invoice. custom_per_event_price_eur overrides the plan''s base per-event price when set (0 = events included); additional teams stay EUR 10 each. Superseded invoices (finished runs of a recurring event) are ignored, so a re-armed event bills its next run afresh.';

-- ── assert_event_activation_allowed: superseded-aware gate ───────────────────
--
-- Copied from the current definition in 20260827153000_custom_subscription.sql.
-- Signature and parameter names unchanged (create or replace is safe, no
-- overload is created). Two P6.4 changes only:
--   * the monthly count adds this month's event_occurrences: restarting a
--     recurring event clears its events.activated_at, and without the
--     occurrence count each restart would hand the monthly quota back for a
--     run that already happened. The re-activated event itself still counts
--     exactly once (its own current activation is excluded by id <>
--     p_event_id while being gated, and it has no occurrence row until its
--     run finishes).
--   * the UNPAID_INVOICE count ignores superseded rows. restart_recurring_event
--     refuses to supersede an unpaid invoice, so a superseded row is always
--     settled and this filter can never hide real debt.
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

  -- Paid plans need an active, paid-through subscription.
  if v_plan in ('arena', 'pro', 'max') then
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
  -- filtering them out here can never hide real debt.
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
  'Raises when the org may not activate the event. Orgs with a custom subscription (custom_subscription_price_eur set) have no monthly event limit. The monthly count includes event_occurrences (finished runs of recurring events); superseded invoices never block.';

-- ── restart_recurring_event: re-arm a finished run ───────────────────────────

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

  -- The finished run's current invoice, if any. Refusing to supersede an
  -- UNPAID invoice is the invariant that keeps the superseded-aware reads
  -- sound: a superseded invoice is always settled (paid/comped/refunded), so
  -- ignoring superseded rows in the unpaid gate and hiding their Pay now
  -- button can never lose money.
  select i.* into v_invoice
  from public.invoices i
  where i.event_id = p_event_id
    and i.superseded = false;

  if v_invoice.id is not null and v_invoice.status = 'unpaid' then
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

  -- Move the settled invoice aside: the partial unique index only covers
  -- superseded = false, so the next activation can insert a fresh invoice.
  -- Its history lives on via event_occurrences.invoice_id above.
  if v_invoice.id is not null then
    update public.invoices
    set superseded = true
    where id = v_invoice.id;
  end if;

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
  -- event. invoiced_at and invoice_paid reset with it so the fresh invoice
  -- stamps its own values.
  update public.events
  set
    status = 'ready',
    activated_at = null,
    invoiced_at = null,
    invoice_paid = false
  where id = p_event_id;
end;
$$;

revoke execute on function public.restart_recurring_event(uuid) from public, anon;
grant execute on function public.restart_recurring_event(uuid) to authenticated;

comment on function public.restart_recurring_event(uuid) is
  'P6.4: re-arms a finished run of a recurring event. Snapshots the run into event_occurrences, supersedes its settled invoice, wipes run data (teams, submissions, bingo, chat, live state), and sets the event back to ready with activated_at cleared so the next activation bills afresh. Refuses while the event is live, never run, not recurring, or its invoice is unpaid.';

notify pgrst, 'reload schema';
