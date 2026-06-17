import { Check, Copy, Plus, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { NeoButton } from '@/components/neo-minimal'
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
import { TabletLinkEditor } from '@/components/admin/TabletLinkEditor'
import {
  EMPTY_ORG_FORM,
  getTabletLink,
  orgToForm,
  uploadOrganizationLogo,
  useCreateOrganizationUser,
  useOrganization,
  useOrganizationUsers,
  useRemoveOrganizationUser,
  useSaveOrganization,
  useSaveOrganizationLogo,
  type CreateOrganizationUserResult,
  type OrgUserRole,
  type OrganizationFormState,
} from '@/hooks/use-organization-settings'
import { BillingOverview } from '@/components/billing/BillingOverview'
import { validateTabletCode } from '@/lib/tablet-link'
import { normalizeUsername, validateUsername } from '@/lib/auth-identifier'
import { generateTempPassword } from '@/lib/temp-password'
import { cn } from '@/lib/utils'

type SettingsTab = 'profile' | 'billing'

function formatUserRole(role: OrgUserRole): string {
  return role.replace(/_/g, ' ')
}

function displayUserName(user: {
  first_name: string | null
  last_name: string | null
  username: string
}): string {
  const fromParts = [user.first_name, user.last_name]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(' ')
  return fromParts || user.username
}

export function AdminSettingsPage() {
  const organizationId = useOrganizationId()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: SettingsTab =
    searchParams.get('tab') === 'billing' ? 'billing' : 'profile'

  const orgQuery = useOrganization(organizationId)
  const usersQuery = useOrganizationUsers(organizationId)
  const saveOrg = useSaveOrganization(organizationId)
  const saveLogo = useSaveOrganizationLogo(organizationId)
  const createUser = useCreateOrganizationUser(organizationId)
  const removeUser = useRemoveOrganizationUser(organizationId)

  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<OrganizationFormState>(EMPTY_ORG_FORM)
  const [copied, setCopied] = useState(false)
  const [passwordCopied, setPasswordCopied] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [createdUser, setCreatedUser] = useState<CreateOrganizationUserResult | null>(null)
  const [credentialsCopied, setCredentialsCopied] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newRole, setNewRole] = useState<OrgUserRole>('event_manager')
  const [newTempPassword, setNewTempPassword] = useState('')
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
    const tabletErr = validateTabletCode(form.tablet_slug)
    if (tabletErr) {
      setSaveMessage(tabletErr)
      return
    }
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

  function resetUserForm() {
    setNewUsername('')
    setNewEmail('')
    setNewFirstName('')
    setNewLastName('')
    setNewRole('event_manager')
    setNewTempPassword('')
    setCreatedUser(null)
    setCredentialsCopied(false)
  }

  function openUserModal() {
    resetUserForm()
    setUserModalOpen(true)
  }

  function closeUserModal() {
    setUserModalOpen(false)
    resetUserForm()
  }

  async function handleCreateUser() {
    const usernameErr = validateUsername(newUsername)
    if (usernameErr) {
      setSaveMessage(usernameErr)
      return
    }
    if (
      !newEmail.trim() ||
      !newFirstName.trim() ||
      !newLastName.trim() ||
      !newTempPassword.trim()
    ) {
      setSaveMessage('All user fields are required, including a temporary password.')
      return
    }
    if (newTempPassword.trim().length < 8) {
      setSaveMessage('Temporary password must be at least 8 characters.')
      return
    }

    setSaveMessage(null)
    try {
      const result = await createUser.mutateAsync({
        username: normalizeUsername(newUsername),
        email: newEmail.trim().toLowerCase(),
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        role: newRole,
        temporary_password: newTempPassword.trim(),
      })
      setCreatedUser(result)
    } catch (err) {
      setSaveMessage(
        err instanceof Error ? err.message : 'Failed to create user.',
      )
    }
  }

  async function handleCopyCredentials() {
    if (!createdUser) return
    const text = `Username: ${createdUser.username}\nTemporary password: ${createdUser.temporary_password}`
    await navigator.clipboard.writeText(text)
    setCredentialsCopied(true)
    window.setTimeout(() => setCredentialsCopied(false), 2000)
  }

  async function handleCopyLink() {
    if (!tabletLink) return
    await navigator.clipboard.writeText(tabletLink)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  async function handleCopyPassword() {
    const password = form.tablet_password.trim() || '1234'
    await navigator.clipboard.writeText(password)
    setPasswordCopied(true)
    window.setTimeout(() => setPasswordCopied(false), 2000)
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
          <NeoButton
            type="button"
            variant="primary"
            disabled={saveOrg.isPending}
            onClick={() => void handleSave()}
          >
            {saveOrg.isPending ? 'Saving…' : 'Save'}
          </NeoButton>
        ) : null
      }
    >
      <div className="neo-tabs border-border/80 mb-8 flex gap-1 border-b">
        <button
          type="button"
          onClick={() => setTab('profile')}
          className={cn(
            'neo-tab px-4 py-2 text-sm font-medium',
            tab === 'profile' ? 'neo-tab-active' : '',
          )}
        >
          Organization Profile
        </button>
        <button
          type="button"
          onClick={() => setTab('billing')}
          className={cn(
            'neo-tab px-4 py-2 text-sm font-medium',
            tab === 'billing' ? 'neo-tab-active' : '',
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
        <BillingOverview
          organizationId={organizationId}
          billingPlan={orgQuery.data?.billing_plan}
          billingPeriod={orgQuery.data?.billing_period}
          showAvailablePlans
        />
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
              <div>
                <h2 className="text-foreground text-lg font-semibold">Team</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Organization accounts with username login and a temporary password on first sign-in.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openUserModal}
              >
                <Plus className="size-4" />
                Add user
              </Button>
            </div>
            {usersQuery.isLoading ? (
              <QueryLoading rows={2} />
            ) : usersQuery.isError ? (
              <QueryError message={usersQuery.error.message} />
            ) : (usersQuery.data?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm">No users yet.</p>
            ) : (
              <ul className="divide-border divide-y">
                {usersQuery.data?.map((user) => (
                  <li
                    key={user.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="text-foreground font-medium">
                        {displayUserName(user)}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        @{user.username} · {user.email} · {formatUserRole(user.role)}
                        {user.must_change_password ? ' · pending password change' : ''}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      disabled={removeUser.isPending}
                      onClick={() => void removeUser.mutateAsync(user.id)}
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
            {orgQuery.data ? (
              <TabletLinkEditor
                orgName={form.name || orgQuery.data.name}
                tabletCode={form.tablet_slug}
                onCodeChange={(tablet_slug) => setForm({ ...form, tablet_slug })}
                subdomain={orgQuery.data.subdomain}
                customDomain={orgQuery.data.custom_domain}
              />
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="tablet-password">Tablet Password</Label>
              <div className="flex max-w-md gap-2">
                <Input
                  id="tablet-password"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.tablet_password}
                  onChange={(e) =>
                    setForm({ ...form, tablet_password: e.target.value })
                  }
                  className="bg-background flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleCopyPassword()}
                >
                  {passwordCopied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  Copy
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Shared venue code for the tablet kiosk. Defaults to 1234 if unchanged.
              </p>
            </div>
            {tabletLink ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void handleCopyLink()}>
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  Copy link
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link to={tabletLink} target="_blank">
                    Open tablet page
                  </Link>
                </Button>
              </div>
            ) : null}
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

      {userModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="border-border/80 max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground font-semibold">
                {createdUser ? 'User created' : 'Add user'}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={closeUserModal}
              >
                <X className="size-4" />
              </Button>
            </div>

            {createdUser ? (
              <>
                <p className="text-muted-foreground text-sm">
                  Share these credentials with the user. They must change the password on first
                  login.
                </p>
                <div className="bg-muted/40 space-y-3 rounded-lg p-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Username</p>
                    <p className="text-foreground font-mono">{createdUser.username}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Temporary password
                    </p>
                    <p className="text-foreground font-mono">{createdUser.temporary_password}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Role</p>
                    <p className="text-foreground">{formatUserRole(createdUser.role)}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => void handleCopyCredentials()}>
                    {credentialsCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    Copy credentials
                  </Button>
                  <NeoButton type="button" variant="primary" onClick={closeUserModal}>
                    Done
                  </NeoButton>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="user-username">Username</Label>
                  <Input
                    id="user-username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    autoComplete="off"
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-email">Email</Label>
                  <Input
                    id="user-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="user-first">First name</Label>
                    <Input
                      id="user-first"
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-last">Surname</Label>
                    <Input
                      id="user-last"
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-role">Role</Label>
                  <select
                    id="user-role"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as OrgUserRole)}
                    className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="facilitator">Facilitator</option>
                    <option value="event_manager">Event manager</option>
                    <option value="client_admin">Client admin</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-temp-password">Temporary password</Label>
                  <div className="flex gap-2">
                    <Input
                      id="user-temp-password"
                      type="text"
                      value={newTempPassword}
                      onChange={(e) => setNewTempPassword(e.target.value)}
                      autoComplete="new-password"
                      className="bg-background flex-1 font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setNewTempPassword(generateTempPassword())}
                    >
                      Generate
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Minimum 8 characters. The user must change this on first login.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeUserModal}>
                    Cancel
                  </Button>
                  <NeoButton
                    type="button"
                    variant="primary"
                    disabled={createUser.isPending}
                    onClick={() => void handleCreateUser()}
                  >
                    {createUser.isPending ? 'Creating…' : 'Create user'}
                  </NeoButton>
                </div>
              </>
            )}
          </Card>
        </div>
      ) : null}
    </AdminPageShell>
  )
}
