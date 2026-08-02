import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { FacilitatorToggle } from '@/components/admin/FacilitatorToggle'
import { NeoButton, NeoCard } from '@/components/neo-minimal'
import { useCookieConsent } from '@/contexts/cookie-consent-context'

const CATEGORIES = [
  {
    id: 'essential' as const,
    label: 'Essential',
    description:
      'Required for authentication, security, and storing your cookie consent choice. Always active.',
    required: true,
  },
  {
    id: 'analytics' as const,
    label: 'Analytics',
    description:
      'Help us understand how RallyHub is used so we can improve the product. Not used today.',
    required: false,
  },
  {
    id: 'preferences' as const,
    label: 'Preferences',
    description: 'Remember optional UI settings beyond essential session data.',
    required: false,
  },
]

export function CookiePreferencesDialog() {
  const { consent, savePreferences, acceptAll, rejectNonEssential, closePreferences } =
    useCookieConsent()
  const [analytics, setAnalytics] = useState(consent?.analytics ?? false)
  const [preferences, setPreferences] = useState(consent?.preferences ?? false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-syncs the local editable draft toggles whenever consent changes externally (e.g. re-opening after saving elsewhere)
    setAnalytics(consent?.analytics ?? false)
    setPreferences(consent?.preferences ?? false)
  }, [consent])

  return (
    <div
      className="neo-minimal-scope fixed inset-0 z-[110] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-preferences-title"
    >
      <NeoCard className="flex max-h-[min(32rem,90vh)] w-full max-w-lg flex-col overflow-hidden p-0">
        <div className="space-y-2 border-b border-[var(--nm-border)] p-5">
          <h2 id="cookie-preferences-title" className="text-foreground font-semibold">
            Cookie preferences
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Choose which optional cookies and local storage we may use.{' '}
            <Link to="/cookies" className="text-foreground font-medium underline-offset-4 hover:underline">
              Learn more
            </Link>
            .
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {CATEGORIES.map((category) => {
            const checked =
              category.id === 'essential'
                ? true
                : category.id === 'analytics'
                  ? analytics
                  : preferences
            const onChange =
              category.id === 'analytics'
                ? setAnalytics
                : category.id === 'preferences'
                  ? setPreferences
                  : undefined

            return (
              <div
                key={category.id}
                className={`flex items-start gap-3 rounded-lg border border-[var(--nm-border)] p-3 ${
                  category.required ? 'bg-muted/30' : ''
                }`}
              >
                {/* The app's on/off switch rather than a tick box: these are
                    settings that take effect, not boxes on a form. */}
                <div className="order-2 mt-0.5 shrink-0">
                  <FacilitatorToggle
                    label={category.label}
                    labelHidden
                    checked={checked}
                    disabled={category.required}
                    onChange={(next) => onChange?.(next)}
                  />
                </div>
                <span className="order-1 min-w-0 flex-1">
                  <span className="text-foreground text-sm font-medium">
                    {category.label}
                    {category.required ? (
                      <span className="text-muted-foreground ml-2 text-xs font-normal">
                        Always on
                      </span>
                    ) : null}
                  </span>
                  <span
                    id={`cookie-cat-${category.id}-desc`}
                    className="text-muted-foreground mt-1 block text-xs leading-relaxed"
                  >
                    {category.description}
                  </span>
                </span>
              </div>
            )
          })}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[var(--nm-border)] p-5 sm:flex-row sm:justify-end">
          <NeoButton type="button" variant="ghost" onClick={closePreferences}>
            Cancel
          </NeoButton>
          <NeoButton type="button" variant="surface" onClick={rejectNonEssential}>
            Reject non-essential
          </NeoButton>
          <NeoButton type="button" variant="primary" onClick={() => savePreferences(analytics, preferences)}>
            Save preferences
          </NeoButton>
          <NeoButton type="button" variant="primary" onClick={acceptAll}>
            Accept all
          </NeoButton>
        </div>
      </NeoCard>
    </div>
  )
}
