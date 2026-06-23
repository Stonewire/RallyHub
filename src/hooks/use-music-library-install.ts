import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

export type MusicInstallResult = {
  organizationName: string
  ok: boolean
  count?: number
  error?: string
}

/** Super-admin: copy the platform music library into one or more client orgs.
 *  Dedup (skip tracks the org already has) happens server-side in the RPC. */
export function useInstallMusicLibrary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      organizationIds,
      organizationNames,
    }: {
      organizationIds: string[]
      organizationNames: Record<string, string>
    }): Promise<MusicInstallResult[]> => {
      const results: MusicInstallResult[] = []
      for (const orgId of organizationIds) {
        const { data, error } = await supabase.rpc('install_music_library', {
          p_target_org_id: orgId,
        })
        results.push({
          organizationName: organizationNames[orgId] ?? orgId,
          ok: !error,
          count: typeof data === 'number' ? data : undefined,
          error: error?.message,
        })
      }
      return results
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['musicCatalog'] })
    },
  })
}
