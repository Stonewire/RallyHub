-- Participant pages normally use the anon role, but a facilitator may test the
-- join flow in a browser that already has an authenticated session. These RPCs
-- remain protected by the live event join token; purchases additionally require
-- the private per-device team token. Granting EXECUTE to authenticated therefore
-- makes role selection robust without granting access to another team or event.
grant execute on function
  public.get_inventory_item_for_purchase(uuid, uuid),
  public.claim_team_with_inventory_access(uuid, uuid, text, text),
  public.purchase_inventory_item(uuid, uuid, text)
  to authenticated;
