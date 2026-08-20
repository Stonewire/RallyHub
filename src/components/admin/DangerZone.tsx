import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export type DangerZoneRow = {
  id: string
  label: string
  description: ReactNode
  /** The row's action control, rendered right-aligned. */
  action: ReactNode
}

type DangerZoneProps = {
  /** Defaults to the translated "Danger Zone" heading. */
  title?: string
  rows: DangerZoneRow[]
  /** Optional status or error text shown above the rows. */
  notice?: ReactNode
}

/**
 * The new design's Danger Zone card: red border, red title, and one row per
 * destructive action with its explanation on the left and its control on the
 * right. Shared by Organisation, My Account and the event editor so the
 * pattern stays identical across all three.
 */
export function DangerZone({ title, rows, notice }: DangerZoneProps) {
  const { t } = useTranslation('admin')
  return (
    <section
      className="rounded-nm-lg bg-nm-surface border-[1.5px] p-5"
      style={{ borderColor: 'var(--nm-danger)' }}
      aria-labelledby="danger-zone-title"
    >
      <h2
        id="danger-zone-title"
        className="text-base font-bold"
        style={{ color: 'var(--nm-danger)' }}
      >
        {title ?? t('dangerZone.title')}
      </h2>

      {notice ? <div className="mt-2 text-sm">{notice}</div> : null}

      <div className="mt-3 flex flex-col">
        {rows.map((row) => (
          <div
            key={row.id}
            className="border-border flex flex-wrap items-center justify-between gap-3 border-t py-3 first:border-t-0 first:pt-1"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{row.label}</p>
              <p className="text-nm-neutral-500 text-xs">{row.description}</p>
            </div>
            <div className="shrink-0">{row.action}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
