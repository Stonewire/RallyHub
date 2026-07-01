-- In-app onboarding checklist: which walkthrough tasks a client_admin has
-- marked complete for their org. Client-admin only feature — no new RLS
-- policy needed, "organizations_update_client_admin" (047) already covers it.
alter table public.organizations
  add column if not exists onboarding_completed_tasks text[] not null default '{}'::text[];
