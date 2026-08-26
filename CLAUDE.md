# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Branch workflow

- Two levels only. Substantial features get a `feature/<short-name>` branch; everything else may go straight to `main`. `main` is live production (Vercel).
- `staging` and `dev` are retired (7 Aug 2026). Do not merge into them or keep them aligned.
- Pushing to `main` is expected, not an exception, but never push while a client event is `active`. Check first when the change touches live surfaces. Own test events are fine.
- Branch `stable-2.0` is the frozen pre-2.1.0 fallback. The old `bug-fixes` branch is historical, no new work.
- Every main push bumps `APP_VERSION` in `src/lib/version.ts` (MAJOR.MINOR.PATCH: patch for small fixes, minor for feature batches, major for big updates) and adds a `CHANGELOG.md` entry. `package.json` version stays `0.0.0`, never bump it.
- `TRACKER.md` at the repo root is the living checklist of bugs, re-lands and planned work. Read it before touching scoring, realtime, offline, or RLS-sensitive code, and update it as items land.

Rules that keep live events safe: one live-path change per commit, so a single `git revert` undoes exactly one thing. Anything touching bingo, realtime, or the player view gets a live smoke test before the next change. Admin-only work (editors, settings, dashboards) is the safe zone and can move faster.

## Commands

```bash
npm run dev             # Vite dev server (HMR)
npm run build           # tsc -b && vite build (the ONLY type-check; dev and test skip it)
npm run lint            # ESLint (flat config, eslint.config.js)
npm test                # vitest run, full suite
npm test -- src/lib/bingo-core.test.ts   # single test file
npm run test:watch      # vitest watch mode
npm run preview         # serve the production build locally

# Node scripts (need VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in repo-root .env)
npm run seed:test-event         # throwaway test event (optional SEED_ORGANIZATION_ID)
npm run seed:all-orgs
npm run load:test               # N simulated phones over the real anon join path (also needs VITE_SUPABASE_ANON_KEY)
npm run catalog:list-storage
npm run catalog:repair-urls     # dry run; :apply variant writes
```

Tests: 48 files, colocated as `src/**/*.test.ts(x)`. Vitest config lives in the `test` block of `vite.config.ts` (no vitest.config file). Default environment is deliberately `node`; DOM tests opt in per file with a `// @vitest-environment jsdom` docblock. Bingo scoring, puzzle scoring, offline scoring parity and i18n locale parity are all covered: run the suite before touching any of them.

The service worker registers in production builds only, so offline behaviour and PWA install are untestable on `npm run dev`. Use `npm run build` + `npm run preview` or a deployed origin.

## Environment

Copy `.env.example` to `.env`. Required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Host vars (code fallbacks match production): `VITE_PLATFORM_HOST` = app.rallyhub.games, `VITE_ADMIN_HOST` = admin.rallyhub.games, `VITE_DEMO_HOST` = demo.rallyhub.games. Optional: `VITE_TENANT_HOST`, `VITE_TURNSTILE_SITE_KEY`, `VITE_PLATFORM_ORG_ID`, `VITE_PADDLE_CLIENT_TOKEN`, `VITE_PADDLE_ENVIRONMENT` (anything but exactly `production` means sandbox), `VITE_ENABLE_PLAN_CHANGES` (strict `=== 'true'`). Server-side secrets (Turnstile, Paddle, data-lifecycle cron) live in Supabase Edge Function secrets or Vault, never in browser env.

Local multi-tenant testing: `?tenant=<subdomain>` on any URL, or `<subdomain>.localhost`.

## Architecture

React 19 + Vite SPA on Vercel; Supabase (Postgres + RLS, Realtime, Storage, Edge Functions) is the entire backend. Path alias `@/` maps to `src/`.

### Hosts and multi-tenancy (domain architecture v2)

Four production hosts. `parseTenantFromHost()` in `src/lib/tenant.ts` resolves tenant vs platform context; the admin host and apex resolve as platform there and are told apart separately in `src/router.tsx`:

- `rallyhub.games` (apex): marketing site.
- `app.rallyhub.games`: the client app. Client admin panels are path-based: `/:clientSlug/admin/*` (via `PathTenantScope`). Live event pretty links are `/{clientSlug}/{eventSlug}/join|display|facilitator`, resolved by `SlugRedirects` to the UUID routes.
- `admin.rallyhub.games`: super-admin (RallyHub staff) panel only.
- `demo.rallyhub.games`: synthetic `demo` tenant, stays fully host-based.

Legacy tenant hosts are `{client}.app.rallyhub.games` (subdomains of the platform host); their bare `/` redirects to the path-based scheme, while deep legacy links still serve directly via the host-scoped mounts. The resolved tablet kiosk route is unchanged, but the canonical shareable tablet link is now the pretty `/{clientSlug}/tablet` form (`src/lib/tablet-link.ts`). Live-surface paths force platform context regardless of host. Reserved slugs (`src/lib/public-routes.ts`, mirrored by a DB trigger) block both subdomains and first path segments.

Roles: `super_admin` > `client_admin` > `event_manager` > `facilitator`, capabilities centralised in `src/lib/auth-routes.ts`. Facilitators get `/facilitator/*` plus a trimmed admin slice; a separate `StaffRole` layer (owner, platform_admin, support_agent, content_manager, finance) scopes what staff see inside the super-admin panel. Wrong-domain enforcement (`wrongDomainRedirectUrl` in `src/lib/auth-routes.ts`, localhost exempt): super_admin may only sign in on the admin host; client roles are rejected on the admin host (other hosts are not challenged). The login form shows a jump-link error; an already-live session on the wrong host is signed out locally and sent to the right host's `/login`.

### Route surfaces

| Path | Purpose |
|------|---------|
| `/:clientSlug/admin/*` | Client org admin (events, games, team, settings, support) |
| `/admin/*` | Host-scoped admin mount; super-admin children (clients, payments, promo codes) exist only here |
| `/join/:eventId` | Participant join + gameplay (anonymous) |
| `/display/:eventId` | Audience display (anonymous, read-only, must not write timers) |
| `/facilitator/:eventId` | Facilitator live control panel (login required) |
| `/:clientSlug/tablet` | Canonical tablet link, redirects to the kiosk route |
| `/tablet/:orgSlug/:tabletCode` | Tablet kiosk score entry (`orgSlug` is the slugified org NAME, not the tenant subdomain) |
| `/login`, `/register`, `/contact`, legal pages | Shared |

Both admin mounts share one `adminRouteChildren` array in `src/router.tsx`, so they cannot drift; keep it that way.

### Live event data flow

Live state is a `LiveEventBundle` (`src/lib/live-event.ts`): event, organization, event_state, teams, games, submissions (capped to the 1000 most recent). Updates arrive as `LiveBundlePatch` messages over a Supabase Realtime broadcast channel named from the event id plus the first 16 chars of the join token (`src/lib/live-broadcast.ts`). Only `event_state`, `team` and `submission` patches merge into the bundle; `bingo_run`, `bingo_team_card` and `puzzle_progress` have dedicated handlers, and `full_reload` triggers a debounced refetch. Publishing is best-effort and never blocks a write.

Safety nets in `src/hooks/use-live-event.ts`: a 4s poll of the `event_state` row (anonymous players do not reliably receive Realtime), guarded by `updated_at` so it never clobbers newer state, plus a postgres_changes channel with capped exponential backoff. `event_state` writes are last-write-wins (single-facilitator assumption, documented as P2-1); three stale-write guards exist (the poll compares `updated_at`, the broadcast and postgres_changes handlers also check `lastWrittenAtRef`), so keep `lastWrittenAtRef` in sync in any new update path. Never subscribe postgres_changes to `event_games`: it is not in the Realtime publication and subscribing kills the whole channel.

Tokens:
- **Join token** (per event, shared): minted by the `bootstrap_live_event_access` RPC (only for events in status active/ready/demo), stored in sessionStorage, attached as `x-join-token` by the fetch interceptor in `src/lib/supabase.ts`. An expired token fails silently (RLS filters reads to empty); `fetchBundle` clears and re-mints once, mirror that pattern in any new read path.
- **Team token** (per device, secret): minted at team claim, stored in the participant session (localStorage), attached as `x-team-token` on `/rest/v1/` requests ONLY. Never send it to Edge Functions or Storage: their CORS preflight rejects it and the browser then drops the real request (this once killed all participant uploads). Puzzle and store RPCs take it as an explicit argument instead.
- **Participant anon mode**: `setLiveParticipantMode(true)` forces the anon key Authorization header so a logged-in facilitator testing the join flow does not write as `authenticated` (which RLS blocks). It is module-global; `FacilitatorEventPage` explicitly turns it off.

Game-config secrets (quiz answers, puzzle answers, solution videos) are stripped server-side by `redact_game_config_for_live` for anonymous callers (participants, display); authenticated org members and staff receive unredacted config since V3.15.3 (`caller_may_see_event_solutions`). Quiz reveals still go through the `reveal_quiz_answer` RPC, which writes the revealed state atomically. New secret fields must be added to the redactor, not just typed.

### Offline subsystem (OFFLINE-1, V3.19.0 to V3.21.4)

Quest stages play fully offline; quiz and music bingo are lock-step with the room and stay online-only by design (the player view says so). Spec: `docs/OFFLINE-MODE-SPEC.md`. Code: `src/lib/offline/` (outbox, outbox-persistence, idb, blob-cache, package, scoring, puzzle-local, store-snapshot, bundle-snapshot, net) plus `public/sw.js`.

- The outbox carries three kinds: `open-submission`, `puzzle-result`, `store-order`. Every open-stage submission goes through it even online, so submit returns instantly; offline store orders drain through the same queue and error taxonomy. Queue records persist to IndexedDB, media blobs to the Cache API (150 MB cap, 50 MB headroom guard).
- Error taxonomy is load-bearing: `NetworkSubmitError` retries forever, plain `Error` counts toward 8 attempts then drops, `PermanentSubmitError` drops immediately. Misclassifying an outage destroys queued player work.
- The submission `clientId` doubles as the DB primary key: duplicate-key on drain is the dedup mechanism. Drained rows keep their original `created_at`.
- Answer package (`get_offline_event_package` RPC, team-token gated): text answers ship as sha256 hashes for auto-approve games ONLY (review-mode answers never leave the server); puzzle answers ship plaintext (accepted leak). Offline text scoring must stay byte-identical to the server trigger: Postgres `btrim` strips spaces only.
- Puzzles finished offline enqueue exactly one result; `submit_offline_puzzle_result` re-validates and re-scores server-side with FOR UPDATE locking plus a partial unique index, and deliberately skips the submissions-open check (the device reconnected late; do not add it). Once local puzzle play starts, it stays local until completion.
- Rehydration is event AND team scoped (slot takeover safety); tokens are read fresh at drain time, never persisted in the queue.
- `public/sw.js`: runtime caching only, offline app boot from a cached shell plus the IndexedDB bundle snapshot. The cleanup step deletes unknown caches except the `rallyhub-offline-blobs` prefix; renaming the blob cache without keeping that prefix wipes queued submissions on SW update. Shell and asset caches version together via `OFFLINE_BOOT_VERSION`.

### Games and stages

Six game types (`GameType` in `src/types/database.ts`): `photo | video | quiz | music_bingo | text | puzzle`. Stage types (`EventStage` in `src/types/game-config.ts`): `open | quiz | bingo | break | welcome | end`. Welcome and End are auto-pinned bookends managed by `ensureBookendStages()` in `src/lib/event-form-utils.ts`; they are only ever injected into never-activated events, because reshaping a live event's `stages_config` shifts `event_state.current_stage_index`. Open stages hold multiple games via `stage.gameIds`; quiz and bingo stages hold one via `stage.gameId`. Both fields exist on every stage, so reading the wrong one silently yields nothing.

`GameConfig` is one flat typed JSON column shared by all types. Puzzles (wordle, matching, crossword) are `puzzle_*` fields inside it, with private answer fields stripped from live payloads. Music bingo: org-level `music_catalog`, clips cut client-side with ffmpeg.wasm (core fetched from unpkg at runtime, so clip extraction needs network), seeded 5x5 cards and a shuffled no-repeat play order from `src/lib/bingo-engine.ts`.

Prep tooling (admin-only, never sent to live surfaces): `games.prep_status`, checklist tags in `games.config` and `inventory_items.checklist_items`, per-event `event_tasks` table, aggregated event checklist whose tick state (`events.checklist_state`) resets whenever the team count changes.

### Internationalisation

Five languages, typed as `AppLanguage` in `src/lib/i18n.ts`: `en | bg | es | fr | nl`. Four namespaces (`common`, `live`, `facilitator`, `admin`) as JSON under `src/locales/<lang>/<ns>.json`. English is bundled and initialised synchronously; the rest lazy-load. Locale parity is test-enforced: every language must be key-identical to English with no empty values, so adding a string means editing all five locale files or `npm test` fails.

Language resolution per surface: the admin panel follows `organizations.default_language` (via `useAdminLanguage` in `AdminLayout`); live surfaces follow `events.language` (set from the bundle in `use-live-event.ts`); on multilingual events (`events.multilingual` + `events.available_languages`) each participant device pins its own choice, which wins over the event language on that phone only (and is persisted best-effort to `teams.language` so a replacement phone inherits it); display and facilitator never pin. The super-admin panel, marketing pages and auth pages are deliberately English-only, and the language picker itself is intentionally untranslated.

Outside React, import `{ i18n }` from `@/lib/i18n` (never `i18next` directly) so the English bootstrap is guaranteed. The five-language list is duplicated across the type, the parity test and four SQL check constraints; adding a language touches all of them. Any migration that re-creates the tenant RPCs must copy the current return table including `default_language`: a demo-account migration already regressed this once (fixed by `20260820020000`).

### Data layer

- `src/lib/supabase.ts`: the singleton client and the fetch interceptor (join token, team token, anon mode). All browser DB access goes through it.
- Query keys: `src/lib/query-keys.ts` is the main factory, but support tickets use `src/hooks/support-query-keys.ts` and super-admin hooks use inline `['rallyhub', ...]` literals that other files invalidate by exact string. Do not rename or "centralise" them; cross-file invalidation depends on the literals.
- `src/types/database.ts` is hand-authored (not generated). Schema changes mean editing it manually; running Supabase type generation would clobber the domain unions and comments. `src/types/helpers.ts` provides `Tables<T>` / `TablesInsert<T>` / `TablesUpdate<T>`.
- Hooks in `src/hooks/` wrap React Query; heavier business logic lives in `src/lib/` with colocated tests.

### Components and styling

- `src/components/neo-minimal/`: the design system layer (NeoButton, NeoCard, NeoInput, SegmentedPill, FlipSwitch, TagInput, ...). New admin and live UI builds on this.
- `src/components/ui/`: shadcn primitives plus project-owned custom components that ARE actively maintained here: `number-field.tsx` (field may sit empty while deleting, mouse wheel never edits the value), `cover-image.tsx`, `status-indicator.tsx`, `rich-text.tsx`, `rich-text-editor.tsx`. Leave the stock shadcn primitives alone; edit the custom ones as needed.
- `src/components/live/` (facilitator + participant), `src/components/admin/`, `src/components/routing/` (layout shells, guards, tenant scopes, slug redirects).
- Styling is Tailwind CSS v4, CSS-native config: no tailwind.config file. Tokens map in `@theme inline` in `src/index.css` to `--nm-*` variables in `src/styles/neo-minimal.css` (light and dark). Brand: gold #FFC107 always paired with charcoal text, charcoal ink, soft shadows over borders. Inter is the app-wide font, headings included; Abril Fatface survives only in marketing display type. `DESIGN.md` is stale on typography and exact surface colours: trust the CSS.
- Brand assets: `public/brand/` (PWA icons in `public/brand/pwa/`).

## Known issues

`TRACKER.md` is the source of truth for open bugs and planned work. Long-standing live risks: teams joining mid-bingo (H6), event_state last-write-wins with multiple facilitators (P2-1). `docs/AUDIT-2026-06.md` and `docs/SECURITY-REVIEW-2026-07.md` are historical audit records.
