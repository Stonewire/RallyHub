# Domain architecture v2 + Paddle domain approval — design

Date: 2026-08-03. Approved by Rumen in session; implementation deliberately
deferred (other bug work in flight). Ships as the next minor version when
built (V3.6.0 was current at approval time).

## Goal

Three domains with strict roles, path-based tenancy, and Paddle checkout
domain approval that covers every client forever with one approved domain.

## Background

- Logging in from the marketing apex (`rallyhub.games`) currently leaves the
  user on `rallyhub.games/admin`. Client panels must live on
  `app.rallyhub.games` instead; super admins must be confined to
  `admin.rallyhub.games`.
- Paddle rejected `app.rallyhub.games` for checkout ("unreachable") while the
  apex is approved; a live checkout 403'd from the app subdomain and
  succeeded from the apex. Subdomains are NOT covered by the apex approval.
- Both subdomains now resolve via Vercel DNS with valid SSL and serve the
  SPA, but their roots land on a bare login, and Paddle's rejection email
  lists "login wall" as a fail reason.

## Decisions made (with Rumen, one at a time)

1. **Path-based tenancy everywhere** (not subdomains, not profile-only):
   client slug in the URL path, for admin AND live surfaces.
2. **Event identifier in the path too**, as the pretty event slug (UUIDs
   resolve as fallback).
3. **Wrong-domain logins are rejected outright** with a pointer to the right
   domain — super admin on the app domain, client roles on the admin domain.
4. **Old links redirect forever** (compat shim), never 404.
5. **Public splash pages** at both subdomain roots for Paddle review comfort.

## 1. URL architecture

```
rallyhub.games                 marketing + legal pages only
  /admin, /login on this host  → hard redirect (window.location) to app.rallyhub.games

app.rallyhub.games
  /                            public splash
  /login, /register, /login/*  auth, org-less
  /privacy, /terms, /dpa, ...  legal pages (footer targets)
  /{client}/admin/...          client panel (client_admin / event_manager /
                               facilitator-restricted views, as today)
  /{client}/{event}/join       participants; /join/{teamName} after claim
  /{client}/{event}/display    audience display
  /{client}/{event}/facilitator
  /{client}/app                RESERVED for a future installable PWA replacing
                               the tablet link. 404s politely for now. Not in
                               this project's scope beyond reserving the path.
  /tablet/...                  stays as-is until /app replaces it

admin.rallyhub.games
  /                            public splash (staff wording)
  /admin/*                     super admin panel, slug-less (cross-org)

demo.rallyhub.games            untouched; keeps host-based resolution
```

- `{client}` = `organizations.subdomain` (already unique, already
  user-visible; no new column).
- `{event}` = `events.slug`, unique per org (DB index; one-time migration
  auto-generates slugs from names where missing, auto-suffix on collision).
- First path segment validated against a reserved-word list (extend
  `RESERVED_TENANT_SUBDOMAINS`: login, register, privacy, terms, dpa,
  imprint, cookies, contact, play, tablet, join, display, facilitator,
  events, app, admin, api, assets, ...). Enforced at org creation AND rename.
- Renaming an org changes its URLs; old-slug links 404. Same behaviour as
  subdomain renames today; no slug-history system (YAGNI).

## 2. Tenant resolution and router

**Chosen: explicit route params.** Routes declared as `/:clientSlug/admin/*`,
`/:clientSlug/:eventSlug/join` etc. A new `PathTenantScope` reads the slug,
resolves the org through the same lookup the subdomain flow uses today, and
feeds the existing `TenantProvider` — branding, theming, org queries all
untouched downstream.

Cost accepted: every absolute internal link (`/admin/events` in sidebars,
navigates, redirects) goes through a small `orgPath()` helper that prefixes
the current client slug. Mechanical, explicit.

**Rejected: dynamic router basename.** Basename is global; it poisons the
org-less routes (`/login`, `/`) on the same domain and turns every edge case
into a special case.

`parseTenantFromHost` stays alive for the compat shim and the demo host, but
stops being the primary mechanism on the app domain.

## 3. Login and role-host enforcement

- Marketing "Log in" / "Create account": plain `<a>` full-navigation links to
  `https://app.rallyhub.games/login` / `/register`. The session is born on
  the right origin; no cross-domain session hand-off exists or is needed.
- `rallyhub.games/admin*` and `/login*`: render nothing; hard
  `window.location.replace` to the same path on the app domain, signing out
  any stale apex session locally on the way.
- Login on `app.rallyhub.games` (role knowable only after auth; enforcement
  runs when the profile loads, before any navigation):
  - `super_admin` → immediate local sign-out + "Staff accounts sign in at
    admin.rallyhub.games". Session lives milliseconds, never navigates.
  - client roles → org slug from profile's `organization_id`, land on
    `/{slug}/admin` (facilitators: `/{slug}/admin/events`).
  - `must_change_password` flow unchanged, runs before the redirect.
- Login on `admin.rallyhub.games`: mirror — non-super-admin authenticates,
  is signed out, sees "Client accounts sign in at app.rallyhub.games".
  Super admin lands on `/admin`.

## 4. Compatibility shim (redirect-only, no business logic)

- Old subdomain links (`{sub}.app.rallyhub.games/...`) and `?tenant=` links:
  host resolution runs as today but forwards to
  `app.rallyhub.games/{slug}/{rest}` instead of rendering.
- Old event-id URLs (`/join/{uuid}`, `/display/{uuid}`, `/facilitator/{uuid}`,
  existing pretty-event links): resolve the event, forward to
  `/{client}/{event}/...`. UUID links stay resolvable forever. Tablet links
  are NOT shimmed — `/tablet/...` keeps working unchanged until the PWA
  project replaces it (Section 1).
- `?tenant=` override retained for localhost development.
- **Accepted risk**: old subdomain links are a different origin; participant
  state (join token, claimed-team token) is per-origin, so a participant
  re-opening an old printed QR after cutover loses claimed-team state.
  Recovery: facilitator resets the team. Mitigation: cut over on a
  no-active-events day (existing house rule); new events only hand out
  new-format links.

## 5. Splash pages + Paddle approval

Two static public pages, shared light shell, marketing styling, no data
fetches:

- `app.rallyhub.games/`: logo, "The RallyHub client portal — sign in to run
  your team events", Sign in button, footer: Privacy, Terms, DPA, Imprint,
  Cookies, link to rallyhub.games.
- `admin.rallyhub.games/`: same shell, "RallyHub staff portal" wording.

Paddle ops (Rumen, dashboard, after the splash deploys):

1. Resubmit `app.rallyhub.games` for domain review (form in Paddle's email).
2. Add + submit `admin.rallyhub.games` (optional in principle — super admins
   never pay — but requested and harmless).
3. Set Paddle's default payment link (Checkout settings) to
   `https://app.rallyhub.games`.
4. **Prerequisite carried in from earlier**: update the
   `PADDLE_WEBHOOK_SECRET` Supabase edge-function secret to the live
   destination's signing secret
   (`pdl_ntfset_01kympmfcjxd3mkphmd4xnxj3d_...`), then replay the two missed
   webhook events (transaction.completed, subscription.created for the
   €1.80 live test) so the database finally records that subscription.

Key property: with path tenancy, every client checkout opens on
`app.rallyhub.games` regardless of org — one approved domain covers all
clients forever. No per-client subdomain approval problem.

## 6. Edge cases

- Unknown client slug or event slug → clean generic 404.
- Reserved-word list blocks colliding org slugs, at creation and rename.
- Event slug uniqueness per org via DB index; auto-suffix at creation.
- Facilitator links keep existing auth rules at the new path.
- Link generation (LINKS-1 branch-aware) produces new-format URLs; local
  dev keeps working via `?tenant=`.

## 7. Testing and rollout — three releases, in order

1. **Add-only.** New path routes + resolution live alongside all current
   behaviour; both URL styles work; nothing user-visible changes. Unit tests
   for the path parser, `orgPath()`, and the role-host login matrix.
2. **Flip.** Splash pages, marketing links, login enforcement, link
   generation to new format, redirect shim on. Quiet no-event day. Manual
   smoke: login as each role on each domain, phone join + team claim on a
   throwaway event, display + facilitator, one old-QR redirect check.
3. **Paddle ops + live payment retest.** Dashboard steps above, then one
   real checkout from `/{client}/admin` billing proving overlay → payment →
   webhook 2xx → DB rows.

Versioning: next minor at ship time (V3.6.0 current at approval).

## Out of scope

- The `/{client}/app` installable PWA (design later; path reserved only).
- Slug-history/rename redirects.
- Any change to `demo.rallyhub.games`.
- Tablet link replacement (waits for the PWA project).
