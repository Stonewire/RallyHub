import { Check, Copy, Pencil, Plus, Trash2, X } from 'lucide-react'
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
  useUpdateOrganizationUser,
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
  const { role: actorRole, user: authUser } = useAuth()
  const { notify } = useNotification()
  const usersQuery = useOrganizationUsers(organizationId)
  const createUser = useCreateOrganizationUser(organizationId)
  const removeUser = useRemoveOrganizationUser(organizationId)
  const updateUser = useUpdateOrganizationUser(organizationId)
  const [userToRemove, setUserToRemove] = useState<OrganizationUser | null>(null)

  const currentUserId = authUser?.id ?? null
  const isOrgAdmin = actorRole === 'client_admin' || actorRole === 'super_admin'

  const assignableRoles = assignableOrgUserRoles(actorRole)
  const defaultRole: AssignableOrgUserRole = facilitatorsOnly
    ? 'facilitator'
    : (assignableRoles[0] ?? 'facilitator')

  // --- Add user modal ---
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

  // --- Edit user modal ---
  const [editUser, setEditUser] = useState<OrganizationUser | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editRole, setEditRole] = useState<OrgUserRole>('facilitator')
  const [editPassword, setEditPassword] = useState('')
  const [editRequireChange, setEditRequireChange] = useState(false)

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

  function openEditModal(user: OrganizationUser) {
    setEditUser(user)
    setEditError(null)
    setEditUsername(user.username)
    setEditEmail(user.email)
    setEditFirstName(user.first_name ?? '')
    setEditLastName(user.last_name ?? '')
    setEditRole(user.role)
    setEditPassword('')
    setEditRequireChange(false)
  }

  function canEditUser(user: OrganizationUser): boolean {
    return isOrgAdmin || user.id === currentUserId
  }

  function canRemoveUser(user: OrganizationUser): boolean {
    if (user.id === currentUserId) return false
    if (!isOrgAdmin) return false
    if (facilitatorsOnly) return user.role === 'facilitator'
    return true
  }

  // Role is only editable by an org admin editing someone else.
  const editRoleEditable = Boolean(editUser) && isOrgAdmin && editUser?.id !== currentUserId

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

  async function handleSaveEdit() {
    if (!editUser) return
    const usernameErr = validateUsername(editUsername)
    if (usernameErr) {
      setEditError(usernameErr)
      return
    }
    if (!editEmail.trim() || !editFirstName.trim() || !editLastName.trim()) {
      setEditError('Username, email, first and last name are required.')
      return
    }
    if (editPassword.trim() && editPassword.trim().length < 8) {
      setEditError('Password must be at least 8 characters.')
      return
    }
    setEditError(null)
    try {
      await updateUser.mutateAsync({
        userId: editUser.id,
        username: normalizeUsername(editUsername),
        email: editEmail.trim().toLowerCase(),
        first_name: editFirstName.trim(),
        last_name: editLastName.trim(),
        role: editRoleEditable ? editRole : editUser.role,
        password: editPassword.trim() || undefined,
        require_password_change: editPassword.trim() ? editRequireChange : undefined,
      })
      setEditUser(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not save changes.')
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

  const title = facilitatorsOnly ? 'Facilitators' : 'Team Management'
  const subtitle = facilitatorsOnly
    ? 'Create facilitator accounts with a temporary password for first login.'
    : 'Organization accounts with username login and a temporary password on first sign-in.'

  return (
    <>
      <Card className="border-border/80 overflow-hidden bg-card p-0 shadow-sm">
        <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="text-foreground text-base font-bold">{title}</h2>
            <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {!facilitatorsOnly ? (
              <span className="bg-nm-slate-100 text-nm-slate-600 rounded px-2 py-1 text-[10px] font-semibold">Private</span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openUserModal}
              data-tour={facilitatorsOnly ? undefined : 'add-user-button'}
            >
              <Plus className="size-4" />
              {facilitatorsOnly ? 'Add facilitator' : 'Add user'}
            </Button>
          </div>
        </div>
        {usersQuery.isLoading ? (
          <div className="p-5"><QueryLoading rows={2} /></div>
        ) : usersQuery.isError ? (
          <div className="p-5"><QueryError message={usersQuery.error.message} /></div>
        ) : (usersQuery.data?.length ?? 0) === 0 ? (
          <p className="text-muted-foreground p-5 text-sm">
            {facilitatorsOnly ? 'No facilitators yet.' : 'No users yet.'}
          </p>
        ) : (
          <div>
          <div className={facilitatorsOnly
            ? 'text-muted-foreground border-border hidden grid-cols-[minmax(140px,1fr)_minmax(100px,.7fr)_minmax(170px,1fr)_110px_76px] gap-3 border-b bg-muted/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] md:grid'
            : 'text-muted-foreground border-border hidden grid-cols-[minmax(0,1fr)_110px_76px] gap-3 border-b bg-muted/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] md:grid'}>
            {facilitatorsOnly ? (
              <><span>Name</span><span>Username</span><span>Email</span><span>Role</span><span /></>
            ) : (
              <><span>User</span><span>Role</span><span /></>
            )}
          </div>
          <ul className="divide-border divide-y">
            {usersQuery.data?.map((user) => (
              <li
                key={user.id}
                className={facilitatorsOnly
                  ? 'grid gap-2 px-4 py-3 md:grid-cols-[minmax(140px,1fr)_minmax(100px,.7fr)_minmax(170px,1fr)_110px_76px] md:items-center md:gap-3'
                  : 'grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_110px_76px] md:items-center md:gap-3'}
              >
                <div className="min-w-0">
                  <p className="text-foreground flex items-center gap-2 truncate text-sm font-semibold">
                    {displayUserName(user)}
                    {user.id === currentUserId ? (
                      <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-xs font-semibold">
                        You
                      </span>
                    ) : null}
                  </p>
                  {user.must_change_password ? <p className="text-amber-600 mt-0.5 text-[10px] font-medium">Password change pending</p> : null}
                  {!facilitatorsOnly ? (
                    <p className="text-muted-foreground mt-0.5 truncate text-[11px]">@{user.username} · {user.email}</p>
                  ) : null}
                </div>
                {facilitatorsOnly ? (
                  <>
                    <p className="text-muted-foreground truncate text-xs">@{user.username}</p>
                    <p className="text-muted-foreground truncate text-xs">{user.email}</p>
                  </>
                ) : null}
                <span className="bg-nm-slate-100 text-nm-slate-700 w-fit rounded px-2 py-1 text-[10px] font-semibold capitalize">
                  {formatUserRole(user.role)}
                </span>
                <div className="flex shrink-0 items-center justify-end gap-1">
                  {canEditUser(user) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Edit"
                      onClick={() => openEditModal(user)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  ) : null}
                  {canRemoveUser(user) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      title="Delete"
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
          </div>
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

      {editUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="border-border/80 max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground font-semibold">
                Edit {editUser.id === currentUserId ? 'your details' : displayUserName(editUser)}
              </h3>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditUser(null)}>
                <X className="size-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                autoComplete="off"
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-first">First name</Label>
                <Input
                  id="edit-first"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-last">Surname</Label>
                <Input
                  id="edit-last"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              {editRoleEditable ? (
                <select
                  id="edit-role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as OrgUserRole)}
                  className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {assignableRoles.map((role) => (
                    <option key={role} value={role}>
                      {formatUserRole(role)}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-foreground text-sm capitalize">
                  {formatUserRole(editRole)}
                  <span className="text-muted-foreground">
                    {editUser.id === currentUserId ? ' · you cannot change your own role' : ''}
                  </span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">New password</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-password"
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Leave blank to keep current"
                  className="bg-background flex-1 font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditPassword(generateTempPassword())}
                >
                  Generate
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editRequireChange}
                  disabled={!editPassword.trim()}
                  onChange={(e) => setEditRequireChange(e.target.checked)}
                />
                Require user to update password on next login
              </label>
            </div>
            {editError ? (
              <p className="text-destructive text-sm" role="alert">
                {editError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                Cancel
              </Button>
              <NeoButton
                type="button"
                variant="primary"
                disabled={updateUser.isPending}
                onClick={() => void handleSaveEdit()}
              >
                {updateUser.isPending ? 'Saving…' : 'Save changes'}
              </NeoButton>
            </div>
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
