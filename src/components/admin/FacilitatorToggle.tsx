import { Volume2, VolumeX } from 'lucide-react'

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
  /** Label above the switch instead of beside it, for a row of them. */
  stacked = false,
  /**
   * Rides a speaker on the thumb, crossed out when off. The winner-sound
   * targets are three identical switches in a row, and the icon is what says
   * they are about sound rather than about visibility.
   */
  icon,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
  stacked?: boolean
  icon?: 'sound'
}) {
  return (
    <label
      className={
        stacked
          ? 'flex cursor-pointer flex-col items-center gap-1.5 text-center'
          : 'flex cursor-pointer items-center justify-between gap-3'
      }
    >
      <span className={stacked ? 'text-xs font-bold text-balance' : 'text-sm font-semibold'}>
        {label}
      </span>
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
          className={`absolute top-0.5 flex size-[22px] items-center justify-center rounded-full transition-[left,background-color] duration-200 ease-[cubic-bezier(.4,0,.2,1)] ${
            checked ? 'bg-nm-yellow left-[28px]' : 'left-0.5 bg-white/60'
          }`}
        >
          {icon === 'sound' ? (
            // Both icons are stacked and crossfaded, so neither one pops in.
            <span className="relative flex size-3.5 items-center justify-center text-black">
              <Volume2
                className={`absolute size-3.5 transition-all duration-200 ${
                  checked ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
                }`}
                strokeWidth={2.5}
              />
              <VolumeX
                className={`absolute size-3.5 transition-all duration-200 ${
                  checked ? 'scale-75 opacity-0' : 'scale-100 opacity-70'
                }`}
                strokeWidth={2.5}
              />
            </span>
          ) : null}
        </span>
      </button>
    </label>
  )
}
