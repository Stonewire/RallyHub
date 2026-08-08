-- Supabase advisor: unindexed foreign keys on live-path tables (8 Aug).
-- Only tables touched during live events; signature-manager and billing
-- tables left alone.
create index if not exists inventory_orders_team_id_idx on public.inventory_orders (team_id);
create index if not exists inventory_orders_organization_id_idx on public.inventory_orders (organization_id);
create index if not exists inventory_order_items_item_id_idx on public.inventory_order_items (inventory_item_id);
create index if not exists inventory_purchases_team_id_idx on public.inventory_purchases (team_id);
create index if not exists event_puzzle_progress_team_id_idx on public.event_puzzle_progress (team_id);
create index if not exists event_puzzle_progress_game_id_idx on public.event_puzzle_progress (game_id);
create index if not exists event_performance_segments_team_id_idx on public.event_performance_segments (team_id);
create index if not exists event_performance_segments_game_id_idx on public.event_performance_segments (game_id);
create index if not exists client_diagnostics_team_id_idx on public.client_diagnostics (team_id);
create index if not exists submissions_reviewed_by_idx on public.submissions (reviewed_by);

-- Advisor-suggested: dashboard activity queries filter submissions by created_at.
create index if not exists submissions_created_at_idx on public.submissions using btree (created_at);
