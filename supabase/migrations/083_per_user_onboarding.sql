-- Onboarding moves from per-organisation to per-user: every admin-panel user
-- (client_admin, event_manager) gets their own tour on first login, and adding
-- the columns fresh here resets progress for all existing accounts.
-- profiles has no self-update policy (by design - role must stay locked), so
-- writes go through a security-definer RPC that touches only these two fields.
-- The old organizations.onboarding_* columns stay until this ships to main
-- (production still reads them); drop them after the merge.
alter table public.profiles
  add column if not exists onboarding_completed_tasks text[] not null default '{}'::text[],
  add column if not exists onboarding_dismissed boolean not null default false;

create or replace function public.set_my_onboarding(
  p_completed text[] default null,
  p_dismissed boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  update public.profiles
  set onboarding_completed_tasks = coalesce(p_completed, onboarding_completed_tasks),
      onboarding_dismissed = coalesce(p_dismissed, onboarding_dismissed)
  where id = auth.uid();
end;
$$;

revoke execute on function public.set_my_onboarding(text[], boolean) from anon;
grant execute on function public.set_my_onboarding(text[], boolean) to authenticated;

comment on function public.set_my_onboarding(text[], boolean) is
  'Update the calling user''s onboarding progress (completed step ids / dismissed flag). Null keeps the current value.';
