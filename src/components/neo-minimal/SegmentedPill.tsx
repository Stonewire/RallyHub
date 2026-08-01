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

  return (
    <div
      role="tablist"
      aria-label={rest['aria-label']}
      className={cn(
        'bg-nm-slate-800 dark:bg-nm-slate-200 relative flex w-full rounded-full p-1',
        className,
      )}
    >
      <span
        aria-hidden
        className="bg-nm-yellow absolute top-1 bottom-1 rounded-full transition-[left] duration-200 ease-[cubic-bezier(.4,0,.2,1)]"
        style={{
          left: `calc(${activeIndex * width}% + 4px)`,
          width: `calc(${width}% - 8px)`,
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
              'relative z-10 flex-1 rounded-full text-center font-bold whitespace-nowrap transition-colors',
              size === 'sm' ? 'px-3 py-1 text-[11px]' : 'px-4 py-2 text-sm',
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
