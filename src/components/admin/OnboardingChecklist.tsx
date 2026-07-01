import { Check } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { TourSpotlight } from '@/components/admin/TourSpotlight'
import { NeoButton } from '@/components/neo-minimal'
import { useAuth } from '@/contexts/auth-context'
import { useCompleteOnboardingStep, useDismissOnboarding } from '@/hooks/use-onboarding'
import { useOrganizationId } from '@/hooks/use-organization-id'
import { useOrganization } from '@/hooks/use-organization-settings'
import { ONBOARDING_STEPS } from '@/lib/onboarding-tasks'
import { cn } from '@/lib/utils'

/** Persistent, non-blocking onboarding tour: side panel + a spotlight that points at the real UI. Stays open until every step is done or "All completed" is pressed. */
export function OnboardingChecklist() {
  const { role } = useAuth()
  const organizationId = useOrganizationId()
  const orgQuery = useOrganization(organizationId)
  const completeStep = useCompleteOnboardingStep(organizationId)
  const dismiss = useDismissOnboarding(organizationId)
  const location = useLocation()

  const completed = orgQuery.data?.onboarding_completed_tasks ?? []
  const dismissed = orgQuery.data?.onboarding_dismissed ?? false
  const eligible = role === 'client_admin' && Boolean(organizationId)
  const activeStep = ONBOARDING_STEPS.find((s) => !completed.includes(s.id)) ?? null

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

  if (!eligible || dismissed || !orgQuery.data) return null

  return (
    <>
      <div className="fixed top-20 right-4 z-40 max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-border/80 bg-card p-4 shadow-xl">
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
              <li key={step.id}>
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
