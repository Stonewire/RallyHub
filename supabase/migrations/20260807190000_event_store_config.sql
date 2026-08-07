-- The event Store: which inventory items are on sale at this event, how many
-- exist in total, and how many one team may take. Stored as jsonb beside
-- teams_config and stages_config, which are the same shape of decision (the
-- organiser's plan for the event) and are edited in the same designer form.
-- Actual purchases live in inventory_purchases, so remaining stock is always
-- derived rather than mutated here.
--
-- Shape: [{ "itemId": uuid, "totalStock": int, "perTeamLimit": int }]
--
-- Applied to production 7 Aug 2026 via MCP apply_migration.
alter table public.events
  add column if not exists store_config jsonb not null default '[]'::jsonb;

comment on column public.events.store_config is
  'Event store: [{itemId, totalStock, perTeamLimit}]. Purchases live in inventory_purchases.';
