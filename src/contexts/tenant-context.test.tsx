// @vitest-environment jsdom
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