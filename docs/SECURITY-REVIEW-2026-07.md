# Security Review - July 2026

Working branch: `security-fixes`

This log captures the July 2026 review findings from the app/code pass plus
the Supabase Security Advisor, Performance Advisor, and query-performance
exports. It is intentionally split into phases so each batch can be tested and
reverted independently.

## Phase 1 - landed on `security-fixes` as V2.4.8

- Tablet kiosk event listing now requires a valid `tablet_sessions` token in
  `get_tablet_events_for_org(p_org_id, p_token)`. The old one-argument RPC is
  dropped so active/ready/demo event metadata is no longer returned before PIN
  authentication.
- `handle_new_user()` no longer trusts `raw_user_meta_data` for authorization
  fields. It creates a placeholder profile with `role = event_manager`,
  `organization_id = null`, and `must_change_password = false`; trusted Edge
  Functions assign the real role/org after creating the Auth user.
- User-management Edge Functions no longer write authorization fields
  (`role`, `organization_id`, `must_change_password`) into Auth
  `user_metadata`, and now fail loudly if the authoritative `profiles` write
  fails.
- `organization-logos` storage writes are restricted to paths beginning with the
  caller's organization UUID, unless the caller is a super admin. A scoped
  authenticated SELECT policy remains for upsert/list/delete workflows.
- Broad public listing policies were removed from public storage buckets:
  `organization-logos` and `game-assets`. Public object URLs remain the intended
  read path for already-known media URLs.
- First `SECURITY DEFINER` grant cleanup: obvious admin/scoring/lifecycle RPCs
  lost implicit `PUBLIC`/anon execute, and trigger-only functions lost direct
  anon/authenticated execute.

## Security Advisor Findings

### RLS enabled, no policy

Reported tables:

- `bingo_run_secrets`
- `signup_attempts`
- `tablet_login_attempts`
- `tablet_sessions`

Assessment: these are internal tables managed by service-role code or
`SECURITY DEFINER` RPCs. RLS with no policies plus revoked direct grants is
intentional. Do not add public access policies just to silence the advisor. If
needed, add explicit deny-all policies or comments in a later migration.

### SECURITY DEFINER executable by anon/authenticated

The advisor reported many `SECURITY DEFINER` functions callable through default
`PUBLIC` execute inheritance. Phase 1 fixes the obvious admin/destructive and
trigger-only subset. Remaining functions need to be categorized before changing
grants:

- Public by design: tenant lookup, login-email resolution, tablet PIN/session
  verification, live-event bootstrap, live redacted game lookup.
- Authenticated app RPCs: user management, promo codes, event lifecycle,
  scoring/restart helpers, support/onboarding.
- Trigger-only/internal helpers: should generally revoke direct execute.
- RLS helper functions: change carefully and test every affected table policy.

### Auth metadata trust

`handle_new_user()` previously accepted `role` and `organization_id` from
`raw_user_meta_data`, which is unsafe if normal Supabase Auth signup is enabled.
Phase 1 restores a safe placeholder trigger model. Edge Functions remain the
source of truth for profile authorization assignments.

### Public storage listing

Advisor reported public read/listing policies on `game-assets` and
`organization-logos`. Phase 1 removes broad public SELECT policies and keeps
scoped authenticated SELECT where uploads/upserts/list/delete need it.

## Performance Advisor Findings

### RLS performance

Advisor counts from the July export:

- `auth_rls_initplan`: 21 policies
- `multiple_permissive_policies`: 29 policy combinations

Plan:

- Wrap `auth.uid()` and stable helper calls in `(select ...)` where applicable.
- Consolidate duplicate own-org + super-admin permissive policies where safe.
- Rerun advisors after each table group rather than changing all RLS at once.

### Missing foreign-key indexes

Advisor reported 19 FK-side columns lacking direct indexes. Add them in the
performance phase, prioritizing high-write/high-delete tables and live-event
joins. Also add a targeted composite index for the hot live query:

```sql
create index if not exists submissions_event_created_at_idx
  on public.submissions (event_id, created_at desc);
```

Do not blindly drop "unused indexes" yet. The advisor list should be checked
after a meaningful production usage window and a rollback plan.

## Query Performance Snapshot

Main observations:

- Supabase Realtime internals dominate total time. That is expected for live
  events, but we should watch channel volume and reconnect behavior.
- `event_state` polling appears often. The current 4-second safety poll is
  intentional for anonymous live screens but should stay isolated and cheap.
- `support_unread_ticket_count` averaged around 13ms in the export; review the
  support message/read indexes during the performance phase.
- `get_live_event_games` is modest but frequent; keep it redacted and indexed
  around `event_games.event_id`.

## Code Health Findings

- `FacilitatorEventPage.tsx`, `JoinGameView.tsx`, and `use-live-event.ts` are
  the main complexity hotspots. Refactor them only after the security/database
  work is stable.
- `rejectSubmission()` should mirror `approveSubmission()` and only process
  pending submissions. Otherwise a processed submission can be changed to
  rejected without reversing points.
- Route-level lazy loading is mostly absent; `router.tsx` imports nearly every
  page upfront. This explains the large bundle warning and belongs in an
  engineering-health phase, not this security batch.
