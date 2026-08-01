-- Users may edit their OWN presentational profile fields.
--
-- profiles previously had select policies only, so every write went through the
-- update-org-user Edge Function. That is correct for anything privileged, but
-- it left the new avatar and phone fields with no path at all: a client-side
-- update was silently rejected by RLS.
--
-- This policy is deliberately narrow. It covers the row you own, and a trigger
-- pins the fields that must never be self-assigned. Without that trigger a user
-- could grant themselves client_admin, or move into another organisation, by
-- updating their own row.
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Privilege fields stay server-controlled. Any attempt to change them through
-- the self-update path is reverted to the stored value rather than raising, so
-- a well-behaved client that PATCHes the whole row still succeeds.
create or replace function public.guard_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The Edge Function runs as the service role and must stay unrestricted.
  if (select auth.uid()) is null or (select auth.uid()) <> NEW.id then
    return NEW;
  end if;

  NEW.role := OLD.role;
  NEW.organization_id := OLD.organization_id;
  NEW.must_change_password := OLD.must_change_password;
  NEW.username := OLD.username; -- uniqueness is enforced by the Edge Function
  return NEW;
end;
$$;

drop trigger if exists guard_profile_self_update on public.profiles;
create trigger guard_profile_self_update
  before update on public.profiles
  for each row
  execute function public.guard_profile_self_update();

comment on policy "profiles_update_own" on public.profiles is
  'Self-service edits to presentational fields (avatar_url, phone, names). Role, organisation, username and must_change_password are pinned by guard_profile_self_update.';
