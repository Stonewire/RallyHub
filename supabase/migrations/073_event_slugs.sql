-- Slug-based shareable links: every event gets a unique slug within its org,
-- auto-numbered (quiz-night, quiz-night-2, …) and monotonic — archived events
-- keep their slug so a later same-named event takes the next number.
-- Client slug = organizations.subdomain (already present + editable).

alter table public.events add column if not exists slug text;

create or replace function public.slugify(p text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]+', '-', 'g'))
$$;

-- Smallest free "base", "base-2", "base-3"… within the org.
create or replace function public.next_event_slug(p_org uuid, p_name text, p_exclude uuid default null)
returns text language plpgsql stable as $$
declare base text; cand text; n int := 1;
begin
  base := public.slugify(p_name);
  if base = '' then base := 'event'; end if;
  cand := base;
  loop
    if not exists (
      select 1 from public.events
      where organization_id = p_org and slug = cand
        and (p_exclude is null or id <> p_exclude)
    ) then
      return cand;
    end if;
    n := n + 1;
    cand := base || '-' || n;
  end loop;
end $$;

create or replace function public.set_event_slug()
returns trigger language plpgsql as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := public.next_event_slug(new.organization_id, new.name, new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_set_event_slug on public.events;
create trigger trg_set_event_slug before insert on public.events
  for each row execute function public.set_event_slug();

-- Backfill oldest-first so existing duplicates number by creation order.
do $$
declare r record;
begin
  for r in
    select id, organization_id, name from public.events
    where slug is null order by created_at asc
  loop
    update public.events
    set slug = public.next_event_slug(r.organization_id, r.name, r.id)
    where id = r.id;
  end loop;
end $$;

create unique index if not exists events_org_slug_uniq
  on public.events(organization_id, slug);

-- Anonymous resolvers used by the shareable slug routes.
create or replace function public.resolve_event_by_slugs(p_client_slug text, p_event_slug text)
returns uuid language sql stable security definer set search_path = public as $$
  select e.id
  from public.events e
  join public.organizations o on o.id = e.organization_id
  where lower(o.subdomain) = lower(p_client_slug)
    and lower(e.slug) = lower(p_event_slug)
  limit 1
$$;
grant execute on function public.resolve_event_by_slugs(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
