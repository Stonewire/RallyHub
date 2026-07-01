-- Onboarding tour: whether the client_admin has finished (or force-finished
-- via "All completed") the interactive walkthrough. Once true, the tour and
-- checklist panel stop appearing for the org.
alter table public.organizations
  add column if not exists onboarding_dismissed boolean not null default false;
