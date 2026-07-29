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

Each reset installs up to 24 active games from the existing RallyHub platform
library, copies the music catalogue, and creates 14 events spread across roughly
one year. Eleven events contain completed teams, scores, submissions, activity
logs, and invoices. The account also includes upcoming/draft events, a ready
`RallyHub Product Showcase`, inventory items, a paid Pro subscription history,
and one unpaid event invoice for testing the simulated checkout.

No made-up game templates are created. If the platform library is empty, reset
fails visibly instead of constructing content that cannot exist for real clients.

## Deployment order

Do not add the DNS record until the feature branch has been accepted.

1. Apply `20260730010000_demo_sandbox.sql`.
2. Deploy `demo-session`, `demo-reset`, `demo-billing`, and the updated
   `data-lifecycle` Edge Function.
3. Optionally set `DEMO_HOST=demo.rallyhub.games` and
   `DEMO_ACCOUNT_EMAIL=demo@rallyhub.games` as Supabase Edge Function secrets.
   Those are already the safe defaults; no demo password secret is required.
4. Set `VITE_DEMO_HOST=demo.rallyhub.games` in the web deployment and deploy the
   approved application branch to staging.
5. Smoke-test automatic entry, manual reset, a live event with two phones, an
   event invoice payment, plan upgrade/downgrade, and expiry at 30 minutes.
6. Only then attach `demo.rallyhub.games` to the web project and create the DNS
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
