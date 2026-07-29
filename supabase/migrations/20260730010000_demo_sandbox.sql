-- Public, self-resetting RallyHub demo organization.
--
-- The browser still receives an ordinary client_admin session and all normal RLS
-- rules continue to apply. Only service-role Edge Functions may restore the
-- sandbox or mutate its protected demo metadata.

alter table public.organizations
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_reset_at timestamptz,
  add column if not exists demo_last_reset_at timestamptz,
  add column if not exists demo_reset_interval_minutes integer not null default 30
    check (demo_reset_interval_minutes between 5 and 1440),
  add column if not exists demo_generation integer not null default 0,
  add column if not exists demo_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists organizations_single_demo_idx
  on public.organizations (is_demo)
  where is_demo;

create or replace function public.protect_demo_organization_metadata()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.is_demo and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    new.is_demo := old.is_demo;
    new.demo_reset_at := old.demo_reset_at;
    new.demo_last_reset_at := old.demo_last_reset_at;
    new.demo_reset_interval_minutes := old.demo_reset_interval_minutes;
    new.demo_generation := old.demo_generation;
    new.demo_user_id := old.demo_user_id;
    new.subdomain := old.subdomain;
    new.custom_domain := old.custom_domain;
    new.paddle_customer_id := old.paddle_customer_id;
    new.paddle_subscription_id := old.paddle_subscription_id;
    new.subscription_status := old.subscription_status;
    new.subscription_current_period_end := old.subscription_current_period_end;
    new.account_status := old.account_status;
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_protect_demo_metadata on public.organizations;
create trigger organizations_protect_demo_metadata
  before update on public.organizations
  for each row execute function public.protect_demo_organization_metadata();

revoke all on function public.protect_demo_organization_metadata() from public, anon, authenticated;

-- Widen tenant-public RPCs with only the two pieces of demo state the browser
-- needs. Internal reset/user identifiers remain private.
drop function if exists public.get_organization_tenant_public(uuid);
drop function if exists public.get_organization_tenant_by_subdomain(text);
drop function if exists public.resolve_tenant_by_host(text);

create function public.get_organization_tenant_public(p_org_id uuid)
returns table (
  id uuid, subdomain text, custom_domain text, name text, logo_url text,
  primary_color text, secondary_color text, accent_color text, tablet_slug text,
  hide_platform_branding boolean,
  logo_light_url text, logo_dark_url text,
  brand_heading_font text, brand_body_font text,
  brand_heading_font_url text, brand_body_font_url text,
  is_demo boolean, demo_reset_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select o.id, o.subdomain, o.custom_domain, o.name, o.logo_url,
    o.primary_color, o.secondary_color, o.accent_color, o.tablet_slug,
    o.hide_platform_branding,
    o.logo_light_url, o.logo_dark_url,
    o.brand_heading_font, o.brand_body_font,
    o.brand_heading_font_url, o.brand_body_font_url,
    o.is_demo, o.demo_reset_at
  from public.organizations o where o.id = p_org_id limit 1;
$$;

create function public.get_organization_tenant_by_subdomain(p_subdomain text)
returns table (
  id uuid, subdomain text, custom_domain text, name text, logo_url text,
  primary_color text, secondary_color text, accent_color text, tablet_slug text,
  hide_platform_branding boolean,
  logo_light_url text, logo_dark_url text,
  brand_heading_font text, brand_body_font text,
  brand_heading_font_url text, brand_body_font_url text,
  is_demo boolean, demo_reset_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select o.id, o.subdomain, o.custom_domain, o.name, o.logo_url,
    o.primary_color, o.secondary_color, o.accent_color, o.tablet_slug,
    o.hide_platform_branding,
    o.logo_light_url, o.logo_dark_url,
    o.brand_heading_font, o.brand_body_font,
    o.brand_heading_font_url, o.brand_body_font_url,
    o.is_demo, o.demo_reset_at
  from public.organizations o
  where lower(o.subdomain) = lower(trim(p_subdomain)) limit 1;
$$;

create function public.resolve_tenant_by_host(p_host text)
returns table (
  id uuid, subdomain text, custom_domain text, name text, logo_url text,
  primary_color text, secondary_color text, accent_color text, tablet_slug text,
  hide_platform_branding boolean,
  logo_light_url text, logo_dark_url text,
  brand_heading_font text, brand_body_font text,
  brand_heading_font_url text, brand_body_font_url text,
  is_demo boolean, demo_reset_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with host_clean as (select lower(split_part(trim(p_host), ':', 1)) as h)
  select o.id, o.subdomain, o.custom_domain, o.name, o.logo_url,
    o.primary_color, o.secondary_color, o.accent_color, o.tablet_slug,
    o.hide_platform_branding,
    o.logo_light_url, o.logo_dark_url,
    o.brand_heading_font, o.brand_body_font,
    o.brand_heading_font_url, o.brand_body_font_url,
    o.is_demo, o.demo_reset_at
  from public.organizations o
  cross join host_clean hc
  where (o.custom_domain is not null and lower(o.custom_domain) = hc.h)
     or (hc.h like '%.app.rallyhub.games' and o.subdomain = split_part(hc.h, '.', 1))
     or (hc.h like '%.rallyhubapp.vercel.app' and o.subdomain = split_part(hc.h, '.', 1))
     or (hc.h like '%.localhost' and o.subdomain = split_part(hc.h, '.', 1))
  limit 1;
$$;

grant execute on function public.get_organization_tenant_public(uuid) to anon, authenticated;
grant execute on function public.get_organization_tenant_by_subdomain(text) to anon, authenticated;
grant execute on function public.resolve_tenant_by_host(text) to anon, authenticated;

create or replace function public.reset_demo_sandbox(
  p_organization_id uuid,
  p_force boolean default false
)
returns table (
  organization_id uuid,
  last_reset_at timestamptz,
  next_reset_at timestamptz,
  reset_interval_minutes integer,
  generation integer
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_org public.organizations%rowtype;
  v_platform_id uuid;
  v_template public.games%rowtype;
  v_new_game_id uuid;
  v_event_id uuid;
  v_event_name text;
  v_event_status text;
  v_event_date timestamptz;
  v_team_id uuid;
  v_team_count integer;
  v_team_names text[] := array['Comets', 'Trailblazers', 'Mavericks', 'Fireflies', 'North Stars', 'Wildcards', 'Pioneers', 'Voyagers'];
  v_team_colors text[] := array['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#00ACC1', '#FDD835', '#6D4C41'];
  v_event_names text[] := array[
    'Winter Kickoff', 'New Year Rally', 'Creative Sprint', 'Spring Team Social',
    'Leadership Offsite', 'Summer Games', 'Client Celebration', 'Company Quest',
    'Autumn Adventure', 'Sales Summit', 'Holiday Challenge', 'Partner Preview',
    'Quarterly Team Day', 'RallyHub Product Showcase'
  ];
  v_index integer;
  v_team_index integer;
  v_game_ids uuid[];
  v_primary_game uuid;
  v_quiz_game uuid;
  v_bingo_game uuid;
  v_stages jsonb;
  v_teams_config jsonb;
  v_now timestamptz := clock_timestamp();
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  select * into v_org
  from public.organizations
  where id = p_organization_id and is_demo
  for update;

  if not found then
    raise exception 'Demo organization not found';
  end if;

  if not p_force and v_org.demo_reset_at is not null and v_org.demo_reset_at > v_now then
    return query select v_org.id, v_org.demo_last_reset_at, v_org.demo_reset_at,
      v_org.demo_reset_interval_minutes, v_org.demo_generation;
    return;
  end if;

  select id into v_platform_id
  from public.organizations
  where subdomain = 'rallyhub-library'
  limit 1;

  if v_platform_id is null then
    raise exception 'Platform game library organization not found';
  end if;

  delete from public.organization_deletion_requests dr where dr.organization_id = v_org.id;
  delete from public.organization_members om where om.organization_id = v_org.id;
  delete from public.tablet_sessions ts where ts.organization_id = v_org.id;
  delete from public.tablet_login_attempts tla where tla.organization_id = v_org.id;
  delete from public.support_tickets st where st.organization_id = v_org.id;
  delete from public.promo_code_redemptions pr where pr.organization_id = v_org.id;
  delete from public.subscription_transactions tx where tx.organization_id = v_org.id;
  delete from public.inventory_items ii where ii.organization_id = v_org.id;
  delete from public.events e where e.organization_id = v_org.id;
  delete from public.game_groups gg where gg.organization_id = v_org.id;
  delete from public.games g where g.organization_id = v_org.id;
  delete from public.music_playlists mp where mp.organization_id = v_org.id;
  delete from public.music_catalog mc where mc.organization_id = v_org.id;

  create temporary table if not exists demo_game_map (
    source_id uuid primary key,
    installed_id uuid not null,
    game_type text not null,
    list_order integer not null
  ) on commit drop;
  truncate table demo_game_map;

  for v_template in
    select * from public.games g
    where g.organization_id = v_platform_id
      and g.is_platform_template
      and g.deleted_at is null
      and g.status = 'active'
    order by g.list_order, g.created_at
    limit 24
  loop
    insert into public.games (
      organization_id, name, type, description, cover_url, points_type,
      points_static, points_min, points_max, solution_description,
      solution_image_url, status, config, is_default_for_new_clients,
      is_platform_template, source_template_id, list_order
    ) values (
      v_org.id, v_template.name, v_template.type, v_template.description,
      v_template.cover_url, v_template.points_type, v_template.points_static,
      v_template.points_min, v_template.points_max,
      v_template.solution_description, v_template.solution_image_url,
      'active', v_template.config, false, false, v_template.id,
      v_template.list_order
    ) returning id into v_new_game_id;

    insert into demo_game_map(source_id, installed_id, game_type, list_order)
    values (v_template.id, v_new_game_id, v_template.type, v_template.list_order);
  end loop;

  select array_agg(installed_id order by list_order),
    (array_agg(installed_id order by list_order))[1]
  into v_game_ids, v_primary_game
  from demo_game_map;

  if coalesce(array_length(v_game_ids, 1), 0) = 0 then
    raise exception 'The platform library has no active games to install';
  end if;

  select installed_id into v_quiz_game from demo_game_map where game_type = 'quiz' order by list_order limit 1;
  select installed_id into v_bingo_game from demo_game_map where game_type = 'music_bingo' order by list_order limit 1;

  insert into public.music_catalog (
    organization_id, artist, title, audio_url, clip_url, clip_start_seconds,
    clip_duration_seconds, duration_seconds, source_filename, genre,
    parse_confidence, license_confirmed_at
  )
  select v_org.id, artist, title, audio_url, clip_url, clip_start_seconds,
    clip_duration_seconds, duration_seconds, source_filename, genre,
    parse_confidence, license_confirmed_at
  from public.music_catalog mc
  where mc.organization_id = v_platform_id;

  v_stages := jsonb_build_array(
    jsonb_build_object('id', gen_random_uuid(), 'name', 'Warm-up challenges', 'type', 'open', 'gameId', v_primary_game, 'gameIds', to_jsonb(v_game_ids[1:least(4, array_length(v_game_ids, 1))])),
    case when v_quiz_game is not null
      then jsonb_build_object('id', gen_random_uuid(), 'name', 'Quiz round', 'type', 'quiz', 'gameId', v_quiz_game, 'gameIds', jsonb_build_array(v_quiz_game))
      else jsonb_build_object('id', gen_random_uuid(), 'name', 'Team challenges', 'type', 'open', 'gameId', v_primary_game, 'gameIds', jsonb_build_array(v_primary_game)) end,
    jsonb_build_object('id', gen_random_uuid(), 'name', 'Refreshment break', 'type', 'break', 'message', 'Take five — the next round starts soon.', 'durationMinutes', 5),
    case when v_bingo_game is not null
      then jsonb_build_object('id', gen_random_uuid(), 'name', 'Music bingo finale', 'type', 'bingo', 'gameId', v_bingo_game, 'gameIds', jsonb_build_array(v_bingo_game))
      else jsonb_build_object('id', gen_random_uuid(), 'name', 'Grand finale', 'type', 'open', 'gameId', v_primary_game, 'gameIds', jsonb_build_array(v_primary_game)) end
  );

  for v_index in 1..array_length(v_event_names, 1) loop
    v_event_name := v_event_names[v_index];
    if v_index <= 11 then
      v_event_status := 'archived';
      v_event_date := v_now - make_interval(months => 13 - v_index) + make_interval(days => (v_index % 3) * 4);
    elsif v_index = 12 then
      v_event_status := 'ready';
      v_event_date := v_now + interval '7 days';
    elsif v_index = 13 then
      v_event_status := 'draft';
      v_event_date := v_now + interval '21 days';
    else
      v_event_status := 'ready';
      v_event_date := v_now + interval '2 hours';
    end if;

    v_team_count := case when v_index % 4 = 0 then 8 when v_index % 3 = 0 then 6 else 5 end;
    select jsonb_agg(jsonb_build_object(
      'id', gen_random_uuid(),
      'name', case when v_event_status = 'archived' then v_team_names[n] else '' end,
      'color', v_team_colors[n]
    ) order by n)
    into v_teams_config
    from generate_series(1, v_team_count) as n;

    insert into public.events (
      organization_id, name, slug, event_date, status, team_count,
      branding_enabled, inventory_enabled, logo_url, brand_colors,
      teams_config, stages_config, display_layout, display_text_color,
      list_order, invoice_paid, invoiced_at, activated_at, created_at
    ) values (
      v_org.id, v_event_name,
      lower(regexp_replace(v_event_name, '[^a-zA-Z0-9]+', '-', 'g')),
      v_event_date, v_event_status, v_team_count, true, true,
      null, jsonb_build_array('#252525', '#F2EFE8', '#FFCB03'),
      v_teams_config, v_stages,
      case when v_index % 2 = 0 then 'orbit_view' else 'rank_list' end,
      'white', v_index,
      v_event_status = 'archived' and v_index <> 11,
      case when v_event_status = 'archived' then v_event_date else null end,
      case when v_event_status = 'archived' then v_event_date else null end,
      v_event_date - interval '28 days'
    ) returning id into v_event_id;

    insert into public.event_games(event_id, game_id)
    select v_event_id, unnest(v_game_ids[1:least(8, array_length(v_game_ids, 1))]);

    insert into public.event_state(event_id, show_scores, show_timer_on_display, submissions_open)
    values (v_event_id, true, true, v_event_status <> 'archived');

    for v_team_index in 1..v_team_count loop
      insert into public.teams(event_id, name, color, score, status, slot_number, created_at)
      values (
        v_event_id,
        case when v_event_status = 'archived' then v_team_names[v_team_index] else null end,
        v_team_colors[v_team_index],
        case when v_event_status = 'archived' then 350 + ((v_index * 83 + v_team_index * 137) % 1450) else 0 end,
        case when v_event_status = 'archived' then 'active' else 'idle' end,
        v_team_index,
        v_event_date - interval '2 hours'
      ) returning id into v_team_id;

      if v_event_status = 'archived' then
        insert into public.submissions(event_id, team_id, game_id, media_url, media_type, status, points_awarded, created_at)
        values (
          v_event_id, v_team_id, v_primary_game,
          'A polished demo answer from ' || v_team_names[v_team_index],
          'text', 'approved', 100 + ((v_team_index * 25) % 100),
          v_event_date + make_interval(mins => v_team_index * 3)
        );
      end if;
    end loop;

    if v_event_status = 'archived' then
      insert into public.invoices (
        event_id, organization_id, plan_key, amount, discount, amount_due,
        included_team_count, extra_team_count, extra_team_fee,
        status, paddle_transaction_id, created_at
      ) values (
        v_event_id, v_org.id, 'pro', 99 + greatest(v_team_count - 5, 0) * 10,
        0, 99 + greatest(v_team_count - 5, 0) * 10,
        5, greatest(v_team_count - 5, 0), greatest(v_team_count - 5, 0) * 10,
        case when v_index = 11 then 'unpaid' else 'paid' end,
        case when v_index = 11 then null else 'demo_event_' || replace(v_event_id::text, '-', '') end,
        v_event_date
      );

      insert into public.event_activity_log(
        event_id, organization_id, actor_type, actor_name, action, details, created_at
      ) values
        (v_event_id, v_org.id, 'admin', 'Alex Morgan', 'event_activated', jsonb_build_object('source', 'demo'), v_event_date - interval '15 minutes'),
        (v_event_id, v_org.id, 'facilitator', 'Jamie Lee', 'scores_revealed', jsonb_build_object('teams', v_team_count), v_event_date + interval '90 minutes'),
        (v_event_id, v_org.id, 'system', null, 'event_archived', jsonb_build_object('automatic', false), v_event_date + interval '2 hours');
    end if;
  end loop;

  insert into public.inventory_items(organization_id, name, description, points_cost, is_active)
  values
    (v_org.id, 'Mystery envelope', 'A surprise advantage for the next challenge.', 250, true),
    (v_org.id, 'Double points token', 'Double one approved challenge score.', 500, true),
    (v_org.id, 'Coffee voucher', 'A small real-world reward for the team.', 300, true),
    (v_org.id, 'Five-minute head start', 'Begin the next puzzle five minutes early.', 450, true),
    (v_org.id, 'Hint card', 'Ask the facilitator for one helpful hint.', 200, true),
    (v_org.id, 'Team photo print', 'A keepsake from the event.', 350, false);

  for v_index in 0..9 loop
    insert into public.subscription_transactions(
      organization_id, paddle_transaction_id, paddle_subscription_id,
      plan_key, billing_period, amount, amount_due, currency, status,
      created_at, updated_at
    ) values (
      v_org.id, 'demo_subscription_' || v_index || '_' || replace(v_org.id::text, '-', ''),
      'demo_subscription_active', 'pro', 'monthly', 200, 200, 'EUR',
      case when v_index = 7 then 'failed' else 'paid' end,
      v_now - make_interval(months => v_index),
      v_now - make_interval(months => v_index)
    );
  end loop;

  update public.organizations
  set name = 'Northstar Experiences',
      subdomain = 'demo',
      custom_domain = 'demo.rallyhub.games',
      primary_color = '#252525',
      secondary_color = '#F2EFE8',
      accent_color = '#FFCB03',
      logo_url = null,
      logo_light_url = null,
      logo_dark_url = null,
      brand_heading_font = null,
      brand_body_font = null,
      brand_heading_font_url = null,
      brand_body_font_url = null,
      contact_email = 'hello@northstar-demo.example',
      email = 'billing@northstar-demo.example',
      phone = '+356 2000 0000',
      vat_number = 'MT DEMO 123456',
      address_street = '14 Harbour View',
      address_city = 'Valletta',
      address_postal = 'VLT 1000',
      address_country = 'Malta',
      tablet_password = '2468',
      tablet_slug = 'northstar-demo',
      billing_plan = 'pro',
      billing_period = 'monthly',
      paddle_customer_id = 'demo_customer_northstar',
      paddle_subscription_id = 'demo_subscription_active',
      subscription_status = 'active',
      subscription_current_period_end = v_now + interval '1 month',
      account_status = 'active',
      trial_ends_at = null,
      trial_review_needed = false,
      educational_status = 'none',
      hide_platform_branding = false,
      demo_last_reset_at = v_now,
      demo_reset_at = v_now + make_interval(mins => demo_reset_interval_minutes),
      demo_generation = demo_generation + 1
  where id = v_org.id
  returning id, demo_last_reset_at, demo_reset_at,
    demo_reset_interval_minutes, demo_generation
  into organization_id, last_reset_at, next_reset_at,
    reset_interval_minutes, generation;

  update public.profiles
  set username = 'demo',
      full_name = 'Demo Host',
      first_name = 'Demo',
      last_name = 'Host',
      role = 'client_admin',
      organization_id = v_org.id,
      must_change_password = false,
      onboarding_completed_tasks = '{}'::text[],
      onboarding_dismissed = true,
      updated_at = v_now
  where id = v_org.demo_user_id;

  return next;
end;
$$;

revoke all on function public.reset_demo_sandbox(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.reset_demo_sandbox(uuid, boolean) to service_role;

notify pgrst, 'reload schema';
