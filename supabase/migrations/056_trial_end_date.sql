-- Add trial expiry tracking to organizations.
-- trial_ends_at:      super-admin sets this when granting a trial; null = no expiry
-- trial_review_needed: set to true automatically when a trial expires, cleared manually

alter table public.organizations
  add column if not exists trial_ends_at timestamptz default null,
  add column if not exists trial_review_needed boolean not null default false;

-- RPC: called from the super-admin app to auto-suspend expired trials.
-- Marks account_status = 'suspended' and trial_review_needed = true for any
-- org that is still in trial but whose trial_ends_at has passed.
create or replace function public.expire_overdue_trials()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.organizations
  set
    account_status      = 'suspended',
    trial_review_needed = true
  where
    account_status = 'trial'
    and trial_ends_at is not null
    and trial_ends_at < now();
end;
$$;

grant execute on function public.expire_overdue_trials() to authenticated;

notify pgrst, 'reload schema';
