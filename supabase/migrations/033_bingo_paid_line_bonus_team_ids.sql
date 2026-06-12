-- Persist line-bonus payouts per bingo run so teams are not re-awarded on every reveal (audit C7).

alter table public.bingo_runs
  add column if not exists paid_line_bonus_team_ids jsonb not null default '[]'::jsonb;

comment on column public.bingo_runs.paid_line_bonus_team_ids is
  'Team IDs that have already received bingo_line_points for this run (win condition met once).';
