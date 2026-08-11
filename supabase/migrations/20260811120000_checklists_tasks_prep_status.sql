-- Checklists, tasks, and per-game prep status.
-- Additive and backward-compatible: every existing row gets a valid default,
-- so live events with no checklist/task/prep data keep working unchanged.
-- Apply to production via MCP apply_migration, then hand-edit src/types/database.ts.

-- 1. Per-game prep status (internal readiness tracking).
--    Deliberately SEPARATE from the dormant games.status publish column.
alter table public.games
  add column if not exists prep_status text not null default 'draft';

alter table public.games
  drop constraint if exists games_prep_status_check;
alter table public.games
  add constraint games_prep_status_check
  check (prep_status in ('draft', 'in_progress', 'done', 'needs_attention'));

-- 2. Per-team checklist of physical items on inventory (store) items.
alter table public.inventory_items
  add column if not exists checklist_items text[] not null default '{}';

-- 3. Event checklist tick-state: { "teamCount": <int>, "checked": { "<name>": true } }.
--    Ticks are ignored on load when the stored teamCount no longer matches the
--    event's team_count, which gives the required reset-on-team-count-change.
alter table public.events
  add column if not exists checklist_state jsonb not null default '{}'::jsonb;

-- 4. Event task list. Its own table so task edits never touch the event form's
--    dirty/autosave flow. organization_id is denormalised for the org-scoped RLS.
create table if not exists public.event_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  assignee text,
  description text,
  due_date date,
  status text not null default 'todo',
  list_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_tasks_status_check check (status in ('todo', 'in_progress', 'blocked', 'done'))
);

create index if not exists event_tasks_event_id_idx on public.event_tasks (event_id, list_order);

alter table public.event_tasks enable row level security;

drop policy if exists event_tasks_org_all on public.event_tasks;
create policy event_tasks_org_all on public.event_tasks
  for all to authenticated
  using ((organization_id = (select public.user_organization_id())) or (select public.is_super_admin()))
  with check ((organization_id = (select public.user_organization_id())) or (select public.is_super_admin()));

drop trigger if exists event_tasks_set_updated_at on public.event_tasks;
create trigger event_tasks_set_updated_at
  before update on public.event_tasks
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
