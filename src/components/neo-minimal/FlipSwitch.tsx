import { cn } from '@/lib/utils'

type FlipSwitchProps<T extends string> = {
  /** Value shown on the left of the track. */
  offValue: T
  /** Value shown on the right of the track. */
  onValue: T
  offLabel: string
  onLabel: string
  value: T
  onChange: (next: T) => void
  /** Small uppercase caption above the control, as in the design. */
  caption?: string
  disabled?: boolean
  id?: string
  className?: string
}

/**
 * The new design's two-state flip switch: a 52x26 dark pill with a 22px gold
 * thumb that slides between the two labels, the active label going bold gold.
 *
 * The slate ramp mirrors in dark mode, so slate-800 (light) and slate-200
 * (dark) are used together because both resolve to #1d1f24, keeping the track
 * dark in either theme.
 */
export function FlipSwitch<T extends string>({
  offValue,
  onValue,
  offLabel,
  onLabel,
  value,
  onChange,
  caption,
  disabled = false,
  id,
  className,
}: FlipSwitchProps<T>) {
  const isOn = value === onValue

  return (
    <div className={cn('flex flex-col items-center gap-1.5', className)}>
      {caption ? (
        <span className="text-nm-neutral-500 text-[10px] font-semibold tracking-wider uppercase">
          {caption}
        </span>
      ) : null}
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'text-xs transition-colors',
            isOn ? 'text-nm-neutral-500' : 'text-nm-yellow font-bold',
          )}
        >
          {offLabel}
        </span>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={isOn}
          aria-label={`${offLabel} or ${onLabel}`}
          disabled={disabled}
          onClick={() => onChange(isOn ? offValue : onValue)}
          className={cn(
            'bg-nm-slate-800 dark:bg-nm-slate-200 relative h-[26px] w-[52px] shrink-0 rounded-full transition-opacity',
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          )}
        >
          <span
            aria-hidden
            className="bg-nm-yellow absolute top-0.5 left-0.5 size-[22px] rounded-full transition-transform duration-200 ease-[cubic-bezier(.4,0,.2,1)]"
            style={{ transform: isOn ? 'translateX(26px)' : 'translateX(0)' }}
          />
        </button>
        <span
          className={cn(
            'text-xs transition-colors',
            isOn ? 'text-nm-yellow font-bold' : 'text-nm-neutral-500',
          )}
        >
          {onLabel}
        </span>
      </div>
    </div>
  )
}
