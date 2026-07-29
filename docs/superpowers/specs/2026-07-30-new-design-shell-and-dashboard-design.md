# New Design: App Shell + Client Admin Dashboard

Date: 2026-07-30
Branch: `feature/new-design` (created off `main`)
Phase: 1 of N. This phase covers the app shell and the client admin Overview page only.

## Purpose

Rebuild the client admin panel to match the new design in `new-design/`, starting with the shell (sidebar + header) and the Overview/Dashboard page. Once this is signed off, the same structure, tokens and component language get applied to Games, Events, Organisation, Billing, Support and My Account in later phases.

The design reference is `new-design/Gaming Dashboard - Professional.dc.html` with a written handover at `new-design/README.md`. That HTML is a prototype, not production code. It is not embedded or copied wholesale; it is the visual and behavioural spec that gets reimplemented against the real components, real data and real auth.

## Ground rule for gaps

The design does not contain every button and feature the app already has. Where the design is missing something that exists today, the existing capability is preserved unless explicitly dropped in the Decisions section below. Nothing gets silently deleted because it was absent from a mockup. Any new gap discovered during implementation stops and asks rather than guessing.

## Decisions (locked)

These were settled during brainstorming and are not open for re-litigation during implementation.

| Area | Decision |
|---|---|
| Phase 1 scope | Full shell (new header + reskinned sidebar) plus the Overview page. Later screens reuse the shell. |
| Role logic | Keep all current permission rules exactly as they are. Reskin only. Facilitator and event_manager nav variants survive. |
| Surface palette | Move to the design's cool grey surfaces. |
| Accent | Keep brand yellow `#ffc107`. Do not adopt the design file's `#FEC10A`. |
| Font | Adopt Inter. Replaces Manrope and Abril Fatface in the admin shell. Deliberate change: the current fonts read as distracting. |
| Org nav | Flatten Organisation and Billing to two top-level sidebar items. They still land on the existing settings routes underneath. |
| Overview stat cards | Keep the useful existing ones. Available Games and Upcoming Events from the design, plus Live Now and Total Events folded into the same row. Drop the Your Plan card and the Quick Links card. |
| Recent Activity | Reuse the existing recent-events data, restyled into the design's activity-feed look. No new activity-log backend this phase. |
| Chart | Real chart with real data. Main 30-day activity chart with a metric switcher, plus a game-type breakdown panel beside it. |
| Chart library | None. Hand-rolled inline SVG for the line/area chart, CSS bars for the breakdown. No new dependency. |
| Header search | Build for real. Live results across games, events and support tickets. |
| Help modal | Build the modal and its search UI, wired up with zero articles. It always shows the "no matches, open a ticket" state until real content exists. |
| Exit | Build the design's flow: confirm, real sign-out, then the full-screen "You've been logged out" card with Log Back In. |
| New Game / New Event buttons | Present in the header, wired to today's existing creation flows. The design's own slide-over game editor and full-screen event editor are later phases. |

## Architecture

### Token layer

A new cool-grey token set is added to `src/styles/neo-minimal.css` alongside the existing `--nm-*` variables, keyed to the same names the shell already consumes so existing components inherit the new surfaces without edits. The design's `--color-*` naming is not introduced as a second parallel system; its values are mapped onto the existing token names to avoid two competing vocabularies.

Mapping:

- `--nm-bg-base` becomes `#F7F7F8`
- `--nm-bg-surface` and `--nm-bg-elevated` become `#FFFFFF`
- `--nm-text-primary` becomes `#1F2126`
- `--nm-border` becomes `rgba(31,33,38,.14)`
- `--nm-yellow` stays `#ffc107`
- The design's accent-2 slate ramp (`#EDEEF0` to `#121317`) and neutral ramp (`#F7F7F8` to `#1A1B1F`) are added as new `--nm-slate-100..900` and `--nm-neutral-100..900` variables, since the current system has no tint ramps and several new-design components need them.

Dark mode mirrors the ramps as the handover specifies (bg `#15161A`, surface `#1E2025`, text `#F1F1F3`, ramps reversed 100 to 900). The existing `.dark` block is updated in place, not duplicated.

Radii tighten to the design's `3px` / `6px` / `10px` scale via the existing `--nm-radius-*` variables.

Inter is loaded and `--font-sans` and `--font-heading` both point at it. `--font-display` (Abril Fatface) is removed from the admin shell.

Because these token names are already consumed app-wide, this is a global visual change to every screen using `.neo-minimal-scope`, not just the two being rebuilt. That is accepted: it keeps one token system instead of two, and later phases restyle those screens anyway. The branch is not merged until the whole redesign is signed off, so production is unaffected in the meantime.

### Shell

Three new components under `src/components/shell/`:

- `AdminHeader.tsx`: the 40px header bar. Sidebar collapse toggle on the left; on the right, search, New Game, New Event, theme toggle, Help, Exit, avatar, with the dividers the design specifies. Owns no data itself; composes the pieces below.
- `HeaderSearch.tsx`: the 240px search input, its results dropdown and its no-matches state.
- `HelpModal.tsx`: the searchable help-article modal with its empty state.

`AdminAppSidebar.tsx` is modified rather than replaced. Its role-gating logic (`isFacilitatorOnlyRole`, `canAccessOrgSettings`, `canManageOrgUsers`, `showPersonalProfileNav`) is preserved verbatim. The changes are: the collapsible Org Settings group is replaced by flat Organisation and Billing items; the theme toggle and Sign out move out of the sidebar footer into the header; the Support button stays bottom-anchored as the design shows; widths become 168px expanded and 64px collapsed with a `width .15s ease` transition.

`AdminLayout.tsx` gains the header between the sidebar and the scrolling outlet, and drops the floating `SidebarTrigger` since the collapse control now lives in the header.

The logged-out interstitial is a new `LoggedOutScreen.tsx` under `src/components/auth/`, shown as a full-screen overlay after a successful sign-out from the header Exit button.

### Overview page

`ClientDashboardPage.tsx` is rewritten as a thin composition of four new components under `src/components/dashboard/`:

- `StatCard.tsx`: kicker label, large 40px number, small delta line beneath. Used four times.
- `ActivityFeed.tsx`: the icon-plus-text-plus-relative-time rows, fed by the existing recent-events query.
- `ActivityChart.tsx`: the hand-rolled SVG chart plus its metric switcher tabs.
- `GameTypeBreakdown.tsx`: the CSS-bar panel showing which game types are being played.

Layout follows the design: a stat row, the chart occupying the large right region spanning two rows, and the activity feed beneath the stats. The design's fixed `944px × 428px` chart dimensions are treated as an indicative aspect ratio, not literal pixels; the chart is responsive and the SVG uses a viewBox.

Page title becomes "Overview" with the design's subtitle copy. The existing `AdminPageShell` wrapper is bypassed for this page because the design's header treatment differs from `NeoPageShell`'s; the page renders its own heading block.

### Data layer

`src/hooks/use-dashboard.ts` gains two queries. Both go through the existing `queryKeys` factory, with new keys added to `src/lib/query-keys.ts`.

`useActivitySeries(organizationId, metric)` returns 30 daily buckets for the selected metric. Two metrics are supported:

- Submissions per day: count of `submissions` rows grouped by day.
- Teams playing per day: distinct `team_id` per day.

"Active players per day" is deliberately not offered: there is no participants table and `submissions` carries only `team_id`, so player-level granularity is not derivable today. The metric switcher therefore ships with two tabs, not three.

`useGameTypeBreakdown(organizationId)` returns submission counts per game type over the same 30-day window, joined from `submissions` through `games.type`.

Both face the same constraint: `submissions` has no `organization_id` column, so org scoping happens by joining through `events`.

Aggregation approach, stated explicitly so implementation does not have to guess: start by selecting the raw `created_at`, `team_id` and `game_id` rows for the org's 30-day window in one query per hook, then bucket and count them in TypeScript. Days with no activity are gap-filled client-side to zero so the series always has exactly 30 points and the chart renders a continuous line. If a real org's row count makes that query slow, escalate to a Postgres view or RPC that returns pre-aggregated daily counts; do not add client-side pagination as a workaround.

The four stat-card values come from the existing `useDashboardStats`, unchanged. Its `upcomingEvents` and `totalGames` fields already supply the design's two named cards.

The design shows a "+2 from last week" delta beneath each stat. `useDashboardStats` returns no historical comparison today, so either it gains one, or the delta line is omitted. Decision: omit the delta line in phase 1 rather than invent a number. The card layout leaves room for it to land later.

### Header search

A single `useGlobalSearch(query)` hook queries games, events and support tickets in parallel, debounced, disabled below two characters, and returns a flat tagged result list. Each result carries the route it navigates to. Phase 1 navigates to the relevant page; the design's behaviour of also auto-opening the matching editor waits until those editors are rebuilt in later phases.

Role gating applies: a facilitator's search does not return results for surfaces they cannot reach.

## Verification

- `npm run build` (type-check plus build) and `npm run lint` clean.
- `npm test` clean. The existing bingo scoring suite must be untouched by this work; if it moves, something has gone wrong.
- Manual pass in the dev server against a real org, in both light and dark mode, at desktop and narrow widths, verified by screenshot: shell renders, sidebar collapses, all four stat cards populate, chart renders with real data and switches metric, breakdown populates, activity feed populates, search returns results and shows its no-matches state, Help modal opens and shows its empty state, Exit produces the interstitial and actually ends the session.
- Role check: sign in as facilitator and as event_manager and confirm each still sees exactly the nav they saw before this change and nothing more.
- Empty-org check: a brand-new org with no games, events or submissions renders zero states everywhere rather than blank space or errors.

## Out of scope this phase

Games, Events, Organisation, Billing, Support and My Account pages. The design's slide-over game editor, full-screen event editor, music library, deleted-games view, event-links modal and iMessage-style support chat. A real activity-log backend. Stat-card week-over-week deltas. Player-level analytics. Auto-opening editors from search results.

## Risks

- The token change is global to `.neo-minimal-scope`, so screens not yet redesigned will look part-migrated for the duration of the branch. Acceptable because the branch stays unmerged until the full redesign is signed off, but it means intermediate states on this branch will look inconsistent by design.
- The two new aggregate queries scan `submissions` joined through `events`. On a large org this could be slow. If it is, the fallback is a database view or an RPC that pre-aggregates, rather than pulling rows to the client.
- Moving theme toggle and sign-out from sidebar to header changes muscle memory for existing users. Intentional, per the design.
- Hand-rolled SVG charting is the right call for one chart. If later phases need several more, revisit and add Recharts then.
