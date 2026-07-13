-- CONTACT-1: durable store for marketing demo/contact form leads.
-- Rows are written only by the `submit-contact` Edge Function (service role,
-- bypasses RLS). No anon/authenticated direct writes. Super admins can read.

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  event_type text,
  message text,
  ip_address text,
  emailed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists contact_submissions_created_at_idx
  on public.contact_submissions (created_at desc);
create index if not exists contact_submissions_ip_created_idx
  on public.contact_submissions (ip_address, created_at desc);

alter table public.contact_submissions enable row level security;

-- Only super admins may read leads from the app. No insert/update/delete
-- policies exist, so anon/authenticated cannot write directly; the Edge
-- Function uses the service role.
drop policy if exists "contact_submissions_super_admin_select" on public.contact_submissions;
create policy "contact_submissions_super_admin_select"
  on public.contact_submissions for select
  to authenticated
  using ((select public.is_super_admin()));

revoke all on public.contact_submissions from anon, authenticated;
grant select on public.contact_submissions to authenticated;
