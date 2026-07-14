import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/contexts/auth-context'
import {
  LEGAL_DOCUMENTS,
  outstandingLegalDocuments,
  type LegalAcceptanceRow,
} from '@/lib/legal-acceptance'
import { supabase } from '@/lib/supabase'

/**
 * Records acceptance for whoever is signed in right now, outside React state.
 *
 * Used straight after registration, where the user ticked the box on the form and
 * has just been auto-signed-in — the useAuth() context has not necessarily caught
 * up yet, so we read the session directly.
 *
 * Best-effort by design: if this fails, registration still succeeds and the
 * LegalAcceptanceGate simply asks them on first login. There is no path where a
 * failure here lets someone into the product without having accepted.
 */
export async function recordLegalAcceptanceForCurrentUser(
  organizationId?: string | null,
): Promise<void> {
  const { data } = await supabase.auth.getUser()
  const userId = data.user?.id
  if (!userId) return

  await supabase.from('legal_acceptances').upsert(
    LEGAL_DOCUMENTS.map((doc) => ({
      user_id: userId,
      organization_id: organizationId ?? null,
      document: doc.key,
      version: doc.version,
    })),
    { onConflict: 'user_id,document,version', ignoreDuplicates: true },
  )
}

/**
 * Which legal documents the signed-in user still has to accept.
 *
 * Covers both routes into the product: someone who registered themselves (and
 * accepted at signup), and someone whose account a super admin created for them,
 * who has never accepted anything and gets asked on first login.
 */
export function useOutstandingLegalDocuments() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const query = useQuery({
    queryKey: ['legal-acceptances', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<LegalAcceptanceRow[]> => {
      const { data, error } = await supabase
        .from('legal_acceptances')
        .select('document, version')
        .eq('user_id', userId!)
      if (error) throw error
      return data ?? []
    },
  })

  return {
    ...query,
    // Until we know, assume nothing is outstanding. Flashing a blocking legal
    // dialog at someone while their acceptances are still loading, only to yank it
    // away, is worse than showing it a moment late.
    outstanding: query.data ? outstandingLegalDocuments(query.data) : [],
    isReady: query.isSuccess,
  }
}

/**
 * Records acceptance of every currently-in-force document for this user.
 *
 * Idempotent: the table has a unique index on (user_id, document, version), so
 * re-accepting the same version is ignored rather than duplicated.
 */
export function useAcceptLegalDocuments(organizationId?: string | null) {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('You must be signed in to accept.')

      const rows = LEGAL_DOCUMENTS.map((doc) => ({
        user_id: user.id,
        organization_id: organizationId ?? null,
        document: doc.key,
        version: doc.version,
      }))

      const { error } = await supabase
        .from('legal_acceptances')
        .upsert(rows, { onConflict: 'user_id,document,version', ignoreDuplicates: true })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['legal-acceptances', user?.id ?? null] })
    },
  })
}
