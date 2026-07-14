import { useState } from 'react'
import { Link } from 'react-router-dom'

import { NeoButton } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import { useAcceptLegalDocuments, useOutstandingLegalDocuments } from '@/hooks/use-legal-acceptance'
import { useOrganizationId } from '@/hooks/use-organization-id'

/**
 * Blocks the admin panel until the signed-in user has accepted the current legal
 * documents.
 *
 * This is the path for accounts a super admin created (an invited client admin,
 * event manager or facilitator never saw the registration form, so never accepted
 * anything). It also catches everyone again whenever a document's version is
 * bumped after a legal review.
 *
 * Deliberately not dismissible: there is no close button and no escape route. A
 * consent dialog you can click past is not consent.
 */
export function LegalAcceptanceGate({ children }: { children: React.ReactNode }) {
  const organizationId = useOrganizationId()
  const { outstanding, isReady } = useOutstandingLegalDocuments()
  const accept = useAcceptLegalDocuments(organizationId)
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Wait until we actually know. Never flash the gate at someone whose
  // acceptances are still loading.
  if (!isReady || outstanding.length === 0) return <>{children}</>

  async function handleAccept() {
    setError(null)
    try {
      await accept.mutateAsync()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record your acceptance.')
    }
  }

  return (
    <div className="bg-background fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <Card className="border-border/80 w-full max-w-lg space-y-5 p-6 shadow-lg sm:p-8">
        <div className="space-y-2">
          <h1 className="text-foreground text-xl font-semibold">Before you continue</h1>
          <p className="text-muted-foreground text-sm">
            Please read and accept the following. They govern how you use RallyHub and how
            personal data from your events is handled.
          </p>
        </div>

        <ul className="space-y-2">
          {outstanding.map((doc) => (
            <li key={doc.key}>
              <Link
                to={doc.path}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:text-foreground/80 border-border/80 bg-muted/30 flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium"
              >
                {doc.label}
                <span className="text-muted-foreground text-xs">Read →</span>
              </Link>
            </li>
          ))}
        </ul>

        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="accent-primary mt-0.5 size-4 shrink-0"
          />
          <span className="text-muted-foreground">
            I have read and accept the documents listed above. If I am accepting on behalf of an
            organisation, I confirm I am authorised to do so.
          </span>
        </label>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <NeoButton
          variant="accent"
          onClick={() => void handleAccept()}
          disabled={!checked || accept.isPending}
          className="w-full"
        >
          {accept.isPending ? 'Saving…' : 'Accept and continue'}
        </NeoButton>

        <p className="text-muted-foreground text-xs">
          Your acceptance is recorded with the document version and a timestamp.
        </p>
      </Card>
    </div>
  )
}
