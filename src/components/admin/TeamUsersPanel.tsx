import { Check, Copy, KeyRound, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { NeoButton } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useCreateOrganizationUser,
  useOrganizationUsers,
  useRemoveOrganizationUser,
  useSetOrganizationUserPassword,
  type CreateOrganizationUserResult,
  type OrgUserRole,
  type OrganizationUser,
} from '@/hooks/use-organization-settings'
import { useOrganizationId } from '@/hooks/use-organization-id'
import { useAuth } from '@/contexts/auth-context'
import { useNotification } from '@/contexts/notification-context'
import { copyToClipboard } from '@/lib/clipboard'
import { normalizeUsername, validateUsername } from '@/lib/auth-identifier'
import {
  assignableOrgUserRoles,
  canAssignOrgUserRole,
  type AssignableOrgUserRole,
} from '@/lib/auth-routes'
import { generateTempPassword } from '@/lib/temp-password'

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

type TeamUsersPanelProps = {
  /** When true, copy is tailored for event managers (facilitators only). */
  facilitatorsOnly?: boolean
}

export function TeamUsersPanel({ facilitatorsOnly = false }: TeamUsersPanelProps) {
  const organizationId = useOrganizationId()
  const { role: actorRole } = useAuth()
  const { notify } = useNotification()
  const usersQuery = useOrganizationUsers(organizationId)
  const createUser = useCreateOrganizationUser(organizationId)
  const removeUser = useRemoveOrganizationUser(organizationId)
  const setPassword = useSetOrganizationUserPassword(organizationId)
  const [userToRemove, setUserToRemove] = useState<OrganizationUser | null>(null)
  const [pwTarget, setPwTarget] = useState<OrganizationUser | null>(null)
  const [pwValue, setPwValue] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwDone, setPwDone] = useState(false)

  function openSetPassword(user: OrganizationUser) {
    setPwTarget(user)
    setPwValue(generateTempPassword())
    setPwError(null)
    setPwDone(false)
  }

  async function confirmSetPassword() {
    if (!pwTarget) return
    if (pwValue.trim().length < 8) {
      setPwError('Password must be at least 8 characters.')
      return
    }
    setPwError(null)
    try {
      await setPassword.mutateAsync({ userId: pwTarget.id, password: pwValue.trim() })
      setPwDone(true)
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Could not set password')
    }
  }

  const assignableRoles = assignableOrgUserRoles(actorRole)
  const defaultRole: AssignableOrgUserRole = facilitatorsOnly
    ? 'facilitator'
    : (assignableRoles[0] ?? 'facilitator')

  const [userModalOpen, setUserModalOpen] = useState(false)
  const [createdUser, setCreatedUser] = useState<CreateOrganizationUserResult | null>(null)
  const [credentialsCopied, setCredentialsCopied] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newRole, setNewRole] = useState<AssignableOrgUserRole>(defaultRole)
  const [newTempPassword, setNewTempPassword] = useState('')

  function resetUserForm() {
    setNewUsername('')
    setNewEmail('')
    setNewFirstName('')
    setNewLastName('')
    setNewRole(defaultRole)
    setNewTempPassword('')
    setCreatedUser(null)
    setCredentialsCopied(false)
    setFormError(null)
  }

  function openUserModal() {
    resetUserForm()
    setUserModalOpen(true)
  }

  function closeUserModal() {
    setUserModalOpen(false)
    resetUserForm()
  }

  function canRemoveUser(user: OrganizationUser): boolean {
    if (facilitatorsOnly) return user.role === 'facilitator'
    return true
  }

  async function handleCreateUser() {
    const usernameErr = validateUsername(newUsername)
    if (usernameErr) {
      setFormError(usernameErr)
      return
    }
    if (
      !newEmail.trim() ||
      !newFirstName.trim() ||
      !newLastName.trim() ||
      !newTempPassword.trim()
    ) {
      setFormError('All user fields are required, including a temporary password.')
      return
    }
    if (newTempPassword.trim().length < 8) {
      setFormError('Temporary password must be at least 8 characters.')
      return
    }
    if (!canAssignOrgUserRole(actorRole, facilitatorsOnly ? 'facilitator' : newRole)) {
      setFormError('You cannot assign that role.')
      return
    }

    setFormError(null)
    try {
      const result = await createUser.mutateAsync({
        username: normalizeUsername(newUsername),
        email: newEmail.trim().toLowerCase(),
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        role: facilitatorsOnly ? 'facilitator' : newRole,
        temporary_password: newTempPassword.trim(),
      })
      setCreatedUser(result)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create user.')
    }
  }

  async function handleCopyCredentials() {
    if (!createdUser) return
    const text = `Username: ${createdUser.username}\nTemporary password: ${createdUser.temporary_password}`
    if (!(await copyToClipboard(text))) {
      notify('Could not copy — copy the credentials manually before closing')
      return
    }
    setCredentialsCopied(true)
    window.setTimeout(() => setCredentialsCopied(false), 2000)
  }

  async function confirmRemoveUser() {
    if (!userToRemove) return
    try {
      await removeUser.mutateAsync(userToRemove.id)
      setUserToRemove(null)
    } catch (err) {
      setUserToRemove(null)
      notify(err instanceof Error ? err.message : 'Could not remove user')
    }
  }

  const title = facilitatorsOnly ? 'Facilitators' : 'Team'
  const subtitle = facilitatorsOnly
    ? 'Create facilitator accounts with a temporary password for first login.'
    : 'Organization accounts with username login and a temporary password on first sign-in.'

  return (
    <>
      <Card className="border-border/80 bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-foreground text-lg font-semibold">{title}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={openUserModal}>
            <Plus className="size-4" />
            {facilitatorsOnly ? 'Add facilitator' : 'Add user'}
          </Button>
        </div>
        {usersQuery.isLoading ? (
          <QueryLoading rows={2} />
        ) : usersQuery.isError ? (
          <QueryError message={usersQuery.error.message} />
        ) : (usersQuery.data?.length ?? 0) === 0 ? (
          <p className="text-muted-foreground text-sm">
            {facilitatorsOnly ? 'No facilitators yet.' : 'No users yet.'}
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {usersQuery.data?.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-foreground font-medium">{displayUserName(user)}</p>
                  <p className="text-muted-foreground text-sm">
                    @{user.username} · {user.email} · {formatUserRole(user.role)}
                    {user.must_change_password ? ' · pending password change' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Set password"
                    onClick={() => openSetPassword(user)}
                  >
                    <KeyRound className="size-4" />
                  </Button>
                  {canRemoveUser(user) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      disabled={removeUser.isPending}
                      onClick={() => setUserToRemove(user)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {userModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="border-border/80 max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground font-semibold">
                {createdUser
                  ? facilitatorsOnly
                    ? 'Facilitator created'
                    : 'User created'
                  : facilitatorsOnly
                    ? 'Add facilitator'
                    : 'Add user'}
              </h3>
              <Button type="button" variant="ghost" size="icon-sm" onClick={closeUserModal}>
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
                {facilitatorsOnly ? (
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <p className="text-foreground text-sm">Facilitator</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="user-role">Role</Label>
                    <select
                      id="user-role"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as AssignableOrgUserRole)}
                      className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
                    >
                      {assignableRoles.map((role) => (
                        <option key={role} value={role}>
                          {formatUserRole(role)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
                {formError ? (
                  <p className="text-destructive text-sm" role="alert">
                    {formError}
                  </p>
                ) : null}
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

      {pwTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="border-border/80 w-full max-w-sm space-y-4 bg-card p-6 shadow-lg">
            <h3 className="text-foreground font-semibold">
              {pwDone ? 'Password updated' : `Set password for ${displayUserName(pwTarget)}`}
            </h3>
            {pwDone ? (
              <>
                <p className="text-muted-foreground text-sm">
                  Share this with{' '}
                  <span className="text-foreground font-medium">{displayUserName(pwTarget)}</span>.
                  They'll be asked to change it on next login.
                </p>
                <p className="bg-muted/40 text-foreground rounded-lg p-3 font-mono text-sm">
                  {pwValue}
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void copyToClipboard(pwValue)}
                  >
                    <Copy className="size-4" />
                    Copy
                  </Button>
                  <NeoButton type="button" variant="primary" onClick={() => setPwTarget(null)}>
                    Done
                  </NeoButton>
                </div>
              </>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">
                  Set a new password for @{pwTarget.username}. They must change it on next login.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={pwValue}
                    onChange={(e) => setPwValue(e.target.value)}
                    autoComplete="new-password"
                    className="bg-background flex-1 font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPwValue(generateTempPassword())}
                  >
                    Generate
                  </Button>
                </div>
                {pwError ? (
                  <p className="text-destructive text-sm" role="alert">
                    {pwError}
                  </p>
                ) : null}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setPwTarget(null)}>
                    Cancel
                  </Button>
                  <NeoButton
                    type="button"
                    variant="primary"
                    disabled={setPassword.isPending}
                    onClick={() => void confirmSetPassword()}
                  >
                    {setPassword.isPending ? 'Saving…' : 'Set password'}
                  </NeoButton>
                </div>
              </>
            )}
          </Card>
        </div>
      ) : null}

      {userToRemove ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-user-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <Card className="border-border/80 w-full max-w-sm space-y-4 bg-card p-6 shadow-lg">
            <h3 id="remove-user-title" className="text-foreground font-semibold">
              Remove {facilitatorsOnly ? 'facilitator' : 'user'}?
            </h3>
            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-medium">{displayUserName(userToRemove)}</span>{' '}
              (@{userToRemove.username}) will lose access to this organization. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setUserToRemove(null)}>
                Cancel
              </Button>
              <NeoButton
                type="button"
                variant="destructive"
                disabled={removeUser.isPending}
                onClick={() => void confirmRemoveUser()}
              >
                {removeUser.isPending ? 'Removing…' : 'Remove'}
              </NeoButton>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  )
}
