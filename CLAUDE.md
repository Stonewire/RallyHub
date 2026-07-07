# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow (since 2 Jul 2026)

- Work happens on the `fixes` branch. Push only to `fixes`; merge to `main` only when Rumen says so.
- `TRACKER.md` at the repo root is the living checklist of bugs, re-lands, and planned features. Update it as items land.
- Every push to `main` bumps `APP_VERSION` (`src/lib/version.ts`) using three-number versioning: patch for small fixes (2.0.1), minor for bigger updates (2.1.0), major for big new features (3.0.0). Add a CHANGELOG.md entry each time.

## Commands

```bash
npm run dev           # start dev server (Vite HMR)
npm run build         # TypeScript check + Vite production build
npm run lint          # ESLint
npm run preview       # preview the built app locally

# Seed / maintenance scripts (require SUPABASE_SERVICE_ROLE_KEY in .env)
npm run seed:test-event
npm run seed:all-orgs
npm run catalog:list-storage
npm run catalog:repair-urls
npm run catalog:repair-urls:apply
```

Tests run with vitest: `npm test` (or `npm run test:watch`). Colocated as `src/**/*.test.ts`; the bingo scoring core (win detection, cell matching, card generation) is covered — run the suite before touching any bingo or scoring code. Type-checking runs as part of `npm run build`.

## Environment

Copy `.env.example` → `.env` and fill in:
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — required for all app features
- `VITE_PLATFORM_HOST` — defaults to `rallyhubapp.vercel.app`
- `VITE_TENANT_HOST` — optional, for multi-domain setups (not needed on Vercel Hobby)

For local multi-tenant testing: append `?tenant=<subdomain>` to any URL, or use `<subdomain>.localhost`.

## Architecture

### Multi-tenant model
The app serves two distinct contexts determined at runtime by `parseTenantFromHost()` (`src/lib/tenant.ts`):

- **Platform host** (`rallyhubapp.vercel.app` / `localhost`): shows the RallyHub super-admin interface — client management, platform game library, cross-org support.
- **Tenant host** (org subdomain or `?tenant=` query param): shows the client org's admin panel and all live event surfaces.

The root `RootPage` in `router.tsx` redirects based on this context. `<TenantScope>` (wrapping `/admin` and `/login`) provides tenant-resolved org data via `TenantProvider`.

### Role hierarchy
`super_admin` → `client_admin` → `event_manager` → `facilitator`

Role capabilities are centralized in `src/lib/auth-routes.ts`. Facilitators (`facilitator` role) can only access `/facilitator/*`; they have no admin panel.

### Route surfaces
| Path | Purpose |
|------|---------|
| `/admin/*` | Client org admin: events, games, team, settings, support |
| `/facilitator/:eventId` | Facilitator live control panel |
| `/display/:eventId` | Audience display screen (read-only; must not write timers) |
| `/join/:eventId` | Participant join + gameplay |
| `/tablet/:orgSlug/:tabletCode` | Tablet kiosk (score entry) |
| `/` (platform host) | Marketing landing page |
| `/admin/clients/*` | `super_admin` only — client management |

### Live event data flow
Live event state is managed as a `LiveEventBundle` (`src/lib/live-event.ts`) — a snapshot of the event, teams, games, submissions, and `event_state`. Updates arrive as `LiveBundlePatch` messages over a Supabase Realtime broadcast channel (`src/lib/live-broadcast.ts`) and are merged in-place without refetching the whole bundle.

**Join token system**: Participant and display pages are always anonymous. `ensureLiveEventAccess()` (`src/lib/live-event-access.ts`) calls the `bootstrap_live_event_access` RPC to mint a short-lived join token stored in `sessionStorage`. The token is attached as an `x-join-token` header by the custom `fetch` interceptor in `src/lib/supabase.ts`.

**Participant anon mode**: `setLiveParticipantMode(true)` forces the `Authorization` header to the anon key, overriding any logged-in session. This is required so facilitators testing the join flow in the same browser don't accidentally write as `authenticated` role (which RLS blocks for participant submissions).

### Game types
`photo` | `video` | `quiz` | `music_bingo` | `text`

Game configuration is stored as a typed `GameConfig` JSON column (`src/types/game-config.ts`). Event stages (`EventStage`) reference game IDs and have types: `open`, `quiz`, `bingo`, `break`.

**Music bingo** is the most complex game type: tracks are stored in the org's music catalog, audio clips are extracted client-side via ffmpeg.wasm (`src/lib/extract-audio-clip.ts`), and each team gets a seeded-random 5×5 card built by `bingo-engine.ts`. Play order is a separate shuffled list so no track repeats.

### Data layer conventions
- `src/lib/supabase.ts` — singleton Supabase client; all DB access goes through it
- `src/lib/query-keys.ts` — centralized React Query key factory; always use these
- `src/types/database.ts` — hand-authored DB type definitions (not auto-generated from Supabase)
- `src/types/helpers.ts` — `Tables<T>` / `TablesUpdate<T>` convenience extractors
- Hooks in `src/hooks/` wrap React Query for data fetching; business logic lives in `src/lib/`

### Component layers
- `src/components/ui/` — shadcn primitives (do not edit directly)
- `src/components/neo-minimal/` — `NeoButton`, `NeoCard`, `NeoFormFields`, etc. — the design system layer used in admin and live panels
- `src/components/live/` — live event UI (facilitator panel, display, participant)
- `src/components/admin/` — admin panel UI
- `src/components/routing/` — layout shells and route guards (`RequireAuth`, `RequireTenantAccess`, `HostAdminLayout`, etc.)

Path alias: `@/` → `src/`

## Known issues

`TRACKER.md` at the repo root is the live checklist of open bugs, re-lands, and planned work — check it before touching scoring, realtime, or RLS-sensitive code, and follow its "How we avoid breaking things" rules. `docs/AUDIT-2026-06.md` holds the detailed June 2026 audit findings (historical; its Fixed statuses predate the V2.0 rollback). Several scoring paths have known race conditions and the live bundle has known stale-data gaps; teams joining mid-bingo (H6) remains a live risk.
