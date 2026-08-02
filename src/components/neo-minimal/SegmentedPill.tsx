import { cn } from '@/lib/utils'

export type SegmentedOption<T extends string> = {
  value: T
  label: string
  disabled?: boolean
}

type SegmentedPillProps<T extends string> = {
  options: SegmentedOption<T>[]
  value: T
  onChange: (next: T) => void
  'aria-label'?: string
  className?: string
  /** Compact height, for use inside dense card headers. */
  size?: 'md' | 'sm'
}

/**
 * The new design's multi-state segmented control: a dark pill track with a
 * single gold indicator sliding behind the options, and the active label
 * flipping to dark text.
 *
 * The indicator is positioned with a `left` percentage rather than a
 * self-referential `transform: translateX(%)`, which drifts out of alignment
 * once there are four or more options.
 *
 * slate-800 (light) and slate-200 (dark) both resolve to #1d1f24, so the track
 * stays dark in either theme despite the ramp mirroring.
 */
export function SegmentedPill<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'md',
  ...rest
}: SegmentedPillProps<T>) {
  const activeIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  )
  const width = 100 / options.length
  const pad = size === 'sm' ? 2 : 4

  return (
    <div
      role="tablist"
      aria-label={rest['aria-label']}
      className={cn(
        'bg-nm-slate-800 dark:bg-nm-slate-200 relative flex w-full rounded-full',
        size === 'sm' ? 'p-0.5' : 'p-1',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'bg-nm-yellow absolute rounded-full transition-[left] duration-200 ease-[cubic-bezier(.4,0,.2,1)]',
          size === 'sm' ? 'top-0.5 bottom-0.5' : 'top-1 bottom-1',
        )}
        style={{
          left: `calc(${activeIndex * width}% + ${pad}px)`,
          width: `calc(${width}% - ${pad * 2}px)`,
        }}
      />
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative z-10 min-w-0 flex-1 truncate rounded-full text-center font-bold whitespace-nowrap transition-colors',
              // Horizontal padding stays tight so more segments squeeze in
              // rather than pushing the track wider than its card.
              size === 'sm' ? 'px-1.5 py-1 text-[11px]' : 'px-4 py-2 text-sm',
              isActive ? 'text-nm-charcoal' : 'text-white/80 hover:text-white',
              option.disabled && 'cursor-not-allowed opacity-40',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
