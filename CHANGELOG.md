# RallyHub Changelog

Version shown small under "Sign out" in the admin sidebar (`src/lib/version.ts`).
Bump `APP_VERSION` and add an entry here on each meaningful update merged to `main`.
Numbering: first = major updates, second = bigger batches of features/redesigns,
third = small fixes (e.g. 2.1.1).

## V2.5.5 - 2026-07-13 (event-manager facilitator access)
- Event managers can again open facilitator event links. The facilitator route's
  role check accidentally omitted `event_manager`, sending a valid signed-in
  event manager through a login redirect loop that presented as a black screen.
  Friendly event links still resolve to their normal internal UUID route.

## V2.5.4 - 2026-07-13 (fix /facilitator landing crash)
- The bare `/facilitator` landing page crashed with "useTenant must be used
  within TenantProvider" because that route is not wrapped in TenantScope and
  `AuthPageShell` required the tenant context. Added a non-throwing
  `useOptionalTenant()` and switched the shell to it (it only needs the tenant on
  tenant hosts). The page now renders the sign-in / instructions card correctly.
  Verified in-browser (renders, no error boundary).

## V2.5.3 - 2026-07-13 (per-surface browser tab titles)
- Each surface now sets a distinct tab title so multiple open tabs are
  tellable apart: "RallyHub: Admin", "RallyHub: Facilitator", "RallyHub: Display",
  "RallyHub: Teams", "RallyHub: Tablet". Live surfaces also append the event name,
  e.g. "RallyHub: Display · Summer Summit". New `useDocumentTitle` hook; wired into
  the admin layouts and the facilitator / display / join / tablet pages.

## V2.5.2 - 2026-07-13 (facilitator admin access)
- **FACIL-1**: facilitator accounts can now log into the app + admin panel
  instead of being locked out. Previously every guard (`RootPage`, `RequireAuth`,
  `HostAdminLayout`, `RequireTenantAccess`) bounced facilitators, and on the
  platform host they were redirected to `/login` (the "cannot log in" loop).
- Facilitators now land on a restricted admin surface: a read-only **Events**
  page (`FacilitatorEventsPage`) where they can open the facilitator link, copy
  the display/teams links, and show the teams join QR for each event; and a
  **Profile** page (`FacilitatorSettingsPage`) to edit their own first/last name
  (via the self-edit path in `update-org-user`), with their organisation shown
  read-only. Sidebar is stripped to Events + Profile (no dashboard, games, team,
  org settings, or support). They can sign in and out normally.
- Access is enforced at every layer: `facilitatorAllowedPath` limits them to
  `/admin`, `/admin/events`, `/admin/settings` (plus `/facilitator/*` to run
  events); the route dispatchers render the facilitator pages; RLS already scopes
  their event/org reads. All other roles are unchanged (every change is gated on
  `isFacilitatorOnlyRole`).

## V2.5.1 - 2026-07-13 (contact form backend + auth email templates)
- **CONTACT-1**: the marketing demo form now submits to a real `submit-contact`
  Edge Function (deployed, `verify_jwt` on). It validates input, drops honeypot
  hits, rate-limits per IP (10/hour), stores every lead in a new
  `contact_submissions` table (RLS: super-admin read only), and emails the lead
  via Resend when `RESEND_API_KEY` is set. Email failure never fails the request,
  the lead is saved first, so no lead is lost even before Resend is configured.
  The form has loading/success/error states with a mailto fallback on error.
  Verified end to end (store + validation + success state).
- **EMAIL-1** (config deliverables): branded RallyHub Supabase Auth email
  templates in `docs/email/rallyhub-auth-templates.html` (confirm signup, reset
  password, magic link, invite, change email) plus a full setup guide in
  `docs/RESEND-SETUP.md` covering Resend domain verification, the contact-form
  secrets, and wiring Resend as Auth Custom SMTP. The dashboard steps need
  Rumen's Resend credentials.

## V2.5.0 - 2026-07-12 (marketing homepage redesign)
- Rebuilt the public homepage (`rallyhub.games`) from the approved design
  handoff into maintainable React components under
  `src/components/marketing/home/` (hero, proof strip, mixed-event run, event
  builder, facilitator, live views, interactive branding preview, how-it-works,
  audience, on-page demo form, header with mobile menu, footer). Bespoke visuals
  live in `src/styles/marketing-home.css`; all colours derive from the
  neo-minimal tokens. Abril Fatface display + Manrope body, warm ivory/charcoal
  with the gold accent, alternating light and dark sections.
- New optimised media in `public/marketing/` (responsive hero JPEGs 1600/800w,
  live display screenshot) plus a real Open Graph image at `/og-image.jpg`
  (the previously referenced `/og-image.png` was missing). `PageHead` default OG
  updated. Below-the-fold images lazy-load; the hero uses `srcset` + explicit
  dimensions to prevent layout shift.
- Conversion routes use the app's own router: `Start building` → `/register`,
  `Log in` → `/login`, `Book a demo` scrolls to the on-page `#contact` form.
  Reveal-on-scroll and a scroll-progress bar respect `prefers-reduced-motion`,
  with a safety fallback so content can never stay hidden.
- Contact form: full validation, accessible labels/errors, focus management, and
  a honeypot. It composes a pre-filled email via the visitor's own mail client
  (no data sent to any third party). A real server-side destination is still an
  open product decision (see TRACKER CONTACT-1).
- Accuracy: photo/video/text scoring described as host-reviewed (not "instant"),
  no "manage all your clients", no free-event/trial/pricing claims on the
  homepage, no invented testimonials or metrics. Removed the old page's pricing
  block and the "your first event is on us" line.
- Removed the now-unused `PlaceholderImage` component.

## V2.4.14 - 2026-07-12 (ENG2 stage 1: extract participant overlays)
- Same safe slice on JoinGameView: the three leaf overlays (facilitator chat,
  announcement, exit-password dialog) moved verbatim into presentational
  components in `src/components/live/participant/JoinGameOverlays.tsx`. Page owns
  all state/handlers; props TypeScript-checked. No behaviour change; file
  1555 → 1484 lines. The header/body render blocks and state machine are left
  for later staged passes (each needs a participant smoke test).

## V2.4.13 - 2026-07-12 (ENG1 stage 1: extract facilitator modals)
- First safe slice of the FacilitatorEventPage decomposition: the four leaf
  modals (winner-sound routing, team claim, reset-team confirm, event log) moved
  verbatim into presentational components in
  `src/components/live/facilitator/FacilitatorModals.tsx`. Page owns all state
  and handlers still; props are TypeScript-checked. No behaviour change; file
  2268 → 2146 lines. Deeper decomposition of the render/state machine is left
  for later staged passes (each needs a facilitator smoke test).

## V2.4.12 - 2026-07-11 (P1-1 bingo playback recovery)
- Players now recover the current bingo song if the facilitator's tab closes
  mid-round. The play index is already written to `bingo_runs` on every advance;
  `useBingoRun` now polls that row (every 3s) and moves players forward when the
  facilitator's broadcast has been silent for 6s+. Guarded by
  `pickRecoveredBingoRun` so a stale read can never rewind an active run, and a
  no-op while broadcasts flow, so normal facilitator-present play is unchanged.
  Needs a real-phone smoke test (facilitator closes tab mid-bingo) before the
  next event. New unit test: `src/hooks/use-bingo-run.test.ts`.

## V2.4.11 - 2026-07-11 (SEC-2 RLS performance cleanup)
- Wrapped `auth.uid()`/`is_super_admin()`/`user_organization_id()` in `(select
  ...)` across RLS policies so they evaluate once per query, not per row, and
  merged the own-org + super-admin permissive policy pairs into single policies.
  `auth_rls_initplan` 21 → 0; `multiple_permissive_policies` 29 → 1 (only the
  invoices SELECT pair left, an awkward all+select merge deliberately skipped).
- Behaviour-preserving: verified RLS-visible row counts are byte-identical for
  super_admin, client_admin, and event_manager across all 18 affected tables
  (before/after simulation), and the anon participant path via load test.

## V2.4.10 - 2026-07-11 (SEC-4 anon SECURITY DEFINER lockdown, round 2)
- Removed `anon` execute from 11 SECURITY DEFINER functions that no anonymous
  surface uses: the five RLS helpers (`is_super_admin`, `user_organization_id`,
  `is_facilitator_for_event`, `is_org_member_for_event`, `is_org_staff_for_event`,
  all referenced only in `authenticated` policies), three admin RPCs
  (`expire_overdue_trials`, `get_organization_users`, `install_music_library`),
  and three internal workers (`award_bingo_line_bonus`, `archive_stale_active_events`,
  `seed_organization_defaults`). Each keeps exactly the role it needs
  (`authenticated`/`service_role`). Anon-executable SECURITY DEFINER functions:
  28 → 17 (46 → 17 since the review began). Verified the anon participant path
  still works via the 15-phone load test (0 errors, 100% broadcast delivery).

## V2.4.9 - 2026-07-11 (SEC-3 indexes + SEC-5 advisor cleanup)
- Added the 19 missing foreign-key indexes flagged by the performance advisor
  and a composite `submissions(event_id, created_at desc)` index for the hot
  live-event read. The plain `submissions(event_id)` index is kept for now.
- Organization creation is now super-admin / service-role only: the old
  `organizations` INSERT policy allowed any authenticated user (`WITH CHECK
  (true)`); it now checks `is_super_admin()`. Signup Edge Functions use the
  service role and are unaffected.
- Pinned `search_path = public` on the 14 functions flagged with a mutable
  search path (behaviour unchanged; all cross-schema references were already
  qualified).
- Retired dead Edge Functions: deleted local `create-facilitator` and
  `invite-member` sources (uncalled). The deployed `smooth-api`, `invite-member`,
  and `reveal-bingo-winner` still need removing from the Supabase dashboard.
- Leaked-password protection enabled in Auth settings.

## V2.4.8 - 2026-07-09 (security hardening phase 1)
- Tablet kiosk event lists now require a valid server-issued tablet session
  token before the `get_tablet_events_for_org` RPC returns active/ready/demo
  event metadata.
- The Auth user creation trigger no longer trusts user-editable metadata for
  `role`, `organization_id`, or `must_change_password`; trusted Edge Functions
  remain responsible for assigning profile authorization fields, and no longer
  write those authorization fields into Auth `user_metadata`.
- Organization logo storage writes are scoped to the caller's org path (or super
  admin), and broad public storage listing policies were removed from the public
  `organization-logos` / `game-assets` buckets.
- Removed implicit `PUBLIC` execute access from the first batch of admin,
  scoring, lifecycle, and trigger `SECURITY DEFINER` functions.

## V2.4.7 - 2026-07-09 (Turnstile signup verification)
- **P2-5b**: the public registration form now includes Cloudflare Turnstile.
  The `register-client` Edge Function accepts the Turnstile token and verifies
  it server-side when `TURNSTILE_SECRET_KEY` is configured, on top of the
  existing per-IP signup rate limit.
- Added `VITE_TURNSTILE_SITE_KEY` to the frontend environment typing/example;
  the site key remains public, while the secret key belongs in Supabase Edge
  Function secrets.

## V2.4.6 — 2026-07-08 (photo compression + anon storage hardening)
Merged from `fixes` after live verification:
- **P2-UP**: photos now get compressed before upload on all three paths that
  were missing it — the native-camera-app fallback (iOS), and both team
  claim-photo pickers (participant + facilitator). A 1.2MB test photo
  landed at 253KB (~79% smaller).
- **P0-2b**: anon storage uploads are hardened. Storage RLS can't see the
  participant join token (confirmed by the 076→079 history — an earlier
  attempt to check it there broke live uploads). New approach: a
  `mint-storage-upload-url` edge function verifies the join token against
  the specific event over a normal request (where headers ARE visible),
  then mints a signed upload URL scoped to exactly one path. Both
  participant upload paths now use it. The old anon upload/update RLS
  policies on `game-assets` are removed entirely — verified live that a
  direct bypass attempt is now rejected while real uploads still work.

## V2.4.5 — 2026-07-08 (lint backlog cleared)
Cleared the full lint backlog: 96 problems down to 0. Mostly mechanical
fixes and documented `eslint-disable` comments for legitimate patterns the
newer React rules flag too aggressively (keeping a ref in sync with the
latest prop, hydrating a form from fetched data, object-URL previews,
fetch-on-mount). One real bug found and fixed along the way: a dead branch
in the bingo auto-advance logic that could never run (caught by
`no-dupe-else-if`) — verified live with a full throwaway bingo round
afterward, crossfade and multi-song auto-advance both correct.

## V2.4.4 — 2026-07-08 (signup rate limiting + register page crash fix)
- **P2-5**: the public signup endpoint now rejects more than 5 signup
  attempts per IP per hour (server-side, before any org/user is created).
  Captcha (Turnstile) is deferred until the site/secret keys are set up.
- **Fixed**: the register page could crash outright ("Rendered fewer hooks
  than expected") if a signed-in check changed value between renders (e.g.
  a stale/expired session in the browser) — two early returns sat before a
  block of `useState` calls, violating React's hooks rules. Found while
  testing the rate limit above; registration was silently broken for
  anyone who hit that edge case.

## V2.4.3 — 2026-07-08 (event activity log filters)
Added actor (team/facilitator/admin, by name) and action filters to the
per-event activity log (admin event page + facilitator panel), so you can
narrow a busy event log down to e.g. "just this team" or "just submission
rejections." Download CSV respects the active filters.

## V2.4.2 — 2026-07-08 (admin reload bug fix + small cleanups)
- **Hard reload on any /admin/* sub-route bounced to the dashboard**: for one
  render after a signed-in session resolved, the app could read `role: null`
  before the profile had actually finished loading, and a role-gated
  redirect treated that as "no access," bouncing to /login and then to the
  default dashboard once the real role loaded a moment later. Fixed by
  tracking which user id the loaded profile actually belongs to, so the
  loading flag stays true until it truly matches — reload now stays on the
  page you were on.
- **P2-1 documented**: multi-facilitator last-write-wins is a known,
  accepted limitation for now (single-facilitator workflow assumed); noted
  directly in code (`use-live-event.ts`) rather than built around.
- Dropped the Q-2 (game-time label) and bonus-games-rebuild items from the
  backlog — not wanted. Added Paddle payment integration and the branded
  PDF event-recap report as tracked future work.

## V2.4.1 — 2026-07-08 (remove music bingo bonus challenges)
Removed the bonus round feature completely: editor creation UI, facilitator
trigger/reveal/end controls, player answer UI, display rendering, plus the
now-orphaned `BingoBonusPanel`, `bingo-bonus-scoring`, and
`bingo-submission-url`. Regular bingo (start, marking, scoring, reveal, win
celebration) untouched — verified end-to-end with a throwaway event via
browser automation, not yet a live phone test.

## V2.4.0 — 2026-07-08 (live-event reliability: submit delay + bingo)
Shipped ahead of a live phone test, at Rumen's call — worth watching closely
on the next real event.
- **Quest submit/cancel stuck ~15s on "Submitting…"**: five spots (photo/video/
  text submit, quiz answers, cancel) waited on a best-effort broadcast to
  other devices before clearing their own loading state. A channel that
  isn't in a joined state (e.g. a backgrounded tab during a video capture)
  silently falls back to a slow REST call with a 10s timeout - meanwhile the
  facilitator's own view updates independently and instantly, which is why
  it looked like the facilitator saw it first. Now updates the player's own
  view immediately (matching the pattern already used for bingo marks) and
  sends the broadcast in the background instead of blocking on it.
- **Bingo Start needing 2-3 presses**: a brand-new bingo stage had no run
  row yet, so the first press had to wait on a network call before playing
  audio - by then it's no longer inside the tap that triggered it, so mobile
  browsers silently blocked the sound. The run now loads as soon as the
  stage is selected, before Start is ever pressed.
- **Bingo cells staying yellow long after the correct answer should show**:
  the "reveal this song's answers" trigger only fired in a narrow one-second
  window of the song's playback; a skipped update (any tab hiccup) pushed it
  to fire only after the whole song-change transition finished, so the next
  song was already playing while the last one's answers hadn't updated yet.
  Now it can't get skipped.
- **Tapping a bingo cell sometimes doing nothing**: the grid is briefly
  locked every round while the previous song is being scored - correct
  behaviour, but a tap during that window looked like the app just ignored
  it. Now shows a short "Locking answers…" note so it reads as expected.

## V2.3.3 — 2026-07-07 (description editor: text colour actually fixed)
- The real bug: the colour picker writes a `<font color="...">` attribute,
  not a CSS style, and the sanitizer only ever kept colour via `style` -
  so it was silently stripped every time you hit Save. Confirmed fixed by
  colouring text, saving, and reloading against the live database.

## V2.3.2 — 2026-07-07 (description editor: text colour fix)
- Picking a text colour in the description editor didn't stick - the native
  colour picker steals keyboard focus from the editor, so the colour command
  was running against nothing. It now refocuses the editor before applying
  the colour, so it saves and reloads correctly.

## V2.3.1 — 2026-07-07 (description formatting on player screens)
- The photo/video "take a photo/video" briefing screen was showing the
  description's HTML tags as literal text (e.g. `<b><u>`) instead of
  formatting them - it was missing the rich text renderer added in V2.3.0.
  Fixed, and reordered that screen (and the two other challenge screens) to
  Title → Points → Photo → Description → Button, so there's no empty gap
  when a game has no cover image.
- Description text on player-facing challenge screens is bigger and
  semibold by default, for readability.

## V2.3.0 — 2026-07-07 (recycle bin + description formatting + events fix)
- **Fixed a live bug**: creating an event and attaching games could fail with
  `column "updated_at" of relation "events" does not exist`, leaving the
  event saved but with no games attached (so it showed "This game is
  unavailable" in Play mode). The `events` table was missing a column a
  trigger added in a previous migration depended on.
- **Recycle bin**: deleting a game or event now moves it to a Bin tab
  (Games and Events pages) instead of destroying it - restore it or open it
  directly from there. Shows days left before it's gone for good (30 days),
  then it's auto-deleted. Invoiced events keep their record for payment
  history even after the bin empties.
- **Game description**: the box is now a proper multi-line editor with
  basic formatting - bold, italic, underline, bigger/smaller text, and text
  colour. Formatting only applies to the description field.
- Video games now default to a 30 second max duration instead of 2 minutes
  (still fully editable per game).

## V2.2.1 — 2026-07-07 (game editor + card cleanup)
- Editing a photo or video game (including ones brought in via batch import)
  now has the full editor: points (static/range), solution description and
  image, and for video the max duration + example video clip. Previously
  these were create-only and Edit showed a placeholder message.
- Removed the Draft/Active status dot from game cards on the Games page -
  it was never actionable (games have no status workflow like events do)
  and just added visual noise.

## V2.2.0 — 2026-07-07 (batch game import)
Import button on the Games page: download a CSV template, fill in one row per
game (quiz games: one row per question), upload, review the per-row validation,
and create the whole batch in one go. Supports photo / video / text / quiz,
static or 100-500 range points, time limits, typed and multiple-choice answers,
and a Group column that files games into groups (created automatically). The
original hand-made sheets (Name, Type, Description, Point type, Points) import
unchanged. Music bingo is excluded on purpose - it needs audio uploads.

## V2.1.1 — 2026-07-07 (facilitator console polish)
Rumen's review pass on the redesign: announcement buttons on their own row,
display copy icon top-left, one-row [-15][play][+15] stepper without the
minute chip, green glow on the live stage-controls card, and a yellow border
on selected Stage / filter buttons so selection is obvious in both themes.

## V2.1.0 — 2026-07-07 (the fixes-branch batch)
Everything from the fixes branch, merged via PR #1. Pre-merge state saved as
branch `stable-2.0`.
- Onboarding v2: per-user tours (every account reset; event managers get a
  trimmed run), auto-minimising panel, revisitable completed steps, Mark
  complete on every step. Interactive 19-step spotlight tour underneath.
- Facilitator console redesign: countdown + Reveal Winner top right, inline
  countdown editing, stepper next to Start, display preview fills its card
  with a hover copy icon, compact announcements, stage controls left and
  only when active.
- Quest editor: quick-add (All / photo / video / text), drag-to-reorder;
  player phones follow the stage order.
- Re-landed post-rollback fixes: cancel clears the player tile instantly,
  atomic bingo + quiz restart score reversal (RPCs), reconnect backoff cap,
  PII debug logs stripped, dead components deleted.
- Tablet kiosk link blocked until the default 1234 PIN is changed.
- vitest suite over the bingo scoring core (30 tests); jspdf + ffmpeg now
  lazy-load out of the main bundle.

## V2.0 — 2026-06-23 (first client-ready stable)
First version stable enough for clients to use in production. Highlights:
- Live event: winner sound on all player phones, bingo-winner.mp3, facilitator
  Mute, stopped-team player block, bingo "Failed to advance" race fixed.
- Admin: client dashboard home, event delete, ghost Branding tab removed,
  CSV media/log exports.
- Billing: first event free for paid plans, trials surfaced on super-admin.
- Music: super-admin library + install-to-clients, genre, search/sort, playlists
  (incl. add-whole-playlist to music bingo).
- Shareable slug links: /{client}/events/{event}/{facilitator|display|teams} and
  /{client}/tablet, with QR regeneration.
- Go-live domains: app./admin.rallyhub.games.

Tagged in git as `v2.0-stable`. `main` stays production; new work happens on the
`new-features` branch and is merged to `main` only after testing.
