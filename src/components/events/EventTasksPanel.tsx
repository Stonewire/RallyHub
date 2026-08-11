import { IconChevronDown, IconClose, IconEdit, IconTrash } from '@/components/icons'
import { useState } from 'react'

import { NeoButton, NeoInput, NeoLabel, NeoTextarea } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { EventChecklist } from '@/components/events/EventChecklist'
import {
  EVENT_TASK_STATUS_LABELS,
  EVENT_TASK_STATUS_ORDER,
  EVENT_TASK_STATUS_PILL_CLASS,
  useDeleteEventTask,
  useEventTasks,
  useSaveEventTask,
  type EventTaskRow,
} from '@/hooks/use-event-tasks'
import type { EventTaskStatus } from '@/types/database'
import { cn } from '@/lib/utils'

type Draft = {
  id?: string
  name: string
  assignee: string
  description: string
  dueDate: string
  status: EventTaskStatus
}

const EMPTY_DRAFT: Draft = {
  name: '',
  assignee: '',
  description: '',
  dueDate: '',
  status: 'todo',
}

function formatDue(due: string | null): string {
  if (!due) return ''
  const d = new Date(`${due}T00:00:00`)
  if (Number.isNaN(d.getTime())) return due
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function TaskStatusMenu({
  status,
  onSelect,
}: {
  status: EventTaskStatus
  onSelect: (status: EventTaskStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const others = EVENT_TASK_STATUS_ORDER.filter((s) => s !== status)
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('h-8 gap-1.5 rounded-full px-3', EVENT_TASK_STATUS_PILL_CLASS[status])}
        >
          <span className="text-xs font-semibold">{EVENT_TASK_STATUS_LABELS[status]}</span>
          <IconChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[10rem]">
        {others.map((s) => (
          <DropdownMenuItem
            key={s}
            onClick={() => {
              onSelect(s)
              setOpen(false)
            }}
          >
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                EVENT_TASK_STATUS_PILL_CLASS[s],
              )}
            >
              {EVENT_TASK_STATUS_LABELS[s]}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type EventTasksPanelProps = {
  eventId: string
  organizationId: string | null
}

export function EventTasksPanel({ eventId, organizationId }: EventTasksPanelProps) {
  const tasksQuery = useEventTasks(eventId)
  const saveTask = useSaveEventTask(organizationId, eventId)
  const deleteTask = useDeleteEventTask(eventId)

  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checklistOpen, setChecklistOpen] = useState(false)

  function startAdd() {
    setError(null)
    setDraft({ ...EMPTY_DRAFT })
  }

  function startEdit(task: EventTaskRow) {
    setError(null)
    setDraft({
      id: task.id,
      name: task.name,
      assignee: task.assignee ?? '',
      description: task.description ?? '',
      dueDate: task.due_date ?? '',
      status: task.status,
    })
  }

  async function submit() {
    if (!draft) return
    if (!draft.name.trim()) {
      setError('Task name is required.')
      return
    }
    setError(null)
    try {
      await saveTask.mutateAsync({
        id: draft.id,
        name: draft.name,
        assignee: draft.assignee || null,
        description: draft.description || null,
        dueDate: draft.dueDate || null,
        status: draft.status,
      })
      setDraft(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the task.')
    }
  }

  async function quickStatus(task: EventTaskRow, status: EventTaskStatus) {
    setError(null)
    try {
      await saveTask.mutateAsync({
        id: task.id,
        name: task.name,
        assignee: task.assignee,
        description: task.description,
        dueDate: task.due_date,
        status,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the task.')
    }
  }

  const tasks = tasksQuery.data ?? []

  return (
    <Card className="border-border/80 space-y-4 bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold">Task list</h3>
          <p className="text-muted-foreground text-xs">
            Plan and assign the prep for this event.
          </p>
        </div>
        <NeoButton type="button" variant="surface" size="sm" onClick={() => setChecklistOpen(true)}>
          View checklist
        </NeoButton>
        <NeoButton type="button" variant="accent" size="sm" onClick={startAdd}>
          Add task
        </NeoButton>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {draft ? (
        <Card className="border-border/80 space-y-3 bg-background p-4 shadow-none">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.1em]">
              {draft.id ? 'Edit task' : 'New task'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Cancel"
              onClick={() => setDraft(null)}
            >
              <IconClose className="size-4" />
            </Button>
          </div>
          <div className="space-y-1.5">
            <NeoLabel htmlFor="task-name">Task *</NeoLabel>
            <NeoInput
              id="task-name"
              value={draft.name}
              maxLength={200}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              autoFocus
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <NeoLabel htmlFor="task-assignee">Assignee</NeoLabel>
              <NeoInput
                id="task-assignee"
                value={draft.assignee}
                maxLength={120}
                placeholder="Who's on it?"
                onChange={(e) => setDraft({ ...draft, assignee: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <NeoLabel htmlFor="task-due">Due date</NeoLabel>
              <NeoInput
                id="task-due"
                type="date"
                value={draft.dueDate}
                onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <NeoLabel htmlFor="task-description">Description</NeoLabel>
            <NeoTextarea
              id="task-description"
              rows={2}
              value={draft.description}
              maxLength={1000}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <NeoLabel className="mb-0">Status</NeoLabel>
              <TaskStatusMenu
                status={draft.status}
                onSelect={(status) => setDraft({ ...draft, status })}
              />
            </div>
            <div className="flex gap-2">
              <NeoButton type="button" variant="ghost" size="sm" onClick={() => setDraft(null)}>
                Cancel
              </NeoButton>
              <NeoButton
                type="button"
                variant="primary"
                size="sm"
                disabled={saveTask.isPending}
                onClick={() => void submit()}
              >
                {draft.id ? 'Save task' : 'Add task'}
              </NeoButton>
            </div>
          </div>
        </Card>
      ) : null}

      {tasksQuery.isLoading ? (
        <QueryLoading rows={3} />
      ) : tasksQuery.isError ? (
        <QueryError message={tasksQuery.error.message} />
      ) : tasks.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          No tasks yet. Add one to start planning.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-muted-foreground text-left text-[10px] font-semibold uppercase tracking-[0.1em]">
                <th className="border-border border-b px-2 pb-2">Task</th>
                <th className="border-border border-b px-2 pb-2">Assignee</th>
                <th className="border-border border-b px-2 pb-2">Due</th>
                <th className="border-border border-b px-2 pb-2">Status</th>
                <th className="border-border border-b px-2 pb-2" />
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-border/60 border-b last:border-0 align-middle">
                  <td className="px-2 py-3">
                    <p className="font-semibold">{task.name}</p>
                    {task.description ? (
                      <p className="text-muted-foreground text-xs">{task.description}</p>
                    ) : null}
                  </td>
                  <td className="text-muted-foreground px-2 py-3">
                    {task.assignee || <span className="opacity-60">Unassigned</span>}
                  </td>
                  <td className="text-muted-foreground px-2 py-3 whitespace-nowrap tabular-nums">
                    {formatDue(task.due_date) || '—'}
                  </td>
                  <td className="px-2 py-3">
                    <TaskStatusMenu status={task.status} onSelect={(s) => void quickStatus(task, s)} />
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${task.name}`}
                        onClick={() => startEdit(task)}
                      >
                        <IconEdit className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${task.name}`}
                        className="text-destructive"
                        disabled={deleteTask.isPending}
                        onClick={() => void deleteTask.mutateAsync(task.id)}
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {checklistOpen ? (
        <EventChecklist
          eventId={eventId}
          organizationId={organizationId}
          onClose={() => setChecklistOpen(false)}
        />
      ) : null}
    </Card>
  )
}
