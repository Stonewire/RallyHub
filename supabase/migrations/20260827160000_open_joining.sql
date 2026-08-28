-- P6.3: open joining / unlimited teams, for public events with unknown attendance.
--
-- events.open_joining = true means teams are not pre-created as slots: each
-- group of participants creates its own team at the join page through the new
-- join_event_as_new_team RPC. There is no cap on the number of teams for
-- non-demo open-joining events (the join RPC applies no count limit; demo
-- events keep their 2-claimed-team cap).
--
-- Billing (locked decision): the base event price still charges at activation,
-- but the additional-team surcharge cannot be known then (teams are unknown),
-- so create_event_activation_invoice skips it for open-joining events and
-- settle_open_joining_team_fees settles it from actually-claimed teams when
-- the event leaves 'active'.

alter table public.events
  add column if not exists open_joining boolean not null default false;

comment on column public.events.open_joining is
  'When true, participants create their own teams at the join page (no pre-created slots, no team cap outside demo). The additional-team surcharge settles at event end from actually-claimed teams.';

-- ---------------------------------------------------------------------------
-- join_event_as_new_team: participant-facing team creation for open-joining
-- events. Validation mirrors claim_team_with_inventory_access (current
-- definition: 20260827120000_demo_claim_cap.sql): same join-token check, same
-- live-status check, same name rule, same demo claimed-team cap, and the
-- inventory purchase token is minted identically. The differences: it INSERTs
-- a fresh teams row on the next free slot_number instead of updating an
-- existing slot, and it requires events.open_joining.
--
-- Colour: a DB copy of the 20-colour slot palette in
-- src/lib/sync-team-slots.ts (SLOT_COLORS), indexed by slot_number so the
-- cycling matches what pre-created slots would have received. Keep the two
-- lists in sync if the palette ever changes.

create or replace function public.join_event_as_new_team(
  p_event_id uuid,
  p_name text,
  p_photo_url text default null
)
returns table (
  id uuid,
  event_id uuid,
  name text,
  color text,
  photo_url text,
  score integer,
  status text,
  slot_number integer,
  created_at timestamptz,
  inventory_purchase_token text
)
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_team public.teams%rowtype;
  v_token text;
  v_event_status text;
  v_open_joining boolean;
  v_claimed_count integer;
  v_slot integer;
  v_color text;
  -- DB copy of SLOT_COLORS (src/lib/sync-team-slots.ts).
  v_palette text[] := array[
    '#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA',
    '#00ACC1', '#FDD835', '#6D4C41', '#D81B60', '#3949AB',
    '#00897B', '#F4511E', '#5E35B1', '#039BE5', '#7CB342',
    '#FF7043', '#8D6E63', '#546E7A', '#C0CA33', '#26A69A'
  ];
begin
  if not public.live_join_token_matches_event(p_event_id) then
    raise exception 'Event access has expired. Reload the team page.';
  end if;

  select e.status, e.open_joining
    into v_event_status, v_open_joining
  from public.events e
  where e.id = p_event_id;

  if v_event_status is null or v_event_status not in ('active', 'demo') then
    raise exception 'This event is not live.';
  end if;

  if not coalesce(v_open_joining, false) then
    raise exception 'This event does not allow open joining.';
  end if;

  if nullif(trim(p_name), '') is null or char_length(trim(p_name)) > 120 then
    raise exception 'Enter a valid team name.';
  end if;

  -- The event-row lock serialises concurrent joins: two devices cannot both
  -- read the same max slot_number (unique (event_id, slot_number) is the
  -- backstop), and on demo events cannot both pass the claimed-team cap. It
  -- is taken BEFORE touching team rows to match the event-then-teams lock
  -- order of claim_team_with_inventory_access and reset_event_data.
  perform 1 from public.events e where e.id = p_event_id for update;

  -- Re-read status and open_joining AFTER taking the lock: the unlocked read
  -- above races the facilitator ending the event or disabling open joining
  -- (TOCTOU), and a join that squeezes through after either change would land
  -- a team on an event that is no longer accepting them.
  select e.status, e.open_joining
    into v_event_status, v_open_joining
  from public.events e
  where e.id = p_event_id;

  if v_event_status not in ('active', 'demo') then
    raise exception 'This event is not live.';
  end if;

  if not coalesce(v_open_joining, false) then
    raise exception 'This event does not allow open joining.';
  end if;

  -- Demo cap: at most 2 claimed teams at a time, exactly like the claim RPC.
  if v_event_status = 'demo' then
    select count(*) into v_claimed_count
    from public.teams t
    where t.event_id = p_event_id
      and nullif(trim(t.name), '') is not null;

    if v_claimed_count >= 2 then
      raise exception 'Demo events allow up to 2 claimed teams.';
    end if;
  end if;

  -- Next free slot. Deliberately NO team-count cap here: open joining exists
  -- precisely for events with unknown attendance, and the plan team limit is
  -- an activation-time check on the configured team_count, which open-joining
  -- events do not pre-configure.
  select coalesce(max(t.slot_number), 0) + 1 into v_slot
  from public.teams t
  where t.event_id = p_event_id;

  v_color := v_palette[((v_slot - 1) % array_length(v_palette, 1)) + 1];

  insert into public.teams (event_id, slot_number, color, name, photo_url, score, status)
  values (p_event_id, v_slot, v_color, trim(p_name), p_photo_url, 0, 'active')
  returning * into v_team;

  -- Inventory purchase token, minted identically to the claim RPC.
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.inventory_team_access (team_id, event_id, token_hash)
  values (v_team.id, p_event_id, digest(v_token, 'sha256'))
  on conflict (team_id) do update
    set event_id = excluded.event_id, token_hash = excluded.token_hash, created_at = now();

  return query select
    v_team.id, v_team.event_id, v_team.name, v_team.color, v_team.photo_url,
    v_team.score, v_team.status, v_team.slot_number, v_team.created_at, v_token;
end;
$$;

-- Same grant shape as claim_team_with_inventory_access: anon for participant
-- devices, authenticated so a facilitator testing the join flow in a signed-in
-- browser is not blocked (20260716123203), service_role for scripts.
revoke all on function public.join_event_as_new_team(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.join_event_as_new_team(uuid, text, text)
  to anon, authenticated, service_role;

comment on function public.join_event_as_new_team(uuid, text, text) is
  'Creates a new team on an open-joining event behind the live join token and mints the per-device purchase token. Demo events accept at most 2 claimed teams at a time; non-demo open-joining events have no team cap.';

-- ---------------------------------------------------------------------------
-- Activation invoicing: an open-joining event charges NO additional-team
-- surcharge at activation (extra_team_count 0), because the number of teams is
-- unknown until the event runs. The surcharge settles at event end via
-- settle_open_joining_team_fees below.
--
-- Copied from the current definition in 20260827153000_custom_subscription.sql
-- (P6.2). The ONLY change: v_extra_team_count is forced to 0 when
-- events.open_joining. Custom per-event override, promo and educational
-- handling are otherwise untouched.

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
  select id into v_invoice_id from public.invoices where event_id = p_event_id;
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
  -- P6.3: open-joining events have no known team count at activation. The
  -- additional-team surcharge is settled at event end from actually-claimed
  -- teams (settle_open_joining_team_fees).
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

comment on function public.create_event_activation_invoice(uuid) is
  'Creates the activation invoice. custom_per_event_price_eur overrides the plan''s base per-event price when set (0 = events included); additional teams stay EUR 10 each. Open-joining events charge no team surcharge at activation; it settles at event end.';

-- ---------------------------------------------------------------------------
-- End-of-event team settlement for open-joining events.
--
-- Counts actually-claimed teams and applies the additional-team surcharge to
-- the event's existing activation invoice, using the SAME constants as
-- create_event_activation_invoice: 5 teams included, EUR 10 per additional
-- team. The custom_per_event_price_eur override only ever replaces the BASE
-- amount, never the per-team price, so it plays no part here. Comped orgs
-- (partner, enterprise normalized to partner) and demo-sandbox orgs (is_demo)
-- settle at 0.
--
-- The counts are written absolutely and the amounts adjusted by delta against
-- the invoice's recorded extra_team_fee, so a second settlement (an event that
-- re-enters and re-leaves 'active') re-syncs instead of double-charging.

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
  v_delta numeric(10, 2);
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

  -- Comped orgs and the demo sandbox settle at 0: nothing to add.
  if v_plan = 'partner' or v_is_demo then
    return;
  end if;

  select count(*) into v_claimed
  from public.teams t
  where t.event_id = p_event_id
    and nullif(trim(t.name), '') is not null;

  v_extra := greatest(v_claimed - v_included, 0);
  v_fee := v_extra * 10;        -- EUR 10/team, same as the activation invoice

  select * into v_invoice
  from public.invoices
  where event_id = p_event_id
  for update;

  if not found then
    -- No invoice: the event never went through activation billing (nothing to
    -- settle against). Deliberate no-op.
    return;
  end if;

  v_delta := v_fee - coalesce(v_invoice.extra_team_fee, 0);

  if v_invoice.status = 'unpaid' then
    update public.invoices
    set extra_team_count = v_extra,
        extra_team_fee = v_fee,
        amount = amount + v_delta,
        amount_due = greatest(amount_due + v_delta, 0)
    where id = v_invoice.id;
  elsif v_delta <> 0 then
    -- A settled invoice (paid, comped, or refunded) must not silently grow:
    -- the client may already have paid it, and quietly raising a paid bill
    -- would be a hidden charge. Issuing a SECOND, separate settlement invoice
    -- for the team fees is future work; until then the unbilled amount is
    -- only logged.
    raise notice 'settle_open_joining_team_fees: invoice % for event % is %, leaving it untouched; unsettled team-fee delta of % EUR (future work: separate settlement invoice)',
      v_invoice.id, p_event_id, v_invoice.status, v_delta;
  end if;
end $$;

revoke all on function public.settle_open_joining_team_fees(uuid)
  from public, anon, authenticated;

comment on function public.settle_open_joining_team_fees(uuid) is
  'Applies the additional-team surcharge for an open-joining event to its unpaid activation invoice, from actually-claimed teams (5 included, EUR 10 each). Comped and demo orgs settle at 0; settled invoices are never grown.';

-- Fires when an open-joining event leaves 'active' (archived, draft, or any
-- other destination). Runs inside the same transaction as the status change.
create or replace function public.trg_open_joining_settlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'active' and new.status is distinct from 'active'
     and coalesce(new.open_joining, false) then
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
