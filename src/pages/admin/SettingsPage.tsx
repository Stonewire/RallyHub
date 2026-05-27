import { Check, Copy, Plus, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { AccentButton } from '@/components/admin/AccentButton'
import { FormSaveFooter } from '@/components/layout/FormSaveFooter'
import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOrganizationId } from '@/hooks/use-organization-id'
import {
  EMPTY_ORG_FORM,
  getTabletLink,
  orgToForm,
  uploadOrganizationLogo,
  useAddOrganizationMember,
  useOrganization,
  useOrganizationMembers,
  useRemoveOrganizationMember,
  useSaveOrganization,
  useSaveOrganizationLogo,
  type MemberRole,
  type OrganizationFormState,
} from '@/hooks/use-organization-settings'
import { cn } from '@/lib/utils'

type SettingsTab = 'profile' | 'billing'

function qrUrl(link: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(link)}`
}

export function AdminSettingsPage() {
  const organizationId = useOrganizationId()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: SettingsTab =
    searchParams.get('tab') === 'billing' ? 'billing' : 'profile'

  const orgQuery = useOrganization(organizationId)
  const membersQuery = useOrganizationMembers(organizationId)
  const saveOrg = useSaveOrganization(organizationId)
  const saveLogo = useSaveOrganizationLogo(organizationId)
  const addMember = useAddOrganizationMember(organizationId)
  const removeMember = useRemoveOrganizationMember(organizationId)

  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<OrganizationFormState>(EMPTY_ORG_FORM)
  const [copied, setCopied] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [memberModalOpen, setMemberModalOpen] = useState(false)
  const [memberName, setMemberName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [memberRole, setMemberRole] = useState<MemberRole>('event_manager')
  const [logoUploading, setLogoUploading] = useState(false)

  useEffect(() => {
    if (orgQuery.data) {
      setForm(orgToForm(orgQuery.data))
    }
  }, [orgQuery.data])

  if (!organizationId) {
    return (
      <AdminPageShell title="Org Settings" subtitle="Manage your organization.">
        <NoOrganizationMessage />
      </AdminPageShell>
    )
  }

  const tabletLink = orgQuery.data ? getTabletLink(orgQuery.data) : ''

  async function handleSave() {
    setSaveMessage(null)
    try {
      await saveOrg.mutateAsync(form)
      setSaveMessage('Settings saved.')
    } catch (err) {
      setSaveMessage(
        err instanceof Error ? err.message : 'Failed to save settings.',
      )
    }
  }

  async function handleLogoChange(file: File | undefined) {
    if (!file || !organizationId) return
    setLogoUploading(true)
    setSaveMessage(null)
    try {
      const url = await uploadOrganizationLogo(organizationId, file)
      setForm((f) => ({ ...f, logo_url: url }))
      await saveLogo.mutateAsync(url)
    } catch (err) {
      setSaveMessage(
        err instanceof Error ? err.message : 'Failed to upload logo.',
      )
    } finally {
      setLogoUploading(false)
    }
  }

  async function handleAddMember() {
    if (!memberName.trim() || !memberEmail.trim()) {
      setSaveMessage('Name and email are required for new members.')
      return
    }
    setSaveMessage(null)
    try {
      const result = await addMember.mutateAsync({
        name: memberName.trim(),
        email: memberEmail.trim(),
        role: memberRole,
      })
      setMemberModalOpen(false)
      setMemberName('')
      setMemberEmail('')
      setMemberRole('event_manager')
      if (result?.inviteWarning) {
        setSaveMessage(result.inviteWarning)
      } else {
        setSaveMessage('Team member added and invitation sent.')
      }
    } catch (err) {
      setSaveMessage(
        err instanceof Error ? err.message : 'Failed to add team member.',
      )
    }
  }

  async function handleCopyLink() {
    if (!tabletLink) return
    await navigator.clipboard.writeText(tabletLink)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  function setTab(next: SettingsTab) {
    setSearchParams(next === 'billing' ? { tab: 'billing' } : {})
  }

  const profileLoading = orgQuery.isLoading
  const profileReady = orgQuery.isFetched

  return (
    <AdminPageShell
      title="Org Settings"
      subtitle="Organization profile, team, tablet access, and billing."
      actions={
        tab === 'profile' ? (
          <AccentButton
            type="button"
            disabled={saveOrg.isPending}
            onClick={() => void handleSave()}
          >
            {saveOrg.isPending ? 'Saving…' : 'Save'}
          </AccentButton>
        ) : null
      }
    >
      <div className="border-border/80 mb-8 flex gap-1 border-b">
        <button
          type="button"
          onClick={() => setTab('profile')}
          className={cn(
            'text-foreground -mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
            tab === 'profile'
              ? 'border-[#FFCB03]'
              : 'text-muted-foreground border-transparent hover:text-foreground',
          )}
        >
          Organization Profile
        </button>
        <button
          type="button"
          onClick={() => setTab('billing')}
          className={cn(
            'text-foreground -mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
            tab === 'billing'
              ? 'border-[#FFCB03]'
              : 'text-muted-foreground border-transparent hover:text-foreground',
          )}
        >
          Billing
        </button>
      </div>

      {profileLoading && !profileReady ? (
        <QueryLoading rows={4} />
      ) : orgQuery.isError ? (
        <QueryError message={orgQuery.error.message} />
      ) : tab === 'billing' ? (
        <Card className="border-border/80 bg-card p-6 shadow-sm">
          <p className="text-foreground font-medium">Current plan</p>
          <p className="text-foreground mt-1 text-2xl font-bold capitalize">
            {orgQuery.data?.billing_plan ?? 'starter'}
          </p>
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            Billing details coming soon. You will be able to manage invoices and
            payment methods here.
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {!orgQuery.data ? (
            <p className="text-muted-foreground text-sm">
              Organization record not found. Saving will update once the record
              exists in Supabase.
            </p>
          ) : null}
          {saveMessage ? (
            <p
              className={cn(
                'text-sm',
                saveMessage.includes('saved')
                  ? 'text-foreground'
                  : 'text-destructive',
              )}
              role="status"
            >
              {saveMessage}
            </p>
          ) : null}

          <Card className="border-border/80 space-y-5 bg-card p-6 shadow-sm">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-background"
              />
            </div>

            <div className="space-y-3">
              <Label>Logo</Label>
              <div className="flex flex-wrap items-center gap-4">
                {form.logo_url ? (
                  <img
                    src={form.logo_url}
                    alt="Organization logo"
                    className="border-border/80 size-16 rounded-lg border object-contain"
                  />
                ) : (
                  <div className="bg-muted/50 text-muted-foreground flex size-16 items-center justify-center rounded-lg text-xs">
                    No logo
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    void handleLogoChange(e.target.files?.[0])
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={logoUploading}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="size-4" />
                  {logoUploading ? 'Uploading…' : 'Upload logo'}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ['primary_color', 'Primary'],
                  ['secondary_color', 'Secondary'],
                  ['accent_color', 'Accent'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id={key}
                      type="color"
                      value={form[key]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                      className="border-border/80 size-10 cursor-pointer rounded-md border bg-transparent"
                    />
                    <Input
                      value={form[key]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                      className="bg-background font-mono text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
            <h2 className="text-foreground text-lg font-semibold">
              Company Details
            </h2>
            <div className="space-y-2">
              <Label htmlFor="vat">VAT</Label>
              <Input
                id="vat"
                value={form.vat_number}
                onChange={(e) =>
                  setForm({ ...form, vat_number: e.target.value })
                }
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-street">Street Address</Label>
              <Input
                id="address-street"
                value={form.address_street}
                onChange={(e) =>
                  setForm({ ...form, address_street: e.target.value })
                }
                className="bg-background"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="address-city">City</Label>
                <Input
                  id="address-city"
                  value={form.address_city}
                  onChange={(e) =>
                    setForm({ ...form, address_city: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address-state">State or Region</Label>
                <Input
                  id="address-state"
                  value={form.address_state}
                  onChange={(e) =>
                    setForm({ ...form, address_state: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="address-postal">Postal Code</Label>
                <Input
                  id="address-postal"
                  value={form.address_postal}
                  onChange={(e) =>
                    setForm({ ...form, address_postal: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address-country">Country</Label>
                <Input
                  id="address-country"
                  value={form.address_country}
                  onChange={(e) =>
                    setForm({ ...form, address_country: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
            </div>
          </Card>

          <Card className="border-border/80 bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-foreground text-lg font-semibold">
                Team Members
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMemberModalOpen(true)}
              >
                <Plus className="size-4" />
                Add Member
              </Button>
            </div>
            {membersQuery.isLoading ? (
              <QueryLoading rows={2} />
            ) : membersQuery.isError ? (
              <QueryError message={membersQuery.error.message} />
            ) : (membersQuery.data?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm">No team members yet.</p>
            ) : (
              <ul className="divide-border divide-y">
                {membersQuery.data?.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="text-foreground font-medium">{member.name}</p>
                      <p className="text-muted-foreground text-sm">
                        {member.email} · {member.role.replace('_', ' ')}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      onClick={() => void removeMember.mutateAsync(member.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
            <h2 className="text-foreground text-lg font-semibold">
              Tablet Access
            </h2>
            <div className="space-y-2">
              <Label htmlFor="tablet-slug">Tablet link code</Label>
              <Input
                id="tablet-slug"
                value={form.tablet_slug}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tablet_slug: e.target.value
                      .replace(/[^a-zA-Z0-9_-]/g, '')
                      .slice(0, 24),
                  })
                }
                className="bg-background max-w-md font-mono"
                placeholder="e.g. kiosk01"
              />
              <p className="text-muted-foreground text-xs">
                Unique code in your tablet URL (along with organization name). Leave
                blank to keep the current code when saving other fields.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tablet-password">Tablet Password</Label>
              <Input
                id="tablet-password"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={form.tablet_password}
                onChange={(e) =>
                  setForm({ ...form, tablet_password: e.target.value })
                }
                className="bg-background max-w-md"
              />
            </div>
            <div className="space-y-2">
              <Label>Tablet Link</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  readOnly
                  value={tabletLink}
                  className="bg-background min-w-[min(100%,20rem)] flex-1 font-mono text-xs"
                />
                <Button type="button" variant="outline" onClick={() => void handleCopyLink()}>
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  Copy
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link to={tabletLink} target="_blank">
                    Open
                  </Link>
                </Button>
              </div>
              {tabletLink ? (
                <img
                  src={qrUrl(tabletLink)}
                  alt="QR code for tablet link"
                  width={128}
                  height={128}
                  className="border-border/80 mt-3 rounded-lg border"
                />
              ) : null}
            </div>
          </Card>
        </div>
      )}

      {tab === 'profile' && profileReady && !orgQuery.isError ? (
        <FormSaveFooter
          onSave={() => void handleSave()}
          saving={saveOrg.isPending}
          label="Save settings"
        />
      ) : null}

      {memberModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="border-border/80 w-full max-w-md space-y-4 bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground font-semibold">Add team member</h3>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setMemberModalOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-name">Name</Label>
              <Input
                id="member-name"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-email">Email</Label>
              <Input
                id="member-email"
                type="email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-role">Role</Label>
              <select
                id="member-role"
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value as MemberRole)}
                className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="event_manager">Event manager</option>
                <option value="client_admin">Client admin</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMemberModalOpen(false)}
              >
                Cancel
              </Button>
              <AccentButton
                type="button"
                disabled={addMember.isPending}
                onClick={() => void handleAddMember()}
              >
                {addMember.isPending ? 'Adding…' : 'Add member'}
              </AccentButton>
            </div>
          </Card>
        </div>
      ) : null}
    </AdminPageShell>
  )
}
