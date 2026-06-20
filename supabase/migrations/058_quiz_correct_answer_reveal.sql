-- Store the correct answer ID in event_state so it can be broadcast to players
-- at reveal time. The game config redacts correctAnswerId for all live surfaces
-- (migration 041), so this column is the only way players learn which answer was right.
-- Cleared when the facilitator moves to the next question.

ALTER TABLE public.event_state
  ADD COLUMN IF NOT EXISTS quiz_correct_answer_id text DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
