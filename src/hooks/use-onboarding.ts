import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

export type MyOnboarding = {
  onboarding_completed_tasks: string[]
  onboarding_dismissed: boolean
}

const onboardingKey = (userId: string | null) => ['my-onboarding', userId] as const

/** The signed-in user's own tour progress (per-user since migration 083). */
export function useMyOnboarding(userId: string | null) {
  return useQuery({
    queryKey: onboardingKey(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<MyOnboarding | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_completed_tasks, onboarding_dismissed')
        .eq('id', userId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Marks one tour step complete for the signed-in user. */
export function useCompleteOnboardingStep(userId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ stepId, current }: { stepId: string; current: string[] }) => {
      const next = Array.from(new Set([...current, stepId]))
      const { error } = await supabase.rpc('set_my_onboarding', { p_completed: next })
      if (error) throw error
      return next
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: onboardingKey(userId) })
    },
  })
}

/** Ends the tour for good — pressed via "All completed", or fired automatically once every step is done. */
export function useDismissOnboarding(userId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('set_my_onboarding', { p_dismissed: true })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: onboardingKey(userId) })
    },
  })
}
