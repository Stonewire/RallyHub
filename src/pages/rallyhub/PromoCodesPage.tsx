import {
  IconClose,
  IconEdit,
  IconTrash,
} from '@/components/icons'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { Card } from '@/components/ui/card'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import {
  NeoButton,
  NeoInput,
  NeoLabel,
  NeoStatusBadge,
} from '@/components/neo-minimal'
import { useNotification } from '@/contexts/notification-context'
import {
  useCreatePromoCode,
  useDeletePromoCode,
  usePromoCodes,
  useSetPromoCodeActive,
  useUpdatePromoCode,
  type CreatePromoCodeInput,
  type PromoCode,
  type UpdatePromoCodeInput,
  useAllPromoRedemptions,
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

export function RallyHubPromoCodesPage() {
  const { notify } = useNotification()
  const codesQuery = usePromoCodes()
  const createCode = useCreatePromoCode()
  const updateCode = useUpdatePromoCode()
  const deleteCode = useDeletePromoCode()
  const setActive = useSetPromoCodeActive()

  const [form, setForm] = useState(EMPTY_FORM)
  const [createOpen, setCreateOpen] = useState(false)
  const redemptionsQuery = useAllPromoRedemptions()
  // The header's New Code lands here with ?new=1; open the modal and eat the
  // param so refresh and back do not reopen it.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to URL state arriving from the header link, not derivable at render time
      setCreateOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null)
  const [editForm, setEditForm] = useState({ discountPercent: '', durationMonths: '1', maxRedemptions: '', notes: '' })
  const [deletingCode, setDeletingCode] = useState<PromoCode | null>(null)

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
      setCreateOpen(false)
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
    <AdminPageShell
      title="Promo Codes"
      subtitle="Create discount codes clients redeem in their billing panel."
      actions={
        <NeoButton variant="accent" onClick={() => setCreateOpen(true)}>
          New Code
        </NeoButton>
      }
    >
      {createOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="New promo code"
          onClick={() => setCreateOpen(false)}
        >
          <Card
            className="border-border/80 bg-card max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
        <h3 className="text-foreground text-sm font-bold">New promo code</h3>
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
          <NeoButton type="button" variant="surface" onClick={() => setCreateOpen(false)}>
            Cancel
          </NeoButton>
          <NeoButton
            type="button"
            variant="accent"
            disabled={createCode.isPending}
            onClick={() => void handleCreate()}
          >
            {createCode.isPending ? 'Creating…' : 'Create code'}
          </NeoButton>
        </div>
          </Card>
        </div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div>
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
            return (
              <Card key={code.id} className="border-border/80 bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-foreground font-mono font-semibold">{code.code}</span>
                      <NeoStatusBadge tone="draft">{code.purpose}</NeoStatusBadge>
                      {!code.is_active ? (
                        <NeoStatusBadge tone="attention">Inactive</NeoStatusBadge>
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
                      onClick={() => openEdit(code)}
                    >
                      <IconEdit className="size-3.5" />
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
                      <IconTrash className="size-3.5" />
                    </NeoButton>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
        </div>

        {/* Who used what, when: the live usage feed beside the codes. */}
        <Card className="border-border/80 bg-card p-6 shadow-sm">
          <h2 className="text-foreground mb-4 text-sm font-bold">Usage</h2>
          {redemptionsQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : redemptionsQuery.isError ? (
            <QueryError message={redemptionsQuery.error.message} />
          ) : (redemptionsQuery.data?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">
              No redemptions yet. When a client redeems a code, it shows up here.
            </p>
          ) : (
            <ul className="divide-border/60 divide-y">
              {redemptionsQuery.data?.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-sm font-medium">
                      <Link
                        to={`/admin/clients/${r.organization_id}`}
                        className="hover:underline"
                      >
                        {r.org_name}
                      </Link>
                      <span className="text-muted-foreground"> redeemed </span>
                      <span className="font-mono font-semibold">{r.code}</span>
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {formatDate(r.created_at)} · {r.status}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Edit modal */}
      {editingCode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <Card className="border-border/80 bg-card w-full max-w-md space-y-4 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground font-semibold">Edit {editingCode.code}</h3>
              <NeoButton type="button" variant="ghost" size="sm" onClick={closeEdit}>
                <IconClose className="size-4" />
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
          </Card>
        </div>
      ) : null}

      {/* Delete confirm */}
      {deletingCode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <Card className="border-border/80 bg-card w-full max-w-sm space-y-4 p-6 shadow-xl">
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
          </Card>
        </div>
      ) : null}
    </AdminPageShell>
  )
}
