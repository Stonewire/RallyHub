import { Check, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { TourSpotlight } from '@/components/admin/TourSpotlight'
import { NeoButton } from '@/components/neo-minimal'
import { useAuth } from '@/contexts/auth-context'
import {
  useCompleteOnboardingStep,
  useDismissOnboarding,
  useMyOnboarding,
} from '@/hooks/use-onboarding'
import { onboardingStepsForRole } from '@/lib/onboarding-tasks'
import { cn } from '@/lib/utils'

/** Flips the panel to the left edge whenever the spotlight target would sit underneath it. */
function usePanelSide(targetSelector: string | undefined, panelRef: React.RefObject<HTMLDivElement | null>) {
  const [side, setSide] = useState<'right' | 'left'>('right')

  useEffect(() => {
    if (!targetSelector) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs from real DOM layout below, not derivable during render
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

/**
 * Per-user onboarding tour (client_admin gets the full run, event_manager a
 * trimmed one). Auto-minimises to a corner pill while the spotlight points at
 * something on the current page, pops back up when it is time to read the next
 * step. Completed steps are clickable to revisit; every step has an
 * always-visible "Mark complete" escape hatch.
 */
export function OnboardingChecklist() {
  const { role, user } = useAuth()
  const userId = user?.id ?? null
  const onboardingQuery = useMyOnboarding(userId)
  const completeStep = useCompleteOnboardingStep(userId)
  const dismiss = useDismissOnboarding(userId)
  const location = useLocation()
  const navigate = useNavigate()
  const panelRef = useRef<HTMLDivElement>(null)
  const activeItemRef = useRef<HTMLLIElement>(null)
  const [revisitId, setRevisitId] = useState<string | null>(null)
  // null = automatic; true/false = the user toggled it for the current step.
  const [manualExpand, setManualExpand] = useState<boolean | null>(null)

  const steps = useMemo(() => onboardingStepsForRole(role), [role])
  const stepIds = useMemo(() => new Set(steps.map((s) => s.id)), [steps])

  const completed = (onboardingQuery.data?.onboarding_completed_tasks ?? []).filter((id) =>
    stepIds.has(id),
  )
  const dismissed = onboardingQuery.data?.onboarding_dismissed ?? false
  const eligible = role === 'client_admin' || role === 'event_manager'
  const activeStep = steps.find((s) => !completed.includes(s.id)) ?? null
  const revisitStep = revisitId ? (steps.find((s) => s.id === revisitId) ?? null) : null
  // What the spotlight points at: a revisited step wins over the live one.
  const shownStep = revisitStep ?? activeStep
  const panelSide = usePanelSide(shownStep?.target, panelRef)

  const routePathOf = (route: string) => route.split('?')[0]
  const activeOnRoute =
    activeStep != null && location.pathname === routePathOf(activeStep.route)
  // Out of the way while the arrow points at something on this page; back up
  // front when the step needs reading (manual steps, or wrong page).
  const autoMinimized = !revisitStep && activeStep?.advanceOn === 'click' && activeOnRoute
  const minimized = manualExpand == null ? autoMinimized : !manualExpand

  // A new step resets the manual toggle so the auto behaviour takes over again.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset of local UI state when the active step identity changes
    setManualExpand(null)
    setRevisitId(null)
  }, [activeStep?.id])

  // Nav steps complete themselves once you're already on the page they point to.
  useEffect(() => {
    if (!eligible || !onboardingQuery.data || revisitStep || !activeStep?.skipIfPath) return
    if (location.pathname !== activeStep.skipIfPath) return
    if (completeStep.isPending) return
    completeStep.mutate({ stepId: activeStep.id, current: completed })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, onboardingQuery.data, revisitStep, activeStep?.id, activeStep?.skipIfPath, location.pathname])

  // Once every step is done, finish the tour without making the user press the button.
  useEffect(() => {
    if (!eligible || dismissed || !onboardingQuery.data || activeStep || dismiss.isPending) return
    dismiss.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, dismissed, onboardingQuery.data, activeStep])

  // Keep the highlighted step (and its buttons) visible inside the scrolling panel.
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeStep?.id, revisitId, minimized])

  if (!eligible || dismissed || !onboardingQuery.data) return null

  const markComplete = (stepId: string) => {
    if (completeStep.isPending) return
    completeStep.mutate({ stepId, current: completed })
  }

  return (
    <>
      {minimized && activeStep ? (
        <div className="fixed right-4 bottom-4 z-[80] flex items-center gap-2 rounded-full border border-border/80 bg-card py-1.5 pr-1.5 pl-3 shadow-xl">
          <Sparkles className="text-accent size-4 shrink-0" />
          <span className="text-foreground max-w-56 truncate text-xs font-medium">
            {completed.length + 1}/{steps.length} · {activeStep.title}
          </span>
          <NeoButton
            variant="surface"
            size="sm"
            disabled={completeStep.isPending}
            onClick={() => markComplete(activeStep.id)}
          >
            Mark complete
          </NeoButton>
          <button
            type="button"
            aria-label="Show the full tour"
            className="hover:bg-muted/50 rounded-full p-1.5"
            onClick={() => setManualExpand(true)}
          >
            <ChevronUp className="size-4" />
          </button>
        </div>
      ) : (
        <div
          ref={panelRef}
          className={cn(
            'fixed top-20 z-[80] max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-border/80 bg-card p-4 shadow-xl transition-[left,right] duration-200',
            panelSide === 'right' ? 'right-4' : 'left-4 lg:left-[17rem]',
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-foreground text-sm font-semibold">Getting started</h2>
              <p className="text-muted-foreground text-xs">
                {completed.length} of {steps.length} done
              </p>
            </div>
            <button
              type="button"
              aria-label="Minimise the tour"
              className="hover:bg-muted/50 rounded-full p-1.5"
              onClick={() => setManualExpand(false)}
            >
              <ChevronDown className="size-4" />
            </button>
          </div>
          <div className="mt-2 mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="bg-accent h-full rounded-full transition-all"
              style={{ width: `${(completed.length / steps.length) * 100}%` }}
            />
          </div>

          <ul className="space-y-1">
            {steps.map((step) => {
              const done = completed.includes(step.id)
              const isActive = activeStep?.id === step.id && !revisitStep
              const isRevisit = revisitStep?.id === step.id
              const isOpen = isActive || isRevisit
              const onRoute = location.pathname === routePathOf(step.route)

              return (
                <li key={step.id} ref={isOpen ? activeItemRef : undefined}>
                  <div
                    className={cn(
                      'rounded-lg px-2 py-1.5 text-sm',
                      isOpen ? 'bg-muted/50' : '',
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
                      {done ? (
                        // Completed steps stay clickable: jump back to that page
                        // and point the spotlight at it again.
                        <button
                          type="button"
                          title="Show me this again"
                          className={cn(
                            'text-left font-medium underline-offset-2 hover:underline',
                            isRevisit ? 'text-foreground' : 'text-muted-foreground',
                          )}
                          onClick={() => {
                            setRevisitId(step.id)
                            setManualExpand(true)
                            navigate(step.route)
                          }}
                        >
                          {step.title}
                        </button>
                      ) : (
                        <p
                          className={cn(
                            'font-medium',
                            isActive ? 'text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {step.title}
                        </p>
                      )}
                    </div>

                    {isOpen ? (
                      <div className="mt-1.5 pl-6">
                        <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-xs">
                          {step.body.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {isRevisit ? (
                            <NeoButton
                              variant="surface"
                              size="sm"
                              onClick={() => setRevisitId(null)}
                            >
                              Back to the tour
                            </NeoButton>
                          ) : step.advanceOn === 'manual' ? (
                            <NeoButton
                              variant="surface"
                              size="sm"
                              disabled={completeStep.isPending}
                              onClick={() => markComplete(step.id)}
                            >
                              Mark complete
                            </NeoButton>
                          ) : (
                            <>
                              {!onRoute ? (
                                <NeoButton variant="surface" size="sm" asChild>
                                  <Link to={step.route}>Take me there</Link>
                                </NeoButton>
                              ) : null}
                              <NeoButton
                                variant="ghost"
                                size="sm"
                                disabled={completeStep.isPending}
                                onClick={() => markComplete(step.id)}
                              >
                                Mark complete
                              </NeoButton>
                            </>
                          )}
                        </div>
                        {isActive && step.advanceOn === 'click' && onRoute ? (
                          <p className="text-muted-foreground mt-1 text-xs italic">
                            Click the highlighted button to continue.
                          </p>
                        ) : null}
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
      )}

      {shownStep?.target ? (
        <TourSpotlight
          key={`${shownStep.id}-${revisitStep ? 'revisit' : 'live'}`}
          targetSelector={shownStep.target}
          label={shownStep.title}
          waitingForClick={!revisitStep && shownStep.advanceOn === 'click'}
          onTargetClick={() => markComplete(shownStep.id)}
        />
      ) : null}
    </>
  )
}
