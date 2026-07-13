-- Event managers are allowed to open and operate facilitator event links.
-- Keep the database/RLS authority aligned with the client route guard and the
-- activate-bingo-run Edge Function.
create or replace function public.is_facilitator_for_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    join public.profiles p on p.id = auth.uid()
    where e.id = p_event_id
      and (
        p.role = 'super_admin'
        or (
          p.organization_id = e.organization_id
          and p.role in ('facilitator', 'event_manager', 'client_admin')
        )
      )
  );
$$;

comment on function public.is_facilitator_for_event(uuid) is
  'Authenticated facilitator, event_manager, client_admin of org, or super_admin for live privileged writes.';
