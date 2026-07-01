import { Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { TourSpotlight } from '@/components/admin/TourSpotlight'
import { NeoButton } from '@/components/neo-minimal'
import { useAuth } from '@/contexts/auth-context'
import { useCompleteOnboardingStep, useDismissOnboarding } from '@/hooks/use-onboarding'
import { useOrganizationId } from '@/hooks/use-organization-id'
import { useOrganization } from '@/hooks/use-organization-settings'
import { ONBOARDING_STEPS } from '@/lib/onboarding-tasks'
import { cn } from '@/lib/utils'

const STEP_IDS = new Set(ONBOARDING_STEPS.map((s) => s.id))

/** Flips the panel to the left edge whenever the spotlight target would sit underneath it. */
function usePanelSide(targetSelector: string | undefined, panelRef: React.RefObject<HTMLDivElement | null>) {
  const [side, setSide] = useState<'right' | 'left'>('right')

  useEffect(() => {
    if (!targetSelector) {
      setSide('right')
      return
    }
    const check = () => {
      const el = document.querySelector(`[data-tour="${targetSelector}"]`)
      const panel = panelRef.current
      if (!el || !panel) return
      const t = el.getBoundingClientRect()
      // Compare against where the panel sits in its default right-side spot,
      // not its current spot — keeps the decision stable (no flip-flopping).
      const width = panel.offsetWidth
      const height = panel.offsetHeight
      const right = { left: window.innerWidth - 16 - width, right: window.innerWidth - 16, top: 80, bottom: 80 + height }
      const pad = 12
      const intersects =
        t.left - pad < right.right &&
        t.right + pad > right.left &&
        t.top - pad < right.bottom &&
        t.bottom + pad > right.top
      setSide(intersects ? 'left' : 'right')
    }
    check()
    const interval = setInterval(check, 300)
    return () => clearInterval(interval)
  }, [targetSelector, panelRef])

  return side
}

/** Persistent, non-blocking onboarding tour: side panel + a spotlight that points at the real UI. Stays open until every step is done or "All completed" is pressed. */
export function OnboardingChecklist() {
  const { role } = useAuth()
  const organizationId = useOrganizationId()
  const orgQuery = useOrganization(organizationId)
  const completeStep = useCompleteOnboardingStep(organizationId)
  const dismiss = useDismissOnboarding(organizationId)
  const location = useLocation()
  const panelRef = useRef<HTMLDivElement>(null)
  const activeItemRef = useRef<HTMLLIElement>(null)

  const completed = (orgQuery.data?.onboarding_completed_tasks ?? []).filter((id) =>
    STEP_IDS.has(id),
  )
  const dismissed = orgQuery.data?.onboarding_dismissed ?? false
  const eligible = role === 'client_admin' && Boolean(organizationId)
  const activeStep = ONBOARDING_STEPS.find((s) => !completed.includes(s.id)) ?? null
  const panelSide = usePanelSide(activeStep?.target, panelRef)

  // Nav steps complete themselves once you're already on the page they point to.
  useEffect(() => {
    if (!eligible || !orgQuery.data || !activeStep?.skipIfPath) return
    if (location.pathname !== activeStep.skipIfPath) return
    if (completeStep.isPending) return
    completeStep.mutate({ stepId: activeStep.id, current: completed })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, orgQuery.data, activeStep?.id, activeStep?.skipIfPath, location.pathname])

  // Once every step is done, finish the tour without making the user press the button.
  useEffect(() => {
    if (!eligible || dismissed || !orgQuery.data || activeStep || dismiss.isPending) return
    dismiss.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, dismissed, orgQuery.data, activeStep])

  // Keep the active step (and its Next button) visible inside the scrolling panel.
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeStep?.id])

  if (!eligible || dismissed || !orgQuery.data) return null

  return (
    <>
      <div
        ref={panelRef}
        className={cn(
          'fixed top-20 z-[80] max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-border/80 bg-card p-4 shadow-xl transition-[left,right] duration-200',
          panelSide === 'right' ? 'right-4' : 'left-4 lg:left-[17rem]',
        )}
      >
        <h2 className="text-foreground text-sm font-semibold">Getting started</h2>
        <p className="text-muted-foreground text-xs">
          {completed.length} of {ONBOARDING_STEPS.length} done
        </p>
        <div className="mt-2 mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${(completed.length / ONBOARDING_STEPS.length) * 100}%` }}
          />
        </div>

        <ul className="space-y-1">
          {ONBOARDING_STEPS.map((step) => {
            const done = completed.includes(step.id)
            const isActive = activeStep?.id === step.id
            const routePath = step.route.split('?')[0]

            return (
              <li key={step.id} ref={isActive ? activeItemRef : undefined}>
                <div
                  className={cn(
                    'rounded-lg px-2 py-1.5 text-sm',
                    isActive ? 'bg-muted/50' : '',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                        done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border/80',
                      )}
                    >
                      {done ? <Check className="size-2.5" /> : null}
                    </span>
                    <p
                      className={cn(
                        'font-medium',
                        done
                          ? 'text-muted-foreground line-through'
                          : isActive
                            ? 'text-foreground'
                            : 'text-muted-foreground',
                      )}
                    >
                      {step.title}
                    </p>
                  </div>

                  {isActive ? (
                    <div className="mt-1.5 pl-6">
                      <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-xs">
                        {step.body.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                      <div className="mt-2">
                        {step.advanceOn === 'manual' ? (
                          <NeoButton
                            variant="surface"
                            size="sm"
                            disabled={completeStep.isPending}
                            onClick={() =>
                              completeStep.mutate({ stepId: step.id, current: completed })
                            }
                          >
                            Next
                          </NeoButton>
                        ) : location.pathname !== routePath ? (
                          <NeoButton variant="surface" size="sm" asChild>
                            <Link to={step.route}>Take me there</Link>
                          </NeoButton>
                        ) : (
                          <p className="text-muted-foreground text-xs italic">
                            Click the highlighted button to continue.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>

        <div className="mt-3 border-t border-border/60 pt-3">
          <NeoButton
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            disabled={dismiss.isPending}
            onClick={() => dismiss.mutate()}
          >
            All completed
          </NeoButton>
        </div>
      </div>

      {activeStep?.target ? (
        <TourSpotlight
          key={activeStep.id}
          targetSelector={activeStep.target}
          label={activeStep.title}
          waitingForClick={activeStep.advanceOn === 'click'}
          onTargetClick={() =>
            completeStep.mutate({ stepId: activeStep.id, current: completed })
          }
        />
      ) : null}
    </>
  )
}
