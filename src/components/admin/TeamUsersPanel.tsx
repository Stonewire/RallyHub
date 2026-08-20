import { IconCheck, IconClose, IconCopy, IconEdit, IconPlus, IconTrash } from '@/components/icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

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

/** Display label for a role enum. The DB value itself never changes. */
const ROLE_LABEL_KEYS: Record<OrgUserRole, string> = {
  facilitator: 'team.role.facilitator',
  event_manager: 'team.role.eventManager',
  client_admin: 'team.role.clientAdmin',
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
  const { t } = useTranslation('admin')
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
      setFormError(t('team.errorAllFieldsRequired'))
      return
    }
    if (newTempPassword.trim().length < 8) {
      setFormError(t('team.errorTempPasswordLength'))
      return
    }
    if (!canAssignOrgUserRole(actorRole, facilitatorsOnly ? 'facilitator' : newRole)) {
      setFormError(t('team.errorCannotAssignRole'))
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
      setFormError(err instanceof Error ? err.message : t('team.errorCreateFailed'))
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
      setEditError(t('team.errorNameFieldsRequired'))
      return
    }
    if (editPassword.trim() && editPassword.trim().length < 8) {
      setEditError(t('team.errorPasswordLength'))
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
      setEditError(err instanceof Error ? err.message : t('team.errorSaveFailed'))
    }
  }

  async function handleCopyCredentials() {
    if (!createdUser) return
    const text = t('team.credentialsClipboard', {
      username: createdUser.username,
      password: createdUser.temporary_password,
    })
    if (!(await copyToClipboard(text))) {
      notify(t('team.copyFailed'))
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
      notify(err instanceof Error ? err.message : t('team.removeFailed'))
    }
  }

  const title = facilitatorsOnly ? t('team.facilitatorsTitle') : t('team.managementTitle')
  const subtitle = facilitatorsOnly
    ? t('team.facilitatorsSubtitle')
    : t('team.managementSubtitle')

  return (
    <>
      <Card className="border-border/80 overflow-hidden bg-card p-0 shadow-sm">
        <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="text-foreground text-base font-bold">{title}</h2>
            <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>
          </div>
          {/* Badge only, so it lines up with the Public/Private badges on the
              other settings cards. Adding a user happens under the list. */}
          {!facilitatorsOnly ? (
            <span className="rounded bg-[#d9efe3] px-2 py-1 text-[10px] font-semibold text-[#1f6b48] dark:bg-[#1d3d2d] dark:text-[#a6dcc0]">
              {t('settings.private')}
            </span>
          ) : null}
        </div>
        {usersQuery.isLoading ? (
          <div className="p-5"><QueryLoading rows={2} /></div>
        ) : usersQuery.isError ? (
          <div className="p-5"><QueryError message={usersQuery.error.message} /></div>
        ) : (usersQuery.data?.length ?? 0) === 0 ? (
          <p className="text-muted-foreground p-5 text-sm">
            {facilitatorsOnly ? t('team.emptyFacilitators') : t('team.emptyUsers')}
          </p>
        ) : (
          <div>
          <div className={facilitatorsOnly
            ? 'text-muted-foreground border-border hidden grid-cols-[minmax(140px,1fr)_minmax(100px,.7fr)_minmax(170px,1fr)_110px_76px] gap-3 border-b bg-muted/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] md:grid'
            : 'text-muted-foreground border-border hidden grid-cols-[minmax(0,1fr)_110px_76px] gap-3 border-b bg-muted/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] md:grid'}>
            {facilitatorsOnly ? (
              <><span>{t('team.colName')}</span><span>{t('team.colUsername')}</span><span>{t('team.colEmail')}</span><span>{t('team.colRole')}</span><span /></>
            ) : (
              <><span>{t('team.colUser')}</span><span>{t('team.colRole')}</span><span /></>
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
                        {t('team.you')}
                      </span>
                    ) : null}
                  </p>
                  {user.must_change_password ? <p className="text-amber-600 mt-0.5 text-[10px] font-medium">{t('team.passwordChangePending')}</p> : null}
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
                  {t(ROLE_LABEL_KEYS[user.role])}
                </span>
                <div className="flex shrink-0 items-center justify-end gap-1">
                  {canEditUser(user) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title={t('team.edit')}
                      onClick={() => openEditModal(user)}
                    >
                      <IconEdit className="size-4" />
                    </Button>
                  ) : null}
                  {canRemoveUser(user) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      title={t('team.delete')}
                      disabled={removeUser.isPending}
                      onClick={() => setUserToRemove(user)}
                    >
                      <IconTrash className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          </div>
        )}
        {/* Sits under the last row, so adding reads as continuing the list. */}
        <div className="border-border border-t px-4 py-3">
          <NeoButton
            type="button"
            variant="accent"
            size="sm"
            onClick={openUserModal}
            data-tour={facilitatorsOnly ? undefined : 'add-user-button'}
          >
            <IconPlus className="size-4" />
            {facilitatorsOnly ? t('team.addFacilitator') : t('team.addUser')}
          </NeoButton>
        </div>
      </Card>

      {userModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="border-border/80 max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground font-semibold">
                {createdUser
                  ? facilitatorsOnly
                    ? t('team.facilitatorCreated')
                    : t('team.userCreated')
                  : facilitatorsOnly
                    ? t('team.addFacilitator')
                    : t('team.addUser')}
              </h3>
              <Button type="button" variant="ghost" size="icon-sm" onClick={closeUserModal}>
                <IconClose className="size-4" />
              </Button>
            </div>

            {createdUser ? (
              <>
                <p className="text-muted-foreground text-sm">
                  {t('team.shareCredentials')}
                </p>
                <div className="bg-muted/40 space-y-3 rounded-lg p-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">{t('team.username')}</p>
                    <p className="text-foreground font-mono">{createdUser.username}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      {t('team.temporaryPassword')}
                    </p>
                    <p className="text-foreground font-mono">{createdUser.temporary_password}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">{t('team.colRole')}</p>
                    <p className="text-foreground">{t(ROLE_LABEL_KEYS[createdUser.role])}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => void handleCopyCredentials()}>
                    {credentialsCopied ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
                    {t('team.copyCredentials')}
                  </Button>
                  <NeoButton type="button" variant="primary" onClick={closeUserModal}>
                    {t('team.done')}
                  </NeoButton>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="user-username">{t('team.username')}</Label>
                  <Input
                    id="user-username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    autoComplete="off"
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-email">{t('team.email')}</Label>
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
                    <Label htmlFor="user-first">{t('team.firstName')}</Label>
                    <Input
                      id="user-first"
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-last">{t('team.surname')}</Label>
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
                    <Label>{t('team.colRole')}</Label>
                    <p className="text-foreground text-sm">{t('team.role.facilitator')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="user-role">{t('team.colRole')}</Label>
                    <select
                      id="user-role"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as AssignableOrgUserRole)}
                      className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
                    >
                      {assignableRoles.map((role) => (
                        <option key={role} value={role}>
                          {t(ROLE_LABEL_KEYS[role])}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="user-temp-password">{t('team.temporaryPassword')}</Label>
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
                      {t('team.generate')}
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {t('team.tempPasswordHint')}
                  </p>
                </div>
                {formError ? (
                  <p className="text-destructive text-sm" role="alert">
                    {formError}
                  </p>
                ) : null}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeUserModal}>
                    {t('common:cancel')}
                  </Button>
                  <NeoButton
                    type="button"
                    variant="primary"
                    disabled={createUser.isPending}
                    onClick={() => void handleCreateUser()}
                  >
                    {createUser.isPending ? t('team.creating') : t('team.createUser')}
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
                {editUser.id === currentUserId
                  ? t('team.editYourDetails')
                  : t('team.editUserTitle', { name: displayUserName(editUser) })}
              </h3>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditUser(null)}>
                <IconClose className="size-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-username">{t('team.username')}</Label>
              <Input
                id="edit-username"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                autoComplete="off"
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">{t('team.email')}</Label>
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
                <Label htmlFor="edit-first">{t('team.firstName')}</Label>
                <Input
                  id="edit-first"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-last">{t('team.surname')}</Label>
                <Input
                  id="edit-last"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">{t('team.colRole')}</Label>
              {editRoleEditable ? (
                <select
                  id="edit-role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as OrgUserRole)}
                  className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {assignableRoles.map((role) => (
                    <option key={role} value={role}>
                      {t(ROLE_LABEL_KEYS[role])}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-foreground text-sm capitalize">
                  {t(ROLE_LABEL_KEYS[editRole])}
                  <span className="text-muted-foreground">
                    {editUser.id === currentUserId ? ` · ${t('team.cannotChangeOwnRole')}` : ''}
                  </span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">{t('team.newPassword')}</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-password"
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder={t('team.leaveBlankToKeep')}
                  className="bg-background flex-1 font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditPassword(generateTempPassword())}
                >
                  {t('team.generate')}
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editRequireChange}
                  disabled={!editPassword.trim()}
                  onChange={(e) => setEditRequireChange(e.target.checked)}
                />
                {t('team.requirePasswordUpdate')}
              </label>
            </div>
            {editError ? (
              <p className="text-destructive text-sm" role="alert">
                {editError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                {t('common:cancel')}
              </Button>
              <NeoButton
                type="button"
                variant="primary"
                disabled={updateUser.isPending}
                onClick={() => void handleSaveEdit()}
              >
                {updateUser.isPending ? t('form.saving') : t('team.saveChanges')}
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
              {facilitatorsOnly ? t('team.removeFacilitatorTitle') : t('team.removeUserTitle')}
            </h3>
            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-medium">{displayUserName(userToRemove)}</span>{' '}
              {t('team.removeBody', { username: userToRemove.username })}
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setUserToRemove(null)}>
                {t('common:cancel')}
              </Button>
              <NeoButton
                type="button"
                variant="destructive"
                disabled={removeUser.isPending}
                onClick={() => void confirmRemoveUser()}
              >
                {removeUser.isPending ? t('team.removing') : t('team.remove')}
              </NeoButton>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  )
}
