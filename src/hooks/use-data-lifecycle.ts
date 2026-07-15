import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  cancelOrganizationDeletion,
  permanentlyDeleteEvent,
  requestOrganizationDeletion,
  type OrganizationDeletionRequest,
} from '@/lib/data-lifecycle'
import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'

export function useOrganizationDeletionRequest(organizationId: string | null) {
  return useQuery({
    queryKey: queryKeys.organizationDeletionRequest(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<OrganizationDeletionRequest | null> => {
      if (!organizationId) return null
      const { data, error } = await supabase
        .from('organization_deletion_requests')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useRequestOrganizationDeletion(organizationId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error('No organization')
      return requestOrganizationDeletion(organizationId)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.organizationDeletionRequest(organizationId),
      })
    },
  })
}

export function useCancelOrganizationDeletion(organizationId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error('No organization')
      return cancelOrganizationDeletion(organizationId)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.organizationDeletionRequest(organizationId),
      })
    },
  })
}

export function usePermanentlyDeleteEvent(organizationId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: permanentlyDeleteEvent,
    onSuccess: (_, eventId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.events(organizationId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.trashedEvents(organizationId) })
      void queryClient.removeQueries({ queryKey: queryKeys.event(eventId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats(organizationId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.recentEvents(organizationId) })
    },
  })
}
