# RallyHub Changelog

Version shown small under "Sign out" in the admin sidebar (`src/lib/version.ts`).
Bump `APP_VERSION` and add an entry here on each meaningful update merged to `main`.

## V2.1 (2026-07-01) live stability fix
Reverted the P1-1 safety-net reload that reloaded the whole event every 15-20s
and froze interaction: bingo picks and photo submits stuck on loading until a
refresh. Restored the prior behaviour (light 4s event-state poll plus the live
broadcast). Bumped the visible version so the deployed build can be confirmed at
a glance under "Sign out".

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
