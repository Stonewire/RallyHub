-- Onboarding moved to per-user (migration 083, profiles.onboarding_*).
-- No app code reads organizations.onboarding_completed_tasks /
-- onboarding_dismissed anymore (confirmed via grep) — safe to drop now that
-- the per-user version has shipped to main.
alter table public.organizations
  drop column if exists onboarding_completed_tasks,
  drop column if exists onboarding_dismissed;
