-- Proof that a given user accepted a given version of a given legal document.
--
-- Append-only on purpose: an acceptance is evidence. Nobody gets to UPDATE or
-- DELETE one, not even a super admin, because a mutable consent record is worth
-- nothing if it is ever challenged. Re-accepting a new version writes a NEW row.
--
-- Version is stored alongside the document, not a bare boolean, so that when the
-- lawyer revises a document we bump its version (src/lib/legal-acceptance.ts) and
-- everyone is asked again on their next login.
create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  document text not null check (document in ('terms', 'privacy', 'dpa')),
  version integer not null check (version > 0),
  accepted_at timestamptz not null default now()
);

-- One row per user per document per version. Re-accepting the same version is a
-- no-op rather than a duplicate, which keeps the trail clean.
create unique index if not exists legal_acceptances_user_doc_version_idx
  on public.legal_acceptances (user_id, document, version);

create index if not exists legal_acceptances_user_idx
  on public.legal_acceptances (user_id);

alter table public.legal_acceptances enable row level security;

-- A user may read their own acceptances (the app checks what they still owe).
drop policy if exists "legal_acceptances_select_own" on public.legal_acceptances;
create policy "legal_acceptances_select_own"
  on public.legal_acceptances for select
  to authenticated
  using (user_id = (select auth.uid()));

-- A user may record their OWN acceptance, and only for themselves. They cannot
-- forge one on behalf of somebody else.
drop policy if exists "legal_acceptances_insert_own" on public.legal_acceptances;
create policy "legal_acceptances_insert_own"
  on public.legal_acceptances for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Super admins can read everything (support, and proving compliance if asked).
drop policy if exists "legal_acceptances_super_admin_read" on public.legal_acceptances;
create policy "legal_acceptances_super_admin_read"
  on public.legal_acceptances for select
  to authenticated
  using ((select public.is_super_admin()));

-- Deliberately NO update or delete policy for anyone, including super admins.
revoke all on public.legal_acceptances from anon, authenticated;
grant select, insert on public.legal_acceptances to authenticated;
