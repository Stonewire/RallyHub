# Idea: RallyHub Companion App (our own Hermit)

Date: 2026-07-31
Status: idea, not scheduled
Origin: the 30-31 Jul 2026 capture investigation. One full day of fighting a
third-party wrapper (Hermit) taught us exactly what a wrapper must do well,
and that we cannot fix the one we do not own.

## The problem it solves

Events run RallyHub's web apps on tablets and phones through a wrapper today
(Hermit) because organisers want an app-like, locked-down, home-screen
experience rather than a browser tab. Tonight proved the cost of not owning
that wrapper:

- Hermit's WebView intermittently stalls JPEG encoding for a near-constant
  ~13 seconds (worked around in V2.20.35, never fixable at the source).
- It serves stale cached bundles and masquerades as Chrome, so a device can
  silently run week-old code and cannot be identified from diagnostics.
- Its network layer never delivered a single diagnostics row while Chrome on
  the same tablet delivered every one.
- Camera behaviour differs from Chrome on the same hardware, and we have no
  say in any of it.

## What it is

One RallyHub-branded app on the App Store and Play Store that wraps our web
applications (there will be many) in a shell we control end to end. An
organiser or participant installs it once; it opens RallyHub experiences by
link, QR code, or tablet code, full screen, fast, and predictable.

## How it runs well (the lessons, inverted)

1. **Native camera bridge, not WebView getUserMedia.** The single biggest
   win. The shell exposes a native capture screen (camera preview, shutter,
   review) and hands the finished JPEG or video file to the web layer over a
   bridge. Every problem from tonight (encoder stalls, orientation lies,
   resolution negotiation, desktop-mode quirks) simply does not exist on
   that path, because iOS and Android native camera APIs are the same ones
   the built-in camera apps use.
2. **Cache we control.** The shell always revalidates the app shell HTML on
   launch and shows the running build version; stale bundles become
   impossible rather than undetectable.
3. **A real identity.** The shell sets an explicit RallyHub user agent and
   injects device context, so diagnostics can always say exactly what ran
   where.
4. **Kiosk mode for event tablets.** Pinned full screen, wake lock, screen
   always on, optional exit code. Replaces Hermit plus Android's screen
   pinning in one place.
5. **Reliability plumbing.** Native-level network retry for uploads,
   offline queueing for submissions, and push notifications later if wanted.

## How we could build it

- **Recommended: Capacitor shell.** One codebase, TypeScript, produces both
  the iOS and Android apps. The web apps stay exactly as they are and load
  from our servers; native plugins (camera, wake lock, app version, secure
  storage) are small and mostly off the shelf. This is the lowest-effort
  path that still gives us the native camera bridge.
- Alternative: two thin fully-native WebView apps (Swift + Kotlin). Maximum
  control, roughly double the work, only worth it if Capacitor's WebView
  itself ever becomes the bottleneck (it uses the same system WebViews, so
  the camera bridge matters more than the framework choice).

## The one hard constraint

Apple rejects apps that are nothing but a wrapped website (guideline 4.2,
minimum functionality). The app must ship real native value: the camera
bridge, kiosk mode, QR joining, and offline submission queueing are exactly
that, and they are the features we want anyway. Google Play is far more
permissive but the same features serve it.

## Rough phasing

1. Capacitor shell that opens RallyHub URLs full screen with controlled
   caching and the version stamp: a working Hermit replacement for our own
   tablets, sideloaded, no stores involved yet.
2. Native camera bridge for photo, then video, behind a capability check the
   web apps already know how to fall back from.
3. Kiosk mode and tablet-code entry; replace Hermit at real events.
4. Store submissions (App Store review is the long pole; build the 4.2
   story around the native features).
5. Later: push notifications, offline queueing, per-org branding.

Effort guess, honestly rough: phase 1 is days, phases 2-3 a few weeks of
part-time work, store approval adds calendar time rather than effort.
