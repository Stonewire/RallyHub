# RallyHub Changelog

Version shown small under "Sign out" in the admin sidebar (`src/lib/version.ts`).
Bump `APP_VERSION` and add an entry here on each meaningful update merged to `main`.
Numbering: first = major updates, second = bigger batches of features/redesigns,
third = small fixes (e.g. 2.1.1).

## V2.20.25 - 2026-07-31 (visible build stamp on live pages)

- Hermit still feels slow after a cache clear, yet the diagnostics table
  stays empty, which is impossible on a current build (slow shots write
  rows). The only consistent explanation is that Hermit's WebView is still
  serving a bundle from before the instrumentation existed. There is no
  service worker in the app, so it is plain WebView page caching.
- The Powered by RallyHub badge on live pages now carries a tiny version
  stamp, so the RUNNING build can be read straight off any device. This
  settles every "which version is this device actually on" question in
  seconds, for this investigation and for future support.

## V2.20.24 - 2026-07-31 (every diagnostic row names its build; photo timing measures to first paint)

- Rumen's latest Hermit round felt slower than ever yet wrote no timing rows,
  and the user-agent data shows Hermit disguises itself as Chrome, so a stale
  cached build inside Hermit cannot be told apart from the live deploy by
  fingerprint. Every diagnostic row now records the APP_VERSION that wrote
  it: if Hermit is serving an old cached bundle, the next row says so
  outright.
- Photo capture timing now measures from shutter press to the preview
  actually appearing on screen (not just the internal capture call), with
  the reporting threshold lowered to 600ms, so a felt delay that lives in
  rendering rather than capture is caught too.

## V2.20.23 - 2026-07-31 (name the stage that owns Hermit's 13-second shutter)

- Diagnostic-only. Photo capture inside the Hermit app is erratically slow:
  the timing rows show three real shots at 13.2 seconds almost to the
  millisecond (13172, 13157, 13198ms) with a 1.4 second outlier. Numbers
  that identical are a hidden timeout or forced fallback inside the WebView,
  not random load, and the current measurement only sees the capture step as
  one block.
- The capture step's timing is now split into its parts (setup, canvas draw,
  JPEG encode) and attached to the same capture-timing rows, so the next
  slow Hermit shot names the exact operation that owns the 13 seconds. Fast
  shots keep writing nothing.

## V2.20.22 - 2026-07-31 (join photo uses the in-app camera on tablets)

- The last open item from the original five: the join screen's Take Photo on
  Android tablets opened a file browser, because tablet browsers turn the
  camera-input attribute into a plain file picker. Take Photo now opens the
  same in-app camera the challenges use (full view, edge to edge, fast
  shutter) everywhere except iOS, which keeps its native camera per Rumen's
  verdict that it is perfect there.
- An explicit "Or upload a photo" link keeps the file picker available as a
  deliberate choice on the in-app-camera platforms.
- Photos from the in-app camera arrive already sized for upload; the upload
  path itself is unchanged.

## V2.20.21 - 2026-07-31 (iPhone video records vertical again)

- iPhone video quality recovered in V2.20.20 but the view stayed horizontal:
  iOS Safari ignores polite portrait hints at camera open and stays in its
  landscape mode. The old max-resolution reconfigure removed in V2.20.13 had
  been flipping it to portrait as a side effect, which is why iPhone video
  was vertical before today's tablet work.
- iOS now gets a firm portrait demand after the camera opens (an exact
  width/height swap), with the polite fallback kept if a device genuinely
  cannot. Android is untouched: its drivers either honour the polite hints
  or deliver upright wide frames where forcing portrait would be wrong.
- Also checked from the timing rows: the photo submit delay Rumen flagged is
  honest upload time on the network (photo submits stayed under the 1.5
  second reporting threshold; the video submits that crossed it spent the
  whole time in the file transfer). The instrumentation keeps watching it.

## V2.20.20 - 2026-07-30 (full 1080p video on iPhone and iPad, 720p stays Android-only)

- The 720p recording request shipped in V2.20.14 was calibrated on the
  Android event tablet but applied everywhere. On iPhone it made Safari pick
  a wide, low-resolution camera mode: a horizontal preview and visibly lower
  quality on hardware that handles 1080p without breaking a sweat.
- Video recording now asks for the full 1080x1920 portrait stream everywhere
  EXCEPT Android, which keeps the measured 720p floor: the event tablet
  needed it to stay smooth (9fps at 1080p, measured), and Android event
  devices are unknown hardware in general. iPhones and iPads are known-good
  cameras, per Rumen's explicit call.
- Photo capture is unchanged (1080p everywhere already). The record-timing
  instrumentation stays armed: if any device still records choppy or
  oversized, it writes a row showing what the camera negotiated.

## V2.20.19 - 2026-07-30 (centre the capture buttons on wide screens)

- On the tablet's wide screen the Take photo / Record video / Submit buttons
  sat left of centre: the button component is inline-flex, which ignores the
  auto-margin centring the layout relied on. The capture footers are now
  flex columns that centre their children, so the buttons sit centred on
  every screen width. Phones were already visually centred and are
  unchanged.

## V2.20.18 - 2026-07-30 (capture view goes edge to edge)

- With the zoom crop gone, the tablet's wide camera view was rendering inside
  a narrow phone-shaped column and came out too small to frame a shot with.
  The photo and video capture screens now use the whole screen for the
  camera: the full view renders as large as the display allows on every
  device, letterboxed only where the sensor's shape demands it.
- Embedded review surfaces (submission viewer, pre-submit review card) keep
  their compact framed layout; only the live capture screens go full bleed.
- Context for the record, from Rumen's question: the tablet's camera cannot
  deliver a true vertical full-frame picture because its sensor is
  physically landscape-mounted. Tablet native camera apps that show
  "portrait" are crop-zooming the same wide sensor. Full field of view on
  this hardware is inherently a wide picture; phones with portrait sensors
  are unaffected and stay fully vertical.

## V2.20.17 - 2026-07-30 (full camera view, no zoom crop, on every capture screen)

- The vertical capture window was centre-cropping the camera image, which on
  the tablets looked like heavy zoom and cost real quality (a slice of the
  frame blown up to fill the window). Root cause is physical: the tablet's
  camera sensor is landscape-mounted, so its full field of view is a wide
  picture, and locking the tablet vertical cannot change the sensor's shape.
- Per Rumen's call, full field of view wins: capture screens now show the
  WHOLE camera frame inside the vertical window, letterboxed on black where
  the sensor is wider than the screen. Saved photos are the full frame at
  upload size, with no crop and no upscaling. Phones with portrait sensors
  still fill the window edge to edge and are unaffected.
- Video recording itself was never cropped (the recorded file always
  contained the full frame); only its on-screen preview and review windows
  were cropping, and those now show the full frame too. The recording
  pipeline is untouched.
- The same full-view treatment applies to the participant's pre-submit
  review and the facilitator's submission viewer, so media is never shown
  cropped anywhere in the flow.

## V2.20.16 - 2026-07-30 (photo capture matches the video capture's vertical window)

- V2.20.15's rotation fix was the wrong diagnosis and is reverted: the
  tablet delivers upright content in wide frames, so rotating produced
  sideways photos and a broken-looking, flipped preview. The report that
  video capture looks perfect was the clue, since video applies no rotation
  at all.
- Photo capture now works exactly like video capture: a fixed vertical 9:16
  window shows the camera with the sides cropped away, and the saved photo
  is the same centre crop at upload size. What the participant frames on
  screen is what gets submitted. No rotation logic remains in the photo
  path.
- Video capture is untouched, per Rumen's explicit instruction, as it works.

## V2.20.15 - 2026-07-30 (photos upright when the tablet is held upright)

- Photos taken with the tablet held upright came out horizontal. The rotate
  decision trusted the orientation the camera driver reported when the
  stream opened, and this tablet's driver reports one orientation while
  delivering another.
- Both the saved photo and the live preview now decide rotation from the
  actual frame at the moment it is used: device upright plus a
  wider-than-tall frame means rotate. Driver reports are no longer consulted
  for photo orientation.
- Video preview rotation is unchanged in this release; recorded video file
  orientation on landscape-sensor devices remains a known follow-up.

## V2.20.14 - 2026-07-30 (record at 720p: frame rate over resolution)

- After V2.20.13 the tablet's recording preview improved from 3fps to a
  measured 9fps at the negotiated 1920x1080, still short of smooth. Per
  Rumen's explicit call, frame rate now wins over resolution: video
  recording requests 720p (about 2.3x fewer pixels per frame), which budget
  tablet hardware encodes at full rate. Photos keep the sharper 1080p
  stream, since a single still cannot be choppy.
- The hard `min` resolution constraints were also dropped from the camera
  request as part of the same edit: `min` is a hard requirement that fails
  camera open outright (OverconstrainedError) on cameras that cannot meet
  it, which is what broke desktop and laptop webcams this morning. Ideal
  values degrade gracefully instead of failing.
- Verification unchanged: a smooth recording writes no record-timing row;
  any row that appears shows the negotiated size and measured fps.

## V2.20.13 - 2026-07-30 (choppy tablet video fixed from measured evidence)

- V2.20.12's record-timing rows caught the choppiness red-handed: the camera
  opened at the requested 1080x1920 but was then reconfigured to the sensor's
  maximum, 3120x2448 (7.6 megapixels per frame), and the recording preview
  dropped to a measured 3fps while the hardware mp4 encoder collapsed trying
  to eat 18Mbps of those frames.
- The max-resolution reconfigure is removed. Video now records the stream at
  its negotiated ~1080x1920 size, and the bitrate is computed from the real
  track dimensions (~5Mbps at 1080p), comfortably within what the tablet's
  hardware encoder handles. Recorded files also get meaningfully smaller.
- Verification is the instrumentation: a smooth next recording (over 24fps,
  at or under 1080x1920) writes no record-timing row. Any row that still
  appears shows exactly what the camera negotiated instead.

## V2.20.12 - 2026-07-30 (measure the choppy tablet video before fixing it)

- Diagnostic-only release for the last big open item: video recording on the
  Android tablet is visibly choppy while recording. "Choppy" is low frames
  per second, and that is measurable, so this release measures it instead of
  guessing between the three suspects (sensor pushed to maximum resolution,
  the hardware mp4 encoder, the requested bitrate).
- While recording, the preview's real frame rate is counted from actual
  rendered frames. When a recording of at least 1.5 seconds ends with a
  preview under 24fps, a track resolution beyond 1080x1920, or an
  unmeasurable frame rate, a `record-timing` row captures: measured fps, the
  resolution and frame rate the camera actually negotiated, the recorder
  format chosen, the requested bitrate, recording duration, and file size.
- Smooth recordings write nothing. The next tablet recording session gives
  the numbers that pick the fix.

## V2.20.11 - 2026-07-30 (tablet photo shutter fixed from measured evidence)

- V2.20.10's capture-timing rows nailed the tablet's slow shutter with hard
  numbers: the full-resolution `ImageCapture.takePhoto()` call took between
  2.2 and 23.4 seconds per shot across six captures, returning a 3-4MB still
  that was then shrunk to ~130KB anyway, with the shrink costing a further
  ~1.1 seconds per shot.
- Photos are now grabbed from the live preview frame in a single canvas pass
  that rotates (for landscape sensors on upright devices) and scales to the
  1600px upload size together. Both measured costs are gone; the remaining
  work per shot is one JPEG encode.
- The `ImageCapture` and rotate-after-the-fact code paths are removed
  entirely. Video recording is untouched.
- The capture-timing instrumentation stays in place and is the verification:
  if any shutter still takes over a second on the tablet, it writes a row.
  No rows means fixed.
- Also confirmed from the same evidence run: the tablet now reports itself as
  Android (desktop mode is genuinely off), and the iPhone's earlier lingering
  submit screens did not reproduce in a fresh event; its one slow submit was
  2.6 seconds of legitimate video upload time. If the lingering returns in a
  long-running event, the permanent submit-timing instrumentation will
  capture it.

## V2.20.10 - 2026-07-30 (timing instrumentation for the two remaining slowdowns)

- Diagnostic-only release, no behavior changes. Two timing captures added to
  `client_diagnostics`, reported only when a threshold is exceeded so normal
  runs write nothing:
- `capture-timing`: when a photo takes over a second from shutter press to
  ready, records the camera-open, still-capture, and downscale stage
  durations, whether the ImageCapture API was used, and the image sizes. This
  is for the Android tablet's ~3 second shutter lag; the earlier "fixed"
  build still showed 4-5 seconds there, so this time the fix will be chosen
  from measured stages instead of re-landed on faith.
- `submit-timing`: when a challenge submit takes over 1.5 seconds to close
  (or the screen takes over 400ms to repaint after closing), records the
  upload, state-flush, sound/notify, and repaint-delay durations. This is for
  the iPhone's 4-5 second lingering submit screens; the repaint measurement
  distinguishes a blocked main thread from a compositor stall, which point at
  different culprits.

## V2.20.9 - 2026-07-30 (re-land the x-team-token fix, now confirmed by device evidence)

- Phase 2 of the investigation ran: Rumen reproduced the failures on a real
  iPhone and the Android tablet with V2.20.8's diagnostics live. All six
  captured failures, on both platforms, were the same transport-level error
  ("Failed to send a request to the Edge Function") on the upload
  authorization call, while every REST request (name-only join, text
  submissions, the diagnostics themselves) went through fine.
- That is exactly the `x-team-token` CORS behavior V2.20.2 fixed: REST
  accepts the header, Edge Functions' preflight does not, so the browser
  refuses to send only the Edge Function requests. The fix is now re-landed
  with real-device evidence behind it instead of inference: the header is
  sent only on `/rest/v1/` calls, where Postgres actually reads it.
  Server-side enforcement is unchanged, and the `supabase.test.ts` tests
  covering the header gating are restored with it.
- Also learned from the evidence, for the remaining open items: the Android
  tablet's Chrome is running in desktop mode (its user agent reports desktop
  Linux), which explains the join screen opening a file browser instead of a
  camera (desktop browsers ignore the camera-capture input attribute). And
  the iPhone text-submit delay produced no error row at all while the
  submission demonstrably arrived instantly, so the close-path stall is a
  timing issue needing its own instrumentation, not an exception.

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

## V2.20.7 - 2026-07-30 (revert today's camera/upload changes, restart investigation properly)

- Six commits today (V2.20.1 through V2.20.6) chased camera and upload bugs
  one guess at a time, each verified only in a sandboxed desktop browser.
  On real hardware, five distinct problems remained or worsened, including
  the core issue: photo/video submissions failing on both iPhone and Android
  with "fail to send a request to the edge function."
- Reverted `main` to `a4fa36a` (V2.20.0), the state before any of today's six
  commits. This is a deliberate, explicit tradeoff, not a clean win:
  - Removed (regressions from today, correctly undone): the black-screen
    Android video-record bug and the ~15-second live-track-reconfigure photo
    slowdown.
  - Reintroduced (the original problems from before today, now back): the
    hard `min` resolution constraint that fails camera open outright on
    desktop and some tablets, the original ~5 second full-resolution
    `ImageCapture` photo path, AND the `x-team-token` CORS-preflight bug
    fixed in V2.20.2 (`68bcfb9`); that fix was production-verified, not
    guessed, but is deliberately left reverted so Phase 2 reproduces the
    original "fail to send a request to the edge function" failure
    unmodified. This is the direct cause of bugs 1 and 3 in the spec, and it
    is EXPECTED to keep happening until Phase 3 re-lands that fix. It is not
    something the V2.20.8 diagnostics work below resolves.
- No server-side changes (migrations, Edge Functions) were touched by any of
  today's six commits, so this is a pure client rollback with no data or
  schema impact.
- Next: a permanent diagnostic-logging mechanism ships next (see
  `docs/superpowers/specs/2026-07-30-media-capture-investigation-design.md`)
  so the real root causes get diagnosed from evidence instead of guessed at
  again. No further camera/upload fixes ship until that evidence exists.

## V2.20.6 - 2026-07-30 (removed the second live-camera reconfigure causing Android lag)

- Photo capture regressed to ~15 seconds and video preview lagged continuously
  after V2.20.4/5. Root cause: a second call left over from the same bug class
  fixed in V2.20.4. `tryPortraitConstraints()` called `track.applyConstraints()`
  on the already-open camera track, on every photo and video open, whenever the
  sensor reported landscape. That is a live-track reconfigure exactly like
  applyMaxVideoTrackQuality, which V2.20.4 removed for photo but this second
  call site was missed. `applyConstraints()` on an active getUserMedia track is
  unreliable on some Android hardware: it can stall for seconds or leave the
  camera pipeline degraded for the rest of the session, which also explains the
  "goes straight to files" report — that was the black-preview fallback message
  added in V2.20.4 firing because this same reconfigure was stalling the track.
- The manual browser test that showed capture as "instant" never exercised this
  code path: the stubbed test camera was already portrait, so the
  landscape-only branch that triggers the reconfigure never ran. It was
  confirmed this time with a stubbed landscape (1920x1080) sensor stream, the
  actual shape of the bug.
- The reconfigure call is now removed entirely. Preview and photo orientation
  are unaffected: both already correct sensor orientation in software
  (CSS rotation for the live preview, a canvas rotate baked into every captured
  still) regardless of what the raw track reports, and that was verified against
  a stubbed landscape stream with zero `applyConstraints` calls and a
  correctly-rotated output image.
- Open risk, flagged rather than hidden: recorded VIDEO FILES are the one output
  not corrected this way — MediaRecorder encodes the raw track, not the rotated
  preview — so a landscape-sensor device could record a sideways video file. If
  that turns up on the tablet, the fix is recording through a canvas (the same
  frames already drawn correctly for stills) instead of the raw track, not
  bringing back this reconfigure.

## V2.20.5 - 2026-07-30 (Android video recording no longer goes black on Record)

- V2.20.4 fixed a black camera preview on Android tablets. A different bug
  remained: the preview showed fine, but pressing Record turned it black and
  flickering, with no video produced. iPhone was unaffected — but iPhone video
  challenges always use the OS camera app instead of this in-app recorder, so
  it never exercised this code at all. Android tablets always go through it,
  which is why only they showed it.
- The recorder tried `video/mp4` first everywhere. On Android, MediaRecorder
  hands that to a hardware H.264 encoder that shares the camera pipeline with
  the live preview; attaching it while the preview is already running is a
  known way to get exactly this: a black, flickering preview and no output the
  instant recording starts.
- Android now records `vp9`/`vp8` first, a software encoder that never touches
  the camera hardware. Every other platform is unchanged — desktop and iOS
  Safari need `mp4` first, since they have no `vp8`/`vp9` MediaRecorder support
  at all.
- Not reproducible without an affected Android tablet. This is the fix the
  symptom (works until Record specifically) points to, added test pins the
  platform-specific ordering; the tablet itself is the real test.

## V2.20.4 - 2026-07-30 (video capture on Android tablets)

- Video challenges showed a black screen on Android tablets while working on
  iPhone. Photo capture on the same tablets started working in V2.20.3, and the
  only remaining difference between the two paths was that video still pushed the
  camera to its maximum sensor resolution immediately after opening it. Some
  Android camera stacks respond to that by handing back a track that is live but
  never paints a frame.
- Video now uses the negotiated portrait 1080x1920 stream, the same as photo. The
  recording bitrate is calculated from the real track size, so it adapts and
  quality at 1080p is unaffected. Recordings are also smaller, which helps them
  stay under the upload limit.
- A black preview can no longer be silent: if no frame arrives within three
  seconds, the participant is told to record with their camera app and upload it,
  and the Upload video button is already on that screen.
- Honest caveat: the black screen itself cannot be reproduced without the
  affected tablet, so this is the fix indicated by the photo/video difference
  rather than one confirmed on the device. Needs a check on the tablet.

## V2.20.3 - 2026-07-30 (taking a photo is instant instead of a five-second wait)

- Pressing "Take photo" on an Android tablet stalled for around five seconds
  before the shot appeared. The app was doing a lot of expensive work and then
  throwing the result away.
- Every photo was captured at the sensor's full resolution: the camera was
  reconfigured to its largest frame when the camera opened, a full-resolution
  still was requested from the sensor, that image was rotated at full resolution,
  and only then was it shrunk to 1600px for upload. Four heavy steps, on a
  12-megapixel image, to produce a 1600px photo.
- Stills now come from the frame already on screen and are rotated and scaled to
  final size in a single pass. The camera is no longer pushed to full resolution
  for photos, and the second shrink pass is gone. Video recording still uses full
  resolution, where it pairs with the high bitrate and is wanted.
- Photo quality is unchanged in practice: the preview is a portrait 1080x1920 and
  the saved photo is 1600px on its long edge, exactly as before.
- Measured on a stubbed camera: time from tap to preview halved, with the
  remaining cost being a single JPEG encode. The full-sensor delay that dominated
  on the tablet cannot be reproduced off-device, so the real gain there should be
  larger.

## V2.20.2 - 2026-07-30 (photo and video submissions reach the server again)

- Teams could take a photo or video, hit Submit, watch the loading screen, and
  end up with nothing: no submission on their phone, nothing for the facilitator.
  Uploads had been failing since V2.19.0 on 29 July. Only two photo/video
  submissions existed in the database, both from 13 July.
- V2.19.0 started attaching the `x-team-token` header, which proves a phone owns
  the team it claims to be, to every participant request. Only Postgres reads
  that header. Edge Functions and Storage answer the CORS preflight with a fixed
  list of allowed headers that does not include it, so the browser passed the
  preflight and then silently refused to send the real request. The upload
  authorization call died there, and with it every photo and video submission and
  every team join photo.
- The header is now sent only on REST and RPC calls, the only place it is read.
  No change to what the server enforces.
- Verified against production from a real participant session: upload
  authorization and the storage upload now go out without the header, a
  submission insert carrying it returns 201, and the same insert without it is
  still rejected with "This phone is not authorized for that team", so the
  V2.19.x ownership guard is untouched. Test rows removed afterwards.

## V2.20.1 - 2026-07-30 (participant camera capture fixed on every platform)

- Photo and video capture was dead for teams: the camera screen opened onto a
  black frame on computers, and on tablets the very first team photo opened a
  file picker instead of a camera. Two separate faults, both silently swallowed
  into an empty stream.
- Capture asked for `width: { min: 720 }` and `height: { min: 1280 }`. `min` is
  a hard requirement, so the camera request was rejected outright on any camera
  that cannot produce a 720x1280 portrait frame, which covers every 720p
  landscape laptop webcam and many tablets. Resolution is now a preference, with
  one plain-video retry for drivers that reject size hints altogether.
- Capture was also gated behind a stored "permission granted" flag, set by a
  camera request fired on page load with no user tap, behind the privacy notice,
  and needing microphone as well as camera. Browsers suppress prompts like that,
  and one suppressed prompt left capture dead for the whole event. Permission is
  now requested when the participant taps the capture button.
- Failures now say what went wrong (blocked, no camera, camera in use) instead
  of a generic "not granted", and the next attempt falls back to the device
  camera app or a file upload.
- The team photo on the join screen used a bare file input, so desktop only ever
  offered a file dialog. It now opens the in-app camera where one exists, with
  an explicit upload option underneath.

## V2.20.0 - 2026-07-30 (public self-resetting demo account)

- Added the passwordless `demo.rallyhub.games` tenant with normal client-admin,
  facilitator, display, join, scoring, upload, inventory, and event behavior.
- The shared sandbox automatically restores every 30 minutes and can also be
  reset manually from its countdown control. Demo storage is cleaned safely as
  part of each reset.
- Each reset installs all 159 active platform games and refreshes their current
  names, configuration, cover images, group names, group order, and group
  memberships. All seven platform groups are preserved, and the demo-only
  Music Bingo game has its own group with no ungrouped games remaining.
- Added 14 populated events across roughly one year of activity, with different
  game sets, teams, scores, submissions, invoices, activity logs, inventory,
  and subscription history.
- The ready `RallyHub Product Showcase` includes runnable Quest, Quiz, Break,
  and Music Bingo stages. Bingo uses 25 locally hosted 30-second CC0 music
  clips with their original source recorded for provenance.
- Upgrade, downgrade, subscription, and event-payment flows are simulated
  inside the demo and never call Paddle or create real charges.
- Supabase migrations and Edge Functions were deployed and verified before the
  web release. The full app lint, 146-test suite, and production build pass.

## V2.19.1 - 2026-07-29 (team-ownership enforcement live, hotfix included)

- Migration `20260719130000_team_owned_participant_writes.sql` applied to
  production, activating the enforcement described in V2.19.0.
- Live end-to-end test immediately after, directly against production via a
  real join token, the real `claim_team_with_inventory_access` RPC, and real
  submission inserts: legitimate own-team write succeeded, a forged write
  using another team's token was rejected, a write with no token was rejected.
- That test caught a real bug in the original implementation: the migration
  revoked EXECUTE on the two helper functions from `anon`, but the calling
  trigger isn't `SECURITY DEFINER` — so it broke every anonymous submission
  write the instant it went live. Fixed within minutes via
  `20260729010000_team_owned_participant_writes_grant_fix.sql`, re-tested
  clean, test fixtures cleaned up.

## V2.19.0 - 2026-07-29 (participant writes now prove team ownership)

- **Client half of a two-step security deploy** (SEC-TEAM). Previously every
  anonymous participant in an event shared the same join token, which could
  prove they belonged to *an* event but not that a given write actually
  belonged to their claimed team.
- The private per-device team token minted at team claim (already stored in
  every participant's session since V2.13.0) is now attached as an
  `x-team-token` header on every participant write.
- This step alone changes no behaviour — the server does not enforce the
  header yet. Enforcement lands separately once this build is confirmed live,
  via migration `20260719130000_team_owned_participant_writes.sql`, in the
  correct order (client first, then migration) to avoid locking out
  in-flight events.
- Originally built and reviewed on `feature/team-write-security`
  (2026-07-19), merged into `main` today after re-verifying it against three
  weeks of intervening changes: the team token is still minted unconditionally
  at claim, no later migration touched the write-guard trigger, build/lint/141
  tests all pass clean.

## V2.18.0 - 2026-07-29 (self-service account settings for every role)

- New shared "My Account" panel: first/last name, username, email, and password
  in one place, backed by the existing `update-org-user` Edge Function's
  self-service path (already supported any role editing their own record, just
  never had frontend fields for it beyond name).
- Facilitators' existing Profile page now exposes all four fields, not just name.
- Event managers previously had no personal account page at all (`/admin/settings`
  silently bounced them to Events) — they now get the same page, plus a new
  "Profile" sidebar entry.
- Client admins and super admins get a new "My Account" tab alongside
  Organization Profile and Billing in Settings.
- Verified live against a real facilitator login on a local dev server: all
  fields prefill correctly and the organisation field stays read-only.

## V2.17.0 - 2026-07-28 (judged text games and the full content library)

- Text games now choose how they score through their points type. **Range**
  means the facilitator reads the answer and awards points, the same as a photo
  or video challenge. **Static** keeps the existing behaviour of checking the
  answer against a correct one.
- Judged games need no correct answers at all. Anything the organiser types in
  the answer field becomes a private note shown to the facilitator as a guide.
- Choose-answer games can also be judged: the options still define what the team
  picks from, but no option has to be marked correct.
- Platform library content: 6 themed quizzes (360 questions), 28 puzzle games and
  all 125 quest placements are now seeded as installable templates.
## V2.16.1 - 2026-07-28 (per-event item purchases toggle)

- The event editor has a new "Teams can buy items with their points" checkbox
  under Item purchases. Turn it off and the Buy Items button and QR scanner
  disappear from every team's phone for that event.
- On by default, so every existing event is unchanged.
- Purchases are also rejected server-side when the switch is off, so an item QR
  code kept from an earlier event cannot be used.

## V2.16.0 - 2026-07-28 (puzzle games: Wordle, Matching, Crossword)

- New `puzzle` game type for Quest stages, with three subtypes. All three score
  automatically on the server and keep every device on a team in sync.
- **Wordle:** organiser sets the answer and the keyboard alphabet. Players type
  on a built-in on-screen keyboard, never the phone's own. Unlimited guesses;
  each extra guess costs 10% of the remaining score. Letters colour green,
  amber and grey as they are ruled in or out.
- **Matching:** two shuffled columns per team, tap a pair to match. Wrong pairs
  are recorded and reduce the score.
- **Crossword:** 6x6 grid, organiser paints blocked cells and types words
  inline; every straight run of 2+ letters is auto-detected and must be clued.
  Players tap any letter cell to read its clue, tap again at a crossing to
  switch between across and down, and get 3 hints per team at -10% each. Full
  points at or under 5:00, then -5% per 30 seconds, 10% floor.
- The on-screen keyboard is letters only, laid out like a QWERTY board with
  equal-width keys, and stays locked to the bottom of the screen so Delete and
  Submit are always in reach. Latin and Cyrillic alphabets.
- **Fixed before release:** crossword progress was wiped whenever a player left
  the game and came back, because registering the solve timer overwrote the
  saved grid. Clues also only appeared when tapping the first cell of a word.
- Text games keep the normal device keyboard, unchanged.

## V2.15.2 - 2026-07-21 (fix cropped game cover images)

- Cover images on the challenge briefing screen (photo/video games), text
  challenges, and the submission review screen were cropped to fill the
  frame (object-cover). Switched to object-contain so the full image
  always shows, scaled down to fit within the same size limits.

## V2.15.1 - 2026-07-21 (fix missing points editor for text games)

- Editing a text game (side panel or the standalone page) was missing the
  Points control entirely — a pre-existing bug, not something the V2.15.0
  panel introduced. Points editing only ever saved for photo/video games.
  Text games now get the same Points editor as New game, and points save
  correctly on update.

## V2.15.0 - 2026-07-21 (edit games from a side panel)

- Clicking "Edit" on a game in the Games library now opens a side panel
  instead of navigating to a full page. The games list stays visible and
  clickable behind it — save your changes, then click straight into the
  next game's Edit button without closing anything first.
- The standalone `/admin/games/:id` edit page still works the same as
  before (e.g. deep links, the Bin's restore flow) — both now share the
  same underlying form component.

## V2.14.0 - 2026-07-21 (example video for photo games)

- Photo games can now have an optional example/instructional video attached
  in the game editor (New game and Edit game), same upload field video games
  already had.
- Fixed a pre-existing gap: the example video was saved but never actually
  shown to teams. It now renders on the challenge briefing screen (before
  they start capturing) for both photo and video games.

## V2.13.6 - 2026-07-21 (revert stage picker group/search filters)

- Reverted the group-filter chips and search box added to the quest stage
  game picker in V2.13.3/V2.13.4 — back to the original type-only quick
  filters (All / photo / video / text) with the always-visible pill list.
  The picker still correctly sources only from "Games in this event"
  (V2.13.5 fix kept).

## V2.13.5 - 2026-07-21 (quest stage picker scoped to event's games)

- Quest stage game picker offered every game in the org's library, not just
  the ones already added to the event via "Games in this event". It now
  only lists games already in the event — add a game to the event first,
  then it becomes pickable for a stage.

## V2.13.4 - 2026-07-21 (quest stage picker no longer dumps every game)

- The per-stage game picker stopped showing every available game as a giant
  flat list by default (orgs without groups saw 100+ pills at once). It now
  only lists individual games once you pick a group or type a search term;
  a new search box narrows by name. Quick-add-by-type buttons are unchanged.

## V2.13.3 - 2026-07-21 (game group filter for quest stages)

- Quest stage game picker (the "Add games below" list under an open/quest
  stage) now has the same group filter chips as the event-level Add games
  modal — pick a group or "All games" to narrow the list, then quick-add all
  of it or add games one at a time.

## V2.13.2 - 2026-07-21 (game group filter, hide team points)

- Event editor's "Add games" modal now lets you filter by game group (or all
  games) before selecting, instead of only pre-selecting a group's games into
  a mixed list.
- Facilitator panel gained a "Hide points for teams" toggle, independent of
  "Show scores on display" — hides each team's running point total on their
  own device (main game header and bingo header) without affecting the
  audience display.

## V2.13.1 - 2026-07-17 (branch-aware generated links)

- Facilitator, display, teams, pretty event, Inventory purchase, and tablet links
  now use the domain of the page currently open.
- Copied links, opened links, individual QR images, and PDF QR exports therefore
  remain inside the active Vercel preview, local environment, staging, or
  production deployment instead of unexpectedly pointing to production.
- New-event links now use the same shared generator as every other event-link
  surface, with regression coverage for Vercel preview hosts.

## V2.13.0 - 2026-07-17 (Inventory purchases)

- Added an organization Inventory Library under Games. Admins can create reusable
  physical items with a name, optional description/photo, and point price.
- Inventory items provide stable purchase links plus individual, selected, and
  all-item QR exports, including print-ready A4 QR cards.
- Quest participants can open a phone QR scanner, review an item's details and
  price, and confirm or cancel before spending team points.
- Purchases are atomic and server-authorized: insufficient balances are rejected,
  concurrent double-spends are prevented, and private participant tokens stop one
  team from purchasing against another team's score.
- Facilitators now receive live purchase notifications above Submissions showing
  the team, item, point cost, time, and purchase count. Purchase history remains
  visible after reload.
- Added regression coverage for QR payloads and participant session persistence,
  plus Realtime and RLS support for the protected purchase history.

## V2.12.1 - 2026-07-16 (additional-team billing)

- New events now start with the five teams included in every standard plan.
- Adding a sixth or later team immediately shows the €10-per-team charge and
  the total add-on amount in the event editor.
- Activation confirmation now itemises additional-team charges. The server
  snapshots extra-team quantity and fee into the invoice and Paddle charges the
  resulting authoritative total automatically.
- Event and educational promo discounts continue to apply to the base event fee;
  purchased team capacity remains €10 per additional team.
- Invoice history now itemises the base event fee and additional-team charge.

## V2.12.0 - 2026-07-16 (final pricing and release branches)

- Replaced the previous five-tier pricing ladder with the final four offers:
  Pay Per Event (€199/event), Starter (€20/month or €180/year + €149/event),
  Pro (€200/month or €1,800/year + €99/event), and contact-sales Custom.
- Starter now includes 2 events per month; Pay Per Event and Pro have no monthly
  event cap. All three standard offers include up to 5 teams per event.
- Pro now advertises optional per-event RallyHub branding removal. Additional
  teams are presented as purchasable capacity; their billing lands in V2.12.1.
- Removed Business from registration, plan comparison, subscription changes,
  and Paddle pricing. Any leftover test/demo Business records migrate to Pro.
- Removed the unapproved automatic one-month signup trial from new paid accounts.
- Added the four-level branch workflow to both `AGENTS.md` and `CLAUDE.md`:
  feature/bug-fixes → dev → staging → main, with Level 1 → staging allowed for a
  single release candidate.

## V2.11.0 - 2026-07-15 (billing, data lifecycle, and bingo responsiveness)

- Working pricing updated everywhere to Pro €70/month or €660/year + €99/event,
  and Business €150/month or €1,440/year + €95/event. Free and Starter, event
  limits and team limits remain unchanged.
- Removed the automatic first-event-free rule. Selected clients can still receive
  a complimentary event through an explicit 100% event promo code.
- Added a feature-flagged in-app paid-plan change flow with Paddle proration
  preview and payment-failure protection. The flags remain off for the initial
  live-payment cutover.
- Permanent event/client deletion is now server-owned and Storage-first. Event
  Bin expiry and six-month retention queue retryable cleanup; database rows are
  finalized only after the event's Storage objects are removed successfully.
- Event Bin now offers an explicit permanent-delete action. Regular Delete keeps
  its complete 30-day restore window, including uploaded media. Event branding
  uploads are grouped so superseded logos are removed with the event as well.
- Client admins can request permanent organization deletion from Settings and
  restore it for 30 days. The workflow schedules Paddle renewal cancellation,
  retries failures, removes all organization Storage/database/Auth data after the
  deadline, and attempts to undo the Paddle change when restored.
- Bingo advances the next playable round without waiting for the local audio fade,
  batches scoring work, and removes participant-side winner animation. The first
  confirmed winning phone now shows an immediate static `BINGO!` notice, while the
  facilitator/display celebration remains unchanged.
- Preserved the next content-production batch in `docs/GAME-CONTENT-PLAN.md`:
  five 25-quest groups and six themed quizzes, each using three 20-question rounds
  progressing from easy to medium to hard.
- Added the exact sandbox-to-live Paddle cutover sequence in
  `docs/PADDLE-LIVE-CHECKLIST.md`, including live webhook events and sandbox-ID
  cleanup.

## V2.10.3 - 2026-07-15 (instant quest submission feedback)

- Quest submissions now switch the participant phone from “Submitting…” to a
  local Pending state as soon as the database request is dispatched. The phone
  no longer waits for Supabase's returned row after the facilitator has already
  received the committed submission.
- The server remains authoritative: submissions use a collision-safe
  client-generated UUID with the unchanged anonymous RLS and database guards.
  A confirmed row reconciles over the optimistic copy; a rejected write removes
  it and reopens the challenge with a retry message.
- Cancel is unavailable during the brief acknowledgement window, preventing a
  cancel request from racing an INSERT that has not finished yet.
- Added optimistic-confirm and optimistic-rollback regression coverage. The
  production anonymous/RLS smoke test accepted the client-generated UUID in
  133 ms with no errors; all temporary data was cleaned up.

## V2.10.2 - 2026-07-15 (quiz auto-reveal reliability)

- Fixed the next quiz question failing to auto-reveal after the previous question
  timed out. Auto-reveal now uses the authoritative stored timer state rather than
  a one-render-old animated display value, so a new running question cannot consume
  its reveal guard before anyone answers.
- `reveal_quiz_answer` now advances `event_state.updated_at`. Participant/display
  fallback polling therefore recognizes a reveal even if its Realtime message was
  missed.
- Added focused regression tests covering a newly started timer, all-teams-answered,
  genuine timeout, and already-revealed states.

## V2.10.1 - 2026-07-15 (faster photo/video quest submission)

- Photo/video quest challenges now authorize their signed Storage upload when the
  participant opens the challenge. The Submit tap can reuse that authorization
  instead of waiting for the Edge Function round trip before uploading the file.
- If early authorization is unavailable, expired, or fails, submission safely
  falls back to minting a fresh signed upload URL; upload errors remain visible
  and no success state is shown before the database confirms the submission.
- Production-path smoke test against the demo event: signed-URL mint 389 ms,
  68-byte PNG upload 216 ms, anonymous submission insert + returned row 88 ms;
  the temporary team, submission, and Storage object were deleted afterward.

## V2.10.0 - 2026-07-15 (legal: DPA, acceptance tracking, participant privacy notice)

- **New Data Processing Agreement** at `/dpa` (DRAFT, for legal review). This was
  the missing one, and it is not optional: GDPR Article 28 REQUIRES a written
  processor agreement before a customer may lawfully put their participants' data
  into RallyHub. Covers roles, sub-processors (Supabase, Vercel, Paddle, Resend),
  security measures, retention, audit, breach notification, and the children/Art. 8
  point that matters for the schools segment.
- **Acceptance is now recorded, not just clicked.** New append-only
  `legal_acceptances` table storing user + document + VERSION + timestamp. There is
  deliberately NO update or delete policy, for anyone, including super admins - a
  consent record you can edit is worth nothing if it is ever challenged.
- Storing the *version* (rather than a boolean) means that when the lawyer revises
  a document we bump it in `legal-acceptance.ts` and everyone is asked again on
  their next login.
- **Registration** now requires accepting Terms + Privacy + DPA, each readable in a
  new tab before ticking.
- **First login** for accounts a super admin created: a non-dismissible
  `LegalAcceptanceGate` blocks the admin panel until they accept. Those users never
  saw the registration form, so they had never accepted anything. No close button
  and no escape route - a consent dialog you can click past is not consent.
- **Join screen**: participants now see a privacy notice before they can enter a
  name or submit anything. It is deliberately blunt that they may be photographed
  or filmed, names the organiser as the party who decides, and tells them they can
  decline. Acknowledged per device (participants are anonymous, so there is no user
  id to store it against).
- Legal pages were previously unreachable from the app; `/dpa` added to the shared
  footer links alongside Privacy, Terms, Cookies and Imprint.
- Still outstanding: children/parental consent (Art. 8) is NOT implemented - parked
  by Rumen until the schools segment is live, and to be discussed with a lawyer.

## V2.9.3 - 2026-07-14 (stop leaking upstream errors to the browser)

- **Raw Paddle errors are no longer returned to the client.** Two leaks, both now
  closed:
  - The temporary `detail` field on 502 responses (added to debug the sandbox
    rollout) echoed Paddle's raw error body to the browser.
  - Worse, the catch-all handler returned `err.message` verbatim, which is how a
    Paddle 409 ended up showing the customer Paddle's internal error body,
    **including another customer's id**.
- Error policy is now explicit and enforced: upstream/internal failures are
  LOGGED, never returned. Every message that reaches the browser is a fixed string
  written for the customer. The single exception is the "add a billing email"
  prompt, which is deliberately user-facing and contains nothing internal.
- Diagnose failures in Supabase → Edge Functions → Logs instead; the raw upstream
  body is still captured there, just not handed to the client.
- Only an authenticated org admin could ever reach these endpoints, so this was
  never publicly exposed, but leaking internal plumbing (error codes, request ids,
  other customers' ids) to any customer is not acceptable regardless.

## V2.9.2 - 2026-07-14 (downloadable invoices)

- **Paid events now have a "Invoice" button** in Billing → Payment history that
  opens the official Paddle invoice PDF.
- Paddle is the Merchant of Record, so the legally-valid invoice is Paddle's, not
  one we generate — we link to theirs rather than inventing our own document. The
  link Paddle returns expires after an hour, so it is fetched fresh on each click
  and never cached or stored.
- Ownership is re-checked server-side on top of verify_jwt + org-admin auth, so
  one org can never pull another's invoice by guessing an id.
- Comped/€0 events get no button: Paddle issues no PDF for a zero-value
  transaction, so there is genuinely nothing to download.
- **Closed a gap this exposed:** an auto-charged invoice never went through the
  overlay, so its Paddle transaction id was never recorded — leaving nothing to
  fetch a PDF from. The webhook now stores the transaction id when it settles an
  event invoice, not just the paid status.
- Organisers can also see and download everything from the Paddle customer portal
  ("Manage billing details"); this is the shortcut.

## V2.9.1 - 2026-07-14 (fix Paddle customer conflict; billing details + saved cards)
- **Fixed: "Pay now" failed with `customer_already_exists` (409).** An org with no
  billing email of its own falls back to the admin's login email — and if that
  admin already owns another org, Paddle (which enforces one customer per email)
  rejected the second one. We now adopt the existing customer instead of failing
  the payment: look it up by email, falling back to reading the id out of
  Paddle's own conflict message so a lookup outage still cannot strand someone
  mid-payment.
- **New "Billing details" section in Billing** — opens Paddle's hosted customer
  portal, where organisers manage saved cards, billing address and invoices.
  - **Security:** card data never touches RallyHub. It is entered and stored only
    inside Paddle (PCI-DSS compliant); we hold nothing but Paddle's opaque
    customer id, so there is no card data here to steal. The portal link is minted
    server-side with the secret API key, is scoped to a single customer, and is
    short-lived. The endpoint is behind verify_jwt + org-admin authorisation, so
    an admin can only ever mint a link for their OWN org. The URL is never logged,
    cached or persisted, and opens in a new tab with `noopener,noreferrer` —
    never an iframe (Paddle requires this, and embedding a payment surface invites
    clickjacking).
- **Honest limitation, documented in code:** Paddle only supports charging a
  stored card off-session through a SUBSCRIPTION. Saved payment methods otherwise
  exist purely to pre-fill the checkout. So an org with no subscription (i.e. the
  Free plan) can NOT be silently auto-charged, saved card or not — a saved card
  makes "Pay now" a one-click confirm, and that is as far as Paddle allows.

## V2.9.0 - 2026-07-14 (Free plan switches from prepay to postpaid)
- **Free plan now activates like every other plan.** The event goes live
  immediately, an invoice is raised, and it is auto-charged to a saved card if
  the org has one, otherwise settled manually with "Pay now". This reverses the
  prepay flow from V2.8.0 (Rumen's call after live-testing it).
- Free orgs have no subscription and therefore usually no saved card, so in
  practice they will pay manually. The auto-charge simply no-ops when there is no
  card, and starts working by itself the moment they subscribe.
- **One guard kept.** Free has no subscription holding it honest, so a Free org
  cannot activate a NEW event while an earlier one is still unpaid
  (`UNPAID_INVOICE`). The first activation is always instant; this only bites on
  the second. Without it a Free org could keep activating events and never pay for
  any of them.
- Removed the now-dead prepay path: `prepayEventInvoice()`, the
  `prepare_event_invoice()` RPC (dropped rather than left as a reachable
  security-definer function), and the `PREPAY_REQUIRED` gate.
- Activation dialog copy updated: Free now reads "generate a bill … pay it from
  Billing, or it is charged automatically if you have a card saved."
- Note: `assert_event_activation_allowed` had to be DROPped and recreated (only
  a parameter rename), keeping the exact same (uuid, uuid, boolean) signature —
  changing the arity would create an overload and make the trigger's two-arg call
  ambiguous, which has broken every activation once already.

## V2.8.3 - 2026-07-14 (fix: paid Free-plan event could not be activated)
- **A Free-plan event that had just been paid for was locked to "Archived" and
  could not be activated.** The payment worked and the invoice showed as paid,
  but the event stayed at Ready with no way to go live.
- Cause: the event lifecycle treated `invoiced_at` as "this event has already
  run" — which was true when an invoice was only ever created AT activation. But
  Free-plan prepay (V2.8.0) deliberately creates the invoice BEFORE the event
  goes live, so there is something to pay for. So the moment a Free organiser
  paid, their event looked like it had already been run.
- Fix: `isEventActivated()` / `getAllowedEventStatuses()` /
  `canTransitionEventStatus()` / `isActivationBillingRequired()` now key off
  `events.activated_at` (added in V2.8.0 and only ever set when the event
  actually goes live) instead of `invoiced_at`.
- `isActivationBillingRequired` mattered just as much: keyed off `invoiced_at`, a
  Free organiser who opened the checkout and closed it would never be shown the
  payment again — the confirm dialog was skipped, so the prepay step never ran,
  and the gate rejected the activation with no way forward.
- Duplicating an event now clears `activated_at` too, or the copy would be born
  locked to "Archived".
- Added regression tests for the whole lifecycle, since this is precisely the
  case that slipped through.

## V2.8.2 - 2026-07-14 (PAY-1 fixes from Rumen's live test)
- **Payment was completely broken for any org without an email set.** A
  freshly-registered org has neither `contact_email` nor `email`, and
  `ensurePaddleCustomer` sent `email: null` straight to Paddle, which rejects it
  ("Expected: string, given: null"). The checkout 500'd, so no overlay ever
  opened and activation appeared to silently do nothing. Now falls back to the
  logged-in admin's own email, and if there is genuinely no email anywhere it
  returns a clear "Add a billing email in Settings" instead of a 500.
- **The real error was being hidden.** A failed checkout only ever reported
  "Could not start payment", swallowing the server's actual message. The prepay
  path now surfaces the server's `{ error }` text, so a misconfiguration says what
  it is instead of failing mutely.
- **Hitting the monthly limit now says when it lifts.** "You have used all 1 of
  your events this month. Your next event can be activated from 1 August 2026."
  Computed in UTC to match the gate's `date_trunc('month', now())` window.
- Known gap (not fixed here): registration never populates the org's email, which
  is what exposed this. The fallback covers billing, but the org profile should
  probably capture it at signup.

## V2.8.1 - 2026-07-14 (PAY-1 Stage 3: readable gate errors + plan usage)
- **Blocked activations were silently swallowed.** `confirmActivation` never
  caught the error the DB gate raises, so a refused activation left the dialog
  sitting open with no explanation at all. Now caught and surfaced.
- New `friendlyActivationError()` maps the gate's tagged exceptions
  (SUBSCRIPTION_REQUIRED / PREPAY_REQUIRED / EVENT_LIMIT_REACHED /
  TEAM_LIMIT_EXCEEDED / ORG_SUSPENDED) to plain language, pulling the real plan
  numbers out of the DB message ("You have used all 10 of your events this
  month"). Unrecognised errors pass through rather than being hidden. Unit-tested
  against the exact strings the SQL raises.
- Billing → Current plan now shows usage: "3 of 10 events activated this month",
  and calls out when the limit is reached.
- Activation dialog copy now matches what actually happens: Free plans read
  "Pay €199 and activate", paid plans say the card saved with the subscription
  will be charged.

## V2.8.0 - 2026-07-14 (PAY-1 Stage 2b: Free-plan prepay — billing loop complete)
- **Free plan now prepays.** It has no subscription to gate on and no saved card
  to auto-charge, so a Free org could previously activate an event and simply
  never pay. Now the per-event fee is collected BEFORE the event goes live, and
  the DB gate refuses to activate an unpaid Free event.
- New `prepare_event_invoice()` RPC creates an event's invoice without activating
  it, so there is something to pay for. It runs every other activation check
  (suspension, monthly limit, team limit) first, so we never take money for an
  event the org could not have activated anyway.
- New `events.activated_at`. The monthly-event limit used to count `invoiced_at`,
  which was only ever set at activation — but prepay creates invoices ahead of
  time, which would have let never-activated events eat the monthly quota. The
  limit now counts activations. Backfilled from `invoiced_at`.
- The activation trigger now creates the invoice BEFORE checking entitlement.
  Otherwise a Free org with a 100%-off promo (which produces a `comped` invoice,
  nothing to pay) could never activate: the gate would look for an invoice the
  next statement was about to create. Safe because both run in the same
  transaction as the status change — a failed gate rolls the invoice back.
- New `event_verify` checkout kind confirms payment with Paddle directly after
  the overlay closes, rather than waiting on the async webhook (which would race
  the activation). Idempotent with the webhook.
- **Fixed a latent break:** adding a defaulted third argument to
  `assert_event_activation_allowed` created an overload rather than replacing the
  Stage 1 function, so the trigger's two-arg call matched both candidates
  ("function is not unique") and would have failed EVERY activation. Stale
  signature dropped; verified both gates again after.

## V2.7.3 - 2026-07-14 (PAY-1 Stage 2a: subscription discounts + per-event auto-charge)
- **Subscription promo codes now reach Paddle.** A subscription-purpose promo
  code is applied as a real Paddle Discount object rather than being baked into
  the recurring price, because codes can be time-limited (`duration_months`) and
  a baked-in price would discount every renewal forever. Months are converted to
  Paddle's billing-interval count (on a yearly plan a sub-year duration rounds up
  to one year). The educational 50% stays baked into the price, since it is
  permanent while the org is approved.
- The code is only **consumed once payment actually completes** (via the webhook),
  so an abandoned checkout no longer burns it.
- **Per-event auto-charge.** Activating an event now charges its invoice straight
  to the card saved against the org's subscription (Paddle one-time subscription
  charge), so organisers do not have to press "Pay now" for every event.
  Deliberately fire-and-forget: a decline, a missing subscription or a network
  failure leaves the invoice unpaid and payable later, and can never disrupt a
  live event.
- A one-time subscription charge cannot carry transaction-level `custom_data`, so
  the invoice id is stamped on the inline price; the webhook reads it back from
  `items[].price.custom_data` to settle the invoice (no polling, no race).
- `subscription_transactions.amount_due` now records the post-discount amount.

## V2.7.2 - 2026-07-14 (PAY-1 Stage 1: server-enforced activation gate + plan limits)
- Event activation is now gated server-side, inside the same DB trigger that
  invoices it (migration 20260714120000). Raising there rolls back the
  activation, so it cannot be bypassed from the client. Rules:
  - Paid plans (Starter/Pro/Business) must have an active, paid-through
    subscription (`subscription_status` active/trialing AND
    `subscription_current_period_end >= now()`). No subscription or a lapsed
    period blocks activation.
  - Suspended orgs cannot activate.
  - Monthly event limit per plan (Free 1, Starter 10, Pro 20, Business 40).
  - Teams/players-per-event limit per plan (Free 10, Starter 20, Pro 30,
    Business 50). Enforced at activation on the event's team count.
  - Partner/Enterprise are exempt (billed directly, unlimited).
- New `organizations.subscription_status` / `subscription_current_period_end`,
  populated by the paddle-webhook function, which now handles subscription
  created/updated/activated/canceled/paused/past_due/resumed and records the
  status + current period end (the paid-through date the gate checks).
- New SQL `plan_monthly_event_limit()` / `plan_team_limit()` mirroring
  subscription-plans.ts (unit-tested to catch drift).
- Sandbox note: the first real Paddle subscription payment (RallyHub Gaming,
  Starter yearly) completed end to end - checkout, payment, webhook, DB.
- Still to come (Stage 2/3): subscription promo-code discounts wired to
  checkout, per-event auto-charge to the saved card at activation, Free-plan
  prepay, and in-app messaging for blocked/limit-reached states.

## V2.7.1 - 2026-07-14 (per-month pricing display + homepage pricing section)
- Plan prices now always shown per month, in three places: a new pricing
  section on the marketing homepage, the signup plan dropdown, and the in-app
  plan cards (Billing + Compare plans).
- Each paid plan reads e.g. "€15/mo · billed yearly · €180 once a year · or
  €20/mo billed monthly" — the cheaper number is the yearly-prepaid per-month
  figure (one charge a year), the higher is monthly billing. Free → "€0",
  Enterprise → "Custom / Price on request". All still marked excl. VAT.
- New `planPriceDisplay()` / `formatDualMonthlyPriceLine()` helpers in
  subscription-plans.ts (unit-tested) so all surfaces stay consistent. No
  change to what Paddle actually charges — display only.
- Homepage gets a "Pricing" nav link + `#pricing` section (Free/Starter/Pro/
  Business/Enterprise cards with per-event fee, event and team limits).

## V2.7.0 - 2026-07-14 (PAY-1: Paddle billing integration)
- Real online payment, replacing the old "invoices pile up unpaid" state.
  Paddle Billing (sandbox for now), inline overlay checkout via Paddle.js —
  no redirect off-site.
- Two payment flows, both non-blocking: activating an event is still instant
  and never gated on payment status. Paddle only ever settles invoices/
  subscriptions that already exist.
  - **Per-event invoices**: "Pay now" button on any unpaid event invoice in
    Billing, for its exact already-discounted `amount_due`.
  - **Subscriptions**: "Start subscription" button pays the current plan's
    price (yearly or monthly, educational discount applied). Only for orgs
    without an existing Paddle subscription yet — changing an active
    subscription's plan isn't built yet, contact support instead.
- New `organizations.paddle_customer_id` / `paddle_subscription_id` columns,
  `invoices.paddle_transaction_id`, and a new `subscription_transactions`
  table tracking subscription payment attempts.
- Two new Edge Functions: `paddle-checkout` (creates a Paddle transaction with
  an inline/non-catalog price — RallyHub's own pricing stays the source of
  truth, Paddle's dashboard never holds a duplicate price list) and
  `paddle-webhook` (public, HMAC-signature verified, marks invoices/
  subscription_transactions paid and writes `paddle_subscription_id` back to
  the org on `subscription.created`).
- Known gap: sandbox end-to-end test (real payment → webhook → DB) still
  pending on Rumen's side once `PADDLE_WEBHOOK_SECRET` is registered.

## V2.6.0 - 2026-07-13 (pricing plan revamp: Free/Starter/Pro/Business/Enterprise)
- Full pricing model update per Rumen's new plan table. New prices (all excl.
  VAT, disclaimer now shown wherever a plan/price is displayed):
  - **Free** (`rookie`): €0 · €199/event · 1 event/month · 10 teams/players per event
  - **Starter** (`arena`): €15/mo billed yearly (€180/yr) or €20/mo billed
    monthly · €149/event · 10 events/month · 20 teams/players per event
  - **Pro** (`pro`): €25/mo billed yearly (€300/yr) or €30/mo billed monthly ·
    €99/event · 20 events/month · 30 teams/players per event
  - **Business** (`max`, renamed from "Max"): €25/mo billed yearly (€300/yr) or
    €30/mo billed monthly · €49/event · 40 events/month · 50 teams/players per
    event · partially removes RallyHub branding
  - **Enterprise** (new plan, id `enterprise`): price on request, unlimited
    events, unlimited teams/players, fully removes RallyHub branding. Contact-
    sales only — excluded from self-serve registration (`getSelfServePlans()`);
    only a super admin can assign it. The DB's
    `create_event_activation_invoice()` already treated `enterprise` as comped
    like Partner, so its billing continues to be arranged directly rather than
    through per-event invoicing.
  - Monthly billing is genuinely available again for paid plans (was fully
    retired since an earlier release) — `monthlyPriceEur` now holds real values
    and `formatSubscriptionPrice` honours whichever period is selected.
- `SubscriptionPlan` gained `teamLimit` (teams/players per event) and
  `brandingRemoval` ('none' | 'partial' | 'full'), replacing the unused
  `customBranding` flag. New `formatTeamLimit()` / `formatBrandingNote()`
  helpers surface both on `PlanDetailsCard`, which previously only showed
  per-event price and event limit.
- Updated the server-side `plan_per_event_price_eur()` Postgres function to the
  same new per-event prices — this is what `create_event_activation_invoice()`
  actually bills against, so invoices now match the UI instead of silently
  using the old €150/€100/€50 figures.
- Note for Rumen: the Business tier's monthly/yearly subscription price is
  identical to Pro's (€25 or €30/month) in the table provided — implemented
  exactly as given, but flagging it in case that was meant to be higher.
- VAT: added a shared `VAT_DISCLAIMER` constant ("All prices exclude VAT.")
  shown on the billing overview, the compare-plans grid, and the register page's
  plan selector. Not added retroactively to historical invoice line items.

## V2.5.6 - 2026-07-13 (event-manager bingo activation)
- Completed event-manager facilitator access across the database RLS helper and
  Edge Function source. Event managers can now activate bingo runs, generate
  team cards, control live stages, and score/restart games for events in their
  own organisation. This fixes the false `0 / 0 songs` state where the panel
  played its first configured clip without a persisted bingo run. The database
  repair is live; the existing client fallback makes activation work while the
  Edge Function deployment awaits dashboard access.

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
