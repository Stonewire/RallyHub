/**
 * A labelled on/off switch for the facilitator console's display options.
 *
 * These were bare checkboxes, which read as a form to fill in rather than as
 * controls that change what the room is looking at right now. FlipSwitch is the
 * design's two-state control but is built around a pair of named values; these
 * settings are plainly on or off, so this wraps the same track and thumb with a
 * single label on the left.
 */
export function FacilitatorToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-sm font-semibold">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="bg-nm-slate-800 dark:bg-nm-slate-200 relative h-[26px] w-[52px] shrink-0 rounded-full transition-opacity disabled:opacity-50"
      >
        <span
          aria-hidden
          className={`absolute top-0.5 size-[22px] rounded-full transition-[left] duration-200 ease-[cubic-bezier(.4,0,.2,1)] ${
            checked ? 'bg-nm-yellow left-[28px]' : 'left-0.5 bg-white/40'
          }`}
        />
      </button>
    </label>
  )
}
