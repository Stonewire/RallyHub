/**
 * The library toolbar's filter chips: separate rounded tags, the active one
 * filled slate. Lifted out of the Games page so other lists filter with the
 * same control rather than a near-copy of its class list.
 */
export type FilterChipOption<T extends string> = {
  value: T
  label: string
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  className,
}: {
  options: FilterChipOption<T>[]
  value: T
  onChange: (next: T) => void
  'aria-label'?: string
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex flex-wrap gap-2 ${className ?? ''}`}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={`h-9 rounded-full border px-4 text-xs font-semibold transition-colors ${
            value === option.value
              ? 'border-nm-slate-800 bg-nm-slate-800 dark:border-nm-slate-700 dark:bg-nm-slate-700 text-white'
              : 'border-border bg-card text-muted-foreground hover:border-nm-slate-400 hover:text-foreground'
          }`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
