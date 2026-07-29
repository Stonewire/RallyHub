# RallyHub public demo sandbox

The demo is a real tenant account with normal client-admin permissions, real
events, real join links, Realtime, scoring, uploads, games, and inventory. Its
special behavior is deliberately narrow:

- visitors to `demo.rallyhub.games` receive the shared demo session without a
  username or password;
- the database is restored to a deterministic showcase every 30 minutes;
- the admin shell shows the reset countdown and a manual **Reset now** control;
- event and subscription payments use an in-app checkout simulation and never
  call Paddle;
- the demo organization cannot be deleted;
- uploaded demo files are removed before the database snapshot is restored.

## Seeded showcase

Each reset installs every active game from the existing RallyHub platform
library and creates 14 events spread across roughly one year. The event game
sets rotate through the library so the history does not look duplicated. Eleven
events contain completed teams, scores, submissions, activity logs, and
invoices. The account also includes upcoming/draft events, a ready
`RallyHub Product Showcase`, inventory items, a paid Pro subscription history,
and one unpaid event invoice for testing the simulated checkout.

The Showcase always has four runnable stages: **RallyHub Quest**, **Quiz
Challenge**, **Refreshment Break**, and **Music Bingo Finale**. The Quest stage
includes a photo, video, text, and puzzle game. The quiz comes from the platform
library. Music Bingo is the only demo-only game because the platform library has
no bingo template yet.

Music Bingo contains 25 locally hosted 30-second excerpts by HoliznaCC0 from
the [Public Domain Lofi album](https://freemusicarchive.org/music/holiznacc0/public-domain-lofi).
The artist marks the album CC0/public domain; the governing license is
[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).
The clips live under `game-assets/demo-stock-music/holizna-cc0`, outside the
per-reset demo organization prefix, so a reset does not delete them. The
original source URLs remain in the music catalogue for provenance.

No other made-up game templates are created. If the platform library has no
active games or no active quiz, reset fails visibly instead of constructing
content that cannot exist for real clients. Platform game names, configuration,
and images are recopied on every reset, so later platform-library updates appear
in the demo after the next automatic or manual reset.

## Deployment order

1. Apply `20260730010000_demo_sandbox.sql`.
2. Set `FFMPEG_PATH` to an ffmpeg-compatible binary and upload the CC0 clips
   with `node --env-file=.env scripts/seed-demo-music.mjs`, then apply
   `20260730020000_expand_demo_showcase.sql`.
3. Deploy `demo-session`, `demo-reset`, `demo-billing`, and the updated
   `data-lifecycle` Edge Function.
4. Optionally set `DEMO_HOST=demo.rallyhub.games` and
   `DEMO_ACCOUNT_EMAIL=demo@rallyhub.games` as Supabase Edge Function secrets.
   Those are already the safe defaults; no demo password secret is required.
5. Set `VITE_DEMO_HOST=demo.rallyhub.games` in the web deployment and deploy the
   approved application branch to staging.
6. Smoke-test automatic entry, manual reset, a live event with two phones, an
   event invoice payment, plan upgrade/downgrade, and expiry at 30 minutes.
7. Attach `demo.rallyhub.games` to the web project and create the DNS
   CNAME using the hosting provider's exact target.

## Operational notes

- The timer is global for the shared sandbox, not per visitor. A reset affects
  everyone currently using the public demo.
- A visitor arriving after expiry triggers a restore before sign-in. An open
  admin session also restores at zero, so no always-on cron is required.
- Reset is transactionally serialized by locking the demo organization row.
- The shared session is still restricted by the same organization RLS as a real
  client admin. Service-role access stays inside the three demo Edge Functions.
- The `is_demo` flag, reset schedule, tenant identity, and billing identifiers
  are protected from direct writes by the shared authenticated user.
