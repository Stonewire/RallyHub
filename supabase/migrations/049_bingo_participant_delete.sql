-- ═══════════════════════════════════════════════════════════════════════════
-- RUN THIS IN SUPABASE — Phase 3 follow-up: restore participant bingo selection
-- ═══════════════════════════════════════════════════════════════════════════
-- Bug: 048 granted anon only select/insert/update on submissions. Bingo cell
-- toggling (deselect / re-tap to clear) DELETEs the pending submission, so under
-- 048 every bingo deselect failed (no anon delete grant or policy). Quiz/photo
-- never delete, so only bingo selection broke.
--
-- Fix: allow anon (join-token) participants to DELETE their OWN PENDING
-- submissions only. They still cannot delete approved/rejected rows (can't erase
-- a scored result), cannot set points, and cannot touch other events — the
-- status='pending' guard plus the per-event join-token check preserve Phase 3
-- security. A DELETE guard trigger blocks deleting already-scored rows even if a
-- future policy widens.

-- ─── Guard: anon may only delete pending submissions ───────────────────────

create or replace function public.submissions_guard_participant_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() = 'anon' then
    if OLD.status is distinct from 'pending' then
      raise exception 'Participants can only delete pending submissions';
    end if;
  end if;
  return OLD;
end;
$$;

drop trigger if exists submissions_guard_participant_delete on public.submissions;
create trigger submissions_guard_participant_delete
before delete on public.submissions
for each row
execute function public.submissions_guard_participant_delete();

-- ─── Policy + grant: anon delete of own pending submissions ────────────────

drop policy if exists "submissions_anon_delete_own" on public.submissions;
create policy "submissions_anon_delete_own"
on public.submissions for delete to anon
using (
  public.live_join_token_matches_event(event_id)
  and status = 'pending'
);

grant select, insert, update, delete on public.submissions to anon;
