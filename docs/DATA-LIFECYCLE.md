# Event and client data lifecycle

Last reviewed: 15 July 2026

Permanent deletion is Storage-first. The database queues cleanup, the
`data-lifecycle` Edge Function removes files through the Supabase Storage API,
and only then is the corresponding database data wiped. Failed work remains in
the private retry queue and is picked up by the next daily run.

## Behaviour

- Deleting an event moves it to the Bin for 30 days. Its media remains available
  so Restore is complete.
- **Delete permanently** in the event Bin removes the event's submissions, team
  photos/videos, custom event logo folder (including superseded uploads) and
  database data immediately. Legacy single-file event logos are removed by exact
  path so another event's branding cannot be touched.
- Bin events are automatically queued after 30 days.
- Activated events are automatically queued after the existing six-month
  retention period.
- Invoiced events that an older database-only purge already marked as wiped are
  backfilled into the new queue, because their retained event row still provides
  a trustworthy Storage prefix.
- A super admin's permanent client deletion removes every event folder, the
  organization's complete `game-assets` and `organization-logos` folders, all
  organization database data, and all organization Auth users.
- A client admin can request account deletion in Organization Settings. Paddle
  renewal is scheduled to stop and the organization remains restorable for 30
  days. Restoring cancels the queued cleanup and attempts to restore renewal.
- Shared platform-library assets are never deleted as part of client cleanup.

Supabase Storage deletion uses the Storage API in batches of at most 1,000
objects, as required by Supabase. SQL never deletes rows from `storage.objects`.

## One-time deployment setup

1. Apply migration `20260715134305_data_lifecycle_and_pricing.sql`.
2. Deploy the `data-lifecycle` Edge Function with JWT verification disabled as
   declared in `supabase/config.toml`.
3. Create a long random secret and save it as the Edge Function secret
   `DATA_LIFECYCLE_CRON_SECRET`.
4. In Supabase Vault, create:
   - `project_url` = the project's `https://<project-ref>.supabase.co` URL.
   - `data_lifecycle_cron_secret` = exactly the same random value from step 3.
5. Confirm the `data-lifecycle-worker` job exists in Supabase Cron. The migration
   schedules it for 03:15 UTC each day.

The worker authenticates with the custom secret rather than exposing the
service-role key to Cron. User-triggered actions separately validate the signed-in
user and require client-admin/super-admin ownership.

## Verification checklist

- Request and cancel organization deletion from a client-admin account.
- Confirm Paddle shows, then clears, the scheduled cancellation.
- Soft-delete and restore an event; its media must still load.
- Permanently delete a throwaway event containing a team photo and submission;
  verify its `<event-id>/` Storage prefix is empty before checking DB removal.
- Delete a throwaway client with an org logo, game asset, event upload and test
  user; verify both Storage prefixes, the organization row and Auth user are gone.
- Invoke the daily worker with the cron secret and confirm an empty queue returns
  `claimed: 0` without an error.
