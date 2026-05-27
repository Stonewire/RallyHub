import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getOrganizationOrigin } from '@/lib/tenant'
import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesUpdate } from '@/types/helpers'

export type OrganizationRow = Tables<'organizations'>
export type OrganizationMemberRow = Tables<'organization_members'>

export type OrganizationFormState = {
  name: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  accent_color: string
  vat_number: string
  address_street: string
  address_city: string
  address_state: string
  address_postal: string
  address_country: string
  tablet_password: string
  tablet_slug: string
}

export const EMPTY_ORG_FORM: OrganizationFormState = {
  name: '',
  logo_url: null,
  primary_color: '#3E3D3E',
  secondary_color: '#6f6f6f',
  accent_color: '#FFCB03',
  vat_number: '',
  address_street: '',
  address_city: '',
  address_state: '',
  address_postal: '',
  address_country: '',
  tablet_password: '',
  tablet_slug: '',
}

export function orgToForm(org: OrganizationRow): OrganizationFormState {
  const legacyAddress = org.address?.trim()
  return {
    name: org.name,
    logo_url: org.logo_url,
    primary_color: org.primary_color,
    secondary_color: org.secondary_color,
    accent_color: org.accent_color,
    vat_number: org.vat_number ?? '',
    address_street: org.address_street ?? legacyAddress ?? '',
    address_city: org.address_city ?? '',
    address_state: org.address_state ?? '',
    address_postal: org.address_postal ?? '',
    address_country: org.address_country ?? '',
    tablet_password: org.tablet_password ?? '',
    tablet_slug: org.tablet_slug ?? '',
  }
}

export function getTabletLink(
  org: { subdomain: string; tablet_slug: string; custom_domain?: string | null },
) {
  const base = getOrganizationOrigin(org)
  return `${base}/tablet/${encodeURIComponent(org.subdomain)}/${encodeURIComponent(org.tablet_slug)}`
}

/** Legacy query URL — still resolves on TabletPage */
export function getTabletLinkLegacy(tabletSlug: string) {
  const base =
    typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/tablet?org=${encodeURIComponent(tabletSlug)}`
}

export function useOrganization(organizationId: string | null) {
  return useQuery({
    queryKey: queryKeys.organization(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<OrganizationRow | null> => {
      if (!organizationId) return null

      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .maybeSingle()

      if (error) throw error
      return data
    },
  })
}

export function useOrganizationMembers(organizationId: string | null) {
  return useQuery({
    queryKey: queryKeys.organizationMembers(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<OrganizationMemberRow[]> => {
      if (!organizationId) return []

      const { data, error } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', organizationId)
        .order('invited_at', { ascending: true })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useSaveOrganization(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: OrganizationFormState) => {
      if (!organizationId) throw new Error('No organization')

      const update: TablesUpdate<'organizations'> = {
        name: payload.name,
        logo_url: payload.logo_url,
        primary_color: payload.primary_color,
        secondary_color: payload.secondary_color,
        accent_color: payload.accent_color,
        vat_number: payload.vat_number || null,
        address: null,
        address_street: payload.address_street || null,
        address_city: payload.address_city || null,
        address_state: payload.address_state || null,
        address_postal: payload.address_postal || null,
        address_country: payload.address_country || null,
        tablet_password: payload.tablet_password || null,
        ...(payload.tablet_slug.trim()
          ? { tablet_slug: payload.tablet_slug.trim() }
          : {}),
      }

      const { error } = await supabase
        .from('organizations')
        .update(update)
        .eq('id', organizationId)

      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.organization(organizationId),
      })
    },
  })
}

export function useSaveOrganizationLogo(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (logoUrl: string) => {
      if (!organizationId) throw new Error('No organization')

      const { error } = await supabase
        .from('organizations')
        .update({ logo_url: logoUrl })
        .eq('id', organizationId)

      if (error) throw error
      return logoUrl
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.organization(organizationId),
      })
    },
  })
}

export type MemberRole = 'client_admin' | 'event_manager'

export function useAddOrganizationMember(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      name,
      email,
      role,
    }: {
      name: string
      email: string
      role: MemberRole
    }) => {
      if (!organizationId) throw new Error('No organization')

      const { error } = await supabase.from('organization_members').insert({
        organization_id: organizationId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
      })

      if (error) throw error

      const { error: inviteError } = await supabase.functions.invoke('invite-member', {
        body: { email: email.trim().toLowerCase(), organizationId },
      })

      if (inviteError) {
        return {
          inviteWarning:
            inviteError.message ||
            'Member added but invitation email could not be sent.',
        }
      }

      return {}
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.organizationMembers(organizationId),
      })
    },
  })
}

export function useRemoveOrganizationMember(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.organizationMembers(organizationId),
      })
    },
  })
}

export async function uploadOrganizationLogo(
  organizationId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${organizationId}/logo.${ext}`
  const { uploadAsset } = await import('@/lib/storage')
  return uploadAsset('organization-logos', path, file)
}
