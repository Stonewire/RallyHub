import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import type { TablesUpdate } from '@/types/helpers'

/** Marks one onboarding tour step complete for the org. Client-admin only — see 080 migration. */
export function useCompleteOnboardingStep(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ stepId, current }: { stepId: string; current: string[] }) => {
      if (!organizationId) throw new Error('No organization')
      const next = Array.from(new Set([...current, stepId]))

      const update: TablesUpdate<'organizations'> = {
        onboarding_completed_tasks: next,
      }
      const { error } = await supabase
        .from('organizations')
        .update(update)
        .eq('id', organizationId)
      if (error) throw error
      return next
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.organization(organizationId),
      })
    },
  })
}

/** Ends the onboarding tour for good — pressed manually via "All completed", or fired automatically once every step is done. */
export function useDismissOnboarding(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error('No organization')
      const update: TablesUpdate<'organizations'> = { onboarding_dismissed: true }
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
