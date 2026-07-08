-- P2-5: rate limit for the public register-client edge function. No RLS
-- policies — only the service-role key the edge function runs with can
-- read/write this table.
create table if not exists public.signup_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_address text not null,
  created_at timestamptz not null default now()
);

create index if not exists signup_attempts_ip_created_idx
  on public.signup_attempts (ip_address, created_at);

alter table public.signup_attempts enable row level security;
