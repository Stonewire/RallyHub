# Media Capture Investigation: Revert + Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Roll `main` back to the known-good V2.20.0 baseline, then ship a permanent, minimal client-error-capture mechanism so the next round of camera/upload failures gets diagnosed from real evidence instead of guessed at.

**Architecture:** A single new table (`client_diagnostics`) written via a fire-and-forget REST insert from a small client utility (`reportClientIssue`), wired into the five places that currently fail silently or with a generic message. RLS mirrors the existing `submissions` anon-write pattern (join-token gated), reusing established precedent rather than inventing new access rules.

**Tech Stack:** Supabase (Postgres + RLS + generated-by-hand TS types), React/TypeScript client, Vitest.

## Global Constraints

- Every push to `main` bumps `APP_VERSION` in `src/lib/version.ts` (three-number versioning) and adds a `CHANGELOG.md` entry — per `CLAUDE.md`.
- No em dashes or en dashes in user-facing copy or docs (project convention) — this plan document itself is internal, but any CHANGELOG/TRACKER prose written by a task must follow it.
- `npm run build`, `npm run lint`, and `npx vitest run` must pass before any push.
- Bug fixes push straight to `main` without asking (standing instruction from Rumen, 2026-07-30) — this plan is bug-fix-adjacent (reverting regressions, building the diagnostic tool needed to fix the rest), so each task's push happens without a separate approval request.
- Spec: `docs/superpowers/specs/2026-07-30-media-capture-investigation-design.md` (and its Phase 4 revision) — this plan implements Phases 0 and 1 only. Phases 2/3 are explicitly out of scope until real evidence exists.

---

## Task 1: Revert `main` to V2.20.0

Rolls back all six of today's commits (`39e0b2e` through `ecbb867`). No server-side files were touched by any of those six commits (confirmed via `git diff --stat a4fa36a..ecbb867 -- supabase/` returning empty), so this is a pure client-code rollback with no migration/data implications.

**Files:**
- Modify (restore to `a4fa36a`): `src/components/live/ChallengeMediaCaptureFlow.tsx`, `src/components/live/PhotoChallengeCapture.tsx`, `src/components/live/VideoChallengeCapture.tsx`, `src/lib/challenge-camera.ts`, `src/lib/media-permissions.ts`, `src/lib/supabase.ts`, `src/lib/video-recorder.ts`, `src/pages/live/JoinEventPage.tsx`
- Delete: `src/lib/challenge-camera.test.ts`, `src/lib/supabase.test.ts`, `src/lib/video-recorder.test.ts` (didn't exist at `a4fa36a`)
- Modify: `src/lib/version.ts`, `CHANGELOG.md`

**Interfaces:**
- Produces: every file above returns to its exact `a4fa36a` (V2.20.0) content. Later tasks that reference "the current/baseline code" in these files mean this restored state.

- [ ] **Step 1: Restore the eight modified files to their V2.20.0 content**

```bash
git checkout a4fa36a -- \
  src/components/live/ChallengeMediaCaptureFlow.tsx \
  src/components/live/PhotoChallengeCapture.tsx \
  src/components/live/VideoChallengeCapture.tsx \
  src/lib/challenge-camera.ts \
  src/lib/media-permissions.ts \
  src/lib/supabase.ts \
  src/lib/video-recorder.ts \
  src/pages/live/JoinEventPage.tsx
```

- [ ] **Step 2: Remove the three test files that didn't exist before today**

```bash
git rm src/lib/challenge-camera.test.ts src/lib/supabase.test.ts src/lib/video-recorder.test.ts
```

- [ ] **Step 3: Bump the version**

Edit `src/lib/version.ts`, change the `APP_VERSION` line to:

```ts
export const APP_VERSION = 'V2.20.7'
```

- [ ] **Step 4: Add the CHANGELOG entry**

Insert this new section immediately after the `# RallyHub Changelog` header block (before the existing `V2.20.6` entry) in `CHANGELOG.md`:

```markdown
## V2.20.7 - 2026-07-30 (revert today's camera/upload changes, restart investigation properly)

- Six commits today (V2.20.1 through V2.20.6) chased camera and upload bugs
  one guess at a time, each verified only in a sandboxed desktop browser.
  On real hardware, five distinct problems remained or worsened, including
  the core issue: photo/video submissions failing on both iPhone and Android
  with "fail to send a request to the edge function."
- Reverted `main` to `a4fa36a` (V2.20.0), the state before any of today's six
  commits. This is a deliberate, explicit tradeoff, not a clean win:
  - Removed (regressions from today, correctly undone): the black-screen
    Android video-record bug, the ~15-second live-track-reconfigure photo
    slowdown, and the `x-team-token` CORS-preflight bug that broke every
    submission.
  - Reintroduced (the original problems from before today, now back): the
    hard `min` resolution constraint that fails camera open outright on
    desktop and some tablets, and the original ~5 second full-resolution
    `ImageCapture` photo path.
- No server-side changes (migrations, Edge Functions) were touched by any of
  today's six commits, so this is a pure client rollback with no data or
  schema impact.
- Next: a permanent diagnostic-logging mechanism ships next (see
  `docs/superpowers/specs/2026-07-30-media-capture-investigation-design.md`)
  so the real root causes get diagnosed from evidence instead of guessed at
  again. No further camera/upload fixes ship until that evidence exists.
```

- [ ] **Step 5: Verify the app builds, lints, and tests clean**

```bash
npm run build
npm run lint
npx vitest run
```

Expected: all three pass. `vitest run` should report the same test count as
before today's six commits (three fewer test files than the pre-revert
count).

- [ ] **Step 6: Commit and push**

```bash
git add CHANGELOG.md src/lib/version.ts \
  src/components/live/ChallengeMediaCaptureFlow.tsx \
  src/components/live/PhotoChallengeCapture.tsx \
  src/components/live/VideoChallengeCapture.tsx \
  src/lib/challenge-camera.ts \
  src/lib/media-permissions.ts \
  src/lib/supabase.ts \
  src/lib/video-recorder.ts \
  src/pages/live/JoinEventPage.tsx
git commit -m "V2.20.7: revert today's camera/upload changes, restart investigation properly

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

## Task 2: `client_diagnostics` table, RLS, and generated types

**Files:**
- Create: `supabase/migrations/20260730040000_client_diagnostics.sql`
- Modify: `src/types/database.ts` (insert new table type block after the `submissions` block, i.e. between its closing `Relationships: []` / `}` and the `event_state: {` block)

**Interfaces:**
- Produces: Postgres table `public.client_diagnostics` with columns `id, created_at, event_id, team_id, context, platform, message, detail`. TypeScript type `Tables<'client_diagnostics'>` / `TablesInsert<'client_diagnostics'>` (via the existing `src/types/helpers.ts` generics) available to later tasks.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260730040000_client_diagnostics.sql`:

```sql
-- Media capture investigation (2026-07-30-media-capture-investigation-design.md):
-- durable, permanent capture of client-side failures that are otherwise
-- invisible (edge function calls, storage uploads, camera capture/record
-- exceptions, and the text-submit close-on-submit discrepancy) so real error
-- detail can be queried instead of guessed at.

create table if not exists public.client_diagnostics (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid references public.events(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  context text not null,
  platform text not null,
  message text not null,
  detail jsonb
);

create index if not exists client_diagnostics_created_at_idx
  on public.client_diagnostics (created_at desc);
create index if not exists client_diagnostics_event_id_idx
  on public.client_diagnostics (event_id);

alter table public.client_diagnostics enable row level security;

-- Anon can only INSERT, scoped to an event they hold a valid join token for
-- (same pattern as `submissions` in 041_event_join_token_scoping.sql). No
-- anon SELECT/UPDATE/DELETE.
drop policy if exists "client_diagnostics_anon_insert" on public.client_diagnostics;
create policy "client_diagnostics_anon_insert"
  on public.client_diagnostics for insert
  to anon
  with check (public.live_join_token_matches_event(event_id));

-- Only super admins can read it from the app; diagnosing this round of bugs
-- happens via direct SQL (service role), not an admin-UI reader.
drop policy if exists "client_diagnostics_super_admin_select" on public.client_diagnostics;
create policy "client_diagnostics_super_admin_select"
  on public.client_diagnostics for select
  to authenticated
  using ((select public.is_super_admin()));

revoke all on public.client_diagnostics from anon, authenticated;
grant insert on public.client_diagnostics to anon;
grant select on public.client_diagnostics to authenticated;
```

Note: `event_id` is NOT NULL-checked by the RLS policy itself (`with check
(public.live_join_token_matches_event(event_id))` requires a real, matching
event id — a null `event_id` would make that function return false and the
insert would be rejected). This means every caller of `reportClientIssue`
MUST pass a real `eventId`. Tasks 4 and 5 call it from places that already
have `eventId`/`event.id` directly in scope; Task 6 threads a new `eventId`
prop through to the two leaf capture components that don't currently receive
one, specifically so this holds for every call site with no bypass branch.

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP tool against project `rlnnhgnuprtatmhqxirb`:

```
mcp__723858ec-2e3b-40b1-98ed-d71bc15f86e1__apply_migration
  project_id: rlnnhgnuprtatmhqxirb
  name: client_diagnostics
  query: <the full SQL from Step 1>
```

- [ ] **Step 3: Verify the RLS policy manually**

Run via `mcp__723858ec-2e3b-40b1-98ed-d71bc15f86e1__execute_sql` against the
same project:

```sql
-- Accept case: real join token for a real event.
select set_config(
  'request.headers',
  json_build_object('x-join-token', (select join_token from public.events limit 1))::text,
  true
);
set local role anon;
insert into public.client_diagnostics (event_id, context, platform, message)
values ((select id from public.events limit 1), 'rls-smoke-test', 'other', 'accept case');
reset role;

-- Reject case: wrong/missing join token for the same event.
select set_config('request.headers', '{"x-join-token":"not-the-real-token"}', true);
set local role anon;
insert into public.client_diagnostics (event_id, context, platform, message)
values ((select id from public.events limit 1), 'rls-smoke-test', 'other', 'reject case');
-- Expected: this insert raises a row-level security policy violation.
reset role;

-- Clean up the accepted test row and confirm nothing else got through.
delete from public.client_diagnostics where context = 'rls-smoke-test';
select count(*) as leftover from public.client_diagnostics where context = 'rls-smoke-test';
-- Expected: leftover = 0.
```

Expected: the accept case succeeds silently, the reject case errors with a
row-level security policy violation, and the cleanup query confirms 0 rows
remain.

- [ ] **Step 4: Add the TypeScript type block**

In `src/types/database.ts`, insert this block immediately after the
`submissions` table's closing `Relationships: []` and `}` (i.e. right before
the `event_state: {` block):

```ts
      client_diagnostics: {
        Row: {
          id: string
          created_at: string
          event_id: string | null
          team_id: string | null
          context: string
          platform: string
          message: string
          detail: Json | null
        }
        Insert: {
          id?: string
          event_id?: string | null
          team_id?: string | null
          context: string
          platform: string
          message: string
          detail?: Json | null
        }
        Update: {
          event_id?: string | null
          team_id?: string | null
          context?: string
          platform?: string
          message?: string
          detail?: Json | null
        }
        Relationships: []
      }
```

- [ ] **Step 5: Verify the app still builds**

```bash
npm run build
```

Expected: succeeds (this step only adds a type, no runtime code references it
yet).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260730040000_client_diagnostics.sql src/types/database.ts
git commit -m "feat: add client_diagnostics table for real-device error capture

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

(No push yet — this is an intermediate commit; the feature ships as one push
at the end of Task 6.)

---

## Task 3: `client-diagnostics.ts` utility (TDD)

**Files:**
- Create: `src/lib/client-diagnostics.ts`
- Create: `src/lib/client-diagnostics.test.ts`

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase` (default export of the file, unchanged by the revert); `TablesInsert<'client_diagnostics'>` from `@/types/helpers` (produced by Task 2).
- Produces:
  - `type DiagnosticContext = 'join-team-photo' | 'submission-upload' | 'text-submit' | 'photo-capture' | 'video-record'`
  - `type DiagnosticPlatform = 'ios' | 'android' | 'desktop' | 'other'`
  - `type DiagnosticExtra = Record<string, string | number | boolean | null>`
  - `type DiagnosticOptions = { eventId?: string | null; teamId?: string | null; extra?: DiagnosticExtra }`
  - `function detectPlatform(): DiagnosticPlatform`
  - `function diagnosticSummary(error: unknown): string`
  - `function buildDiagnosticPayload(context: DiagnosticContext, error: unknown, options?: DiagnosticOptions): TablesInsert<'client_diagnostics'>`
  - `function reportClientIssue(context: DiagnosticContext, error: unknown, options?: DiagnosticOptions): string`
  - These four functions/types are what Tasks 4, 5, and 6 import and call.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/client-diagnostics.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import {
  buildDiagnosticPayload,
  detectPlatform,
  diagnosticSummary,
  reportClientIssue,
} from '@/lib/client-diagnostics'
import { supabase } from '@/lib/supabase'

describe('diagnosticSummary', () => {
  it('formats an Error as "Name: message"', () => {
    const err = new TypeError('Failed to fetch')
    expect(diagnosticSummary(err)).toBe('TypeError: Failed to fetch')
  })

  it('stringifies a non-Error throwable', () => {
    expect(diagnosticSummary('plain string failure')).toBe('plain string failure')
  })
})

describe('buildDiagnosticPayload', () => {
  it('captures context, message, and a null event/team id when not provided', () => {
    const err = new Error('boom')
    const payload = buildDiagnosticPayload('photo-capture', err)
    expect(payload.context).toBe('photo-capture')
    expect(payload.message).toBe('Error: boom')
    expect(payload.event_id).toBeNull()
    expect(payload.team_id).toBeNull()
    const detail = payload.detail as { name: string; stack: string | null }
    expect(detail.name).toBe('Error')
    expect(typeof detail.stack === 'string' || detail.stack === null).toBe(true)
  })

  it('carries event/team ids and extra context through when provided', () => {
    const payload = buildDiagnosticPayload('submission-upload', new Error('x'), {
      eventId: 'event-1',
      teamId: 'team-1',
      extra: { mediaType: 'video' },
    })
    expect(payload.event_id).toBe('event-1')
    expect(payload.team_id).toBe('team-1')
    const detail = payload.detail as { extra: Record<string, unknown> }
    expect(detail.extra).toEqual({ mediaType: 'video' })
  })
})

describe('detectPlatform', () => {
  it('returns one of the four known platform tags', () => {
    expect(['ios', 'android', 'desktop', 'other']).toContain(detectPlatform())
  })
})

describe('reportClientIssue', () => {
  it('never throws even when the underlying insert rejects', () => {
    vi.spyOn(supabase, 'from').mockReturnValue({
      insert: () => Promise.reject(new Error('insert failed')),
    } as never)
    expect(() => reportClientIssue('photo-capture', new Error('boom'))).not.toThrow()
    vi.restoreAllMocks()
  })

  it('never throws even when supabase.from itself throws synchronously', () => {
    vi.spyOn(supabase, 'from').mockImplementation(() => {
      throw new Error('client unavailable')
    })
    expect(() => reportClientIssue('video-record', new Error('boom'))).not.toThrow()
    vi.restoreAllMocks()
  })

  it('returns the same summary diagnosticSummary would produce', () => {
    const err = new Error('boom')
    expect(reportClientIssue('video-record', err)).toBe(diagnosticSummary(err))
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/lib/client-diagnostics.test.ts
```

Expected: FAIL — `src/lib/client-diagnostics.ts` does not exist yet, so the
import fails to resolve.

- [ ] **Step 3: Write the implementation**

Create `src/lib/client-diagnostics.ts`:

```ts
import { supabase } from '@/lib/supabase'
import type { TablesInsert } from '@/types/helpers'

export type DiagnosticContext =
  | 'join-team-photo'
  | 'submission-upload'
  | 'text-submit'
  | 'photo-capture'
  | 'video-record'

export type DiagnosticPlatform = 'ios' | 'android' | 'desktop' | 'other'

export type DiagnosticExtra = Record<string, string | number | boolean | null>

export type DiagnosticOptions = {
  eventId?: string | null
  teamId?: string | null
  extra?: DiagnosticExtra
}

/** Coarse platform tag for filtering client_diagnostics rows. */
export function detectPlatform(): DiagnosticPlatform {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  if (/Macintosh|Windows|Linux/i.test(ua) && !/Mobi/i.test(ua)) return 'desktop'
  return 'other'
}

/** Short human-readable summary, safe to append to an existing notify() message. */
export function diagnosticSummary(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}

/** Builds the exact row reportClientIssue inserts — exported for isolated testing. */
export function buildDiagnosticPayload(
  context: DiagnosticContext,
  error: unknown,
  options?: DiagnosticOptions,
): TablesInsert<'client_diagnostics'> {
  const name = error instanceof Error ? error.name : 'UnknownError'
  const stack = error instanceof Error && error.stack ? error.stack.slice(0, 2000) : null

  return {
    event_id: options?.eventId ?? null,
    team_id: options?.teamId ?? null,
    context,
    platform: detectPlatform(),
    message: diagnosticSummary(error),
    detail: {
      name,
      stack,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      extra: options?.extra ?? null,
    },
  }
}

/**
 * Fire-and-forget: captures a currently-mysterious client failure to
 * `client_diagnostics` and returns a short summary the caller can append to
 * their existing notify() message. Never throws and never awaits the insert
 * in a way that could block the caller — losing a diagnostic row is
 * acceptable, hanging the UI to log one is not.
 */
export function reportClientIssue(
  context: DiagnosticContext,
  error: unknown,
  options?: DiagnosticOptions,
): string {
  try {
    const payload = buildDiagnosticPayload(context, error, options)
    void supabase
      .from('client_diagnostics')
      .insert(payload)
      .then(
        () => {},
        () => {},
      )
  } catch {
    // Logging must never break the caller's flow.
  }
  return diagnosticSummary(error)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/lib/client-diagnostics.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Run the full suite and lint to confirm no regressions**

```bash
npm run lint
npx vitest run
npm run build
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/client-diagnostics.ts src/lib/client-diagnostics.test.ts
git commit -m "feat: add reportClientIssue diagnostic-capture utility

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Wire diagnostics into the join-team-photo path

**Files:**
- Modify: `src/pages/live/JoinEventPage.tsx`

**Interfaces:**
- Consumes: `reportClientIssue`, `type DiagnosticContext` from `@/lib/client-diagnostics` (Task 3).

- [ ] **Step 1: Wrap the photo-upload call in `claimTeam`**

In `src/pages/live/JoinEventPage.tsx`, find this block inside `claimTeam()`
(restored by Task 1 to its V2.20.0 content):

```ts
      let photoUrl: string | null = claimSlot.photo_url
      if (claimPhoto) {
        photoUrl = await uploadParticipantAsset(
          eventId,
          `${eventId}/teams/${claimSlot.id}/${Date.now()}.jpg`,
          claimPhoto,
          { mediaKind: 'photo' },
        )
      }
```

Replace it with:

```ts
      let photoUrl: string | null = claimSlot.photo_url
      if (claimPhoto) {
        try {
          photoUrl = await uploadParticipantAsset(
            eventId,
            `${eventId}/teams/${claimSlot.id}/${Date.now()}.jpg`,
            claimPhoto,
            { mediaKind: 'photo' },
          )
        } catch (err) {
          const detail = reportClientIssue('join-team-photo', err, {
            eventId,
            teamId: claimSlot.id,
          })
          throw new Error(`Could not upload team photo (${detail})`)
        }
      }
```

- [ ] **Step 2: Add the import**

Add near the top of `src/pages/live/JoinEventPage.tsx`, alongside the other
`@/lib/*` imports:

```ts
import { reportClientIssue } from '@/lib/client-diagnostics'
```

- [ ] **Step 3: Verify the existing catch still surfaces the detail**

`claimTeam()`'s outer `catch (err)` already does
`setClaimError(err instanceof Error ? err.message : 'Could not join team')`
— unchanged. Because the new `throw new Error(...)` above includes the
`detail` string in its message, that detail now reaches `claimError` and
renders on screen without any further change.

- [ ] **Step 4: Build, lint, test**

```bash
npm run build
npm run lint
npx vitest run
```

Expected: all pass (no test exercises this exact catch path yet — this is a
UI wiring change verified by manual reproduction in Phase 2, not a unit
test).

- [ ] **Step 5: Commit**

```bash
git add src/pages/live/JoinEventPage.tsx
git commit -m "feat: capture join-team-photo upload failures to client_diagnostics

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Wire diagnostics into `JoinGameView`'s submission paths

**Files:**
- Modify: `src/components/live/JoinGameView.tsx`

**Interfaces:**
- Consumes: `reportClientIssue` from `@/lib/client-diagnostics` (Task 3).

- [ ] **Step 1: Wrap the upload call in `submitOpenGame`**

Find this block inside `submitOpenGame(file, game)` (restored by Task 1):

```ts
      const url = minted
        ? await uploadToMintedParticipantUrl(minted, file, { mediaKind: kind })
        : await uploadParticipantAsset(
            event.id,
            `${event.id}/submissions/${teamId}/${crypto.randomUUID()}${game.type === 'video' ? '.mp4' : '.jpg'}`,
            file,
            { mediaKind: kind },
          )
```

Replace it with:

```ts
      let url: string
      try {
        url = minted
          ? await uploadToMintedParticipantUrl(minted, file, { mediaKind: kind })
          : await uploadParticipantAsset(
              event.id,
              `${event.id}/submissions/${teamId}/${crypto.randomUUID()}${game.type === 'video' ? '.mp4' : '.jpg'}`,
              file,
              { mediaKind: kind },
            )
      } catch (err) {
        const detail = reportClientIssue('submission-upload', err, {
          eventId: event.id,
          teamId,
          extra: { gameId: game.id, mediaType: kind },
        })
        throw new Error(`Could not upload submission (${detail})`)
      }
```

- [ ] **Step 2: Surface the detail in the existing catch**

`submitOpenGame`'s existing catch block currently reads:

```ts
    } catch (err) {
      if (optimistic) {
        setOpenSubmissionWrite(optimistic.id, false)
        mergeOwnSubmission('DELETE', undefined, { id: optimistic.id })
        setSelectedGame(game)
      }
      const msg =
        err instanceof Error && err.message.includes('must be')
          ? err.message
          : "Couldn't submit — tap to retry"
      notify(msg)
      setSubmitting(false)
    }
```

Replace the `msg` computation so the upload-failure detail (already embedded
in the thrown error's message by Step 1) shows on screen instead of the
generic string:

```ts
    } catch (err) {
      if (optimistic) {
        setOpenSubmissionWrite(optimistic.id, false)
        mergeOwnSubmission('DELETE', undefined, { id: optimistic.id })
        setSelectedGame(game)
      }
      const msg =
        err instanceof Error && (err.message.includes('must be') || err.message.includes('Could not upload'))
          ? err.message
          : "Couldn't submit — tap to retry"
      notify(msg)
      setSubmitting(false)
    }
```

- [ ] **Step 3: Instrument `submitTextGame`**

Find this block inside `submitTextGame(mediaUrl, game)` (restored by Task 1):

```ts
    beginOpenSubmit()
    let optimistic: Tables<'submissions'> | null = null
    try {
      optimistic = optimisticOpenSubmission(game, mediaUrl, 'text')
      // Calling .then() starts the request now; the UI below does not await its
      // response. RLS and the participant-write trigger still validate the real
      // insert before the facilitator can ever receive it.
      const write = supabase
        .from('submissions')
        .insert({
          id: optimistic.id,
          event_id: event.id,
          team_id: teamId,
          game_id: game.id,
          media_url: mediaUrl,
          media_type: 'text',
          status: 'pending',
        })
        .select()
        .single()
        .then((result) => result)

      setOpenSubmissionWrite(optimistic.id, true)
      mergeOwnSubmission('INSERT', optimistic)
      finishOpenSubmitOptimistically()
```

This flow is fire-and-forget by design (the UI closes before `write`
resolves), so a failure inside it wouldn't naturally reach a `catch` in time
to explain why the screen didn't close. Wrap the two calls between
`beginOpenSubmit()` and the `await write` line individually so a synchronous
throw from either is captured without changing the optimistic-close timing:

```ts
    beginOpenSubmit()
    let optimistic: Tables<'submissions'> | null = null
    try {
      optimistic = optimisticOpenSubmission(game, mediaUrl, 'text')
      // Calling .then() starts the request now; the UI below does not await its
      // response. RLS and the participant-write trigger still validate the real
      // insert before the facilitator can ever receive it.
      const write = supabase
        .from('submissions')
        .insert({
          id: optimistic.id,
          event_id: event.id,
          team_id: teamId,
          game_id: game.id,
          media_url: mediaUrl,
          media_type: 'text',
          status: 'pending',
        })
        .select()
        .single()
        .then((result) => result)

      setOpenSubmissionWrite(optimistic.id, true)
      mergeOwnSubmission('INSERT', optimistic)
      try {
        finishOpenSubmitOptimistically()
      } catch (err) {
        const detail = reportClientIssue('text-submit', err, {
          eventId: event.id,
          teamId,
          extra: { gameId: game.id },
        })
        throw new Error(`Could not finish submitting (${detail})`)
      }
```

The rest of `submitTextGame` (the `await write` handling) is unchanged, but
its own catch block currently swallows the error entirely and shows a fixed
message:

```ts
    } catch {
      if (optimistic) {
        setOpenSubmissionWrite(optimistic.id, false)
        mergeOwnSubmission('DELETE', undefined, { id: optimistic.id })
        setSelectedGame(game)
      }
      notify("Couldn't submit — tap to retry")
      setSubmitting(false)
    }
```

Change it to bind `err` and surface the detail thrown above (mirroring the
same pattern used for `submitOpenGame`'s catch in Step 2):

```ts
    } catch (err) {
      if (optimistic) {
        setOpenSubmissionWrite(optimistic.id, false)
        mergeOwnSubmission('DELETE', undefined, { id: optimistic.id })
        setSelectedGame(game)
      }
      const msg =
        err instanceof Error && err.message.includes('Could not finish submitting')
          ? err.message
          : "Couldn't submit — tap to retry"
      notify(msg)
      setSubmitting(false)
    }
```

- [ ] **Step 4: Add the import**

Add alongside the other `@/lib/*` imports in
`src/components/live/JoinGameView.tsx`:

```ts
import { reportClientIssue } from '@/lib/client-diagnostics'
```

- [ ] **Step 5: Build, lint, test**

```bash
npm run build
npm run lint
npx vitest run
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/live/JoinGameView.tsx
git commit -m "feat: capture submission-upload and text-submit failures to client_diagnostics

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Wire diagnostics into the camera/recorder leaf components

**Files:**
- Modify: `src/components/live/ChallengeMediaCaptureFlow.tsx` (thread `eventId` prop through)
- Modify: `src/components/live/PhotoChallengeCapture.tsx`
- Modify: `src/components/live/VideoChallengeCapture.tsx`
- Modify: `src/components/live/JoinGameView.tsx` (pass `eventId={event.id}` to `ChallengeMediaCaptureFlow`)

**Interfaces:**
- Consumes: `reportClientIssue` from `@/lib/client-diagnostics` (Task 3).
- Produces: `ChallengeMediaCaptureFlowProps` gains a required `eventId: string` field; `PhotoChallengeCapture`/`VideoChallengeCapture` props each gain a required `eventId: string` field. Any other future caller of these three components must be updated to pass it — there are no other callers in this codebase today (confirmed: `ChallengeMediaCaptureFlow` is only rendered from `JoinGameView.tsx`, and `PhotoChallengeCapture`/`VideoChallengeCapture` are only rendered from inside `ChallengeMediaCaptureFlow.tsx`).

- [ ] **Step 1: Add `eventId` to `ChallengeMediaCaptureFlowProps` and thread it through**

In `src/components/live/ChallengeMediaCaptureFlow.tsx`, the props type is:

```ts
type ChallengeMediaCaptureFlowProps = {
  title: string
  description?: string | null
  pointsLabel: string
  coverUrl?: string | null
  accentColor: string
  mediaType: 'photo' | 'video'
  config?: GameConfig | null
  disabled?: boolean
  onFileReady: (file: File) => void
  onCaptureActiveChange?: (active: boolean) => void
}
```

Add `eventId: string` to it:

```ts
type ChallengeMediaCaptureFlowProps = {
  title: string
  description?: string | null
  pointsLabel: string
  coverUrl?: string | null
  accentColor: string
  mediaType: 'photo' | 'video'
  config?: GameConfig | null
  disabled?: boolean
  eventId: string
  onFileReady: (file: File) => void
  onCaptureActiveChange?: (active: boolean) => void
}
```

Add `eventId` to the destructured function parameters (the
`export function ChallengeMediaCaptureFlow({ ... })` signature) alongside
`accentColor`.

Find where `PhotoChallengeCapture` and `VideoChallengeCapture` are rendered:

```ts
      {!useNativeForMedia && captureOpen && mediaType === 'photo' ? (
        <PhotoChallengeCapture
          accentColor={accentColor}
          disabled={disabled}
          onClose={closeInAppCapture}
          onFileReady={handleInAppFileReady}
        />
      ) : null}
      {!useNativeForMedia && captureOpen && mediaType === 'video' ? (
        <VideoChallengeCapture
          config={config}
          accentColor={accentColor}
          disabled={disabled}
          onClose={closeInAppCapture}
          onFileReady={handleInAppFileReady}
        />
      ) : null}
```

Add `eventId={eventId}` to both:

```ts
      {!useNativeForMedia && captureOpen && mediaType === 'photo' ? (
        <PhotoChallengeCapture
          accentColor={accentColor}
          disabled={disabled}
          eventId={eventId}
          onClose={closeInAppCapture}
          onFileReady={handleInAppFileReady}
        />
      ) : null}
      {!useNativeForMedia && captureOpen && mediaType === 'video' ? (
        <VideoChallengeCapture
          config={config}
          accentColor={accentColor}
          disabled={disabled}
          eventId={eventId}
          onClose={closeInAppCapture}
          onFileReady={handleInAppFileReady}
        />
      ) : null}
```

- [ ] **Step 2: Pass `eventId` from `JoinGameView`**

In `src/components/live/JoinGameView.tsx`, find the `ChallengeMediaCaptureFlow`
render call:

```ts
            <ChallengeMediaCaptureFlow
              title={activeOpenGame.name}
              description={activeOpenGame.description}
              pointsLabel={gamePointsDisplay(activeOpenGame)}
              coverUrl={activeOpenGame.cover_url}
              accentColor={accent}
              mediaType={activeOpenGame.type === 'video' ? 'video' : 'photo'}
              config={activeOpenGame.config as GameConfig}
              disabled={submitting}
              onCaptureActiveChange={setCaptureActive}
              onFileReady={(file) => void submitOpenGame(file, activeOpenGame)}
            />
```

Add `eventId={event.id}`:

```ts
            <ChallengeMediaCaptureFlow
              title={activeOpenGame.name}
              description={activeOpenGame.description}
              pointsLabel={gamePointsDisplay(activeOpenGame)}
              coverUrl={activeOpenGame.cover_url}
              accentColor={accent}
              mediaType={activeOpenGame.type === 'video' ? 'video' : 'photo'}
              config={activeOpenGame.config as GameConfig}
              disabled={submitting}
              eventId={event.id}
              onCaptureActiveChange={setCaptureActive}
              onFileReady={(file) => void submitOpenGame(file, activeOpenGame)}
            />
```

- [ ] **Step 3: Wire `reportClientIssue` into `PhotoChallengeCapture`**

In `src/components/live/PhotoChallengeCapture.tsx`, the props type is:

```ts
type PhotoChallengeCaptureProps = {
  accentColor: string
  disabled?: boolean
  onClose: () => void
  onFileReady: (file: File) => void
}

export function PhotoChallengeCapture({
  accentColor,
  disabled,
  onClose,
  onFileReady,
}: PhotoChallengeCaptureProps) {
```

Change to:

```ts
type PhotoChallengeCaptureProps = {
  accentColor: string
  disabled?: boolean
  eventId: string
  onClose: () => void
  onFileReady: (file: File) => void
}

export function PhotoChallengeCapture({
  accentColor,
  disabled,
  eventId,
  onClose,
  onFileReady,
}: PhotoChallengeCaptureProps) {
```

Find `capturePhoto()`:

```ts
  async function capturePhoto() {
    if (!streamRef.current || capturing) return
    setCapturing(true)
    try {
      const raw = await captureStillPhoto(streamRef.current, videoRef.current, { quarterTurn })
      const blob = await downscalePhoto(raw)
      revokeSnapshotUrl()
      const url = URL.createObjectURL(blob)
      snapshotUrlRef.current = url
      setSnapshotUrl(url)
      stopStream()
    } catch {
      notify('Could not capture photo — hold steady and try again')
    } finally {
      setCapturing(false)
    }
  }
```

Replace the catch block to capture and surface the real error:

```ts
  async function capturePhoto() {
    if (!streamRef.current || capturing) return
    setCapturing(true)
    try {
      const raw = await captureStillPhoto(streamRef.current, videoRef.current, { quarterTurn })
      const blob = await downscalePhoto(raw)
      revokeSnapshotUrl()
      const url = URL.createObjectURL(blob)
      snapshotUrlRef.current = url
      setSnapshotUrl(url)
      stopStream()
    } catch (err) {
      const detail = reportClientIssue('photo-capture', err, { eventId })
      notify(`Could not capture photo (${detail}) — hold steady and try again`)
    } finally {
      setCapturing(false)
    }
  }
```

Add the import:

```ts
import { reportClientIssue } from '@/lib/client-diagnostics'
```

- [ ] **Step 4: Wire `reportClientIssue` into `VideoChallengeCapture`**

In `src/components/live/VideoChallengeCapture.tsx`, the props type is:

```ts
type VideoChallengeCaptureProps = {
  config: GameConfig | null | undefined
  accentColor: string
  disabled?: boolean
  onClose: () => void
  onFileReady: (file: File) => void
}

export function VideoChallengeCapture({
  config,
  accentColor,
  disabled,
  onClose,
  onFileReady,
}: VideoChallengeCaptureProps) {
```

Change to:

```ts
type VideoChallengeCaptureProps = {
  config: GameConfig | null | undefined
  accentColor: string
  disabled?: boolean
  eventId: string
  onClose: () => void
  onFileReady: (file: File) => void
}

export function VideoChallengeCapture({
  config,
  accentColor,
  disabled,
  eventId,
  onClose,
  onFileReady,
}: VideoChallengeCaptureProps) {
```

Find `startRecording()`:

```ts
  function startRecording() {
    if (!streamRef.current) {
      uploadRef.current?.click()
      return
    }
    try {
      const recorder = createVideoRecorder(streamRef.current, maxSec)
      const mime = videoMimeForRecorder(recorder)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        playVideoStopSound()
        const blob = new Blob(chunksRef.current, { type: mime })
        chunksRef.current = []
        stopStream()
        if (blob.size > 0) {
          const ext = videoFileExtension(mime)
          void queueForReview(
            new File([blob], `recording-${Date.now()}.${ext}`, { type: mime }),
          )
        } else {
          void openPreview(facingMode)
        }
      }
      recorder.start(200)
      playVideoStartSound()
      setRecording(true)
      const started = Date.now()
      tickRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000)
        const left = Math.max(0, maxSec - elapsed)
        setRemaining(left)
        if (left <= 0) recorderRef.current?.stop()
      }, 200)
    } catch {
      notify('Could not start recording')
    }
  }
```

Replace the catch block:

```ts
  function startRecording() {
    if (!streamRef.current) {
      uploadRef.current?.click()
      return
    }
    try {
      const recorder = createVideoRecorder(streamRef.current, maxSec)
      const mime = videoMimeForRecorder(recorder)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        playVideoStopSound()
        const blob = new Blob(chunksRef.current, { type: mime })
        chunksRef.current = []
        stopStream()
        if (blob.size > 0) {
          const ext = videoFileExtension(mime)
          void queueForReview(
            new File([blob], `recording-${Date.now()}.${ext}`, { type: mime }),
          )
        } else {
          void openPreview(facingMode)
        }
      }
      recorder.start(200)
      playVideoStartSound()
      setRecording(true)
      const started = Date.now()
      tickRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000)
        const left = Math.max(0, maxSec - elapsed)
        setRemaining(left)
        if (left <= 0) recorderRef.current?.stop()
      }, 200)
    } catch (err) {
      const detail = reportClientIssue('video-record', err, { eventId })
      notify(`Could not start recording (${detail})`)
    }
  }
```

Also find `openPreview()`:

```ts
  async function openPreview(facing: ChallengeFacingMode) {
    const stream = await getChallengeCameraStream(facing, true)
    if (!stream) {
      notify('Camera access not granted — allow camera when the app opens, or upload a video')
      return
    }
    streamRef.current = stream
    setQuarterTurn(streamNeedsQuarterTurn(stream))
    setPreviewReady(true)
  }
```

`getChallengeCameraStream` at this baseline returns `MediaStream | null`
rather than throwing (confirmed in `src/lib/challenge-camera.ts` restored by
Task 1), so there's no error object to log here yet — leave this function
unchanged. The camera-open failure path itself is exactly the kind of thing
Phase 3 may need to change `getChallengeCameraStream`'s signature for; not
in scope for this plan.

Add the import:

```ts
import { reportClientIssue } from '@/lib/client-diagnostics'
```

- [ ] **Step 5: Build, lint, test**

```bash
npm run build
npm run lint
npx vitest run
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/live/ChallengeMediaCaptureFlow.tsx \
  src/components/live/PhotoChallengeCapture.tsx \
  src/components/live/VideoChallengeCapture.tsx \
  src/components/live/JoinGameView.tsx
git commit -m "feat: capture photo-capture and video-record failures to client_diagnostics

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: TRACKER.md entry, final verification, and ship

**Files:**
- Modify: `TRACKER.md`
- Modify: `src/lib/version.ts`
- Modify: `CHANGELOG.md`

**Interfaces:** none (documentation + release bookkeeping only).

- [ ] **Step 1: Add the TRACKER.md entry**

Append this bullet at the end of `TRACKER.md` (after the last existing
bullet):

```markdown
- [~] **DIAG-1** Client-side diagnostic logging (`client_diagnostics` table) — permanent capture of currently-mysterious failures (edge function calls, storage uploads, photo capture, video recording, and the text-submit close timing) with real error detail, both on-screen and queryable server-side. Ships as V2.20.8. Built after reverting V2.20.1-V2.20.6 (see `docs/superpowers/specs/2026-07-30-media-capture-investigation-design.md`) because those six commits were guessed and verified only in a sandboxed browser, never on real hardware. Root-cause fixes for the underlying failures are deferred to a follow-up spec once real evidence comes back from Rumen's iPhone and Android tablet.
```

- [ ] **Step 2: Bump the version**

Edit `src/lib/version.ts`:

```ts
export const APP_VERSION = 'V2.20.8'
```

- [ ] **Step 3: Add the CHANGELOG entry**

Insert immediately after the `# RallyHub Changelog` header block (before the
`V2.20.7` entry just added by Task 1):

```markdown
## V2.20.8 - 2026-07-30 (real-error capture for the camera/upload mysteries)

- Following the V2.20.7 revert, added a permanent `client_diagnostics` table
  and a small `reportClientIssue` utility, wired into every currently
  mysterious failure point: the join-team-photo upload, in-game photo/video
  submission upload, photo capture, video recording, and the text-submit
  close-on-submit timing.
- Each failure now shows its real error detail on screen (instead of a
  generic message) and is saved server-side, queryable by event/team/context/
  platform, so the next reproduction on a real device gives actual evidence
  instead of another guess.
- RLS on the new table mirrors the existing `submissions` anon-write pattern
  (join-token gated INSERT, no anon SELECT), reusing established precedent
  rather than inventing new access rules in an area (anon writes) that has
  already caused real incidents in this codebase.
- No root causes are fixed yet. Next step: reproduce bugs 1-4 from
  `docs/superpowers/specs/2026-07-30-media-capture-investigation-design.md`
  on the real iPhone and Android tablet with this logging live, then diagnose
  from what comes back.
```

- [ ] **Step 4: Final full verification**

```bash
npm run build
npm run lint
npx vitest run
```

Expected: all pass.

- [ ] **Step 5: Commit and push**

```bash
git add TRACKER.md CHANGELOG.md src/lib/version.ts
git commit -m "V2.20.8: real-error capture for the camera/upload mysteries

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

## After this plan

Phase 2 (reproduce bugs 1-4 on real devices with diagnostics live) and Phase 3
(root-cause fixes, one at a time with findings presented before each) are
explicitly out of scope for this plan. They start once Rumen has reproduced
the failures and real rows exist in `client_diagnostics` to query.
