import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { countClientEvents } from '@/lib/client-events'
import { supabase } from '@/lib/supabase'
import type { TablesUpdate } from '@/types/helpers'

export type { SupportTicketRow } from '@/hooks/use-support-tickets'
export {
  useReplyToTicket,
  useSupportTickets,
  useUpdateTicketStatus,
} from '@/hooks/use-support-tickets'

export function useRallyHubDashboard() {
  return useQuery({
    queryKey: ['rallyhub', 'dashboard'],
    queryFn: async () => {
      const [orgsRes, eventsRes, activeRes] = await Promise.all([
        supabase.from('organizations').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }),
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
      ])
      if (orgsRes.error) throw orgsRes.error
      if (eventsRes.error) throw eventsRes.error
      if (activeRes.error) throw activeRes.error
      return {
        clientCount: orgsRes.count ?? 0,
        totalEvents: eventsRes.count ?? 0,
        activeEvents: activeRes.count ?? 0,
      }
    },
  })
}

export function useRallyHubClients() {
  return useQuery({
    queryKey: ['rallyhub', 'clients'],
    queryFn: async () => {
      const { data: orgs, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name')
      if (error) throw error

      const { data: events } = await supabase.from('events').select('organization_id, status')

      return (orgs ?? []).map((org) => {
        const orgEvents = (events ?? []).filter((e) => e.organization_id === org.id)
        return {
          ...org,
          ...countClientEvents(orgEvents),
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
  billing_plan?: string
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
    }: {
      name: string
      email: string
      password: string
      subdomain?: string
      billing_plan?: string
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
      billing_plan,
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
        billing_plan: billing_plan ?? 'free',
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

export function useUpdateClientNotes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      orgId,
      notes,
      account_status,
    }: {
      orgId: string
      notes: string
      account_status?: string
    }) => {
      const { error } = await supabase
        .from('organizations')
        .update({
          internal_notes: notes,
          ...(account_status ? { account_status } : {}),
        })
        .eq('id', orgId)
      if (error) throw error
    },
    onSuccess: (_, { orgId }) => {
      void qc.invalidateQueries({ queryKey: ['rallyhub', 'client', orgId] })
      void qc.invalidateQueries({ queryKey: ['rallyhub', 'clients'] })
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
