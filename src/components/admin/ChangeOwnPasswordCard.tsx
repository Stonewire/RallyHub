import { useState } from 'react'

import { NeoButton } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useChangeOwnPassword } from '@/hooks/use-organization-settings'

/** Item 5: lets the signed-in user change their own password (self-service). */
export function ChangeOwnPasswordCard() {
  const change = useChangeOwnPassword()
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit() {
    setError(null)
    setDone(false)
    if (pw.length < 8) return setError('Password must be at least 8 characters.')
    if (pw !== confirm) return setError('Passwords do not match.')
    try {
      await change.mutateAsync(pw)
      setPw('')
      setConfirm('')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password')
    }
  }

  return (
    <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-foreground text-lg font-semibold">Your password</h2>
        <p className="text-muted-foreground text-sm">Change the password for your own account.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="own-pw">New password</Label>
          <Input
            id="own-pw"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="new-password"
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="own-pw-confirm">Confirm password</Label>
          <Input
            id="own-pw-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="bg-background"
          />
        </div>
      </div>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="text-sm text-green-600" role="status">
          Password changed.
        </p>
      ) : null}
      <div className="flex justify-end">
        <NeoButton
          type="button"
          variant="primary"
          disabled={change.isPending}
          onClick={() => void submit()}
        >
          {change.isPending ? 'Saving…' : 'Change password'}
        </NeoButton>
      </div>
    </Card>
  )
}
