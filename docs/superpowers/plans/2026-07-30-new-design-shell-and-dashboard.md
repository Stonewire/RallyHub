# New Design Phase 1: App Shell + Client Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the RallyHub client admin shell (new 40px header, reskinned sidebar) and the Overview page to match the new design, on branch `feature/new-design`, without losing any capability the app has today.

**Architecture:** The design's palette is mapped onto the existing `--nm-*` token names rather than introducing a second token vocabulary, so all admin surfaces shift together. Chrome that currently lives in the sidebar (theme toggle, sign-out) moves into a new header composed of small single-purpose components. Dashboard data logic goes into pure functions in `src/lib/` with vitest coverage; React components stay thin and untested, matching this codebase's convention.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, React Query, Supabase, shadcn/Radix primitives, lucide-react icons, vitest. No new runtime dependencies.

## Global Constraints

- Branch is `feature/new-design`. Never push to `main`. Do not merge anywhere during this plan.
- Never use em dashes or en dashes (`—`, `–`) in any code comment, copy, string, commit message, or doc. Use commas, colons, or full stops.
- British English in all user-facing copy ("Organisation", not "Organization", in new copy; do not rename existing routes or DB columns that use the US spelling).
- Accent yellow is exactly `#ffc107`. Do not use the design file's `#FEC10A`.
- All DB access goes through `src/lib/supabase.ts`. All React Query keys come from `src/lib/query-keys.ts`.
- Path alias `@/` maps to `src/`.
- Preserve every existing role-gating rule. `isFacilitatorOnlyRole`, `canAccessOrgSettings`, `canManageOrgUsers` and the `showPersonalProfileNav` condition must keep behaving identically.
- Do not edit `src/components/ui/` shadcn primitives directly.
- `npm run build` and `npm run lint` must pass before every commit. `npm test` must pass on any task that touches `src/lib/` or `src/hooks/`.
- Do not touch bingo scoring code or its tests (`src/lib/bingo-core.ts`, `src/lib/bingo-engine.ts`, `src/hooks/use-bingo-run.ts` and their tests).
- The design reference is `new-design/Gaming Dashboard - Professional.dc.html`. Read it for exact markup and styles, but never import, embed, or copy it into `src/`.

## File Structure

**Created:**
- `src/components/shell/AdminHeader.tsx` - the 40px header bar, composition only
- `src/components/shell/HeaderSearch.tsx` - search input, results dropdown, no-matches state
- `src/components/shell/HelpModal.tsx` - searchable help modal with empty state
- `src/components/shell/HeaderAvatar.tsx` - 24px initials avatar that links to account
- `src/components/auth/LoggedOutScreen.tsx` - full-screen logged-out interstitial
- `src/components/dashboard/StatCard.tsx` - one stat tile
- `src/components/dashboard/ActivityFeed.tsx` - recent activity rows
- `src/components/dashboard/ActivityChart.tsx` - SVG chart plus metric switcher
- `src/components/dashboard/GameTypeBreakdown.tsx` - CSS-bar breakdown panel
- `src/lib/dashboard-activity.ts` - pure bucketing, gap-fill and SVG path maths
- `src/lib/dashboard-activity.test.ts` - tests for the above
- `src/lib/global-search.ts` - pure search result shaping and role filtering
- `src/lib/global-search.test.ts` - tests for the above
- `src/hooks/use-global-search.ts` - React Query wrapper for header search
- `public/fonts/Inter-VariableFont.ttf` - self-hosted Inter

**Modified:**
- `src/styles/fonts.css` - add Inter, drop Abril Fatface usage
- `src/index.css:11-14` - point `--font-sans` and `--font-heading` at Inter
- `src/styles/neo-minimal.css` - cool grey palette, slate and neutral ramps, tighter radii, `.admin-shell-inset` overrides
- `src/components/admin/AdminAppSidebar.tsx` - flatten org nav, remove theme toggle and sign-out, new widths
- `src/layouts/AdminLayout.tsx` - mount the header, drop the floating `SidebarTrigger`
- `src/hooks/use-dashboard.ts` - add `useActivitySeries` and `useGameTypeBreakdown`
- `src/lib/query-keys.ts` - add `activitySeries` and `gameTypeBreakdown` keys
- `src/pages/admin/ClientDashboardPage.tsx` - rewritten as composition

## Known constraints discovered during planning

These are facts about the current codebase that the tasks below depend on. Do not re-derive them.

- `profiles` has **no** `avatar_url` column. The header avatar is initials-only. Do not build an image avatar or a file picker in this phase.
- `submissions` has **no** `organization_id`. Org scoping requires joining through `events`.
- There is no `participants` table. `submissions` carries only `team_id`, so player-level metrics are impossible. The chart switcher has exactly two tabs.
- `.admin-shell-inset` in `src/styles/neo-minimal.css:137-157` re-declares the palette for admin content and **overrides** `:root`. Palette changes must be made there as well or admin screens will not change.
- `AdminLayout` wraps everything in `SidebarProvider` with `className="neo-minimal-scope"`. The header must render inside `SidebarInset` to sit beside the sidebar.
- No React testing library is installed. Do not write component tests. Extract logic to `src/lib/` and test it there.
- `useAuth()` provides `{ profile, role, signOut, profileLoading }`. `useTheme()` provides `{ resolvedTheme, toggleTheme }`.
- `profileDisplayName` already exists in `src/lib/auth-routes.ts:129`.

---

### Task 1: Cool grey palette and Inter font

**Files:**
- Create: `public/fonts/Inter-VariableFont.ttf`
- Modify: `src/styles/fonts.css`
- Modify: `src/index.css:11-14`
- Modify: `src/styles/neo-minimal.css`

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties consumed by every later task: `--nm-slate-100` through `--nm-slate-900`, `--nm-neutral-100` through `--nm-neutral-900`, and the redefined `--nm-bg-base`, `--nm-bg-surface`, `--nm-bg-elevated`, `--nm-text-primary`, `--nm-border`, `--nm-radius-sm|md|lg`.

- [ ] **Step 1: Download Inter**

```bash
curl -fsSL -o public/fonts/Inter-VariableFont.ttf \
  https://github.com/rsms/inter/raw/v4.0/docs/font-files/InterVariable.ttf
ls -la public/fonts/Inter-VariableFont.ttf
```

Expected: file exists and is larger than 300KB. If the download fails or the file is under 100KB, stop and report it rather than proceeding with a broken font.

- [ ] **Step 2: Register Inter in `src/styles/fonts.css`**

Replace the whole file with:

```css
/**
 * RallyHub brand typography.
 * Body/UI/headings: Inter (variable). Font files live in /public/fonts.
 * Abril Fatface is retained only for the marketing site's display type.
 */

@font-face {
  font-family: 'Abril Fatface';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/AbrilFatface-Regular.ttf') format('truetype');
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('/fonts/Inter-VariableFont.ttf') format('truetype');
}

@font-face {
  font-family: 'Manrope';
  font-style: normal;
  font-weight: 200 800;
  font-display: swap;
  src: url('/fonts/Manrope-VariableFont_wght.ttf') format('truetype');
}
```

- [ ] **Step 3: Point the app font at Inter**

In `src/index.css`, inside `@theme inline`, change these two lines only:

```css
    --font-heading: var(--font-sans);
    --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
```

Leave `--font-display` as it is. The marketing pages still use it.

- [ ] **Step 4: Add the ramps and cool grey base to `src/styles/neo-minimal.css`**

Inside the existing `:root` block, after the `--nm-border-strong` line, add:

```css
  /* ─── Cool grey surfaces (new design) ─── */
  --nm-bg-base: #f7f7f8;
  --nm-bg-surface: #ffffff;
  --nm-bg-elevated: #ffffff;
  --nm-bg-muted: #eeeef0;
  --nm-bg-inset: #dadbde;

  --nm-text-primary: #1f2126;
  --nm-text-secondary: #63666d;
  --nm-text-muted: #8a8d94;

  --nm-border: rgb(31 33 38 / 0.14);
  --nm-border-strong: rgb(31 33 38 / 0.22);

  /* ─── Slate ramp (design's accent-2) ─── */
  --nm-slate-100: #edeef0;
  --nm-slate-200: #d9dbdf;
  --nm-slate-300: #b8bcc4;
  --nm-slate-400: #8d93a0;
  --nm-slate-500: #5c616d;
  --nm-slate-600: #3f434c;
  --nm-slate-700: #2b2e36;
  --nm-slate-800: #1d1f24;
  --nm-slate-900: #121317;

  /* ─── Neutral ramp ─── */
  --nm-neutral-100: #f7f7f8;
  --nm-neutral-200: #eeeef0;
  --nm-neutral-300: #dadbde;
  --nm-neutral-400: #b7b9be;
  --nm-neutral-500: #8a8d94;
  --nm-neutral-600: #63666d;
  --nm-neutral-700: #454850;
  --nm-neutral-800: #2a2c33;
  --nm-neutral-900: #1a1b1f;

  --nm-danger: #c0392b;
```

These come after the originals inside the same block, so they win by cascade order. Do not delete the warm ivory lines above them; the marketing pages read some of them.

Then change the three radius values in the same `:root` block to the design's tighter scale:

```css
  --nm-radius-sm: 3px;
  --nm-radius-md: 6px;
  --nm-radius-lg: 10px;
  --nm-radius-xl: 14px;
  --nm-radius-2xl: 18px;
```

- [ ] **Step 5: Mirror the ramps for dark mode**

Inside the existing `.dark` block, after the `--nm-border-strong` line, add:

```css
  --nm-bg-base: #15161a;
  --nm-bg-surface: #1e2025;
  --nm-bg-elevated: #1e2025;
  --nm-bg-muted: #2a2c33;
  --nm-bg-inset: #121317;

  --nm-text-primary: #f1f1f3;
  --nm-text-secondary: #b7b9be;
  --nm-text-muted: #8a8d94;

  --nm-border: rgb(255 255 255 / 0.14);
  --nm-border-strong: rgb(255 255 255 / 0.22);

  --nm-slate-100: #121317;
  --nm-slate-200: #1d1f24;
  --nm-slate-300: #2b2e36;
  --nm-slate-400: #3f434c;
  --nm-slate-500: #5c616d;
  --nm-slate-600: #8d93a0;
  --nm-slate-700: #b8bcc4;
  --nm-slate-800: #d9dbdf;
  --nm-slate-900: #edeef0;

  --nm-neutral-100: #1a1b1f;
  --nm-neutral-200: #2a2c33;
  --nm-neutral-300: #454850;
  --nm-neutral-400: #63666d;
  --nm-neutral-500: #8a8d94;
  --nm-neutral-600: #b7b9be;
  --nm-neutral-700: #dadbde;
  --nm-neutral-800: #eeeef0;
  --nm-neutral-900: #f7f7f8;
```

- [ ] **Step 6: Update the admin-shell overrides**

`.admin-shell-inset` currently forces warm ivory and beats `:root`. Replace the body of the `.neo-minimal-scope .admin-shell-inset` rule with:

```css
.neo-minimal-scope .admin-shell-inset {
  --nm-bg-base: #f7f7f8;
  --nm-bg-surface: #ffffff;
  --nm-bg-elevated: #ffffff;
  --nm-bg-muted: #eeeef0;
  --nm-bg-inset: #dadbde;
  --nm-text-primary: #1f2126;
  --nm-text-secondary: #63666d;
  --nm-text-muted: #8a8d94;
  --background: #f7f7f8;
  --foreground: #1f2126;
  --card: #ffffff;
  --card-foreground: #1f2126;
  --popover: #ffffff;
  --popover-foreground: #1f2126;
  --muted: #eeeef0;
  --muted-foreground: #63666d;
  --border: rgb(31 33 38 / 0.14);
  --input: rgb(31 33 38 / 0.22);
}
```

And replace the body of `.dark .neo-minimal-scope .admin-shell-inset` with:

```css
.dark .neo-minimal-scope .admin-shell-inset {
  --nm-bg-base: #15161a;
  --nm-bg-surface: #1e2025;
  --nm-bg-elevated: #1e2025;
  --nm-bg-muted: #2a2c33;
  --nm-bg-inset: #121317;
  --nm-text-primary: #f1f1f3;
  --nm-text-secondary: #b7b9be;
  --nm-text-muted: #8a8d94;
  --background: #15161a;
  --foreground: #f1f1f3;
  --card: #1e2025;
  --card-foreground: #f1f1f3;
  --popover: #1e2025;
  --popover-foreground: #f1f1f3;
  --muted: #2a2c33;
  --muted-foreground: #8a8d94;
  --border: rgb(255 255 255 / 0.14);
  --input: rgb(255 255 255 / 0.22);
}
```

- [ ] **Step 7: Verify the build compiles**

Run: `npm run build`
Expected: PASS, no TypeScript or CSS errors.

- [ ] **Step 8: Verify visually**

Start the dev server via the preview tooling, sign in, and take a screenshot of any admin page. Expected: surfaces are cool grey and white rather than cream, text is near-black `#1f2126`, type renders as Inter (noticeably more neutral than Manrope), corners are tighter. Toggle dark mode and confirm dark surfaces are `#15161a` and `#1e2025`.

- [ ] **Step 9: Commit**

```bash
git add public/fonts/Inter-VariableFont.ttf src/styles/fonts.css src/index.css src/styles/neo-minimal.css
git commit -m "feat(design): cool grey palette, slate/neutral ramps and Inter font"
```

---

### Task 2: Header shell and sidebar rework

**Files:**
- Create: `src/components/shell/HeaderAvatar.tsx`
- Create: `src/components/shell/AdminHeader.tsx`
- Modify: `src/components/admin/AdminAppSidebar.tsx`
- Modify: `src/layouts/AdminLayout.tsx`

**Interfaces:**
- Consumes: tokens from Task 1. `useAuth()` for `{ profile, role, signOut }`. `useTheme()` for `{ resolvedTheme, toggleTheme }`. `useSidebar()` for `{ toggleSidebar, state }`. `profileDisplayName` from `@/lib/auth-routes`.
- Produces: `<AdminHeader />` mounted in `AdminLayout`, accepting no props. `<HeaderAvatar />` accepting no props. Task 3 adds `<HeaderSearch />` into `AdminHeader`, Task 4 adds `<HelpModal />`, Task 5 adds the Exit flow. Until those land, this task renders the search input as a plain non-functional input and omits Help and Exit.

- [ ] **Step 1: Create `HeaderAvatar.tsx`**

```tsx
import { Link } from 'react-router-dom'

import { useAuth } from '@/contexts/auth-context'
import { profileDisplayName } from '@/lib/auth-routes'

/** Header initials avatar. `profiles` has no avatar_url, so initials only. */
export function HeaderAvatar() {
  const { profile } = useAuth()
  const name = profile ? profileDisplayName(profile) : ''
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'

  return (
    <Link
      to="/admin/settings?tab=account"
      title="My Account"
      aria-label="My Account"
      className="bg-nm-yellow text-nm-charcoal flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
    >
      {initials}
    </Link>
  )
}
```

- [ ] **Step 2: Create `AdminHeader.tsx`**

```tsx
import { ChevronLeft, Moon, Plus, Sun } from 'lucide-react'
import { Link } from 'react-router-dom'

import { HeaderAvatar } from '@/components/shell/HeaderAvatar'
import { useSidebar } from '@/components/ui/sidebar'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { isFacilitatorOnlyRole } from '@/lib/auth-routes'

function Divider() {
  return <div className="bg-border h-[18px] w-px shrink-0" aria-hidden />
}

/** The 40px admin header. Composition only, owns no data of its own. */
export function AdminHeader() {
  const { toggleSidebar, state } = useSidebar()
  const { resolvedTheme, toggleTheme } = useTheme()
  const { role } = useAuth()
  // Facilitators cannot create games or events, so those CTAs stay hidden.
  const canCreate = !isFacilitatorOnlyRole(role)

  return (
    <header className="border-border bg-background flex h-10 shrink-0 items-center gap-3 border-b px-4">
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={state === 'collapsed' ? 'Expand sidebar' : 'Collapse sidebar'}
        className="hover:bg-muted flex size-[26px] items-center justify-center rounded-nm-md opacity-70 hover:opacity-100"
      >
        <ChevronLeft
          className={`size-3.5 transition-transform ${state === 'collapsed' ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        <div className="relative w-60">
          <input
            className="border-input bg-nm-surface h-[26px] w-full rounded-nm-md border px-2 text-xs"
            placeholder="Search…"
          />
        </div>

        {canCreate ? (
          <>
            <Divider />
            <Link
              to="/admin/games"
              className="border-input bg-nm-surface hover:bg-muted flex h-[26px] shrink-0 items-center gap-1.5 rounded-nm-md border px-2.5 text-xs font-semibold whitespace-nowrap"
            >
              <Plus className="size-3" strokeWidth={2} />
              New Game
            </Link>
            <Link
              to="/admin/events/new"
              className="bg-nm-yellow text-nm-charcoal flex h-[26px] shrink-0 items-center gap-1.5 rounded-nm-md px-2.5 text-xs font-semibold whitespace-nowrap"
            >
              <Plus className="size-3" strokeWidth={2} />
              New Event
            </Link>
          </>
        ) : null}

        <Divider />
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
          className="hover:bg-muted flex size-[26px] items-center justify-center rounded-nm-md"
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="size-3.5" strokeWidth={2} />
          ) : (
            <Moon className="size-3.5" strokeWidth={2} />
          )}
        </button>

        <Divider />
        <HeaderAvatar />
      </div>
    </header>
  )
}
```

Note: `New Game` links to the games page rather than opening the design's type-picker modal, because that modal is a later phase. This matches the locked decision to wire the CTAs to today's existing flows.

- [ ] **Step 3: Mount the header in `AdminLayout.tsx`**

Replace the file with:

```tsx
import { Outlet } from 'react-router-dom'

import { AdminAppSidebar } from '@/components/admin/AdminAppSidebar'
import { OnboardingChecklist } from '@/components/admin/OnboardingChecklist'
import { AppLegalFooter } from '@/components/legal/AppLegalFooter'
import { AdminHeader } from '@/components/shell/AdminHeader'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { cn } from '@/lib/utils'

export function AdminLayout() {
  useDocumentTitle('Admin')
  return (
    <SidebarProvider className="neo-minimal-scope">
      <AdminAppSidebar />
      <SidebarInset
        className={cn(
          'admin-shell-inset neo-minimal-inset bg-background relative flex max-h-[100dvh] min-h-svh flex-1 flex-col overflow-hidden lg:rounded-r-none',
        )}
      >
        <AdminHeader />
        <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <div className="flex-1">
            <Outlet />
          </div>
          <AppLegalFooter />
        </div>
      </SidebarInset>
      <OnboardingChecklist />
    </SidebarProvider>
  )
}
```

The `SidebarTrigger` import and its floating button are gone because the collapse control now lives in the header. `flex-col` is added to `SidebarInset` so the header stacks above the scroll area.

- [ ] **Step 4: Flatten the org nav and strip the moved controls from the sidebar**

In `src/components/admin/AdminAppSidebar.tsx`:

Replace the `orgRoutes` constant with a flat nav list:

```tsx
const orgNav = [
  {
    to: '/admin/settings',
    search: '',
    label: 'Organisation',
    icon: Building2,
  },
  {
    to: '/admin/settings',
    search: '?tab=billing',
    label: 'Billing',
    icon: CreditCard,
  },
] as const
```

Delete the entire `showOrgSettings && sidebarCollapsed ? ... : showOrgSettings ? ... : null` block (the collapsed link and the whole `Collapsible` branch) and replace it with:

```tsx
{showOrgSettings
  ? orgNav.map(({ to, search, label, icon: Icon }) => {
      const isActive =
        pathname.startsWith('/admin/settings') &&
        (search === '?tab=billing'
          ? settingsTab === 'billing'
          : settingsTab !== 'billing' && settingsTab !== 'account')

      return (
        <SidebarMenuItem key={label}>
          <SidebarMenuButton
            asChild
            tooltip={label}
            isActive={isActive}
            className="text-sidebar-foreground"
          >
            <NavLink to={search ? { pathname: to, search } : to}>
              <Icon className="shrink-0" strokeWidth={1.75} />
              <span className="font-medium">{label}</span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )
    })
  : null}
```

In `SidebarFooter`, delete the theme-toggle `SidebarMenuItem` and the sign-out `SidebarMenuItem` entirely. Keep the Support item and the `APP_BUILD_LABEL` paragraph. The footer becomes Support plus the build label only.

Remove the now-unused imports: `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger`, `ChevronDown`, `LogOut`, `Moon`, `Sun`, `useNavigate`, `useTheme`. Remove the `handleSignOut` function, the `signOut` destructure, the `resolvedTheme`/`toggleTheme` destructure, the `navigate` const, the `orgMenuOpen` state, `orgMenuOpenWhenBrowsing`, `onOrgMenuOpenChange`, and `orgChildActive` if it is no longer referenced. Keep `sidebarCollapsed` only if still used; if not, remove it and the `useSidebar` import.

`role` is still needed by `isFacilitatorOnlyRole`, so keep `const { role } = useAuth()`.

- [ ] **Step 5: Set the design's sidebar widths**

In `src/styles/neo-minimal.css`, add at the end of the file:

```css
/* New-design sidebar metrics: 168px expanded, 64px collapsed. */
.neo-minimal-scope {
  --sidebar-width: 168px;
  --sidebar-width-icon: 64px;
}

.neo-minimal-scope .admin-shell-sidebar,
.neo-minimal-scope .admin-shell-sidebar [data-sidebar='sidebar'] {
  transition: width 0.15s ease;
}
```

- [ ] **Step 6: Verify the build and lint**

Run: `npm run build && npm run lint`
Expected: PASS. Any "declared but never used" error means a Step 4 import or const was missed; remove it.

- [ ] **Step 7: Verify in the browser**

Sign in and screenshot. Expected: a 40px header above the content with collapse chevron on the left and search, New Game, New Event, theme toggle and initials avatar on the right. Sidebar is 168px, shows Dashboard, Games, Events, Organisation, Billing as five flat items, with Support anchored at the bottom and no theme or sign-out row. Clicking the chevron collapses the sidebar to 64px with a visible transition. Theme toggle still switches light and dark.

- [ ] **Step 8: Verify role gating did not regress**

Confirm in the code that `visibleMainNav`, `showPersonalProfileNav`, `showTeamNav` and `showOrgSettings` are computed exactly as before. Then sign in as a facilitator. Expected: only Events plus Profile in the nav, no Organisation, no Billing, no Support, and no New Game or New Event buttons in the header.

- [ ] **Step 9: Commit**

```bash
git add src/components/shell src/components/admin/AdminAppSidebar.tsx src/layouts/AdminLayout.tsx src/styles/neo-minimal.css
git commit -m "feat(shell): add admin header, flatten org nav, move theme and sign-out"
```

---

### Task 3: Header global search

**Files:**
- Create: `src/lib/global-search.ts`
- Create: `src/lib/global-search.test.ts`
- Create: `src/hooks/use-global-search.ts`
- Create: `src/components/shell/HeaderSearch.tsx`
- Modify: `src/lib/query-keys.ts`
- Modify: `src/components/shell/AdminHeader.tsx`

**Interfaces:**
- Consumes: `AdminHeader` from Task 2.
- Produces:
  - `type SearchKind = 'game' | 'event' | 'ticket'`
  - `type SearchResult = { id: string; kind: SearchKind; label: string; to: string }`
  - `buildSearchResults(input: SearchInput, role: AppRole | null): SearchResult[]`
  - `type SearchInput = { games: {id: string; name: string}[]; events: {id: string; name: string}[]; tickets: {id: string; subject: string}[] }`
  - `useGlobalSearch(query: string): { results: SearchResult[]; isLoading: boolean }`
  - `<HeaderSearch />` accepting no props.

- [ ] **Step 1: Write the failing test**

Create `src/lib/global-search.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { buildSearchResults } from '@/lib/global-search'

const input = {
  games: [{ id: 'g1', name: 'Photo Hunt' }],
  events: [{ id: 'e1', name: 'Summer Rally' }],
  tickets: [{ id: 't1', subject: 'Cannot upload' }],
}

describe('buildSearchResults', () => {
  it('maps every source into tagged results with routes', () => {
    const results = buildSearchResults(input, 'client_admin')

    expect(results).toEqual([
      { id: 'g1', kind: 'game', label: 'Photo Hunt', to: '/admin/games' },
      { id: 'e1', kind: 'event', label: 'Summer Rally', to: '/admin/events/e1' },
      { id: 't1', kind: 'ticket', label: 'Cannot upload', to: '/admin/support' },
    ])
  })

  it('gives facilitators events only, since they cannot reach games or support', () => {
    const results = buildSearchResults(input, 'facilitator')

    expect(results).toEqual([
      { id: 'e1', kind: 'event', label: 'Summer Rally', to: '/admin/events/e1' },
    ])
  })

  it('returns an empty list when nothing matched', () => {
    expect(buildSearchResults({ games: [], events: [], tickets: [] }, 'client_admin')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- global-search`
Expected: FAIL, cannot resolve `@/lib/global-search`.

- [ ] **Step 3: Implement `src/lib/global-search.ts`**

```ts
import { isFacilitatorOnlyRole } from '@/lib/auth-routes'
import type { AppRole } from '@/types/database'

export type SearchKind = 'game' | 'event' | 'ticket'

export type SearchResult = {
  id: string
  kind: SearchKind
  label: string
  to: string
}

export type SearchInput = {
  games: { id: string; name: string }[]
  events: { id: string; name: string }[]
  tickets: { id: string; subject: string }[]
}

/**
 * Shapes raw rows into tagged, routable results. Facilitators only reach
 * their events surface, so games and tickets are withheld from them.
 */
export function buildSearchResults(
  input: SearchInput,
  role: AppRole | null,
): SearchResult[] {
  const facilitator = isFacilitatorOnlyRole(role)

  const games: SearchResult[] = facilitator
    ? []
    : input.games.map((g) => ({
        id: g.id,
        kind: 'game' as const,
        label: g.name,
        to: '/admin/games',
      }))

  const events: SearchResult[] = input.events.map((e) => ({
    id: e.id,
    kind: 'event' as const,
    label: e.name,
    to: `/admin/events/${e.id}`,
  }))

  const tickets: SearchResult[] = facilitator
    ? []
    : input.tickets.map((t) => ({
        id: t.id,
        kind: 'ticket' as const,
        label: t.subject,
        to: '/admin/support',
      }))

  return [...games, ...events, ...tickets]
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- global-search`
Expected: PASS, 3 tests.

- [ ] **Step 5: Add the query key**

In `src/lib/query-keys.ts`, add inside the object:

```ts
  globalSearch: (orgId: string | null, query: string) =>
    ['global-search', orgId, query] as const,
```

- [ ] **Step 6: Create `src/hooks/use-global-search.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/contexts/auth-context'
import { useOrganizationId } from '@/hooks/use-organization-id'
import { buildSearchResults, type SearchResult } from '@/lib/global-search'
import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'

const MIN_QUERY_LENGTH = 2
const RESULT_LIMIT = 5

/** Live header search across games, events and support tickets. */
export function useGlobalSearch(query: string): {
  results: SearchResult[]
  isLoading: boolean
} {
  const organizationId = useOrganizationId()
  const { role } = useAuth()
  const trimmed = query.trim()
  const enabled = Boolean(organizationId) && trimmed.length >= MIN_QUERY_LENGTH

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.globalSearch(organizationId, trimmed),
    enabled,
    queryFn: async (): Promise<SearchResult[]> => {
      if (!organizationId) return []
      const pattern = `%${trimmed}%`

      const [gamesRes, eventsRes, ticketsRes] = await Promise.all([
        supabase
          .from('games')
          .select('id, name')
          .eq('organization_id', organizationId)
          .is('deleted_at', null)
          .ilike('name', pattern)
          .limit(RESULT_LIMIT),
        supabase
          .from('events')
          .select('id, name')
          .eq('organization_id', organizationId)
          .is('deleted_at', null)
          .ilike('name', pattern)
          .limit(RESULT_LIMIT),
        supabase
          .from('support_tickets')
          .select('id, subject')
          .eq('organization_id', organizationId)
          .ilike('subject', pattern)
          .limit(RESULT_LIMIT),
      ])

      // A single failing surface should not blank the whole dropdown.
      return buildSearchResults(
        {
          games: gamesRes.data ?? [],
          events: eventsRes.data ?? [],
          tickets: ticketsRes.data ?? [],
        },
        role,
      )
    },
  })

  return { results: data ?? [], isLoading: enabled && isFetching }
}
```

- [ ] **Step 7: Create `src/components/shell/HeaderSearch.tsx`**

```tsx
import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useGlobalSearch } from '@/hooks/use-global-search'
import type { SearchKind } from '@/lib/global-search'

const KIND_LABEL: Record<SearchKind, string> = {
  game: 'Game',
  event: 'Event',
  ticket: 'Ticket',
}

/** Header search input with a live results dropdown. */
export function HeaderSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const { results, isLoading } = useGlobalSearch(query)

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocumentClick)
    return () => document.removeEventListener('mousedown', onDocumentClick)
  }, [])

  const trimmed = query.trim()
  const showDropdown = open && trimmed.length >= 2 && !isLoading
  const hasResults = results.length > 0

  function go(to: string) {
    setOpen(false)
    setQuery('')
    navigate(to)
  }

  return (
    <div ref={boxRef} className="relative w-60">
      <Search
        className="text-nm-neutral-600 pointer-events-none absolute top-1/2 left-2.5 size-3 -translate-y-1/2"
        strokeWidth={2}
      />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search…"
        aria-label="Search"
        className="border-input bg-nm-surface h-[26px] w-full rounded-nm-md border pr-2 pl-7 text-xs"
      />

      {showDropdown ? (
        <div className="border-border bg-nm-surface absolute top-[30px] left-0 z-60 w-80 overflow-hidden rounded-nm-md border shadow-lg">
          {hasResults ? (
            results.map((r) => (
              <button
                key={`${r.kind}-${r.id}`}
                type="button"
                onClick={() => go(r.to)}
                className="border-border hover:bg-muted flex w-full items-center gap-2 border-b px-3 py-2 text-left last:border-b-0"
              >
                <span className="bg-nm-slate-100 text-nm-slate-700 shrink-0 rounded-nm-sm px-1.5 py-0.5 text-[9px] font-bold uppercase">
                  {KIND_LABEL[r.kind]}
                </span>
                <span className="flex-1 truncate text-xs">{r.label}</span>
              </button>
            ))
          ) : (
            <p className="text-nm-neutral-500 px-3 py-3 text-xs">
              No matches for "{trimmed}"
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 8: Swap the placeholder input into the real component**

In `src/components/shell/AdminHeader.tsx`, add the import:

```tsx
import { HeaderSearch } from '@/components/shell/HeaderSearch'
```

and replace this whole block:

```tsx
        <div className="relative w-60">
          <input
            className="border-input bg-nm-surface h-[26px] w-full rounded-nm-md border px-2 text-xs"
            placeholder="Search…"
          />
        </div>
```

with:

```tsx
        <HeaderSearch />
```

- [ ] **Step 9: Verify build, lint and tests**

Run: `npm run build && npm run lint && npm test`
Expected: all PASS.

- [ ] **Step 10: Verify in the browser**

Type two characters of a real game name into the header search. Expected: dropdown appears with a tagged row; clicking it navigates. Type nonsense. Expected: the no-matches message with the typed text. Click outside. Expected: dropdown closes.

- [ ] **Step 11: Commit**

```bash
git add src/lib/global-search.ts src/lib/global-search.test.ts src/hooks/use-global-search.ts src/components/shell/HeaderSearch.tsx src/lib/query-keys.ts src/components/shell/AdminHeader.tsx
git commit -m "feat(shell): live header search across games, events and tickets"
```

---

### Task 4: Help modal

**Files:**
- Create: `src/components/shell/HelpModal.tsx`
- Modify: `src/components/shell/AdminHeader.tsx`

**Interfaces:**
- Consumes: `AdminHeader` from Task 2.
- Produces: `<HelpModal open={boolean} onClose={() => void} />`.

There is no help-content system in this codebase and none is being built in this phase. The modal ships with an empty article list, so it always shows the prompt to open a support ticket. The array is the single place to add articles later.

- [ ] **Step 1: Create `src/components/shell/HelpModal.tsx`**

```tsx
import { Search, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

type HelpArticle = { id: string; title: string; snippet: string }

// No help-content system exists yet. Add entries here when copy is ready;
// until then the modal correctly shows its empty state.
const HELP_ARTICLES: HelpArticle[] = []

type HelpModalProps = {
  open: boolean
  onClose: () => void
}

/** Searchable help centre. Renders nothing when closed. */
export function HelpModal({ open, onClose }: HelpModalProps) {
  const [query, setQuery] = useState('')

  if (!open) return null

  const trimmed = query.trim().toLowerCase()
  const matches = HELP_ARTICLES.filter(
    (a) =>
      a.title.toLowerCase().includes(trimmed) ||
      a.snippet.toLowerCase().includes(trimmed),
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Help centre"
      className="fixed inset-0 z-80 flex items-center justify-center bg-black/45"
      onClick={onClose}
    >
      <div
        className="bg-nm-surface border-border w-[420px] max-w-[92vw] rounded-nm-lg border p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">Help Centre</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="hover:bg-muted flex size-[26px] items-center justify-center rounded-nm-md"
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        </div>

        <div className="relative mb-3">
          <Search
            className="text-nm-neutral-600 pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            strokeWidth={2}
          />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help articles…"
            aria-label="Search help articles"
            className="border-input bg-nm-surface h-9 w-full rounded-nm-md border pr-3 pl-8 text-sm"
          />
        </div>

        {matches.length > 0 ? (
          <ul className="flex flex-col">
            {matches.map((a) => (
              <li key={a.id} className="border-border border-b py-2 last:border-b-0">
                <p className="text-sm font-semibold">{a.title}</p>
                <p className="text-nm-neutral-500 text-xs">{a.snippet}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center">
            <p className="text-nm-neutral-500 mb-3 text-xs">
              No help articles match that yet. Our team can help directly.
            </p>
            <Link
              to="/admin/support"
              onClick={onClose}
              className="bg-nm-yellow text-nm-charcoal inline-flex h-8 items-center rounded-nm-md px-3 text-xs font-semibold"
            >
              Open a support ticket
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire the Help button into `AdminHeader.tsx`**

Add to the imports:

```tsx
import { useState } from 'react'

import { HelpModal } from '@/components/shell/HelpModal'
```

and add `HelpCircle` to the existing `lucide-react` import.

Inside the component, above the `return`, add:

```tsx
  const [helpOpen, setHelpOpen] = useState(false)
```

Then, immediately after the theme-toggle `button` element, insert:

```tsx
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label="Help"
          className="hover:bg-muted flex size-[26px] items-center justify-center rounded-nm-md"
        >
          <HelpCircle className="size-3.5" strokeWidth={2} />
        </button>
```

Finally, wrap the returned `header` in a fragment and render the modal as a sibling so it is not clipped by the header's height:

```tsx
  return (
    <>
      <header className="border-border bg-background flex h-10 shrink-0 items-center gap-3 border-b px-4">
        {/* existing header contents unchanged */}
      </header>
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
```

- [ ] **Step 3: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 4: Verify in the browser**

Click the Help icon. Expected: modal opens, the search field is focused, the empty state offers a support-ticket link. Click the backdrop and the X. Expected: both close it. Click the ticket link. Expected: navigates to support and closes the modal.

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/HelpModal.tsx src/components/shell/AdminHeader.tsx
git commit -m "feat(shell): help centre modal with empty state"
```

---

### Task 5: Exit flow and logged-out interstitial

**Files:**
- Create: `src/components/auth/LoggedOutScreen.tsx`
- Modify: `src/components/shell/AdminHeader.tsx`

**Interfaces:**
- Consumes: `useAuth().signOut` from `@/contexts/auth-context`.
- Produces: `<LoggedOutScreen onLogBackIn={() => void} />`.

- [ ] **Step 1: Create `src/components/auth/LoggedOutScreen.tsx`**

```tsx
import { LogOut } from 'lucide-react'

type LoggedOutScreenProps = {
  onLogBackIn: () => void
}

/** Full-screen confirmation shown after the user signs out from the header. */
export function LoggedOutScreen({ onLogBackIn }: LoggedOutScreenProps) {
  return (
    <div className="bg-background fixed inset-0 z-200 flex items-center justify-center">
      <div className="bg-nm-surface border-border flex w-90 max-w-[92vw] flex-col items-center gap-3 rounded-nm-lg border p-6 text-center shadow-lg">
        <div className="bg-nm-slate-100 text-nm-slate-700 flex size-12 items-center justify-center rounded-full">
          <LogOut className="size-5.5" strokeWidth={2} />
        </div>
        <h1 className="text-lg font-bold">You've been logged out</h1>
        <p className="text-nm-neutral-500 text-sm">
          For your security, your session has ended. Log back in to continue.
        </p>
        <button
          type="button"
          onClick={onLogBackIn}
          className="bg-nm-yellow text-nm-charcoal h-9 w-full rounded-nm-md text-sm font-semibold"
        >
          Log Back In
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire the Exit button in `AdminHeader.tsx`**

Add to imports:

```tsx
import { useNavigate } from 'react-router-dom'

import { LoggedOutScreen } from '@/components/auth/LoggedOutScreen'
```

and add `DoorOpen` to the `lucide-react` import.

Destructure `signOut` from the existing `useAuth()` call so it reads:

```tsx
  const { role, signOut } = useAuth()
```

Add state and the handler above the `return`:

```tsx
  const navigate = useNavigate()
  const [loggedOut, setLoggedOut] = useState(false)

  async function handleExit() {
    if (!window.confirm('Log out of RallyHub? You will need to sign in again.')) {
      return
    }
    try {
      await signOut()
      setLoggedOut(true)
    } catch (err) {
      console.error('[RallyHub] Sign out failed', err)
    }
  }
```

Insert the Exit button immediately after the Help button:

```tsx
        <button
          type="button"
          onClick={() => void handleExit()}
          aria-label="Exit"
          className="hover:bg-muted flex size-[26px] items-center justify-center rounded-nm-md"
        >
          <DoorOpen className="size-3.5" strokeWidth={2} />
        </button>
```

And render the interstitial alongside the modal in the fragment:

```tsx
      {loggedOut ? (
        <LoggedOutScreen onLogBackIn={() => navigate('/login', { replace: true })} />
      ) : null}
```

- [ ] **Step 3: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 4: Verify in the browser**

Click Exit and cancel the confirm. Expected: nothing happens, still signed in. Click Exit and accept. Expected: the logged-out card covers the screen. Click Log Back In. Expected: lands on `/login` and is genuinely signed out, so reloading a protected route does not restore the session.

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/LoggedOutScreen.tsx src/components/shell/AdminHeader.tsx
git commit -m "feat(shell): exit flow with logged-out interstitial"
```

---

### Task 6: Dashboard activity data

**Files:**
- Create: `src/lib/dashboard-activity.ts`
- Create: `src/lib/dashboard-activity.test.ts`
- Modify: `src/lib/query-keys.ts`
- Modify: `src/hooks/use-dashboard.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `const ACTIVITY_WINDOW_DAYS = 30`
  - `type ActivityMetric = 'submissions' | 'teams'`
  - `type ActivityPoint = { date: string; value: number }`
  - `type SubmissionRow = { created_at: string; team_id: string }`
  - `bucketActivity(rows: SubmissionRow[], metric: ActivityMetric, endDate: Date): ActivityPoint[]` returning exactly 30 points, oldest first, gap-filled with zeros
  - `buildLinePath(points: ActivityPoint[], width: number, height: number): string`
  - `buildAreaPath(points: ActivityPoint[], width: number, height: number): string`
  - `type GameTypeCount = { type: GameType; count: number }`
  - `tallyGameTypes(rows: { type: GameType }[]): GameTypeCount[]` sorted by count descending
  - `useActivitySeries(organizationId: string | null, metric: ActivityMetric)` returning a React Query result whose `data` is `ActivityPoint[]`
  - `useGameTypeBreakdown(organizationId: string | null)` returning a React Query result whose `data` is `GameTypeCount[]`

- [ ] **Step 1: Write the failing test**

Create `src/lib/dashboard-activity.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  ACTIVITY_WINDOW_DAYS,
  bucketActivity,
  buildLinePath,
  tallyGameTypes,
} from '@/lib/dashboard-activity'

const END = new Date('2026-07-30T12:00:00.000Z')

describe('bucketActivity', () => {
  it('always returns a full 30-day window, oldest first', () => {
    const points = bucketActivity([], 'submissions', END)

    expect(points).toHaveLength(ACTIVITY_WINDOW_DAYS)
    expect(points[0].date).toBe('2026-07-01')
    expect(points[ACTIVITY_WINDOW_DAYS - 1].date).toBe('2026-07-30')
    expect(points.every((p) => p.value === 0)).toBe(true)
  })

  it('counts submissions per day', () => {
    const points = bucketActivity(
      [
        { created_at: '2026-07-30T08:00:00.000Z', team_id: 'a' },
        { created_at: '2026-07-30T09:00:00.000Z', team_id: 'a' },
        { created_at: '2026-07-29T09:00:00.000Z', team_id: 'b' },
      ],
      'submissions',
      END,
    )

    expect(points.at(-1)).toEqual({ date: '2026-07-30', value: 2 })
    expect(points.at(-2)).toEqual({ date: '2026-07-29', value: 1 })
  })

  it('counts distinct teams per day, not rows', () => {
    const points = bucketActivity(
      [
        { created_at: '2026-07-30T08:00:00.000Z', team_id: 'a' },
        { created_at: '2026-07-30T09:00:00.000Z', team_id: 'a' },
        { created_at: '2026-07-30T10:00:00.000Z', team_id: 'b' },
      ],
      'teams',
      END,
    )

    expect(points.at(-1)).toEqual({ date: '2026-07-30', value: 2 })
  })

  it('ignores rows outside the window', () => {
    const points = bucketActivity(
      [{ created_at: '2026-01-01T08:00:00.000Z', team_id: 'a' }],
      'submissions',
      END,
    )

    expect(points.every((p) => p.value === 0)).toBe(true)
  })
})

describe('buildLinePath', () => {
  it('spans the full width and inverts the y axis', () => {
    const path = buildLinePath(
      [
        { date: '2026-07-29', value: 0 },
        { date: '2026-07-30', value: 10 },
      ],
      100,
      50,
    )

    expect(path).toBe('M 0 50 L 100 0')
  })

  it('draws a flat mid-height line when every value is zero', () => {
    const path = buildLinePath(
      [
        { date: '2026-07-29', value: 0 },
        { date: '2026-07-30', value: 0 },
      ],
      100,
      50,
    )

    expect(path).toBe('M 0 50 L 100 50')
  })
})

describe('tallyGameTypes', () => {
  it('counts by type and sorts descending', () => {
    const result = tallyGameTypes([
      { type: 'photo' },
      { type: 'quiz' },
      { type: 'photo' },
    ])

    expect(result).toEqual([
      { type: 'photo', count: 2 },
      { type: 'quiz', count: 1 },
    ])
  })

  it('returns an empty list for no rows', () => {
    expect(tallyGameTypes([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- dashboard-activity`
Expected: FAIL, cannot resolve `@/lib/dashboard-activity`.

- [ ] **Step 3: Implement `src/lib/dashboard-activity.ts`**

```ts
import type { GameType } from '@/types/database'

export const ACTIVITY_WINDOW_DAYS = 30

export type ActivityMetric = 'submissions' | 'teams'

export type ActivityPoint = { date: string; value: number }

export type SubmissionRow = { created_at: string; team_id: string }

export type GameTypeCount = { type: GameType; count: number }

/** UTC calendar day key, so bucketing does not drift with the viewer's zone. */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Buckets submission rows into one point per day for the trailing
 * ACTIVITY_WINDOW_DAYS ending on endDate inclusive. Days with no rows are
 * emitted as zero so the chart always draws a continuous line.
 */
export function bucketActivity(
  rows: SubmissionRow[],
  metric: ActivityMetric,
  endDate: Date,
): ActivityPoint[] {
  const keys: string[] = []
  const end = new Date(
    Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()),
  )

  for (let offset = ACTIVITY_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
    const day = new Date(end)
    day.setUTCDate(day.getUTCDate() - offset)
    keys.push(dayKey(day))
  }

  const inWindow = new Set(keys)
  const counts = new Map<string, number>()
  const teamsSeen = new Map<string, Set<string>>()

  for (const row of rows) {
    const key = row.created_at.slice(0, 10)
    if (!inWindow.has(key)) continue

    if (metric === 'teams') {
      const set = teamsSeen.get(key) ?? new Set<string>()
      set.add(row.team_id)
      teamsSeen.set(key, set)
    } else {
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  return keys.map((date) => ({
    date,
    value:
      metric === 'teams' ? (teamsSeen.get(date)?.size ?? 0) : (counts.get(date) ?? 0),
  }))
}

function scalePoints(
  points: ActivityPoint[],
  width: number,
  height: number,
): { x: number; y: number }[] {
  const max = Math.max(...points.map((p) => p.value), 0)
  const lastIndex = Math.max(points.length - 1, 1)

  return points.map((point, index) => ({
    x: (index / lastIndex) * width,
    // An all-zero series has no range to scale, so pin it to the baseline.
    y: max === 0 ? height : height - (point.value / max) * height,
  }))
}

function formatCoordinate(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

/** SVG `d` for the series outline. */
export function buildLinePath(
  points: ActivityPoint[],
  width: number,
  height: number,
): string {
  if (points.length === 0) return ''

  return scalePoints(points, width, height)
    .map(
      (p, index) =>
        `${index === 0 ? 'M' : 'L'} ${formatCoordinate(p.x)} ${formatCoordinate(p.y)}`,
    )
    .join(' ')
}

/** SVG `d` for the shaded area beneath the series. */
export function buildAreaPath(
  points: ActivityPoint[],
  width: number,
  height: number,
): string {
  const line = buildLinePath(points, width, height)
  if (!line) return ''

  return `${line} L ${formatCoordinate(width)} ${formatCoordinate(height)} L 0 ${formatCoordinate(height)} Z`
}

/** Counts submissions per game type, busiest first. */
export function tallyGameTypes(rows: { type: GameType }[]): GameTypeCount[] {
  const counts = new Map<GameType, number>()

  for (const row of rows) {
    counts.set(row.type, (counts.get(row.type) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- dashboard-activity`
Expected: PASS, 8 tests.

- [ ] **Step 5: Add the query keys**

In `src/lib/query-keys.ts`, add inside the object:

```ts
  activitySeries: (orgId: string | null, metric: string) =>
    ['activity-series', orgId, metric] as const,
  gameTypeBreakdown: (orgId: string | null) =>
    ['game-type-breakdown', orgId] as const,
```

- [ ] **Step 6: Add the two hooks to `src/hooks/use-dashboard.ts`**

Append to the file, and add the imports it needs at the top:

```ts
import {
  ACTIVITY_WINDOW_DAYS,
  bucketActivity,
  tallyGameTypes,
  type ActivityMetric,
  type ActivityPoint,
  type GameTypeCount,
} from '@/lib/dashboard-activity'
import type { GameType } from '@/types/database'
```

```ts
/** ISO timestamp for the start of the trailing activity window. */
function windowStartISO(): string {
  const start = new Date()
  start.setUTCDate(start.getUTCDate() - (ACTIVITY_WINDOW_DAYS - 1))
  start.setUTCHours(0, 0, 0, 0)
  return start.toISOString()
}

export function useActivitySeries(
  organizationId: string | null,
  metric: ActivityMetric,
) {
  return useQuery({
    queryKey: queryKeys.activitySeries(organizationId, metric),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<ActivityPoint[]> => {
      if (!organizationId) return []

      // `submissions` has no organization_id, so scope via the events join.
      const { data, error } = await supabase
        .from('submissions')
        .select('created_at, team_id, events!inner(organization_id)')
        .eq('events.organization_id', organizationId)
        .gte('created_at', windowStartISO())

      if (error) throw error

      const rows = (data ?? []).map((row) => ({
        created_at: row.created_at as string,
        team_id: row.team_id as string,
      }))

      return bucketActivity(rows, metric, new Date())
    },
  })
}

export function useGameTypeBreakdown(organizationId: string | null) {
  return useQuery({
    queryKey: queryKeys.gameTypeBreakdown(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<GameTypeCount[]> => {
      if (!organizationId) return []

      const { data, error } = await supabase
        .from('submissions')
        .select('games!inner(type), events!inner(organization_id)')
        .eq('events.organization_id', organizationId)
        .gte('created_at', windowStartISO())

      if (error) throw error

      const rows = (data ?? [])
        .map((row) => {
          const game = row.games as { type: GameType } | { type: GameType }[] | null
          const resolved = Array.isArray(game) ? game[0] : game
          return resolved ? { type: resolved.type } : null
        })
        .filter((row): row is { type: GameType } => row !== null)

      return tallyGameTypes(rows)
    },
  })
}
```

- [ ] **Step 7: Verify build, lint and tests**

Run: `npm run build && npm run lint && npm test`
Expected: all PASS. If the Supabase embedded-select types complain, keep the explicit casts shown above rather than loosening the row types to `any`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/dashboard-activity.ts src/lib/dashboard-activity.test.ts src/lib/query-keys.ts src/hooks/use-dashboard.ts
git commit -m "feat(dashboard): 30-day activity series and game-type breakdown data"
```

---

### Task 7: Dashboard presentation components

**Files:**
- Create: `src/components/dashboard/StatCard.tsx`
- Create: `src/components/dashboard/ActivityFeed.tsx`
- Create: `src/components/dashboard/ActivityChart.tsx`
- Create: `src/components/dashboard/GameTypeBreakdown.tsx`

**Interfaces:**
- Consumes: `bucketActivity` output shape, `buildLinePath`, `buildAreaPath`, `tallyGameTypes`, `useActivitySeries`, `useGameTypeBreakdown` from Task 6. `useRecentEvents` and its `RecentEventRow` from the existing `src/hooks/use-dashboard.ts`.
- Produces:
  - `<StatCard label={string} value={number | undefined} to={string} />`
  - `<ActivityFeed events={RecentEventRow[]} isLoading={boolean} />`
  - `<ActivityChart organizationId={string} />`
  - `<GameTypeBreakdown organizationId={string} />`

- [ ] **Step 1: Create `StatCard.tsx`**

```tsx
import { Link } from 'react-router-dom'

import { NeoCard } from '@/components/neo-minimal'

type StatCardProps = {
  label: string
  value: number | undefined
  to: string
}

/**
 * One Overview stat tile. The design shows a week-over-week delta beneath the
 * number; there is no historical comparison in the data yet, so it is omitted
 * rather than faked.
 */
export function StatCard({ label, value, to }: StatCardProps) {
  return (
    <Link to={to}>
      <NeoCard interactive className="h-full p-4">
        <p className="text-nm-neutral-500 mb-1 text-[10px] font-semibold tracking-wider uppercase">
          {label}
        </p>
        <p className="text-4xl font-bold tabular-nums">{value ?? '0'}</p>
      </NeoCard>
    </Link>
  )
}
```

- [ ] **Step 2: Create `ActivityFeed.tsx`**

```tsx
import { Clock } from 'lucide-react'
import { Link } from 'react-router-dom'

import { NeoCard } from '@/components/neo-minimal'
import type { RecentEventRow } from '@/hooks/use-dashboard'

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''

  const minutes = Math.round((Date.now() - then) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`

  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

type ActivityFeedProps = {
  events: RecentEventRow[]
  isLoading: boolean
}

/**
 * Recent activity. Backed by recent events, since there is no cross-entity
 * activity log yet.
 */
export function ActivityFeed({ events, isLoading }: ActivityFeedProps) {
  return (
    <NeoCard className="flex flex-col p-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold whitespace-nowrap">Recent Activity</h2>
        <Link
          to="/admin/events"
          className="text-nm-neutral-500 shrink-0 text-xs hover:underline"
        >
          View All
        </Link>
      </div>

      {isLoading ? (
        <p className="text-nm-neutral-500 py-2 text-xs">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-nm-neutral-500 py-2 text-xs">
          No events yet.{' '}
          <Link to="/admin/events/new" className="underline">
            Create your first event
          </Link>
          .
        </p>
      ) : (
        <ul>
          {events.map((e) => (
            <li key={e.id} className="border-border flex gap-2.5 border-t py-2">
              <span className="bg-nm-yellow/20 text-nm-charcoal flex size-[30px] shrink-0 items-center justify-center rounded-full">
                <Clock className="size-3.5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  to={`/admin/events/${e.id}`}
                  className="block truncate text-sm hover:underline"
                >
                  {e.name}
                </Link>
                <p className="text-nm-neutral-500 text-xs">
                  {relativeTime(e.dateISO)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </NeoCard>
  )
}
```

- [ ] **Step 3: Create `ActivityChart.tsx`**

```tsx
import { useState } from 'react'

import { NeoCard } from '@/components/neo-minimal'
import { useActivitySeries } from '@/hooks/use-dashboard'
import {
  buildAreaPath,
  buildLinePath,
  type ActivityMetric,
} from '@/lib/dashboard-activity'

// Fixed viewBox; the SVG scales to its container via width/height 100%.
const VIEW_W = 900
const VIEW_H = 320

const METRICS: { key: ActivityMetric; label: string }[] = [
  { key: 'submissions', label: 'Submissions' },
  { key: 'teams', label: 'Teams playing' },
]

type ActivityChartProps = {
  organizationId: string
}

/** 30-day activity chart, hand-rolled SVG so no charting dependency is needed. */
export function ActivityChart({ organizationId }: ActivityChartProps) {
  const [metric, setMetric] = useState<ActivityMetric>('submissions')
  const { data, isLoading } = useActivitySeries(organizationId, metric)
  const points = data ?? []
  const total = points.reduce((sum, p) => sum + p.value, 0)
  const peak = Math.max(...points.map((p) => p.value), 0)

  return (
    <NeoCard className="flex h-full min-h-55 flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">Participation</h2>
          <p className="text-nm-neutral-500 text-xs">Last 30 days</p>
        </div>
        <div className="bg-nm-slate-700 flex gap-0 rounded-full p-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                metric === m.key
                  ? 'bg-nm-yellow text-nm-charcoal'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-nm-neutral-500 flex flex-1 items-center justify-center text-xs">
          Loading…
        </p>
      ) : total === 0 ? (
        <p className="text-nm-neutral-500 flex flex-1 items-center justify-center px-6 text-center text-xs">
          No activity in the last 30 days. Once teams start playing, their
          submissions show up here.
        </p>
      ) : (
        <>
          <div className="mb-2 flex gap-6">
            <div>
              <p className="text-2xl font-bold tabular-nums">{total}</p>
              <p className="text-nm-neutral-500 text-[10px] tracking-wider uppercase">
                Total
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{peak}</p>
              <p className="text-nm-neutral-500 text-[10px] tracking-wider uppercase">
                Busiest day
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              preserveAspectRatio="none"
              className="h-full w-full"
              role="img"
              aria-label={`${metric === 'teams' ? 'Teams playing' : 'Submissions'} over the last 30 days`}
            >
              <path
                d={buildAreaPath(points, VIEW_W, VIEW_H)}
                fill="var(--nm-yellow)"
                opacity="0.16"
              />
              <path
                d={buildLinePath(points, VIEW_W, VIEW_H)}
                fill="none"
                stroke="var(--nm-yellow)"
                strokeWidth="3"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          <div className="text-nm-neutral-500 mt-1 flex justify-between text-[10px]">
            <span>{points[0]?.date}</span>
            <span>{points.at(-1)?.date}</span>
          </div>
        </>
      )}
    </NeoCard>
  )
}
```

- [ ] **Step 4: Create `GameTypeBreakdown.tsx`**

```tsx
import { NeoCard } from '@/components/neo-minimal'
import { useGameTypeBreakdown } from '@/hooks/use-dashboard'
import type { GameType } from '@/types/database'

const TYPE_LABEL: Record<GameType, string> = {
  photo: 'Photo',
  video: 'Video',
  text: 'Text',
  puzzle: 'Puzzle',
  quiz: 'Quiz',
  music_bingo: 'Music Bingo',
}

type GameTypeBreakdownProps = {
  organizationId: string
}

/** Which game types teams actually played over the same 30-day window. */
export function GameTypeBreakdown({ organizationId }: GameTypeBreakdownProps) {
  const { data, isLoading } = useGameTypeBreakdown(organizationId)
  const rows = data ?? []
  const max = Math.max(...rows.map((r) => r.count), 0)

  return (
    <NeoCard className="flex h-full flex-col p-4">
      <h2 className="text-sm font-bold">By Game Type</h2>
      <p className="text-nm-neutral-500 mb-3 text-xs">Last 30 days</p>

      {isLoading ? (
        <p className="text-nm-neutral-500 text-xs">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-nm-neutral-500 text-xs">Nothing played yet.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <li key={row.type}>
              <div className="mb-1 flex justify-between text-xs">
                <span>{TYPE_LABEL[row.type]}</span>
                <span className="font-semibold tabular-nums">{row.count}</span>
              </div>
              <div className="bg-nm-neutral-200 h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-nm-yellow h-full rounded-full"
                  style={{ width: `${max === 0 ? 0 : (row.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </NeoCard>
  )
}
```

- [ ] **Step 5: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: PASS. Nothing renders these yet; Task 8 wires them in.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard
git commit -m "feat(dashboard): stat card, activity feed, SVG chart and type breakdown"
```

---

### Task 8: Rebuild the Overview page

**Files:**
- Modify: `src/pages/admin/ClientDashboardPage.tsx`

**Interfaces:**
- Consumes: all four components from Task 7. `useDashboardStats` and `useRecentEvents` from the existing `src/hooks/use-dashboard.ts`. `NoOrganizationMessage` from `@/components/admin/QueryState`.
- Produces: the rendered Overview route at `/admin`.

- [ ] **Step 1: Replace `ClientDashboardPage.tsx` entirely**

```tsx
import { NoOrganizationMessage } from '@/components/admin/QueryState'
import { ActivityChart } from '@/components/dashboard/ActivityChart'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { GameTypeBreakdown } from '@/components/dashboard/GameTypeBreakdown'
import { StatCard } from '@/components/dashboard/StatCard'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { useDashboardStats, useRecentEvents } from '@/hooks/use-dashboard'
import { useOrganizationId } from '@/hooks/use-organization-id'

/** Client-admin Overview: stats, 30-day participation and recent activity. */
export function ClientDashboardPage() {
  const organizationId = useOrganizationId()
  const statsQuery = useDashboardStats(organizationId)
  const recentQuery = useRecentEvents(organizationId)

  if (!organizationId) {
    return (
      <AdminPageShell title="Overview" subtitle="Your events at a glance.">
        <NoOrganizationMessage />
      </AdminPageShell>
    )
  }

  const stats = statsQuery.data

  const cards = [
    { label: 'Available Games', value: stats?.totalGames, to: '/admin/games' },
    { label: 'Upcoming Events', value: stats?.upcomingEvents, to: '/admin/events' },
    { label: 'Live Now', value: stats?.activeEvents, to: '/admin/events' },
    { label: 'Total Events', value: stats?.totalEvents, to: '/admin/events' },
  ]

  return (
    <div className="px-6 py-8 lg:px-8">
      <h1 className="mb-1 text-3xl font-bold">Overview</h1>
      <p className="text-nm-neutral-500 mb-6 text-sm">
        Welcome back. Here's what's happening across your organisation today.
      </p>

      <div className="grid gap-4 xl:grid-cols-[repeat(2,minmax(180px,220px))_1fr]">
        {/* Stat tiles: 2x2 on the left of the chart at wide widths. */}
        <div className="grid grid-cols-2 gap-4 xl:col-span-2 xl:contents">
          {cards.map((c) => (
            <StatCard key={c.label} label={c.label} value={c.value} to={c.to} />
          ))}
        </div>

        {/* Chart spans the tall right-hand region, as in the design. */}
        <div className="xl:col-start-3 xl:row-span-3 xl:row-start-1">
          <ActivityChart organizationId={organizationId} />
        </div>

        <div className="xl:col-span-2 xl:col-start-1">
          <ActivityFeed
            events={recentQuery.data ?? []}
            isLoading={recentQuery.isLoading}
          />
        </div>

        <div className="xl:col-span-2 xl:col-start-1">
          <GameTypeBreakdown organizationId={organizationId} />
        </div>
      </div>
    </div>
  )
}
```

The `AdminPageShell` wrapper is kept only for the no-organisation branch, because that helper renders a consistent empty state. The populated page renders its own heading block, since the design's Overview heading differs from `NeoPageShell`'s treatment.

- [ ] **Step 2: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 3: Verify in the browser**

Sign in as a client admin with real data and screenshot `/admin`. Expected: "Overview" heading, four stat tiles showing real numbers, the participation chart drawing a gold line with Total and Busiest day figures, a working metric switcher, the game-type bars populated, and the recent activity list showing real events with relative times.

- [ ] **Step 4: Verify the empty case**

Point at an organisation with no games, events or submissions. Expected: zeros in the tiles, the chart's "No activity in the last 30 days" copy, "Nothing played yet." in the breakdown, and the "Create your first event" prompt in the feed. No blank regions and no console errors.

- [ ] **Step 5: Verify narrow widths and dark mode**

Resize to a narrow viewport. Expected: the grid stacks, the chart stays readable, and nothing overflows horizontally. Toggle dark mode and confirm every card, the chart line and the bars remain legible.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/ClientDashboardPage.tsx
git commit -m "feat(dashboard): rebuild Overview page to the new design"
```

---

### Task 9: Full verification pass

**Files:**
- Modify: `TRACKER.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a verified branch ready for review, and a tracker entry.

- [ ] **Step 1: Run the whole suite**

Run: `npm run build && npm run lint && npm test`
Expected: all PASS. Confirm the bingo tests ran and passed and that no bingo file appears in `git diff --stat main..HEAD`.

- [ ] **Step 2: Check for stray dashes**

Run:

```bash
grep -rn "—\|–" src/components/shell src/components/dashboard src/lib/dashboard-activity.ts src/lib/global-search.ts src/pages/admin/ClientDashboardPage.tsx
```

Expected: no output. If anything matches, replace it with a comma, colon or full stop.

- [ ] **Step 3: Confirm no new dependencies**

Run: `git diff main..HEAD -- package.json package-lock.json`
Expected: no change to either file. If a chart or test library crept in, remove it.

- [ ] **Step 4: Role regression check**

Sign in as each of client_admin, event_manager and facilitator. For each, screenshot the sidebar and header. Expected: exactly the surfaces that role could reach before this branch. Specifically, a facilitator sees Events plus Profile, no Organisation, no Billing, no Support, and no create buttons; an event_manager sees no Organisation or Billing but does see their Profile entry.

- [ ] **Step 5: Full shell walkthrough**

In one session, exercise every piece of chrome: collapse and expand the sidebar, switch theme in both directions, search and navigate from a result, search for nonsense and see the no-matches state, open and close the Help modal, follow its support link, then Exit, cancel it, Exit again, accept, and use Log Back In. Expected: all behave as described in Tasks 2 through 5, with no console errors.

- [ ] **Step 6: Update `TRACKER.md`**

Add an entry under the appropriate section recording that new-design phase 1 (shell plus Overview) is complete on `feature/new-design`, that the palette moved to cool grey and the font to Inter across all admin surfaces, and that the remaining screens (Games, Events, Organisation, Billing, Support, My Account) plus the design's game and event editors are still to do. Note explicitly that this branch must not be merged until the full redesign is signed off.

- [ ] **Step 7: Commit**

```bash
git add TRACKER.md
git commit -m "docs: record new-design phase 1 status in tracker"
```

- [ ] **Step 8: Report to Rumen**

Summarise: what was built, screenshots of the Overview in light and dark, the two things deliberately left out with data reasons (stat deltas, active-players metric), the fact that all admin screens now show cool grey and Inter so other pages look part-migrated by design, and anything encountered that needs his input before the next phase.

---

## Deliberate omissions, with reasons

These are not oversights. Each was decided during brainstorming or forced by the current schema.

- **Stat week-over-week deltas.** `useDashboardStats` has no historical comparison. Omitted rather than invented.
- **Active players metric.** No `participants` table; `submissions` carries only `team_id`. Two chart tabs, not three.
- **Image avatars.** `profiles` has no `avatar_url`. Initials only.
- **Help articles.** No content system. The modal ships with its empty state.
- **The design's game type-picker modal and slide-over editor, and the full-screen event editor.** Later phases. Header CTAs point at today's flows.
- **A real cross-entity activity log.** Later work. The feed reuses recent events.
- **Auto-opening an editor from a search result.** Depends on those editors existing.
- **Your Plan and Quick Links cards.** Dropped per the locked decision; Billing and the nav already cover them.
