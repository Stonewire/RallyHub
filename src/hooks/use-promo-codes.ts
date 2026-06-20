import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert } from '@/types/helpers'

export type PromoCode = Tables<'promo_codes'>
export type PromoRedemption = Tables<'promo_code_redemptions'>

const promoCodesKey = ['rallyhub', 'promo-codes'] as const
const orgRedemptionsKey = (orgId: string | null | undefined) =>
  ['org', 'promo-redemptions', orgId] as const

/** Super-admin: every promo code, newest first. */
export function usePromoCodes() {
  return useQuery({
    queryKey: promoCodesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as PromoCode[]
    },
  })
}

export type CreatePromoCodeInput = {
  code: string
  purpose: 'event' | 'subscription'
  discount_percent: number
  duration_months: number | null
  max_redemptions: number | null
  notes: string | null
}

export function useCreatePromoCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreatePromoCodeInput) => {
      const payload: TablesInsert<'promo_codes'> = {
        code: input.code.trim().toUpperCase(),
        purpose: input.purpose,
        discount_percent: input.discount_percent,
        duration_months: input.purpose === 'subscription' ? input.duration_months : null,
        max_redemptions: input.max_redemptions,
        notes: input.notes?.trim() || null,
      }
      const { data, error } = await supabase
        .from('promo_codes')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PromoCode
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: promoCodesKey })
    },
  })
}

export function useSetPromoCodeActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('promo_codes')
        .update({ is_active: isActive })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: promoCodesKey })
    },
  })
}

/** Client: this org's redeemed promo codes (active + used). */
export function useOrgPromoRedemptions(orgId: string | null | undefined) {
  return useQuery({
    queryKey: orgRedemptionsKey(orgId),
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promo_code_redemptions')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as PromoRedemption[]
    },
  })
}

export type UpdatePromoCodeInput = {
  id: string
  discount_percent: number
  max_redemptions: number | null
  duration_months: number | null
  notes: string | null
}

export function useUpdatePromoCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...fields }: UpdatePromoCodeInput) => {
      const { error } = await supabase
        .from('promo_codes')
        .update(fields)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: promoCodesKey })
    },
  })
}

export function useDeletePromoCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('promo_codes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: promoCodesKey })
    },
  })
}

export type PromoCodeRedemptionWithOrg = PromoRedemption & { org_name: string }

const redemptionsForCodeKey = (codeId: string | null) =>
  ['rallyhub', 'promo-code-redemptions', codeId] as const

export function usePromoCodeRedemptions(codeId: string | null) {
  return useQuery({
    queryKey: redemptionsForCodeKey(codeId),
    enabled: Boolean(codeId),
    queryFn: async (): Promise<PromoCodeRedemptionWithOrg[]> => {
      const { data, error } = await supabase
        .from('promo_code_redemptions')
        .select('*')
        .eq('promo_code_id', codeId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = data ?? []
      const orgIds = [...new Set(rows.map((r) => r.organization_id))]
      const { data: orgs } = orgIds.length
        ? await supabase.from('organizations').select('id, name').in('id', orgIds)
        : { data: [] }
      const orgMap = new Map((orgs ?? []).map((o) => [o.id, o.name]))
      return rows.map((r) => ({
        ...r,
        org_name: orgMap.get(r.organization_id) ?? r.organization_id,
      }))
    },
  })
}

/** Client: add a promo code to this org via the redeem RPC. */
export function useRedeemPromoCode(orgId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('redeem_promo_code', { p_code: code })
      if (error) throw error
      return data as PromoRedemption
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orgRedemptionsKey(orgId) })
    },
  })
}
