import { Check, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { NeoButton } from '@/components/neo-minimal'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { useAuth } from '@/contexts/auth-context'
import { useToggleOnboardingTask } from '@/hooks/use-onboarding'
import { useOrganizationId } from '@/hooks/use-organization-id'
import { useOrganization } from '@/hooks/use-organization-settings'
import { ONBOARDING_TASKS } from '@/lib/onboarding-tasks'
import { cn } from '@/lib/utils'

/** Auto-opens once per browser session for a client_admin with unfinished tasks; reopen via the floating button. */
export function OnboardingChecklist() {
  const { role } = useAuth()
  const organizationId = useOrganizationId()
  const orgQuery = useOrganization(organizationId)
  const toggleTask = useToggleOnboardingTask(organizationId)
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(ONBOARDING_TASKS[0]?.id ?? null)

  const completed = orgQuery.data?.onboarding_completed_tasks ?? []
  const allDone = completed.length >= ONBOARDING_TASKS.length
  const eligible = role === 'client_admin' && Boolean(organizationId)

  useEffect(() => {
    if (!eligible || !orgQuery.data || allDone) return
    const key = `rallyhub-onboarding-shown-${organizationId}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    setOpen(true)
  }, [eligible, orgQuery.data, allDone, organizationId])

  if (!eligible) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-border/80 bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-lg hover:bg-muted/40"
      >
        {allDone ? (
          <Check className="size-4 text-emerald-600" />
        ) : (
          <Sparkles className="size-4 text-accent" />
        )}
        {allDone ? 'Getting started' : `Getting started · ${completed.length}/${ONBOARDING_TASKS.length}`}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Getting started with RallyHub</SheetTitle>
            <SheetDescription>
              {allDone
                ? "You've completed onboarding — reopen this any time from the button in the corner."
                : `${completed.length} of ${ONBOARDING_TASKS.length} done. Work through each task, then mark it complete.`}
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-6">
            <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${(completed.length / ONBOARDING_TASKS.length) * 100}%` }}
              />
            </div>

            <ul className="divide-y divide-border/60">
              {ONBOARDING_TASKS.map((task) => {
                const done = completed.includes(task.id)
                const isExpanded = expanded === task.id
                return (
                  <li key={task.id} className="py-3">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        aria-label={done ? 'Mark task incomplete' : 'Mark task complete'}
                        disabled={toggleTask.isPending}
                        onClick={() =>
                          toggleTask.mutate({ taskId: task.id, completed: !done, current: completed })
                        }
                        className={cn(
                          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                          done
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-border/80 bg-background',
                        )}
                      >
                        {done ? <Check className="size-3" /> : null}
                      </button>

                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => setExpanded(isExpanded ? null : task.id)}
                          className={cn(
                            'text-left text-sm font-medium',
                            done ? 'text-muted-foreground line-through' : 'text-foreground',
                          )}
                        >
                          {task.title}
                        </button>

                        {isExpanded ? (
                          <div className="mt-2 space-y-2">
                            <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-xs">
                              {task.bullets.map((bullet) => (
                                <li key={bullet}>{bullet}</li>
                              ))}
                            </ul>
                            <NeoButton variant="surface" size="sm" asChild>
                              <Link to={task.route} onClick={() => setOpen(false)}>
                                {task.linkLabel}
                              </Link>
                            </NeoButton>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
