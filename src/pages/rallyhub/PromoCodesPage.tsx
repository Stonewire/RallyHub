import { ChevronDown, ChevronUp, Pencil, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import {
  NeoButton,
  NeoCard,
  NeoInput,
  NeoLabel,
  NeoPageShell,
} from '@/components/neo-minimal'
import { useNotification } from '@/contexts/notification-context'
import {
  useCreatePromoCode,
  useDeletePromoCode,
  usePromoCodeRedemptions,
  usePromoCodes,
  useSetPromoCodeActive,
  useUpdatePromoCode,
  type CreatePromoCodeInput,
  type PromoCode,
  type UpdatePromoCodeInput,
} from '@/hooks/use-promo-codes'

type Purpose = 'event' | 'subscription'

const EMPTY_FORM = {
  code: '',
  purpose: 'event' as Purpose,
  discountPercent: '100',
  durationMonths: '1',
  maxRedemptions: '',
  notes: '',
}

function codeToEditForm(code: PromoCode) {
  return {
    discountPercent: String(code.discount_percent),
    durationMonths: String(code.duration_months ?? 1),
    maxRedemptions: code.max_redemptions != null ? String(code.max_redemptions) : '',
    notes: code.notes ?? '',
  }
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso))
}

function RedemptionList({ codeId }: { codeId: string }) {
  const q = usePromoCodeRedemptions(codeId)
  if (q.isLoading) return <p className="text-muted-foreground py-2 text-sm">Loading…</p>
  if (q.isError) return <p className="text-destructive py-2 text-sm">{q.error.message}</p>
  if (!q.data?.length) return <p className="text-muted-foreground py-2 text-sm">No redemptions yet.</p>
  return (
    <ul className="divide-border mt-3 divide-y text-sm">
      {q.data.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-4 py-2">
          <span className="text-foreground font-medium">{r.org_name}</span>
          <span className="text-muted-foreground tabular-nums">
            {formatDate(r.created_at)} · {r.status}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function RallyHubPromoCodesPage() {
  const { notify } = useNotification()
  const codesQuery = usePromoCodes()
  const createCode = useCreatePromoCode()
  const updateCode = useUpdatePromoCode()
  const deleteCode = useDeletePromoCode()
  const setActive = useSetPromoCodeActive()

  const [form, setForm] = useState(EMPTY_FORM)
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null)
  const [editForm, setEditForm] = useState({ discountPercent: '', durationMonths: '1', maxRedemptions: '', notes: '' })
  const [deletingCode, setDeletingCode] = useState<PromoCode | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setEdit<K extends keyof typeof editForm>(key: K, value: (typeof editForm)[K]) {
    setEditForm((f) => ({ ...f, [key]: value }))
  }

  function openEdit(code: PromoCode) {
    setEditingCode(code)
    setEditForm(codeToEditForm(code))
  }

  function closeEdit() {
    setEditingCode(null)
  }

  function validateEditForm(code: PromoCode): UpdatePromoCodeInput | null {
    const discount = Number(editForm.discountPercent)
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      notify('Discount must be 0–100%')
      return null
    }
    const months = Number(editForm.durationMonths)
    if (code.purpose === 'subscription' && (!Number.isFinite(months) || months < 1)) {
      notify('Subscription codes need a month count of 1 or more')
      return null
    }
    const maxRaw = editForm.maxRedemptions.trim()
    const max = maxRaw ? Number(maxRaw) : null
    if (max !== null && (!Number.isFinite(max) || max < 1)) {
      notify('Max redemptions must be blank (unlimited) or 1+')
      return null
    }
    return {
      id: code.id,
      discount_percent: discount,
      duration_months: code.purpose === 'subscription' ? months : null,
      max_redemptions: max,
      notes: editForm.notes.trim() || null,
    }
  }

  async function handleCreate() {
    const code = form.code.trim()
    if (!code) { notify('Enter a code'); return }
    const discount = Number(form.discountPercent)
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      notify('Discount must be 0–100%'); return
    }
    const months = Number(form.durationMonths)
    if (form.purpose === 'subscription' && (!Number.isFinite(months) || months < 1)) {
      notify('Subscription codes need a month count of 1 or more'); return
    }
    const maxRaw = form.maxRedemptions.trim()
    const max = maxRaw ? Number(maxRaw) : null
    if (max !== null && (!Number.isFinite(max) || max < 1)) {
      notify('Max redemptions must be blank (unlimited) or 1+'); return
    }
    const input: CreatePromoCodeInput = {
      code,
      purpose: form.purpose,
      discount_percent: discount,
      duration_months: form.purpose === 'subscription' ? months : null,
      max_redemptions: max,
      notes: form.notes,
    }
    try {
      await createCode.mutateAsync(input)
      notify(`Promo code ${code.toUpperCase()} created`)
      setForm(EMPTY_FORM)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not create promo code')
    }
  }

  async function handleSaveEdit() {
    if (!editingCode) return
    const input = validateEditForm(editingCode)
    if (!input) return
    try {
      await updateCode.mutateAsync(input)
      notify(`${editingCode.code} updated`)
      closeEdit()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update promo code')
    }
  }

  async function handleDelete() {
    if (!deletingCode) return
    try {
      await deleteCode.mutateAsync(deletingCode.id)
      notify(`${deletingCode.code} deleted`)
      setDeletingCode(null)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not delete promo code')
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    try {
      await setActive.mutateAsync({ id, isActive })
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update promo code')
    }
  }

  return (
    <NeoPageShell
      title="Promo Codes"
      subtitle="Create discount codes clients redeem in their billing panel."
    >
      <NeoCard className="mb-8 max-w-2xl space-y-4 p-6">
        <h3 className="text-foreground font-semibold">New promo code</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <NeoLabel htmlFor="pc-code">Code</NeoLabel>
            <NeoInput
              id="pc-code"
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              placeholder="SUMMER25"
              className="bg-background font-mono"
            />
          </div>
          <div className="space-y-2">
            <NeoLabel htmlFor="pc-purpose">Purpose</NeoLabel>
            <select
              id="pc-purpose"
              value={form.purpose}
              onChange={(e) => set('purpose', e.target.value as Purpose)}
              className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="event">Event (per-event bill)</option>
              <option value="subscription">Subscription (recurring)</option>
            </select>
          </div>
          <div className="space-y-2">
            <NeoLabel htmlFor="pc-discount">Discount %</NeoLabel>
            <NeoInput
              id="pc-discount"
              type="number"
              min={0}
              max={100}
              value={form.discountPercent}
              onChange={(e) => set('discountPercent', e.target.value)}
              className="bg-background"
            />
            <p className="text-muted-foreground text-xs">100% on an event = completely free event.</p>
          </div>
          {form.purpose === 'subscription' ? (
            <div className="space-y-2">
              <NeoLabel htmlFor="pc-months">Months the discount applies</NeoLabel>
              <NeoInput
                id="pc-months"
                type="number"
                min={1}
                value={form.durationMonths}
                onChange={(e) => set('durationMonths', e.target.value)}
                className="bg-background"
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <NeoLabel htmlFor="pc-max">Max redemptions</NeoLabel>
            <NeoInput
              id="pc-max"
              type="number"
              min={1}
              value={form.maxRedemptions}
              onChange={(e) => set('maxRedemptions', e.target.value)}
              placeholder="Blank = unlimited"
              className="bg-background"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <NeoLabel htmlFor="pc-notes">Notes (internal)</NeoLabel>
            <NeoInput
              id="pc-notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="e.g. Summer promo for partner agencies"
              className="bg-background"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <NeoButton
            type="button"
            variant="primary"
            disabled={createCode.isPending}
            onClick={() => void handleCreate()}
          >
            {createCode.isPending ? 'Creating…' : 'Create code'}
          </NeoButton>
        </div>
      </NeoCard>

      {codesQuery.isLoading ? (
        <QueryLoading rows={4} />
      ) : codesQuery.isError ? (
        <QueryError message={codesQuery.error.message} />
      ) : (codesQuery.data?.length ?? 0) === 0 ? (
        <p className="text-muted-foreground text-sm">No promo codes yet.</p>
      ) : (
        <div className="space-y-3">
          {codesQuery.data?.map((code) => {
            const limitLabel =
              code.max_redemptions == null
                ? `${code.redemption_count} used · unlimited`
                : `${code.redemption_count}/${code.max_redemptions} used`
            const isExpanded = expandedId === code.id
            return (
              <NeoCard key={code.id} className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-foreground font-mono font-semibold">{code.code}</span>
                      <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-xs capitalize">
                        {code.purpose}
                      </span>
                      {!code.is_active ? (
                        <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-xs text-red-700">
                          Inactive
                        </span>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {code.discount_percent}% off
                      {code.purpose === 'subscription' && code.duration_months
                        ? ` · ${code.duration_months} month${code.duration_months === 1 ? '' : 's'}`
                        : ''}{' '}
                      · {limitLabel}
                      {code.notes ? ` · ${code.notes}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <NeoButton
                      type="button"
                      variant="surface"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : code.id)}
                    >
                      {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      Usage
                    </NeoButton>
                    <NeoButton
                      type="button"
                      variant="surface"
                      size="sm"
                      onClick={() => openEdit(code)}
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </NeoButton>
                    <NeoButton
                      type="button"
                      variant={code.is_active ? 'surface' : 'primary'}
                      size="sm"
                      disabled={setActive.isPending}
                      onClick={() => void toggleActive(code.id, !code.is_active)}
                    >
                      {code.is_active ? 'Deactivate' : 'Reactivate'}
                    </NeoButton>
                    <NeoButton
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={deleteCode.isPending}
                      onClick={() => setDeletingCode(code)}
                    >
                      <Trash2 className="size-3.5" />
                    </NeoButton>
                  </div>
                </div>
                {isExpanded ? (
                  <div className="border-border/60 mt-3 border-t pt-3">
                    <RedemptionList codeId={code.id} />
                  </div>
                ) : null}
              </NeoCard>
            )
          })}
        </div>
      )}

      {/* Edit modal */}
      {editingCode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <NeoCard className="w-full max-w-md space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground font-semibold">Edit {editingCode.code}</h3>
              <NeoButton type="button" variant="ghost" size="sm" onClick={closeEdit}>
                <X className="size-4" />
              </NeoButton>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <NeoLabel htmlFor="edit-discount">Discount %</NeoLabel>
                <NeoInput
                  id="edit-discount"
                  type="number"
                  min={0}
                  max={100}
                  value={editForm.discountPercent}
                  onChange={(e) => setEdit('discountPercent', e.target.value)}
                  className="bg-background"
                />
              </div>
              {editingCode.purpose === 'subscription' ? (
                <div className="space-y-2">
                  <NeoLabel htmlFor="edit-months">Months</NeoLabel>
                  <NeoInput
                    id="edit-months"
                    type="number"
                    min={1}
                    value={editForm.durationMonths}
                    onChange={(e) => setEdit('durationMonths', e.target.value)}
                    className="bg-background"
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <NeoLabel htmlFor="edit-max">Max redemptions</NeoLabel>
                <NeoInput
                  id="edit-max"
                  type="number"
                  min={1}
                  value={editForm.maxRedemptions}
                  onChange={(e) => setEdit('maxRedemptions', e.target.value)}
                  placeholder="Blank = unlimited"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <NeoLabel htmlFor="edit-notes">Notes (internal)</NeoLabel>
                <NeoInput
                  id="edit-notes"
                  value={editForm.notes}
                  onChange={(e) => setEdit('notes', e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <NeoButton type="button" variant="surface" onClick={closeEdit}>Cancel</NeoButton>
              <NeoButton
                type="button"
                variant="primary"
                disabled={updateCode.isPending}
                onClick={() => void handleSaveEdit()}
              >
                {updateCode.isPending ? 'Saving…' : 'Save'}
              </NeoButton>
            </div>
          </NeoCard>
        </div>
      ) : null}

      {/* Delete confirm */}
      {deletingCode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <NeoCard className="w-full max-w-sm space-y-4 p-6">
            <h3 className="text-foreground font-semibold">Delete {deletingCode.code}?</h3>
            <p className="text-muted-foreground text-sm">
              This will permanently remove the code. Existing redemptions are not affected.
            </p>
            <div className="flex justify-end gap-2">
              <NeoButton type="button" variant="surface" onClick={() => setDeletingCode(null)}>Cancel</NeoButton>
              <NeoButton
                type="button"
                variant="destructive"
                disabled={deleteCode.isPending}
                onClick={() => void handleDelete()}
              >
                {deleteCode.isPending ? 'Deleting…' : 'Delete'}
              </NeoButton>
            </div>
          </NeoCard>
        </div>
      ) : null}
    </NeoPageShell>
  )
}
