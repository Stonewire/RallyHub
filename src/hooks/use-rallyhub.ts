import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/contexts/auth-context'
import type { GameRow } from '@/hooks/use-games'
import { countClientEvents } from '@/lib/client-events'
import { platformGameInstallPayload } from '@/lib/install-platform-game'
import {
  fetchGroupClientInstallCounts,
  groupInstallStatusKey,
  installPlatformGameGroup,
} from '@/lib/install-platform-game-group'
import { isListedClientOrganization } from '@/lib/platform-library'
import { supabase } from '@/lib/supabase'
import type { TablesUpdate } from '@/types/helpers'

export type { SupportTicketRow } from '@/hooks/use-support-tickets'
export {
  useReplyToTicket,
  useSupportTickets,
  useUpdateTicketStatus,
} from '@/hooks/use-support-tickets'

export type DashboardRecentEvent = {
  id: string
  name: string
  status: string
  dateISO: string | null
  clientName: string
}

export function useRallyHubDashboard() {
  const { profile, role } = useAuth()
  const excludedOrganizationIds =
    role === 'super_admin' && profile?.organization_id ? [profile.organization_id] : []

  return useQuery({
    queryKey: ['rallyhub', 'dashboard', ...excludedOrganizationIds],
    queryFn: async () => {
      const [orgsRes, eventsRes, invoicesRes] = await Promise.all([
        supabase.from('organizations').select('id, subdomain, name'),
        supabase
          .from('events')
          .select('id, name, status, event_date, organization_id, created_at'),
        supabase.from('invoices').select('amount_due, status, organization_id'),
      ])
      if (orgsRes.error) throw orgsRes.error
      if (eventsRes.error) throw eventsRes.error
      if (invoicesRes.error) throw invoicesRes.error

      // Clients are the listed orgs (exclude platform library + super-admin's own).
      const clients = (orgsRes.data ?? []).filter((org) =>
        isListedClientOrganization(org, excludedOrganizationIds),
      )
      const clientIds = new Set(clients.map((c) => c.id))
      const clientName = new Map(clients.map((c) => [c.id, c.name]))

      const events = (eventsRes.data ?? []).filter((e) =>
        clientIds.has(e.organization_id),
      )

      const statusBreakdown: Record<string, number> = {}
      for (const e of events) {
        statusBreakdown[e.status] = (statusBreakdown[e.status] ?? 0) + 1
      }

      const now = Date.now()
      const upcomingEvents = events.filter(
        (e) => e.event_date && new Date(e.event_date).getTime() > now,
      ).length

      const recentEvents: DashboardRecentEvent[] = [...events]
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
        .slice(0, 6)
        .map((e) => ({
          id: e.id,
          name: e.name,
          status: e.status,
          dateISO: e.event_date,
          clientName: clientName.get(e.organization_id) ?? 'Unknown client',
        }))

      const invoices = (invoicesRes.data ?? []).filter((i) =>
        clientIds.has(i.organization_id),
      )
      const outstanding = invoices
        .filter((i) => i.status === 'unpaid')
        .reduce((sum, i) => sum + Number(i.amount_due ?? 0), 0)
      const collected = invoices
        .filter((i) => i.status === 'paid')
        .reduce((sum, i) => sum + Number(i.amount_due ?? 0), 0)

      return {
        clientCount: clients.length,
        totalEvents: events.length,
        activeEvents: statusBreakdown['active'] ?? 0,
        upcomingEvents,
        statusBreakdown,
        recentEvents,
        revenue: { outstanding, collected },
      }
    },
  })
}

export function useRallyHubClients() {
  const { profile, role } = useAuth()
  const excludedOrganizationIds =
    role === 'super_admin' && profile?.organization_id ? [profile.organization_id] : []

  return useQuery({
    queryKey: ['rallyhub', 'clients', ...excludedOrganizationIds],
    queryFn: async () => {
      const { data: orgs, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name')
      if (error) throw error

      const [eventsRes, invoicesRes] = await Promise.all([
        supabase.from('events').select('organization_id, status'),
        supabase.from('invoices').select('organization_id, status'),
      ])

      const unpaidByOrg = new Map<string, number>()
      for (const inv of invoicesRes.data ?? []) {
        if (inv.status === 'unpaid') {
          unpaidByOrg.set(inv.organization_id, (unpaidByOrg.get(inv.organization_id) ?? 0) + 1)
        }
      }

      return (orgs ?? [])
        .filter((org) => isListedClientOrganization(org, excludedOrganizationIds))
        .map((org) => {
          const orgEvents = (eventsRes.data ?? []).filter((e) => e.organization_id === org.id)
          return {
            ...org,
            ...countClientEvents(orgEvents),
            unpaidInvoiceCount: unpaidByOrg.get(org.id) ?? 0,
          }
        })
    },
  })
}

export function useRallyHubClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ['rallyhub', 'client', clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      const { data: org, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', clientId!)
        .single()
      if (error) throw error

      const [members, events] = await Promise.all([
        supabase
          .from('organization_members')
          .select('*')
          .eq('organization_id', clientId!),
        supabase.from('events').select('*').eq('organization_id', clientId!),
      ])

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('organization_id', clientId!)

      if (members.error) throw members.error

      return {
        org,
        members: members.data ?? [],
        events: events.data ?? [],
        profiles: profiles ?? [],
      }
    },
  })
}

export type ClientAdminUpdateInput = {
  orgId: string
  name?: string
  notes?: string
  account_status?: string
  trial_ends_at?: string | null
  trial_review_needed?: boolean
  hide_platform_branding?: boolean
  educational_status?: string
  billing_plan?: string
  billing_period?: string
  subdomain?: string
  email?: string
  phone?: string
  logo_url?: string | null
  vat_number?: string
  address_street?: string
  address_city?: string
  address_state?: string
  address_postal?: string
  address_country?: string
}

export function useCreateRallyHubClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      name,
      email,
      password,
      subdomain,
      billing_plan,
      billing_period,
    }: {
      name: string
      email: string
      password: string
      subdomain?: string
      billing_plan?: string
      billing_period?: string
    }) => {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('Sign in required')

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          subdomain: subdomain?.trim() || undefined,
          billing_plan,
          billing_period,
        }),
      })
      const json = (await res.json()) as { error?: string; org?: { id: string } }
      if (!res.ok) throw new Error(json.error ?? 'Failed to create client')
      if (!json.org?.id) throw new Error('Client created but no organization id was returned')
      return json.org
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rallyhub', 'clients'] })
    },
  })
}

export function useUpdateClientAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      orgId,
      name,
      notes,
      account_status,
      trial_ends_at,
      trial_review_needed,
      hide_platform_branding,
      educational_status,
      billing_plan,
      billing_period,
      subdomain,
      email,
      phone,
      logo_url,
      vat_number,
      address_street,
      address_city,
      address_state,
      address_postal,
      address_country,
    }: ClientAdminUpdateInput) => {
      const trimmedEmail = email?.trim() ?? ''
      const trimmedPhone = phone?.trim() ?? ''
      const payload = {
        ...(name !== undefined ? { name: name.trim() } : {}),
        internal_notes: notes ?? null,
        account_status: account_status ?? 'active',
        trial_ends_at: trial_ends_at ?? null,
        ...(trial_review_needed !== undefined ? { trial_review_needed } : {}),
        ...(hide_platform_branding !== undefined ? { hide_platform_branding } : {}),
        ...(educational_status !== undefined ? { educational_status } : {}),
        billing_plan: billing_plan ?? 'rookie',
        billing_period: billing_period ?? 'yearly',
        email: trimmedEmail || null,
        contact_email: trimmedEmail || null,
        phone: trimmedPhone || null,
        logo_url: logo_url ?? undefined,
        vat_number: vat_number?.trim() || null,
        address: null,
        address_street: address_street?.trim() || null,
        address_city: address_city?.trim() || null,
        address_state: address_state?.trim() || null,
        address_postal: address_postal?.trim() || null,
        address_country: address_country?.trim() || null,
        updated_at: new Date().toISOString(),
        ...(subdomain !== undefined ? { subdomain: subdomain.toLowerCase().trim() } : {}),
      } satisfies TablesUpdate<'organizations'>

      const { data, error } = await supabase
        .from('organizations')
        .update(payload)
        .eq('id', orgId)
        .select('id')
        .maybeSingle()

      if (error) throw new Error(error.message)
      if (!data) {
        throw new Error(
          'Client was not updated. Confirm you are signed in as a super admin and migration 023 is applied.',
        )
      }
    },
    onSuccess: (_, { orgId }) => {
      void qc.invalidateQueries({ queryKey: ['rallyhub', 'client', orgId] })
      void qc.invalidateQueries({ queryKey: ['rallyhub', 'clients'] })
    },
  })
}

export function useExpireOverdueTrials() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('expire_overdue_trials')
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rallyhub', 'clients'] })
      void qc.invalidateQueries({ queryKey: ['rallyhub', 'dashboard'] })
    },
  })
}

export function usePlatformGames() {
  return useQuery({
    queryKey: ['rallyhub', 'platform-games'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('is_platform_template', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useGameClientInstallStatus(templateGame: GameRow | null) {
  return useQuery({
    queryKey: ['rallyhub', 'game-installs', templateGame?.id],
    enabled: Boolean(templateGame?.id),
    queryFn: async (): Promise<Set<string>> => {
      if (!templateGame) return new Set()

      const [bySourceRes, byLegacyRes] = await Promise.all([
        supabase
          .from('games')
          .select('organization_id')
          .eq('source_template_id', templateGame.id),
        supabase
          .from('games')
          .select('organization_id')
          .eq('name', templateGame.name)
          .eq('type', templateGame.type)
          .eq('is_platform_template', false),
      ])

      if (bySourceRes.error) throw bySourceRes.error
      if (byLegacyRes.error) throw byLegacyRes.error

      const installed = new Set<string>()
      for (const row of bySourceRes.data ?? []) {
        installed.add(row.organization_id)
      }
      for (const row of byLegacyRes.data ?? []) {
        installed.add(row.organization_id)
      }
      return installed
    },
  })
}

export type InstallPlatformGameResult = {
  organizationId: string
  organizationName: string
  ok: boolean
  error?: string
}

export function useInstallPlatformGame() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      template,
      organizationIds,
      organizationNames,
    }: {
      template: GameRow
      organizationIds: string[]
      organizationNames: Record<string, string>
    }): Promise<InstallPlatformGameResult[]> => {
      const results: InstallPlatformGameResult[] = []

      for (const organizationId of organizationIds) {
        const organizationName = organizationNames[organizationId] ?? organizationId
        const { error } = await supabase
          .from('games')
          .insert(platformGameInstallPayload(template, organizationId))

        if (error) {
          results.push({
            organizationId,
            organizationName,
            ok: false,
            error: error.message,
          })
        } else {
          results.push({ organizationId, organizationName, ok: true })
        }
      }

      return results
    },
    onSuccess: (_results, { template }) => {
      void qc.invalidateQueries({ queryKey: ['rallyhub', 'game-installs', template.id] })
    },
  })
}

export type { InstallPlatformGameGroupSummary } from '@/lib/install-platform-game-group'

export function useGroupClientInstallStatus(templates: GameRow[]) {
  const templateIds = templates.map((t) => t.id)

  return useQuery({
    queryKey: ['rallyhub', 'group-installs', groupInstallStatusKey(templateIds)],
    enabled: templateIds.length > 0,
    queryFn: () => fetchGroupClientInstallCounts(templates),
  })
}

export function useInstallPlatformGameGroup() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: installPlatformGameGroup,
    onSuccess: (_summary, { templates }) => {
      void qc.invalidateQueries({
        queryKey: ['rallyhub', 'group-installs', groupInstallStatusKey(templates.map((t) => t.id))],
      })
      for (const template of templates) {
        void qc.invalidateQueries({ queryKey: ['rallyhub', 'game-installs', template.id] })
      }
    },
  })
}
