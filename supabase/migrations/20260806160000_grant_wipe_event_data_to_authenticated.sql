-- wipe_event_data was only executable by service_role, so every in-app call
-- (client admin deleting their event, super admin deleting a client's event)
-- failed with 42501 "permission denied for function". Its sibling routines
-- (reset_event_data, permanently_delete_game) already carry this grant; the
-- function itself enforces who may wipe which event.
--
-- Applied to production on 6 Aug 2026 via MCP apply_migration and verified:
-- simulated authenticated calls as a client_admin (own org) and a super_admin
-- (other org) both succeed; before the grant both failed with 42501.
grant execute on function public.wipe_event_data(uuid) to authenticated;
