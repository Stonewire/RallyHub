-- Super admins can read every client's team members (profiles + organization_members)
-- for the super-admin client-detail view. Before this, both tables only had "own"
-- SELECT policies, so a super_admin saw an empty Team Members list on a client.

-- Helper: true when the current user is a super_admin. SECURITY DEFINER so it reads
-- profiles without being re-filtered by RLS — this prevents self-referential
-- recursion when the function is used inside a policy on profiles itself.
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

grant execute on function public.is_super_admin() to authenticated;

drop policy if exists "profiles_super_admin_select" on public.profiles;
create policy "profiles_super_admin_select"
on public.profiles
for select
to authenticated
using (public.is_super_admin());

drop policy if exists "organization_members_super_admin_select" on public.organization_members;
create policy "organization_members_super_admin_select"
on public.organization_members
for select
to authenticated
using (public.is_super_admin());

notify pgrst, 'reload schema';
