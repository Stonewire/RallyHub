import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { DEFAULT_BRAND_COLORS } from '@/lib/live-event'
import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import type { AppRole } from '@/types/database'
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
  accent_color: '#FFC107',
  vat_number: '',
  address_street: '',
  address_city: '',
  address_state: '',
  address_postal: '',
  address_country: '',
  tablet_password: '1234',
  tablet_slug: '',
}

const DEFAULT_TABLET_PASSWORD = '1234'

/** Admin-facing tablet PIN (plaintext venue code; 040 bcrypt rows show as default until migrated). */
export function displayTabletPassword(stored: string | null | undefined): string {
  const trimmed = stored?.trim()
  if (!trimmed) return DEFAULT_TABLET_PASSWORD
  if (
    trimmed.startsWith('$2a$') ||
    trimmed.startsWith('$2b$') ||
    trimmed.startsWith('$2y$')
  ) {
    return DEFAULT_TABLET_PASSWORD
  }
  return trimmed
}

function normalizeTabletPasswordForSave(value: string): string {
  const trimmed = value.trim()
  return trimmed || DEFAULT_TABLET_PASSWORD
}

function normalizeOrgColor(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim()
  return trimmed || fallback
}

export function orgToForm(org: OrganizationRow): OrganizationFormState {
  const legacyAddress = org.address?.trim()
  return {
    name: org.name,
    logo_url: org.logo_url,
    primary_color: normalizeOrgColor(org.primary_color, EMPTY_ORG_FORM.primary_color),
    secondary_color: normalizeOrgColor(
      org.secondary_color,
      EMPTY_ORG_FORM.secondary_color,
    ),
    accent_color: normalizeOrgColor(org.accent_color, EMPTY_ORG_FORM.accent_color),
    vat_number: org.vat_number ?? '',
    address_street: org.address_street ?? legacyAddress ?? '',
    address_city: org.address_city ?? '',
    address_state: org.address_state ?? '',
    address_postal: org.address_postal ?? '',
    address_country: org.address_country ?? '',
    tablet_password: displayTabletPassword(org.tablet_password),
    tablet_slug: org.tablet_slug ?? '',
  }
}

export { getTabletLink, validateTabletCode } from '@/lib/tablet-link'

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

export function useSaveOrganization(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: OrganizationFormState) => {
      if (!organizationId) throw new Error('No organization')

      const update: TablesUpdate<'organizations'> = {
        name: payload.name,
        logo_url: payload.logo_url,
        primary_color: normalizeOrgColor(
          payload.primary_color,
          DEFAULT_BRAND_COLORS[0],
        ),
        secondary_color: normalizeOrgColor(
          payload.secondary_color,
          DEFAULT_BRAND_COLORS[1],
        ),
        accent_color: normalizeOrgColor(payload.accent_color, DEFAULT_BRAND_COLORS[2]),
        vat_number: payload.vat_number || null,
        address: null,
        address_street: payload.address_street || null,
        address_city: payload.address_city || null,
        address_state: payload.address_state || null,
        address_postal: payload.address_postal || null,
        address_country: payload.address_country || null,
        tablet_password: normalizeTabletPasswordForSave(payload.tablet_password),
        tablet_slug: payload.tablet_slug.trim(),
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

export type OrgUserRole = Extract<AppRole, 'facilitator' | 'event_manager' | 'client_admin'>

export type OrganizationUser = {
  id: string
  username: string
  email: string
  first_name: string | null
  last_name: string | null
  role: OrgUserRole
  must_change_password: boolean
  created_at: string
}

export function useOrganizationUsers(organizationId: string | null) {
  return useQuery({
    queryKey: queryKeys.organizationUsers(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<OrganizationUser[]> => {
      if (!organizationId) return []

      const { data, error } = await supabase.rpc('get_organization_users', {
        p_org_id: organizationId,
      })

      if (error) throw error
      return (data ?? []) as OrganizationUser[]
    },
  })
}

export type CreateOrganizationUserPayload = {
  username: string
  email: string
  first_name: string
  last_name: string
  role: OrgUserRole
  temporary_password: string
}

export type CreateOrganizationUserResult = {
  userId?: string
  username: string
  email: string
  role: OrgUserRole
  temporary_password: string
}

export function useCreateOrganizationUser(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      payload: CreateOrganizationUserPayload,
    ): Promise<CreateOrganizationUserResult> => {
      if (!organizationId) throw new Error('No organization')

      const { data, error } = await supabase.functions.invoke('create-org-user', {
        body: {
          organizationId,
          username: payload.username,
          email: payload.email,
          first_name: payload.first_name,
          last_name: payload.last_name,
          role: payload.role,
          temporary_password: payload.temporary_password,
        },
      })

      if (error) throw error
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error(String(data.error))
      }
      return data as CreateOrganizationUserResult
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.organizationUsers(organizationId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.organizationMembers(organizationId),
      })
    },
  })
}

export function useRemoveOrganizationUser(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      if (!organizationId) throw new Error('No organization')

      const { error } = await supabase.rpc('remove_organization_user', {
        p_org_id: organizationId,
        p_user_id: userId,
      })

      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.organizationUsers(organizationId),
      })
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
  // Timestamp the filename so each re-upload yields a NEW public URL. A fixed
  // path returned the same URL every time, so the browser kept showing the
  // cached old logo ("upload didn't work").
  const path = `${organizationId}/logo-${Date.now()}.${ext}`
  const { uploadAsset } = await import('@/lib/storage')
  return uploadAsset('organization-logos', path, file)
}
