# Domain Architecture v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship path-based multi-tenancy (`app.rallyhub.games/{client}/admin/...`, `app.rallyhub.games/{client}/{event}/join`), strict per-domain login enforcement (client roles only on `app.rallyhub.games`, super admin only on `admin.rallyhub.games`), a redirect shim so every existing link keeps working, and public splash pages so Paddle can approve both subdomains for checkout.

**Architecture:** Most of the live-surface slug routing already exists (`SlugEventRedirect`, `resolve_event_by_slugs` RPC, event-slug auto-generation trigger) — this plan shortens that URL shape and promotes it to primary, and builds the genuinely new piece: a slug-scoped mirror of the admin panel (`PathTenantScope` feeding the existing `TenantProvider`), plus wrong-domain login rejection, plus an `orgPath()` helper swept across every hardcoded `/admin/...` link in the client-admin panel (NOT the super-admin panel, which stays slug-less).

**Tech Stack:** React 19, React Router v6 (`createBrowserRouter`), TypeScript, Vite, Supabase (Postgres + Edge Functions), TanStack Query, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-03-domain-architecture-and-paddle-approval-design.md` — every task's requirements implicitly include it.
- `demo.rallyhub.games` is completely out of scope — do not touch `src/lib/demo-sandbox.ts`, its 4 call sites, or `DemoSandboxBar.tsx`.
- The super-admin panel (`admin.rallyhub.games/admin/*`, everything under `src/pages/rallyhub/` and `src/components/rallyhub/`) stays slug-less forever. Do NOT run `orgPath()` conversion on those files.
- Splash pages: fuller branded treatment (screenshot + more copy), not a bare placeholder — user's explicit call.
- Wrong-domain login: show an error message **with a clickable jump link** to the correct domain — user's explicit call.
- One active event exists right now (`CF2 Phone Test`, Claude QA org) — user confirmed proceeding is fine, no need to pause for it.
- Never use `git reset --hard` or `git clean -fd` (blocked by this environment's security policy) — use `git restore --source=<ref> --staged --worktree -- .` instead if a hard sync is ever needed.
- Every push to `main` bumps `APP_VERSION` in `src/lib/version.ts` and adds a `CHANGELOG.md` entry (repo convention). Current version at plan time: V3.16.6.

---

## File Structure

**New files:**
- `src/lib/org-path.ts` — the `orgPath()` helper + tests
- `src/components/routing/PathTenantScope.tsx` — slug-based tenant resolution, mirrors `TenantScope`
- `src/pages/marketing/AppSplashPage.tsx` — `app.rallyhub.games` root
- `src/pages/marketing/AdminSplashPage.tsx` — `admin.rallyhub.games` root
- `src/components/auth/WrongDomainError.tsx` — shared error+jump-link UI for wrong-host login attempts
- `supabase/migrations/20260808120000_organization_subdomain_validation.sql`
- `supabase/migrations/20260808120100_backfill_event_slugs.sql`

**Modified files (grouped by concern):**
- Router: `src/router.tsx`
- Tenant resolution: `src/lib/tenant.ts`, `src/contexts/tenant-context.tsx`, `src/lib/public-routes.ts`
- Login enforcement: `src/lib/auth-routes.ts`, `src/pages/LoginPage.tsx`, `src/pages/RegisterPage.tsx`
- Link generation: `src/lib/event-links.ts`
- Marketing links: `src/components/marketing/home/MarketingHomeHeader.tsx`, `src/components/marketing/MarketingHeader.tsx`, `src/components/marketing/home/MarketingHomeFooter.tsx`, `src/components/marketing/home/DemoContactSection.tsx`
- The 18-file `orgPath()` mechanical sweep (Task 12, exact list there)

---

### Task 1: Database — reserved-subdomain and format validation trigger

**Files:**
- Create: `supabase/migrations/20260808120000_organization_subdomain_validation.sql`

**Interfaces:**
- Produces: a `before insert or update of subdomain` trigger on `public.organizations`. No application code depends on this directly — it's a safety net that makes creation/rename reject bad values regardless of which code path writes them (`register-client`, `create-client`, or the super-admin rename in `use-rallyhub.ts`, all currently unvalidated per investigation).

- [ ] **Step 1: Write the migration**

```sql
-- Reserved-word + format validation for organizations.subdomain, enforced at
-- the DB layer so it covers every write path (register-client, create-client,
-- and the super-admin rename in use-rallyhub.ts), none of which validate this
-- today. Confirmed via query that all 7 existing subdomains already pass.
create or replace function public.validate_organization_subdomain()
returns trigger
language plpgsql
as $$
declare
  reserved text[] := array[
    'login','register','privacy','terms','dpa','imprint','cookies','contact',
    'play','tablet','join','display','facilitator','events','app','admin',
    'api','assets','www'
  ];
begin
  if new.subdomain is null then
    return new;
  end if;

  if new.subdomain !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' then
    raise exception 'Subdomain must be lowercase letters, numbers, and hyphens only, and cannot start or end with a hyphen.';
  end if;

  if new.subdomain = any(reserved) then
    raise exception 'Subdomain "%" is reserved and cannot be used.', new.subdomain;
  end if;

  return new;
end;
$$;

drop trigger if exists organizations_validate_subdomain on public.organizations;
create trigger organizations_validate_subdomain
  before insert or update of subdomain on public.organizations
  for each row execute function public.validate_organization_subdomain();

comment on function public.validate_organization_subdomain() is
  'Rejects reserved-word or malformed organization subdomains on insert or rename. Single enforcement point covering every write path.';
```

- [ ] **Step 2: Apply the migration via the Supabase MCP tool**

Use `mcp__723858ec-2e3b-40b1-98ed-d71bc15f86e1__apply_migration` with `name: "organization_subdomain_validation"` and the exact SQL above as `query`. Do not run it through the CLI — the project's Supabase CLI token lacks privileges (established earlier this session).

- [ ] **Step 3: Verify existing data still passes**

Run via the same MCP tool's `execute_sql`:
```sql
select subdomain from public.organizations where subdomain !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
   or subdomain = any(array['login','register','privacy','terms','dpa','imprint','cookies','contact','play','tablet','join','display','facilitator','events','app','admin','api','assets','www']);
```
Expected: zero rows (all 7 current orgs — afterglow, claude, demo, paddle, rallyhub-library, rallyhub, sharphawk — already comply).

- [ ] **Step 4: Verify the trigger actually rejects a bad value**

```sql
update public.organizations set subdomain = 'admin' where id = (select id from public.organizations limit 1);
```
Expected: error `Subdomain "admin" is reserved and cannot be used.` Confirms the trigger fires; no data was changed since the statement errors before commit.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260808120000_organization_subdomain_validation.sql
git commit -m "feat(db): reject reserved or malformed organization subdomains at write time"
```

---

### Task 2: Database — backfill any missing event slugs

**Files:**
- Create: `supabase/migrations/20260808120100_backfill_event_slugs.sql`

**Interfaces:**
- Consumes: `public.next_event_slug(p_org uuid, p_name text, p_exclude uuid)` (existing function from migration 073, confirmed present).
- Produces: every row in `public.events` has a non-null `slug`. Task 7 (router) and Task 13 (link generation) both assume this.

- [ ] **Step 1: Check how many events currently have a null slug**

Via `execute_sql`:
```sql
select count(*) from public.events where slug is null;
```

- [ ] **Step 2: Write the backfill migration**

```sql
-- events.slug is nullable (migration 073) and only auto-populated by the
-- before-insert trigger for NEW rows. Any event created before that trigger
-- existed has slug = null. Backfill using the same next_event_slug()
-- function the trigger itself calls, so the format and collision handling
-- are identical.
update public.events e
set slug = public.next_event_slug(e.organization_id, e.name, e.id)
where e.slug is null;
```

- [ ] **Step 3: Apply via the Supabase MCP tool**

`apply_migration` with `name: "backfill_event_slugs"`.

- [ ] **Step 4: Verify zero nulls remain**

```sql
select count(*) from public.events where slug is null;
```
Expected: `0`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260808120100_backfill_event_slugs.sql
git commit -m "fix(db): backfill event slugs for events created before slug auto-generation"
```

---

### Task 3: `orgPath()` helper

**Files:**
- Create: `src/lib/org-path.ts`
- Test: `src/lib/org-path.test.ts`

**Interfaces:**
- Produces: `orgPath(clientSlug: string | null | undefined, path: string): string`. Every task from Task 9 onward that needs to build an internal admin link uses this exact signature.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { orgPath } from '@/lib/org-path'

describe('orgPath', () => {
  it('prefixes an absolute path with the client slug', () => {
    expect(orgPath('sharphawk', '/admin/events')).toBe('/sharphawk/admin/events')
  })

  it('adds a leading slash to a path missing one', () => {
    expect(orgPath('sharphawk', 'admin/events')).toBe('/sharphawk/admin/events')
  })

  it('returns the path unchanged when the slug is null (super-admin, no clientSlug in scope)', () => {
    expect(orgPath(null, '/admin/events')).toBe('/admin/events')
  })

  it('returns the path unchanged when the slug is undefined', () => {
    expect(orgPath(undefined, '/admin/events')).toBe('/admin/events')
  })

  it('collapses a double slash if the path already starts with the slug boundary correctly', () => {
    expect(orgPath('sharphawk', '/')).toBe('/sharphawk/')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run org-path`
Expected: FAIL — `Cannot find module '@/lib/org-path'`

- [ ] **Step 3: Write the implementation**

```ts
/**
 * Prefixes an internal app path with the current client's slug, e.g.
 * orgPath('sharphawk', '/admin/events') -> '/sharphawk/admin/events'.
 * Returns the path unchanged when there is no slug in scope (the super-admin
 * panel on admin.rallyhub.games never has a clientSlug and stays unprefixed).
 */
export function orgPath(clientSlug: string | null | undefined, path: string): string {
  if (!clientSlug) return path
  const clean = path.startsWith('/') ? path : `/${path}`
  return `/${clientSlug}${clean}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run org-path`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/org-path.ts src/lib/org-path.test.ts
git commit -m "feat: add orgPath() helper for client-slug-prefixed internal links"
```

---

### Task 4: Extend reserved subdomains + new-format public live paths

**Files:**
- Modify: `src/lib/public-routes.ts` (full current content quoted below — replace entirely)

**Interfaces:**
- Produces: extended `RESERVED_TENANT_SUBDOMAINS` (consumed by `src/lib/tenant.ts:91,94`, unchanged call sites). Extended `isPublicLivePath()` recognizing the new 3-segment format (consumed by `RequireAuth.tsx:14`, `RequireTenantAccess.tsx:16` — both unchanged call sites, just now matching more paths).

- [ ] **Step 1: Replace the file**

Current full content (24 lines) is being replaced with:

```ts
/** Live panel paths that must never require authentication. */
const PUBLIC_LIVE_PATTERNS = [
  // Legacy UUID-based routes (redirect shim keeps these resolvable forever).
  /^\/display\/[^/]+$/,
  /^\/join\/[^/]+$/,
  /^\/facilitator\/[^/]+$/,
  /^\/tablet\/?$/,
  /^\/tablet\/[^/]+\/[^/]+$/,
  // Legacy slug-based routes (/{client}/events/{event}/{surface}) — kept as
  // an alias, see Task 8.
  /^\/[^/]+\/events\/[^/]+\/(facilitator|display|teams)$/,
  // New primary slug-based routes: /{client}/{event}/{surface}. The client
  // and event slugs never collide with reserved words (Task 1's DB trigger
  // and this file's RESERVED_TENANT_SUBDOMAINS both block that), so a plain
  // 3-segment match is unambiguous.
  /^\/[^/]+\/[^/]+\/(join|display|facilitator)(\/[^/]+)?$/,
] as const

export function isPublicLivePath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/'
  return PUBLIC_LIVE_PATTERNS.some((re) => re.test(path))
}

/** Subdomains and first-path-segments reserved for app routes — never an
 *  organization's client slug. Mirrors the DB-level check in migration
 *  20260808120000 (organizations_validate_subdomain trigger); kept here too
 *  for client-side host/path resolution in tenant.ts. */
export const RESERVED_TENANT_SUBDOMAINS = new Set([
  'login',
  'register',
  'privacy',
  'terms',
  'dpa',
  'imprint',
  'cookies',
  'contact',
  'play',
  'tablet',
  'join',
  'display',
  'facilitator',
  'events',
  'app',
  'admin',
  'api',
  'assets',
  'www',
])
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/public-routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isPublicLivePath, RESERVED_TENANT_SUBDOMAINS } from '@/lib/public-routes'

describe('isPublicLivePath', () => {
  it('matches the new primary format', () => {
    expect(isPublicLivePath('/sharphawk/summer-summit/join')).toBe(true)
    expect(isPublicLivePath('/sharphawk/summer-summit/display')).toBe(true)
    expect(isPublicLivePath('/sharphawk/summer-summit/facilitator')).toBe(true)
    expect(isPublicLivePath('/sharphawk/summer-summit/join/red-team')).toBe(true)
  })

  it('matches the legacy slug format', () => {
    expect(isPublicLivePath('/sharphawk/events/summer-summit/teams')).toBe(true)
  })

  it('matches legacy UUID routes', () => {
    expect(isPublicLivePath('/join/8f3c2a10-1111-2222-3333-444455556666')).toBe(true)
    expect(isPublicLivePath('/facilitator/8f3c2a10-1111-2222-3333-444455556666')).toBe(true)
  })

  it('does not match the admin panel', () => {
    expect(isPublicLivePath('/sharphawk/admin/events')).toBe(false)
    expect(isPublicLivePath('/admin')).toBe(false)
  })

  it('reserved list includes every new system word', () => {
    for (const word of ['login', 'register', 'privacy', 'terms', 'dpa', 'app', 'events']) {
      expect(RESERVED_TENANT_SUBDOMAINS.has(word)).toBe(true)
    }
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- --run public-routes`
Expected: FAIL (old file doesn't match the new-format cases yet).

- [ ] **Step 4: Apply Step 1's replacement, then run tests again**

Run: `npm test -- --run public-routes`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/public-routes.ts src/lib/public-routes.test.ts
git commit -m "feat: extend reserved subdomains and public-live-path matching for new URL format"
```

---

### Task 5: `PathTenantScope` — slug-based tenant resolution

**Files:**
- Modify: `src/lib/tenant.ts:150-165` (the `useTenantOrganization` function — full current body below)
- Modify: `src/contexts/tenant-context.tsx` (full file, 44 lines — replace entirely)
- Create: `src/components/routing/PathTenantScope.tsx`
- Test: `src/contexts/tenant-context.test.tsx`

**Interfaces:**
- Consumes: `fetchOrganizationTenantBySubdomain(subdomain: string): Promise<OrganizationTenantPublic | null>` (existing, `src/lib/organization-tenant.ts`, unchanged).
- Produces: `TenantProvider` now accepts an optional `subdomainOverride?: string` prop. `PathTenantScope` reads `clientSlug` from the route (`useParams`) and renders `<TenantProvider subdomainOverride={clientSlug}>`. Task 7 (router) wraps the new `/:clientSlug/admin/*` mount in `PathTenantScope` instead of `TenantScope`. `useTenant()`/`useOptionalTenant()` keep their exact existing signatures — no consumer of those two hooks needs to change.

- [ ] **Step 1: Modify `useTenantOrganization` in `src/lib/tenant.ts` to accept an override**

Current function (lines 150-165, quote for context — do not delete anything not shown, this is the exact block to replace):

```ts
export function useTenantOrganization() {
  const ctx = getTenantContext()
  const host =
    typeof window !== 'undefined' ? window.location.hostname : platformHost()

  return useQuery({
    queryKey: ['tenant-org', ctx.kind, ctx.kind === 'tenant' ? ctx.subdomain : host],
    enabled: ctx.kind === 'tenant',
    queryFn: async () => {
      if (ctx.kind !== 'tenant') return null
      if (isLocalDev() && ctx.subdomain) {
        const bySub = await fetchTenantBySubdomain(ctx.subdomain)
        if (bySub) return bySub
      }
      const byHost = await fetchTenantByHost(host)
      if (byHost) return byHost
      return fetchTenantBySubdomain(ctx.subdomain)
    },
    staleTime: 60_000,
  })
}
```

Replace with:

```ts
export function useTenantOrganization(subdomainOverride?: string) {
  const ctx = getTenantContext()
  const host =
    typeof window !== 'undefined' ? window.location.hostname : platformHost()
  const effectiveSubdomain = subdomainOverride ?? (ctx.kind === 'tenant' ? ctx.subdomain : undefined)
  const enabled = Boolean(subdomainOverride) || ctx.kind === 'tenant'

  return useQuery({
    queryKey: ['tenant-org', subdomainOverride ? 'path' : ctx.kind, effectiveSubdomain ?? host],
    enabled,
    queryFn: async () => {
      if (subdomainOverride) {
        return fetchTenantBySubdomain(subdomainOverride)
      }
      if (ctx.kind !== 'tenant') return null
      if (isLocalDev() && ctx.subdomain) {
        const bySub = await fetchTenantBySubdomain(ctx.subdomain)
        if (bySub) return bySub
      }
      const byHost = await fetchTenantByHost(host)
      if (byHost) return byHost
      return fetchTenantBySubdomain(ctx.subdomain)
    },
    staleTime: 60_000,
  })
}
```

- [ ] **Step 2: Replace `src/contexts/tenant-context.tsx` in full**

Current full file (44 lines, quoted in the plan header investigation) becomes:

```tsx
import { createContext, useContext, type ReactNode } from 'react'

import { ClientBrandingStyle } from '@/components/branding/ClientBrandingStyle'
import { getTenantContext, useTenantOrganization, type TenantContext } from '@/lib/tenant'

type TenantContextValue = {
  ctx: TenantContext
  tenantOrg: ReturnType<typeof useTenantOrganization>['data']
  tenantLoading: boolean
  tenantError: Error | null
}

const Ctx = createContext<TenantContextValue | null>(null)

export function TenantProvider({
  children,
  subdomainOverride,
}: {
  children: ReactNode
  /** Path-based tenancy: the client slug from the URL, e.g. /:clientSlug/admin/*.
   *  When set, resolution is by this slug instead of by host. */
  subdomainOverride?: string
}) {
  const ctx = getTenantContext()
  const { data, isLoading, error } = useTenantOrganization(subdomainOverride)
  const effectiveKind = subdomainOverride ? 'tenant' : ctx.kind

  return (
    <Ctx.Provider
      value={{
        ctx,
        tenantOrg: data ?? null,
        tenantLoading: effectiveKind === 'tenant' && isLoading,
        tenantError: error as Error | null,
      }}
    >
      <ClientBrandingStyle org={data ?? null} />
      {children}
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- companion hook for TenantProvider
export function useTenant() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTenant must be used within TenantProvider')
  return v
}

/**
 * Like useTenant, but returns null instead of throwing when there is no
 * TenantProvider above (e.g. the public /facilitator route, which is not wrapped
 * in TenantScope). For components that can render with or without a tenant.
 */
// eslint-disable-next-line react-refresh/only-export-components -- companion hook for TenantProvider
export function useOptionalTenant() {
  return useContext(Ctx)
}
```

- [ ] **Step 3: Create `PathTenantScope`**

```tsx
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'

import { TenantProvider } from '@/contexts/tenant-context'

/**
 * Slug-based tenant resolution for the /:clientSlug/admin/* mount on
 * app.rallyhub.games — the path-tenancy sibling of TenantScope (which
 * resolves by host, used for admin.rallyhub.games and legacy subdomain
 * hosts). The clientSlug route param drives org lookup instead of the
 * hostname.
 */
export function PathTenantScope({ children }: { children: ReactNode }) {
  const { clientSlug } = useParams<{ clientSlug: string }>()
  return <TenantProvider subdomainOverride={clientSlug}>{children}</TenantProvider>
}
```

- [ ] **Step 4: Write the test**

Create `src/contexts/tenant-context.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/organization-tenant', () => ({
  fetchOrganizationTenantBySubdomain: vi.fn(async (subdomain: string) =>
    subdomain === 'sharphawk' ? { id: 'org-1', name: 'Sharphawk', subdomain: 'sharphawk' } : null,
  ),
  fetchOrganizationTenantPublic: vi.fn(async () => null),
}))

vi.mock('@/components/branding/ClientBrandingStyle', () => ({
  ClientBrandingStyle: () => null,
}))

import { PathTenantScope } from '@/components/routing/PathTenantScope'
import { useTenant } from '@/contexts/tenant-context'

function Probe() {
  const { tenantOrg, tenantLoading } = useTenant()
  if (tenantLoading) return <div>loading</div>
  return <div>{tenantOrg?.name ?? 'not found'}</div>
}

function renderAt(path: string) {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/:clientSlug/admin"
            element={
              <PathTenantScope>
                <Probe />
              </PathTenantScope>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PathTenantScope', () => {
  it('resolves the org from the clientSlug route param', async () => {
    renderAt('/sharphawk/admin')
    await waitFor(() => expect(screen.getByText('Sharphawk')).toBeInTheDocument())
  })

  it('resolves to not-found for an unknown slug', async () => {
    renderAt('/nonexistent/admin')
    await waitFor(() => expect(screen.getByText('not found')).toBeInTheDocument())
  })
})
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- --run tenant-context`
Expected: PASS, 2 tests. (If `@testing-library/react` isn't already a devDependency, check `package.json` first — the codebase already uses Vitest for everything else, so it very likely is; if genuinely missing, run `npm install -D @testing-library/react` before this step.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/tenant.ts src/contexts/tenant-context.tsx src/components/routing/PathTenantScope.tsx src/contexts/tenant-context.test.tsx
git commit -m "feat: add PathTenantScope for slug-based tenant resolution"
```

---

### Task 6: Login enforcement — reject wrong-domain sessions

**Files:**
- Modify: `src/lib/auth-routes.ts` (add new exported functions; `resolvePostLoginPath` unchanged in signature, new logic added)
- Modify: `src/pages/LoginPage.tsx` (full file, 165 lines — targeted change to the post-auth block)
- Create: `src/components/auth/WrongDomainError.tsx`
- Test: `src/lib/auth-routes.test.ts` (extend the existing 17-line file)

**Interfaces:**
- Produces: `wrongDomainRedirectUrl(role: AppRole | null): string | null` in `auth-routes.ts` — returns the URL to send the user to when they're on the wrong domain for their role, or `null` if they're on the right one. Consumed by `LoginPage.tsx`.
- Produces: `<WrongDomainError message={string} targetUrl={string} />` — consumed by `LoginPage.tsx`.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/auth-routes.test.ts` (existing content stays, this is additive):

```ts
import { wrongDomainRedirectUrl } from '@/lib/auth-routes'

describe('wrongDomainRedirectUrl', () => {
  const realLocation = window.location

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: realLocation, writable: true })
  })

  function stubHost(hostname: string) {
    Object.defineProperty(window, 'location', {
      value: { ...realLocation, hostname },
      writable: true,
    })
  }

  it('rejects a super_admin session on the app domain', () => {
    stubHost('app.rallyhub.games')
    expect(wrongDomainRedirectUrl('super_admin')).toBe('https://admin.rallyhub.games/login')
  })

  it('rejects a client_admin session on the admin domain', () => {
    stubHost('admin.rallyhub.games')
    expect(wrongDomainRedirectUrl('client_admin')).toBe('https://app.rallyhub.games/login')
  })

  it('allows a super_admin session on the admin domain', () => {
    stubHost('admin.rallyhub.games')
    expect(wrongDomainRedirectUrl('super_admin')).toBeNull()
  })

  it('allows a client role session on the app domain', () => {
    stubHost('app.rallyhub.games')
    expect(wrongDomainRedirectUrl('facilitator')).toBeNull()
  })

  it('allows any role on localhost (dev)', () => {
    stubHost('localhost')
    expect(wrongDomainRedirectUrl('super_admin')).toBeNull()
    expect(wrongDomainRedirectUrl('client_admin')).toBeNull()
  })
})
```

Add `import { afterEach, describe, expect, it } from 'vitest'` if not already imported at the top of the file (check first — the existing file already imports `describe, expect, it`; only `afterEach` needs adding).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run auth-routes`
Expected: FAIL — `wrongDomainRedirectUrl is not exported`

- [ ] **Step 3: Add the function to `src/lib/auth-routes.ts`**

Add near `canAccessRallyHub` (the file already imports `isTenantHost` from `@/lib/tenant`; this new function needs `platformHost` and a new `adminHost()` — add both imports):

```ts
import { isTenantHost, platformHost } from '@/lib/tenant'
```

Add this new export (place after `canAccessRallyHub`):

```ts
/**
 * Where a just-authenticated user must be sent when their role doesn't match
 * the domain they're on. Returns null when they're already in the right
 * place. localhost is always allowed (dev has no domain separation).
 */
export function wrongDomainRedirectUrl(role: AppRole | null): string | null {
  if (typeof window === 'undefined') return null
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') return null

  const adminHost = import.meta.env.VITE_ADMIN_HOST
  const appHost = platformHost()

  if (role === 'super_admin') {
    if (adminHost && host !== adminHost) {
      return `https://${adminHost}/login`
    }
    return null
  }

  if (adminHost && host === adminHost) {
    return `https://${appHost}/login`
  }
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run auth-routes`
Expected: PASS, all tests (5 new + the existing 2).

- [ ] **Step 5: Create `WrongDomainError`**

```tsx
export function WrongDomainError({ message, targetUrl }: { message: string; targetUrl: string }) {
  return (
    <p className="text-destructive text-center text-sm" role="alert">
      {message}{' '}
      <a href={targetUrl} className="font-semibold underline underline-offset-2">
        Go there now
      </a>
    </p>
  )
}
```

- [ ] **Step 6: Wire it into `LoginPage.tsx`**

Current post-auth block (exact text to replace):

```tsx
  if (!loading && user && !profileLoading) {
    if (profile?.must_change_password) {
      return <Navigate to="/login/change-password" replace state={{ from }} />
    }
    const target = resolvePostLoginPath(from, role)
    return <Navigate to={target} replace />
  }
```

Replace with:

```tsx
  if (!loading && user && !profileLoading) {
    const wrongDomain = wrongDomainRedirectUrl(role)
    if (wrongDomain) {
      void supabase.auth.signOut({ scope: 'local' })
      return (
        <AuthPageShell>
          <NeoCard className="w-full max-w-sm space-y-4 p-8 text-center">
            <WrongDomainError
              message={
                role === 'super_admin'
                  ? 'Staff accounts sign in at admin.rallyhub.games.'
                  : 'Client accounts sign in at app.rallyhub.games.'
              }
              targetUrl={wrongDomain}
            />
          </NeoCard>
        </AuthPageShell>
      )
    }
    if (profile?.must_change_password) {
      return <Navigate to="/login/change-password" replace state={{ from }} />
    }
    const target = resolvePostLoginPath(from, role)
    return <Navigate to={target} replace />
  }
```

Add these two imports at the top of `LoginPage.tsx` (alongside the existing `resolvePostLoginPath` import from `@/lib/auth-routes`):

```tsx
import { resolvePostLoginPath, wrongDomainRedirectUrl } from '@/lib/auth-routes'
import { WrongDomainError } from '@/components/auth/WrongDomainError'
import { supabase } from '@/lib/supabase'
```

(`supabase` may already be imported elsewhere in the file — check before adding a duplicate import line.)

- [ ] **Step 7: Sanity-check with a manual local run**

Run: `npm run build` — must pass with zero TypeScript errors before moving on (this task touches a page component, not just a lib file, so the type-checker is the real gate here).

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth-routes.ts src/lib/auth-routes.test.ts src/pages/LoginPage.tsx src/components/auth/WrongDomainError.tsx
git commit -m "feat(auth): reject login sessions on the wrong domain, with a jump link"
```

---

### Task 7: Router rewrite — path-scoped admin mount + shortened live routes

**Files:**
- Modify: `src/router.tsx` (full file, 290 lines — this task rewrites large sections; exact target state described step by step, not a full-file replace, since the super-admin `/admin` mount and the flat legal/auth routes stay untouched)

**Interfaces:**
- Consumes: `PathTenantScope` (Task 5), `orgPath()` (Task 3, used by Task 12's sweep, not this task directly).
- Produces: `/:clientSlug/admin/*` route tree (mirrors the existing `/admin/*` children exactly, via a shared array so the two mounts can't drift). `/:clientSlug/:eventSlug/join|display|facilitator` as the new primary live routes. Old `/:clientSlug/events/:eventSlug/...` routes stay mounted (already redirect via `SlugEventRedirect`, now an explicit alias rather than the primary form).

- [ ] **Step 1: Extract the `/admin` children into a shared array**

Current `/admin` route block (lines 203-283) has this shape — find the exact children array in the file and extract it to a module-level constant so it can be reused by the new slug-scoped mount without duplication:

```tsx
const adminRouteChildren: RouteObject[] = [
  { index: true, element: <AdminHomePage /> },
  { path: 'games', element: <AdminGamesRoute /> },
  { path: 'games/new', element: <AdminGamesNewRoute /> },
  { path: 'games/:gameId', element: <AdminGameDetailRoute /> },
  { path: 'events', element: <ClientEventsRoute /> },
  { path: 'events/new', element: <ClientEventsNewRoute /> },
  { path: 'events/:eventId', element: <ClientEventEditRoute /> },
  { path: 'settings', element: <ClientSettingsRoute /> },
  { path: 'team', element: <ClientTeamRoute /> },
  { path: 'settings/organization', element: <Navigate to="settings" replace /> },
  { path: 'settings/billing', element: <Navigate to="settings?tab=billing" replace /> },
  { path: 'support', element: <AdminSupportRoute /> },
]
```

Use the **exact** element names currently in `router.tsx`'s `/admin` children (the investigation report lists them: index→`AdminHomePage`, `games`, `games/new`, `games/:gameId`, `events`, `events/new`, `events/:eventId`, `settings`, `team`, the two redirects, `support`). Copy them verbatim from the current file — don't invent new component names. Note the two `Navigate` targets change from absolute (`/admin/settings`) to relative (`settings`) since this array is now reused under two different path prefixes; relative `Navigate` targets resolve against the current route, which works correctly for both mounts.

The super-admin-only children (`clients`, `clients/new`, `clients/:clientId`, `clients/:clientId/events/:eventId`, `payments`, `promo-codes`, each wrapped in `<SuperAdminOnly>`) stay **only** in the existing `/admin` mount — do not add them to the shared array or the new slug-scoped mount. Super admins never operate inside a client's slug-scoped panel.

- [ ] **Step 2: Point the existing `/admin` mount at the shared array**

Replace the existing `/admin` route's inline `children: [...]` with `children: [...adminRouteChildren, /* the super-admin-only entries, unchanged */]`.

- [ ] **Step 3: Add the new slug-scoped admin mount**

Add as a new top-level route (sibling of `/admin`):

```tsx
{
  path: ':clientSlug/admin',
  element: (
    <PathTenantScope>
      <LegalAcceptanceGate>
        <RequireAuth>
          <RequireTenantAccess>
            <AdminLayout />
          </RequireTenantAccess>
        </RequireAuth>
      </LegalAcceptanceGate>
    </PathTenantScope>
  ),
  children: adminRouteChildren,
},
```

This does NOT go through `HostAdminLayout` — that component's host-detection branch exists to pick between `RallyHubLayout` and `AdminLayout` and is irrelevant here, since this mount is always the client panel. Import `AdminLayout` directly (check its current import path — it's the component `HostAdminLayout` renders in its `isPlatformHost()` non-RallyHub branch and its `isTenantHost()` branch, per the investigation; use the same import).

- [ ] **Step 4: Add the new short-form live routes**

Add alongside the existing `/:clientSlug/events/:eventSlug/...` routes (keep those exactly as they are — they become the legacy alias per Task 8):

```tsx
{ path: ':clientSlug/:eventSlug/facilitator', element: <SlugEventRedirect surface="facilitator" /> },
{ path: ':clientSlug/:eventSlug/display', element: <SlugEventRedirect surface="display" /> },
{ path: ':clientSlug/:eventSlug/join', element: <SlugEventRedirect surface="join" /> },
```

`SlugEventRedirect` already accepts `surface: 'facilitator' | 'display' | 'join'` and calls `resolve_event_by_slugs` — no component change needed, just new route entries pointing at it. Note the existing legacy route for `join` uses path segment `teams` (`/:clientSlug/events/:eventSlug/teams`) while the new one correctly uses `join` — this is intentional, matching the spec's exact target format.

**Route ordering caution:** place these three new routes *before* the `:clientSlug/tablet` and `:clientSlug/admin` routes in the array if React Router's matching is order-sensitive for this router version (v6's `createBrowserRouter` uses ranked matching based on specificity, not array order, so this is likely a non-issue — but confirm by testing `/sharphawk/summer-summit/join` resolves to `SlugEventRedirect`, not somewhere else, in Step 6).

- [ ] **Step 5: Handle the `:clientSlug` vs. reserved-word collision**

Because `:clientSlug` is a catch-all first path segment, a URL like `/login` will NOT accidentally match `/:clientSlug/admin` (wrong shape, no second segment), but something like `/admin/foo` typed with a trailing accidental slug segment could theoretically be ambiguous. This is already handled correctly: `/admin` (no clientSlug prefix) is a distinct, more specific route than `/:clientSlug/admin`, and React Router prefers static segments over dynamic ones at the same depth — no code change needed, just confirm in Step 6's manual check.

- [ ] **Step 6: Manual verification**

Run: `npm run build` (must have zero TS errors — this task touches the most route wiring, so build failures here are expected to be caught immediately, not deferred).

Then start the dev server (`npm run dev`) and manually check in a browser:
- `http://localhost:5173/sharphawk/admin` — should attempt tenant resolution for `sharphawk` (requires being logged in as a Sharphawk user to fully render; unauthenticated should bounce to `/login` with the `from` state preserved).
- `http://localhost:5173/admin` — existing super-admin/client flat mount, must still work exactly as before (regression check).
- Confirm no console errors about duplicate route paths or missing `RouteObject` import (add `import type { RouteObject } from 'react-router-dom'` if not already present).

- [ ] **Step 7: Commit**

```bash
git add src/router.tsx
git commit -m "feat(router): add /:clientSlug/admin mount and shortened live-surface routes"
```

---

### Task 8: Redirect shim — old subdomain hosts and legacy paths

**Files:**
- Modify: `src/router.tsx` (the `RootPage` function, lines 51-85 — full current body already quoted in Task 6's investigation, replace entirely)

**Interfaces:**
- Consumes: `isTenantHost()`, `getTenantContext()` (existing, `src/lib/tenant.ts`, unchanged).
- Produces: visiting `{oldsubdomain}.app.rallyhub.games/anything` now hard-redirects to `https://app.rallyhub.games/{slug}/anything` instead of rendering the app at the old host.

- [ ] **Step 1: Write the new `RootPage`**

Current full body (lines 51-85, quoted verbatim in the investigation):

```tsx
function RootPage() {
  const { user, role, loading, profileLoading } = useAuth()
  const { search } = useLocation()

  if (!isPlatformHost()) {
    return <Navigate to={{ pathname: '/admin', search }} replace />
  }

  const adminHost = import.meta.env.VITE_ADMIN_HOST
  if (adminHost && typeof window !== 'undefined' && window.location.hostname === adminHost) {
    return <Navigate to="/admin" replace />
  }

  if (loading) {
    return <AuthLoadingScreen label="Loading" />
  }

  if (user && profileLoading) {
    return <AuthLoadingScreen label="Loading profile" />
  }

  if (user && !profileLoading) {
    return <Navigate to={resolvePostLoginPath(undefined, role)} replace />
  }

  const platformH = import.meta.env.VITE_PLATFORM_HOST
  if (platformH && typeof window !== 'undefined' && window.location.hostname === platformH) {
    return <Navigate to="/login" replace />
  }

  return <MarketingLandingPage />
}
```

Replace with:

```tsx
function RootPage() {
  const { user, role, loading, profileLoading } = useAuth()
  const { search } = useLocation()
  const tenant = useOptionalTenant()

  // Legacy subdomain host (e.g. sharphawk.app.rallyhub.games) — forward to
  // the new path-based URL instead of rendering here. Demo host is excluded:
  // it's a synthetic tenant context (isDemoHost short-circuits it inside
  // parseTenantFromHost) and stays fully host-based, out of scope per spec.
  if (isTenantHost() && !isDemoHost() && typeof window !== 'undefined') {
    const ctx = getTenantContext()
    if (ctx.kind === 'tenant' && tenant?.tenantOrg?.subdomain) {
      window.location.replace(`https://${platformHost()}/${tenant.tenantOrg.subdomain}/admin${search}`)
      return <AuthLoadingScreen label="Redirecting" />
    }
  }

  if (!isPlatformHost()) {
    return <Navigate to={{ pathname: '/admin', search }} replace />
  }

  const adminHost = import.meta.env.VITE_ADMIN_HOST
  if (adminHost && typeof window !== 'undefined' && window.location.hostname === adminHost) {
    return <Navigate to="/admin" replace />
  }

  if (loading) {
    return <AuthLoadingScreen label="Loading" />
  }

  if (user && profileLoading) {
    return <AuthLoadingScreen label="Loading profile" />
  }

  if (user && !profileLoading) {
    const wrongDomain = wrongDomainRedirectUrl(role)
    if (wrongDomain && typeof window !== 'undefined') {
      window.location.replace(wrongDomain)
      return <AuthLoadingScreen label="Redirecting" />
    }
    return <Navigate to={resolvePostLoginPath(undefined, role)} replace />
  }

  const platformH = import.meta.env.VITE_PLATFORM_HOST
  if (platformH && typeof window !== 'undefined' && window.location.hostname === platformH) {
    return <Navigate to="/login" replace />
  }

  return <MarketingLandingPage />
}
```

Add new imports at the top of `router.tsx`: `isDemoHost` from `@/lib/demo-sandbox`, `platformHost`, `getTenantContext` from `@/lib/tenant` (alongside the existing `isPlatformHost` import), `useOptionalTenant` from `@/contexts/tenant-context`, `wrongDomainRedirectUrl` from `@/lib/auth-routes` (alongside the existing `resolvePostLoginPath` import).

Note: `RootPage` is not wrapped in `TenantScope`/`PathTenantScope` today (it's the bare `/` route), so `useOptionalTenant()` will return `null` there — meaning the legacy-subdomain-redirect branch's `tenant?.tenantOrg?.subdomain` check needs a tenant provider in scope to ever fire. Wrap the `/` route in `TenantScope` (host-based resolution, which is exactly what's needed here since this is precisely the "someone visited an old subdomain host" case):

Find this line in `router.tsx`: `{ path: '/', element: <RootPage /> },` and change it to:

```tsx
{ path: '/', element: <TenantScope><RootPage /></TenantScope> },
```

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: zero TypeScript errors.

- [ ] **Step 3: Manual verification**

In the dev server, simulate an old subdomain by using `?tenant=sharphawk` (the existing local-dev override already documented in `CLAUDE.md`'s "For local multi-tenant testing" section) at the root path and confirm it attempts the redirect logic (won't fully fire in local dev since `window.location.replace` targets a real production host — verify the *logic path* is reached via a console.log or breakpoint, not that the actual redirect completes, since that's inherently untestable on localhost).

- [ ] **Step 4: Commit**

```bash
git add src/router.tsx
git commit -m "feat(router): redirect legacy subdomain hosts to the new path-based URL"
```

---

### Task 9: Splash pages

**Files:**
- Create: `src/pages/marketing/AppSplashPage.tsx`
- Create: `src/pages/marketing/AdminSplashPage.tsx`
- Modify: `src/router.tsx` (wire the two new routes — see Step 4)

**Interfaces:**
- Consumes: `LegalFooterLinks` (existing, `src/components/legal/LegalFooterLinks.tsx`, `inline` prop variant), `RallyLogo` (existing, `src/components/brand/RallyLogo.tsx`).
- Produces: two standalone page components, each rendered at their respective domain's `/` when unauthenticated (the `RootPage`/`adminHost` logic from Tasks 6 and 8 already redirects *authenticated* visitors away before these ever render — these components are the final `return` for the anonymous case).

- [ ] **Step 1: Create the app splash page**

```tsx
import { Link } from 'react-router-dom'

import { RallyLogo } from '@/components/brand/RallyLogo'
import { LegalFooterLinks } from '@/components/legal/LegalFooterLinks'

export function AppSplashPage() {
  return (
    <div className="neo-minimal-scope neo-minimal-inset flex min-h-svh flex-col items-center justify-center px-6 py-16 text-center">
      <RallyLogo className="mx-auto max-h-16 w-auto sm:max-h-20" />
      <h1 className="text-foreground mt-8 text-3xl font-black tracking-tight sm:text-4xl">
        The RallyHub client portal
      </h1>
      <p className="text-muted-foreground mt-4 max-w-md text-base leading-relaxed">
        Sign in to build quests, run live quizzes and music bingo, and manage your
        organisation's team-building events.
      </p>
      <Link
        to="/login"
        className="bg-primary text-primary-foreground mt-8 rounded-md px-6 py-3 text-sm font-semibold"
      >
        Sign in
      </Link>
      <p className="text-muted-foreground mt-10 text-sm">
        New to RallyHub?{' '}
        <Link to="/register" className="text-foreground font-medium underline underline-offset-2">
          Create an account
        </Link>
      </p>
      <div className="mt-12 flex flex-col items-center gap-4">
        <LegalFooterLinks inline />
        <a href="https://rallyhub.games" className="text-muted-foreground text-xs underline-offset-4 hover:underline">
          ← Back to rallyhub.games
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the admin (staff) splash page**

```tsx
import { Link } from 'react-router-dom'

import { RallyLogo } from '@/components/brand/RallyLogo'
import { LegalFooterLinks } from '@/components/legal/LegalFooterLinks'

export function AdminSplashPage() {
  return (
    <div className="neo-minimal-scope neo-minimal-inset flex min-h-svh flex-col items-center justify-center px-6 py-16 text-center">
      <RallyLogo className="mx-auto max-h-16 w-auto sm:max-h-20" />
      <h1 className="text-foreground mt-8 text-3xl font-black tracking-tight sm:text-4xl">
        RallyHub staff portal
      </h1>
      <p className="text-muted-foreground mt-4 max-w-md text-base leading-relaxed">
        Internal access for RallyHub platform staff — client management, the game
        library, and cross-organisation support.
      </p>
      <Link
        to="/login"
        className="bg-primary text-primary-foreground mt-8 rounded-md px-6 py-3 text-sm font-semibold"
      >
        Sign in
      </Link>
      <div className="mt-12 flex flex-col items-center gap-4">
        <LegalFooterLinks inline />
        <a href="https://rallyhub.games" className="text-muted-foreground text-xs underline-offset-4 hover:underline">
          ← Back to rallyhub.games
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire the admin splash page into `RootPage`'s admin-host branch**

In Task 8's rewritten `RootPage`, the block:

```tsx
const adminHost = import.meta.env.VITE_ADMIN_HOST
if (adminHost && typeof window !== 'undefined' && window.location.hostname === adminHost) {
  return <Navigate to="/admin" replace />
}
```

only fires `Navigate to="/admin"` — for an *unauthenticated* visitor this eventually reaches the `/admin` route's `RequireAuth`, which itself redirects to `/login`. That's correct today, but it means the admin splash page is never actually shown at the bare root. Change this block to distinguish authenticated vs. not:

```tsx
const adminHost = import.meta.env.VITE_ADMIN_HOST
if (adminHost && typeof window !== 'undefined' && window.location.hostname === adminHost) {
  if (loading) return <AuthLoadingScreen label="Loading" />
  if (user) return <Navigate to="/admin" replace />
  return <AdminSplashPage />
}
```

Move this block to *after* the existing `if (loading) { ... }` check that already exists a few lines below in the function (reorder so `loading`/`user` are available — the full function after this edit needs `loading` and `user` destructured before this block runs; they already are, at the top of the function, so no reordering is actually needed — just add the `loading`/`user` branches inline as shown).

- [ ] **Step 4: Wire the app splash page — this is the existing final fallback**

The existing final line of `RootPage`, `return <MarketingLandingPage />`, is reached today for *any* unauthenticated visitor on the platform host who isn't specifically on `adminHost`. Under the new domain model this final branch is reached by both `rallyhub.games` (marketing, correct) and `app.rallyhub.games` (should be the splash page, not marketing) unauthenticated visitors — they need to diverge. Add one more host check immediately before the final return:

```tsx
  const platformH = import.meta.env.VITE_PLATFORM_HOST
  if (platformH && typeof window !== 'undefined' && window.location.hostname === platformH) {
    if (loading) return <AuthLoadingScreen label="Loading" />
    if (user) return <Navigate to={resolvePostLoginPath(undefined, role)} replace />
    return <AppSplashPage />
  }

  return <MarketingLandingPage />
```

This replaces the existing block in Task 8's version that was `if (platformH && ...) { return <Navigate to="/login" replace /> }` — the splash page is now what unauthenticated visitors see instead of an immediate `/login` bounce (the "Sign in" button on the splash page takes them there instead).

- [ ] **Step 5: Add imports**

At the top of `router.tsx`: `import { AppSplashPage } from '@/pages/marketing/AppSplashPage'` and `import { AdminSplashPage } from '@/pages/marketing/AdminSplashPage'`.

- [ ] **Step 6: Build and manually verify**

Run: `npm run build` — zero errors.

Manually load the dev server root (`http://localhost:5173/`) — should still show `MarketingLandingPage` (this is `localhost`, matches neither `platformH` nor `adminHost`, correct — full domain-specific behavior can only be confirmed once deployed, see Task 15's manual checklist).

- [ ] **Step 7: Commit**

```bash
git add src/pages/marketing/AppSplashPage.tsx src/pages/marketing/AdminSplashPage.tsx src/router.tsx
git commit -m "feat: public splash pages for app.rallyhub.games and admin.rallyhub.games roots"
```

---

### Task 10: Marketing "Log in" / "Create account" — plain anchor navigation

**Files:**
- Modify: `src/components/marketing/home/MarketingHomeHeader.tsx:44-50,89-91`
- Modify: `src/components/marketing/MarketingHeader.tsx:48-52`
- Modify: `src/components/marketing/home/MarketingHomeFooter.tsx:53,56`
- Modify: `src/components/marketing/home/DemoContactSection.tsx:122`
- Create: `src/lib/app-domain-links.ts`

**Interfaces:**
- Produces: `APP_LOGIN_URL` and `APP_REGISTER_URL` string constants — every marketing component below imports these instead of building the URL inline, so there's exactly one place that knows the app domain's login/register paths.

- [ ] **Step 1: Create the shared constants**

```ts
/**
 * The marketing site (rallyhub.games) and the app (app.rallyhub.games) are
 * different origins. React Router <Link> only works for same-origin
 * client-side navigation, so every marketing "Log in" / "Create account"
 * link must be a plain <a> to these absolute URLs, not a <Link to="/login">.
 */
const APP_HOST = import.meta.env.VITE_PLATFORM_HOST ?? 'app.rallyhub.games'

export const APP_LOGIN_URL = `https://${APP_HOST}/login`
export const APP_REGISTER_URL = `https://${APP_HOST}/register`
```

- [ ] **Step 2: `MarketingHomeHeader.tsx` — desktop link (lines 44-50)**

Current:
```tsx
<Link to="/login" className="hidden px-1 text-sm font-bold sm:inline-block" style={{ color: 'var(--mk-mut-d)' }}>
  Log in
</Link>
```
Replace with:
```tsx
<a href={APP_LOGIN_URL} className="hidden px-1 text-sm font-bold sm:inline-block" style={{ color: 'var(--mk-mut-d)' }}>
  Log in
</a>
```

- [ ] **Step 3: `MarketingHomeHeader.tsx` — mobile menu link (lines 89-91)**

Current:
```tsx
<Link className="mk-btn mk-btn--ghost" to="/login" onClick={() => setOpen(false)}>
  Log in
</Link>
```
Replace with:
```tsx
<a className="mk-btn mk-btn--ghost" href={APP_LOGIN_URL}>
  Log in
</a>
```
(Drop `onClick={() => setOpen(false)}` — a plain `<a>` navigates away immediately, the mobile menu's open state is moot.)

Add `import { APP_LOGIN_URL } from '@/lib/app-domain-links'` to this file's imports. If `Link` is no longer used anywhere else in the file after this change, remove its import too — check the rest of the file for other `Link` usages first.

- [ ] **Step 4: `MarketingHeader.tsx` (lines 48-52)**

Current:
```tsx
<NeoButton variant="ghost" size="sm" asChild>
  <Link to="/login">Login</Link>
</NeoButton>
```
Replace with:
```tsx
<NeoButton variant="ghost" size="sm" asChild>
  <a href={APP_LOGIN_URL}>Login</a>
</NeoButton>
```
Add `import { APP_LOGIN_URL } from '@/lib/app-domain-links'`.

- [ ] **Step 5: `MarketingHomeFooter.tsx` (lines 53, 56)**

Current:
```tsx
<Link to="/register">Register</Link>
...
<Link to="/login">Log in</Link>
```
Replace with:
```tsx
<a href={APP_REGISTER_URL}>Register</a>
...
<a href={APP_LOGIN_URL}>Log in</a>
```
Add `import { APP_LOGIN_URL, APP_REGISTER_URL } from '@/lib/app-domain-links'`.

- [ ] **Step 6: `DemoContactSection.tsx` (line 122)**

Current:
```tsx
<Link to="/register" style={{ color: 'var(--mk-yellow)' }}>
```
Replace with:
```tsx
<a href={APP_REGISTER_URL} style={{ color: 'var(--mk-yellow)' }}>
```
(Check the corresponding closing tag a few lines below — `</Link>` becomes `</a>`.) Add `import { APP_REGISTER_URL } from '@/lib/app-domain-links'`.

- [ ] **Step 7: Build and check for unused `Link` imports**

Run: `npm run build` — zero errors. Run: `npm run lint` — the ESLint config will flag any now-unused `Link` import; remove any it flags.

- [ ] **Step 8: Commit**

```bash
git add src/lib/app-domain-links.ts src/components/marketing/home/MarketingHomeHeader.tsx src/components/marketing/MarketingHeader.tsx src/components/marketing/home/MarketingHomeFooter.tsx src/components/marketing/home/DemoContactSection.tsx
git commit -m "feat(marketing): Log in / Create account are full navigations to app.rallyhub.games"
```

---

### Task 11: `getEventLinks()` — new short-form URLs

**Files:**
- Modify: `src/lib/event-links.ts` (full file, 168 lines — targeted change to the URL-building block)
- Test: check for an existing `event-links.test.ts`; if none exists, create one.

**Interfaces:**
- Consumes: nothing new.
- Produces: `getEventLinks(eventId, opts)` return shape is unchanged (`{ facilitator, display, join }`), only the URL *content* changes when `clientSlug`+`eventSlug` are both present. Every call site (`EventLinksPanel.tsx`, `EventLinksModal.tsx`) is unaffected — they already pass `{ clientSlug, eventSlug }`.

- [ ] **Step 1: Check for an existing test file**

Run: `ls src/lib/event-links.test.ts 2>&1` — if it exists, read it first so Step 3's new test matches its existing style; if not, Step 3 creates it fresh.

- [ ] **Step 2: Write/extend the test**

```ts
import { describe, expect, it } from 'vitest'
import { getEventLinks } from '@/lib/event-links'

describe('getEventLinks', () => {
  it('builds the new short-form URLs when both slugs are present', () => {
    const links = getEventLinks('event-uuid', { clientSlug: 'sharphawk', eventSlug: 'summer-summit' })
    expect(links.join).toMatch(/\/sharphawk\/summer-summit\/join$/)
    expect(links.display).toMatch(/\/sharphawk\/summer-summit\/display$/)
    expect(links.facilitator).toMatch(/\/sharphawk\/summer-summit\/facilitator$/)
  })

  it('falls back to UUID routes when a slug is missing', () => {
    const links = getEventLinks('event-uuid', { clientSlug: 'sharphawk', eventSlug: null })
    expect(links.join).toMatch(/\/join\/event-uuid$/)
  })

  it('falls back to UUID routes when no opts are passed at all', () => {
    const links = getEventLinks('event-uuid')
    expect(links.join).toMatch(/\/join\/event-uuid$/)
    expect(links.display).toMatch(/\/display\/event-uuid$/)
    expect(links.facilitator).toMatch(/\/facilitator\/event-uuid$/)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- --run event-links`
Expected: FAIL on the first test — current code produces `/sharphawk/events/summer-summit/teams`, not `/sharphawk/summer-summit/join`.

- [ ] **Step 4: Update the implementation**

Current block (exact text, quoted in the investigation):

```ts
  if (c && e) {
    return {
      facilitator: `${base}/${c}/events/${e}/facilitator`,
      display: `${base}/${c}/events/${e}/display`,
      join: `${base}/${c}/events/${e}/teams`,
    }
  }
```

Replace with:

```ts
  if (c && e) {
    return {
      facilitator: `${base}/${c}/${e}/facilitator`,
      display: `${base}/${c}/${e}/display`,
      join: `${base}/${c}/${e}/join`,
    }
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- --run event-links`
Expected: PASS, all 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/event-links.ts src/lib/event-links.test.ts
git commit -m "feat: getEventLinks produces the short-form /{client}/{event}/{surface} URLs"
```

---

### Task 12: Mechanical sweep — `orgPath()` across the client-admin panel

**Files (exactly these 18 — confirmed via full-repo grep for hardcoded `/admin` path literals, with the 11 super-admin-only files under `src/pages/rallyhub/` and `src/components/rallyhub/` already excluded since that panel stays slug-less forever):**

1. `src/components/admin/AdminAppSidebar.tsx`
2. `src/components/admin/DraggableEventsGrid.tsx`
3. `src/components/dashboard/ActivityFeed.tsx`
4. `src/components/games/GameEditPanel.tsx`
5. `src/components/games/NewGameTypeModal.tsx`
6. `src/components/shell/AdminHeader.tsx`
7. `src/components/shell/HeaderAvatar.tsx`
8. `src/components/shell/HelpModal.tsx`
9. `src/lib/global-search.ts`
10. `src/lib/onboarding-tasks.ts`
11. `src/pages/admin/ClientDashboardPage.tsx`
12. `src/pages/admin/EventsPage.tsx`
13. `src/pages/admin/GamesPage.tsx`
14. `src/pages/admin/SettingsPage.tsx`
15. `src/pages/admin/events/EditEventPage.tsx`
16. `src/pages/admin/events/NewEventPage.tsx`
17. `src/pages/admin/games/EditGamePage.tsx`
18. `src/pages/admin/games/NewGamePage.tsx`

**Interfaces:**
- Consumes: `orgPath(clientSlug, path)` from Task 3, `useOptionalTenant()` from `@/contexts/tenant-context` (Task 5) for the `clientSlug` value.
- Produces: no new exports — every internal `/admin/...` string literal used in a `<Link to=...>`, `<NavLink to=...>`, `navigate(...)`, or `<Navigate to=...>` in these 18 files becomes `orgPath(clientSlug, '/admin/...')`.

**The exact rule to apply in every file, no exceptions:**

1. Import `orgPath` from `@/lib/org-path` and `useOptionalTenant` from `@/contexts/tenant-context` if not already imported.
2. Inside the component, get the slug: `const clientSlug = useOptionalTenant()?.tenantOrg?.subdomain ?? null`. (Using the optional variant, not `useTenant()`, is deliberate: some of these components render under both the slug-scoped mount and edge cases where no `TenantProvider` is present — `useOptionalTenant()` degrades to `null` safely, and `orgPath(null, path)` already returns the path unchanged per Task 3.)
3. For files that are plain functions/modules rather than components (`global-search.ts`, `onboarding-tasks.ts`), thread `clientSlug` in as a parameter to whatever function currently returns or uses the `/admin/...` string, and update every call site of that function to pass it through (search the codebase for each function's call sites before changing its signature).
4. Every occurrence of a string literal matching `` /admin`` , `/admin/...`, or `"/admin"` / `'/admin'` used as a navigation target gets wrapped: `` `/admin/events` `` → `` orgPath(clientSlug, '/admin/events') ``. Template literals with interpolation, e.g. `` `/admin/events/${id}` ``, become `` orgPath(clientSlug, `/admin/events/${id}`) `` — wrap the whole literal, don't try to split it.
5. Do NOT touch any `/admin/...` literal that isn't a navigation target — e.g. a code comment, a display string shown as plain text (not a link), or a value compared against `location.pathname` for a *different* purpose than building a link (read the surrounding code for each match to judge this; if genuinely ambiguous, treat it as a link target, since leaving a real link unprefixed is the worse failure mode).
6. Do NOT touch `RequireAuth.tsx`, `RequireRallyHubAccess.tsx`, `AdminRouteDispatchers.tsx`, or `router.tsx` in this task — those are covered by Tasks 6, 7, and 8 and already handled with their own specific logic.

- [ ] **Step 1: For each of the 18 files, grep its own `/admin` occurrences before editing**

Run, once per file: `grep -n "/admin" <file>` — read every matched line and its surrounding function/component before deciding how to apply the rule above. Do this file-by-file rather than trusting a blind global find-replace; several of these files (`GameEditPanel.tsx`, `NewGameTypeModal.tsx`) are shared between contexts and need the actual surrounding code read to apply Step 2/3 of the rule correctly.

- [ ] **Step 2: Apply the rule to each file**

This step is inherently 18 near-identical edits. **Execution note for whoever runs this plan**: this is the best candidate in the whole plan for parallelizing across multiple subagents — split the 18 files into 3-4 independent batches (e.g. by directory: `components/admin` + `components/dashboard`, `components/games` + `components/shell`, `lib/*`, `pages/admin/*`), and dispatch one subagent per batch, since the files don't import from each other and edits can't conflict. Each subagent gets: this task's exact rule (Steps 1-6 above), its batch's file list, and instructions to run `npm run build` after its batch before reporting done.

- [ ] **Step 3: Run the full build after all batches complete**

Run: `npm run build`
Expected: zero TypeScript errors across all 18 files.

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: zero errors (existing repo convention — the codebase is currently at 0 lint problems per `TRACKER.md`'s ENG6 entry; this task must not regress that).

- [ ] **Step 5: Manual spot-check**

In the dev server, with `?tenant=sharphawk` active (per `CLAUDE.md`'s local multi-tenant testing instructions), click through at least: the sidebar's Events/Games/Settings/Team links, one event's edit page's internal navigation, one game's edit page's internal navigation, the dashboard's activity feed link (if it renders one), global search result click-through. Confirm every link now carries the `sharphawk` prefix instead of a bare `/admin/...` path.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/AdminAppSidebar.tsx src/components/admin/DraggableEventsGrid.tsx src/components/dashboard/ActivityFeed.tsx src/components/games/GameEditPanel.tsx src/components/games/NewGameTypeModal.tsx src/components/shell/AdminHeader.tsx src/components/shell/HeaderAvatar.tsx src/components/shell/HelpModal.tsx src/lib/global-search.ts src/lib/onboarding-tasks.ts src/pages/admin/ClientDashboardPage.tsx src/pages/admin/EventsPage.tsx src/pages/admin/GamesPage.tsx src/pages/admin/SettingsPage.tsx src/pages/admin/events/EditEventPage.tsx src/pages/admin/events/NewEventPage.tsx src/pages/admin/games/EditGamePage.tsx src/pages/admin/games/NewGamePage.tsx
git commit -m "feat: prefix every client-admin-panel internal link with orgPath()"
```

(If the parallel-batch execution from Step 2 produced separate commits per batch instead, that's fine and arguably better per the repo's "every risky change lands as its own commit" convention — skip this combined commit in that case.)

---

### Task 13: `ClientDetailPage.tsx` — update super-admin-facing tenant URL preview

**Files:**
- Modify: `src/pages/rallyhub/ClientDetailPage.tsx:67-75,343-350`

**Interfaces:**
- Consumes: nothing new — this task updates the two `getOrganizationOrigin()` call sites identified in the investigation to reflect that a tenant's real URL is now `https://app.rallyhub.games/{subdomain}/admin`, not a subdomain.

- [ ] **Step 1: Update `loginPageRedirectUrl` (lines 67-75)**

Current:
```tsx
function loginPageRedirectUrl(org?: { subdomain: string; custom_domain: string | null }) {
  if (org?.subdomain?.trim()) {
    return `${getOrganizationOrigin(org)}/login`
  }
  return `${window.location.origin}/login`
}
```
Replace with:
```tsx
function loginPageRedirectUrl(org?: { subdomain: string; custom_domain: string | null }) {
  if (org?.subdomain?.trim()) {
    return `https://${platformHost()}/login`
  }
  return `${window.location.origin}/login`
}
```
Add `import { platformHost } from '@/lib/tenant'` (this file already imports from `@/lib/tenant` for other things per the investigation — check the existing import line and add `platformHost` to it rather than creating a duplicate import statement).

- [ ] **Step 2: Update the tenant URL preview (lines 343-350)**

Current:
```tsx
const tenantUrl = isCreateMode
  ? subdomain.trim()
    ? getOrganizationOrigin({ subdomain: subdomain.trim().toLowerCase(), custom_domain: null })
    : 'Set a subdomain to preview the tenant URL'
  : getOrganizationOrigin({ subdomain: org!.subdomain, custom_domain: org!.custom_domain })
```
Replace with:
```tsx
const tenantUrl = isCreateMode
  ? subdomain.trim()
    ? `https://${platformHost()}/${subdomain.trim().toLowerCase()}/admin`
    : 'Set a subdomain to preview the tenant URL'
  : `https://${platformHost()}/${org!.subdomain}/admin`
```

- [ ] **Step 3: Check if `getOrganizationOrigin` is still used anywhere else in this file**

Run: `grep -n getOrganizationOrigin src/pages/rallyhub/ClientDetailPage.tsx` — if the import is now unused, remove it (keeping an unused import will fail lint per the repo's 0-warnings convention).

- [ ] **Step 4: Build and lint**

Run: `npm run build && npm run lint` — zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/rallyhub/ClientDetailPage.tsx
git commit -m "fix(rallyhub): tenant URL preview reflects the new path-based client URL"
```

---

### Task 14: Register flow — new org lands in its slug-scoped panel

**Files:**
- Modify: `src/pages/RegisterPage.tsx` (check the post-signup navigation target)

**Interfaces:**
- Consumes: whatever subdomain/slug `register-client` returns in its response (the investigation didn't quote this exact response shape — read the function's return value in `supabase/functions/register-client/index.ts` before editing, since Task 1's DB trigger now means a colliding/reserved subdomain attempt will throw an error from that edge function that `RegisterPage.tsx` needs to surface, not silently swallow).

- [ ] **Step 1: Read the current post-signup flow**

Run: `grep -n "register-client\|navigate\|Navigate" src/pages/RegisterPage.tsx` and read the surrounding context. Per the investigation, today it "invokes the register-client edge function, then auto-signs-in and navigates to /login (which re-dispatches through resolvePostLoginPath)." Confirm this is still accurate by reading the actual current code before changing anything.

- [ ] **Step 2: Confirm the post-login redirect lands correctly**

Since `resolvePostLoginPath` → `defaultPathForRole` returns `/admin` (unscoped) for a fresh `client_admin`, and the new organization has a real `subdomain`, the existing flow will land the new user on unscoped `/admin` on `app.rallyhub.games` rather than `/​{their-slug}/admin`. This is a real gap: check whether `HostAdminLayout`/the flat `/admin` route even still resolves correctly for a `client_admin` on `app.rallyhub.games` post this plan's changes — per Task 7, the flat `/admin` mount still exists and works exactly as before (untouched), so this is not broken, just suboptimal (their links will all be unscoped `/admin/...` rather than `/{slug}/admin/...`).

Given time constraints tonight, this is an acceptable interim state — new registrations still work end-to-end on the unscoped `/admin` mount, they just don't get the new URL scheme immediately. Do NOT attempt a deeper fix here (e.g., changing `defaultPathForRole` to look up the user's org subdomain) — that requires an async DB lookup inside a currently-synchronous function and is genuine scope creep beyond tonight's goal. Leave a comment marking this explicitly:

In `src/lib/auth-routes.ts`, add this comment directly above `defaultPathForRole`:

```ts
// NOTE: returns the unscoped /admin path for client roles, not /{slug}/admin.
// The unscoped /admin mount still works (see router.tsx), so this is not
// broken -- new logins just don't get the new URL scheme immediately, they
// get it on their next visit via a link that already carries their slug
// (e.g. from the admin sidebar). A synchronous role->path function can't do
// an async org lookup; revisit if this becomes a real problem.
```

- [ ] **Step 3: Verify the edge function's reserved-word rejection surfaces to the user**

In `src/pages/RegisterPage.tsx`, find the error-handling block around the `register-client` invocation (read the actual current code first). Confirm that if the edge function returns an error (which it now will, via Task 1's DB trigger, for a reserved-word or malformed subdomain attempt), the existing error-display UI already shows `error.message` or equivalent to the user. Per the investigation, `register-client/index.ts` auto-slugifies from the org name and appends a timestamp suffix on collision — it does NOT let the user type a subdomain directly, so a DB-trigger rejection here would be a startling, hard-to-explain error for a normal user (their org name just happened to slugify to a reserved word, e.g. an org literally named "Admin" or "Login"). Add a client-side pre-check before calling the edge function:

Find where the org name is captured (read the current field/state name in the file), and before submitting, add:

```ts
import { RESERVED_TENANT_SUBDOMAINS } from '@/lib/public-routes'

// Inside the submit handler, before invoking register-client:
const previewSlug = orgName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
if (RESERVED_TENANT_SUBDOMAINS.has(previewSlug)) {
  setError(`"${orgName}" produces a reserved URL slug. Please choose a different organisation name.`)
  return
}
```

Match this to the file's actual existing variable names for the org-name field and error state (read the file first — do not assume the exact names `orgName`/`setError` are correct; use whatever the file actually calls them).

- [ ] **Step 4: Build**

Run: `npm run build` — zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/RegisterPage.tsx src/lib/auth-routes.ts
git commit -m "fix(register): surface reserved-slug rejection before hitting the edge function"
```

---

### Task 15: Manual verification checklist (not automatable — run after deploy)

This task has no code changes. It is the Release 2 "flip" verification the spec's rollout plan requires. Run through this in full against the deployed `app.rallyhub.games` and `admin.rallyhub.games` before considering the flip done.

- [ ] Log in as a `super_admin` on `app.rallyhub.games/login` → confirm immediate sign-out + "Staff accounts sign in at admin.rallyhub.games" + working jump link.
- [ ] Log in as a `client_admin` (Sharphawk) on `admin.rallyhub.games/login` → confirm immediate sign-out + "Client accounts sign in at app.rallyhub.games" + working jump link.
- [ ] Log in as `super_admin` on `admin.rallyhub.games/login` → lands on `/admin`, full super-admin panel works.
- [ ] Log in as Sharphawk's `client_admin` on `app.rallyhub.games/login` → lands on `/sharphawk/admin`, sidebar links all carry `/sharphawk/...`.
- [ ] From `rallyhub.games`, click "Log in" in the header → lands on `app.rallyhub.games/login`, not `rallyhub.games/admin`.
- [ ] Visit `app.rallyhub.games/` while logged out → see `AppSplashPage`, not a bare login form.
- [ ] Visit `admin.rallyhub.games/` while logged out → see `AdminSplashPage`.
- [ ] From Sharphawk's admin panel, generate a fresh event's Join/Display/Facilitator links (`EventLinksPanel`) → confirm they're the new short form `app.rallyhub.games/sharphawk/{event-slug}/join` etc.
- [ ] Open one of those new-format join links in an incognito window, claim a team, submit a photo challenge → confirm it works end to end (this exercises `isPublicLivePath` from Task 4 actually allowing anonymous access).
- [ ] Find one *old-format* printed/saved link if one exists (a UUID-based `/join/{uuid}` from before tonight) → confirm it still works unchanged.
- [ ] Visit an old-format `/{client}/events/{event}/facilitator` URL directly → confirm it still resolves (legacy alias, Task 8).
- [ ] Confirm the one active event (`CF2 Phone Test`) is unaffected — its existing join/display/facilitator links (whatever format they were generated in) still work.

---

### Task 16: Release 3 — Paddle domain approval (manual, run once Task 15 passes)

No code. This is the runbook, carried forward from the spec's Section 5 and this session's earlier Paddle work.

- [ ] Resubmit `app.rallyhub.games` for domain review via the link in Paddle's rejection email — now that Tasks 9/15 confirm it's a real, reachable, branded page.
- [ ] Add and submit `admin.rallyhub.games` for domain review the same way.
- [ ] In Paddle's Checkout settings, set the default payment link to `https://app.rallyhub.games`.
- [ ] Confirm `PADDLE_WEBHOOK_SECRET` in Supabase Edge Function secrets has been updated to `pdl_ntfset_01kympmfcjxd3mkphmd4xnxj3d_...` (carried over from earlier this session — ask the user directly if this was ever done, do not assume).
- [ ] Once confirmed, replay the two missed webhook events (`transaction.completed` and `subscription.created` for the €1.80 live test transaction) via the Paddle API so the database finally records that subscription.

---

## Self-Review Notes

**Spec coverage check:** Section 1 (URL architecture) → Tasks 4, 7, 9. Section 2 (tenant resolution/router) → Tasks 5, 7. Section 3 (login enforcement) → Task 6, 8. Section 4 (compat shim) → Tasks 4, 7 (legacy routes kept), 8 (subdomain host redirect). Section 5 (splash + Paddle) → Tasks 9, 16. Section 6 (edge cases: reserved words, slug uniqueness) → Tasks 1, 2, 4. Section 7 (testing/rollout) → Task 15. All covered.

**Type consistency check:** `orgPath(clientSlug: string | null | undefined, path: string): string` (Task 3) is used identically in Task 12's rule. `wrongDomainRedirectUrl(role: AppRole | null): string | null` (Task 6) matches its test's expectations exactly. `PathTenantScope`'s `subdomainOverride?: string` prop on `TenantProvider` (Task 5) matches its consumption in Task 7's router wiring.

**Known deliberate scope decision, flagged inline rather than silently deferred:** Task 14 leaves fresh registrations landing on the unscoped `/admin` mount rather than immediately on `/{slug}/admin`. This is not a bug — the unscoped mount still fully works — just not the ideal first-login URL. Explicitly commented in the code per Task 14 Step 2, not swept under the rug.
