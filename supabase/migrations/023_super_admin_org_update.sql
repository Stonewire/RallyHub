-- Super admins can update any organization row (WITH CHECK was missing on update policy).
-- Ensure contact columns exist for client detail saves.

alter table public.organizations
  add column if not exists email text,
  add column if not exists phone text;

update public.organizations
set email = contact_email
where email is null
  and contact_email is not null;

drop policy if exists "organizations_super_admin_update" on public.organizations;
create policy "organizations_super_admin_update"
on public.organizations for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  )
);
