-- Phase 1 security hardening from the July 2026 app review.
--
-- Scope:
-- - tablet event lists require a valid server-issued tablet session token
-- - new Auth profiles no longer trust user-editable role/org metadata
-- - organization-logo writes are scoped to the owning org / super admin
-- - broad public storage listing policies are removed from public buckets
-- - obvious admin/trigger SECURITY DEFINER functions lose implicit PUBLIC execute

-- ─── Tablet event list: require a validated tablet session token ────────────

drop function if exists public.get_tablet_events_for_org(uuid);

create or replace function public.get_tablet_events_for_org(
  p_org_id uuid,
  p_token text
)
returns table (
  id uuid,
  organization_id uuid,
  name text,
  event_date timestamptz,
  status text,
  team_count integer,
  branding_enabled boolean,
  logo_url text,
  brand_colors jsonb,
  teams_config jsonb,
  stages_config jsonb,
  display_layout text,
  display_text_color text,
  list_order integer,
  invoice_paid boolean,
  invoiced_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_org_id is null or nullif(trim(coalesce(p_token, '')), '') is null then
    raise exception 'Tablet session required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.tablet_sessions ts
    where ts.organization_id = p_org_id
      and ts.token = p_token
      and ts.expires_at > now()
  ) then
    raise exception 'Tablet session required' using errcode = '42501';
  end if;

  return query
  select
    e.id,
    e.organization_id,
    e.name,
    e.event_date,
    e.status,
    e.team_count,
    e.branding_enabled,
    e.logo_url,
    e.brand_colors,
    e.teams_config,
    e.stages_config,
    e.display_layout,
    e.display_text_color,
    e.list_order,
    e.invoice_paid,
    e.invoiced_at,
    e.created_at
  from public.events e
  where e.organization_id = p_org_id
    and e.status in ('active', 'ready', 'demo')
  order by e.event_date asc nulls last;
end;
$$;

revoke execute on function public.get_tablet_events_for_org(uuid, text)
  from PUBLIC, anon, authenticated;
grant execute on function public.get_tablet_events_for_org(uuid, text)
  to anon, authenticated;

comment on function public.get_tablet_events_for_org(uuid, text) is
  'Tablet kiosk event list for an org. Requires a valid tablet_sessions token; omits join_token.';

-- ─── Auth profile trigger: never trust role/org from user_metadata ───────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text := nullif(trim(meta ->> 'username'), '');
  v_first text := nullif(trim(meta ->> 'first_name'), '');
  v_last text := nullif(trim(meta ->> 'last_name'), '');
  v_full text := nullif(trim(meta ->> 'full_name'), '');
begin
  if v_full is null then
    v_full := nullif(trim(concat_ws(' ', v_first, v_last)), '');
  end if;

  if v_username is null then
    v_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
  end if;

  insert into public.profiles (
    id,
    username,
    full_name,
    first_name,
    last_name,
    role,
    organization_id,
    must_change_password
  )
  values (
    new.id,
    v_username,
    v_full,
    v_first,
    v_last,
    'event_manager',
    null,
    false
  );

  return new;
end;
$$;

revoke execute on function public.handle_new_user()
  from PUBLIC, anon, authenticated;

comment on function public.handle_new_user() is
  'Creates a safe placeholder profile. Trusted Edge Functions assign role/org after Auth user creation.';

-- ─── Storage: scoped logo writes and no broad public listing policies ────────

create or replace function public.storage_organization_logo_path_allowed(
  object_name text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with f as (
    select storage.foldername(object_name) as parts
  )
  select
    public.storage_path_is_uuid((parts)[1])
    and (
      (parts)[1] = public.user_organization_id()::text
      or public.is_super_admin()
    )
  from f;
$$;

revoke execute on function public.storage_organization_logo_path_allowed(text)
  from PUBLIC, anon, authenticated;

comment on function public.storage_organization_logo_path_allowed(text) is
  'organization-logos paths must start with the caller org UUID, unless the caller is a super admin.';

drop policy if exists "org_logos_public_read" on storage.objects;
drop policy if exists "org_logos_authenticated_upload" on storage.objects;
drop policy if exists "org_logos_authenticated_update" on storage.objects;
drop policy if exists "Allow org logo reads" on storage.objects;
drop policy if exists "Allow org logo uploads" on storage.objects;
drop policy if exists "Allow org logo updates" on storage.objects;
drop policy if exists "organization_logos_authenticated_select" on storage.objects;
drop policy if exists "organization_logos_authenticated_insert" on storage.objects;
drop policy if exists "organization_logos_authenticated_update" on storage.objects;
drop policy if exists "organization_logos_authenticated_delete" on storage.objects;

create policy "organization_logos_authenticated_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'organization-logos'
  and public.storage_organization_logo_path_allowed(name)
);

create policy "organization_logos_authenticated_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'organization-logos'
  and public.storage_organization_logo_path_allowed(name)
);

create policy "organization_logos_authenticated_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'organization-logos'
  and public.storage_organization_logo_path_allowed(name)
)
with check (
  bucket_id = 'organization-logos'
  and public.storage_organization_logo_path_allowed(name)
);

create policy "organization_logos_authenticated_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'organization-logos'
  and public.storage_organization_logo_path_allowed(name)
);

drop policy if exists "game_assets_public_read" on storage.objects;
drop policy if exists "game_assets_authenticated_select" on storage.objects;

create policy "game_assets_authenticated_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'game-assets'
  and (
    public.storage_game_assets_org_path_allowed(name)
    or public.storage_game_assets_live_upload_owned(name)
  )
);

-- ─── SECURITY DEFINER execute grants: remove implicit PUBLIC access ──────────

revoke execute on function public.clear_must_change_password()
  from PUBLIC, anon;
grant execute on function public.clear_must_change_password()
  to authenticated;

revoke execute on function public.create_event_activation_invoice(uuid)
  from PUBLIC, anon;
grant execute on function public.create_event_activation_invoice(uuid)
  to authenticated;

revoke execute on function public.delete_organization_cascade(uuid)
  from PUBLIC, anon;
grant execute on function public.delete_organization_cascade(uuid)
  to authenticated;

revoke execute on function public.increment_team_score(uuid, int)
  from PUBLIC, anon;
grant execute on function public.increment_team_score(uuid, int)
  to authenticated;

revoke execute on function public.redeem_promo_code(text)
  from PUBLIC, anon;
grant execute on function public.redeem_promo_code(text)
  to authenticated;

revoke execute on function public.remove_organization_user(uuid, uuid)
  from PUBLIC, anon;
grant execute on function public.remove_organization_user(uuid, uuid)
  to authenticated;

revoke execute on function public.reset_event_data(uuid)
  from PUBLIC, anon;
grant execute on function public.reset_event_data(uuid)
  to authenticated;

revoke execute on function public.restart_bingo_run_scores(uuid, uuid, int, int)
  from PUBLIC, anon;
grant execute on function public.restart_bingo_run_scores(uuid, uuid, int, int)
  to authenticated;

revoke execute on function public.restart_quiz_scores(uuid, uuid)
  from PUBLIC, anon;
grant execute on function public.restart_quiz_scores(uuid, uuid)
  to authenticated;

revoke execute on function public.reveal_quiz_answer(uuid, uuid, text)
  from PUBLIC, anon;
grant execute on function public.reveal_quiz_answer(uuid, uuid, text)
  to authenticated;

revoke execute on function public.score_current_quiz_question(uuid, uuid, text)
  from PUBLIC, anon;
grant execute on function public.score_current_quiz_question(uuid, uuid, text)
  to authenticated;

revoke execute on function public.set_my_onboarding(text[], boolean)
  from PUBLIC, anon;
grant execute on function public.set_my_onboarding(text[], boolean)
  to authenticated;

revoke execute on function public.wipe_event_data(uuid)
  from PUBLIC, anon;
grant execute on function public.wipe_event_data(uuid)
  to authenticated;

-- These trigger/internal functions are not public RPC APIs.
revoke execute on function public.block_insert_when_suspended()
  from PUBLIC, anon, authenticated;
revoke execute on function public.set_profiles_updated_at()
  from PUBLIC, anon, authenticated;
revoke execute on function public.touch_event_on_event_games_change()
  from PUBLIC, anon, authenticated;
revoke execute on function public.touch_support_ticket_on_message()
  from PUBLIC, anon, authenticated;
revoke execute on function public.trg_event_activation_billing()
  from PUBLIC, anon, authenticated;
revoke execute on function public.trg_event_status_lifecycle_guard()
  from PUBLIC, anon, authenticated;
revoke execute on function public.trg_seed_organization_defaults()
  from PUBLIC, anon, authenticated;
