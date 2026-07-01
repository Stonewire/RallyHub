import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import type { TablesUpdate } from '@/types/helpers'

/** Marks (or unmarks) one onboarding task complete for the org. Client-admin only — see 080 migration. */
export function useToggleOnboardingTask(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      taskId,
      completed,
      current,
    }: {
      taskId: string
      completed: boolean
      current: string[]
    }) => {
      if (!organizationId) throw new Error('No organization')
      const next = completed
        ? Array.from(new Set([...current, taskId]))
        : current.filter((id) => id !== taskId)

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
