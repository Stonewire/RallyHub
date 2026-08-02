import { Power, PowerOff, Volume2, VolumeX } from 'lucide-react'

/**
 * The app's on/off switch.
 *
 * Started as the facilitator console's display options, which were bare
 * checkboxes and read as a form to fill in rather than as controls that change
 * what the room is looking at right now. FlipSwitch is the design's other
 * two-state control, but it is built around a pair of *named* values; anything
 * that is plainly on or off belongs here, and wears the power icon that says
 * which way it is set without reading the label.
 */
export function FacilitatorToggle({
  label,
  checked,
  onChange,
  /** Label above the switch instead of beside it, for a row of them. */
  stacked = false,
  /**
   * What rides on the thumb. 'power' is the default, so every on/off switch
   * says which way it is set without reading the label; 'sound' swaps in a
   * speaker where the thing being switched is audio, as the winner-sound
   * targets are three identical switches in a row.
   */
  icon = 'power',
  disabled = false,
  /** The label is still announced, just not drawn, where the surrounding row
   *  already names the setting. */
  labelHidden = false,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
  stacked?: boolean
  icon?: 'power' | 'sound' | 'none'
  disabled?: boolean
  labelHidden?: boolean
}) {
  const [OnIcon, OffIcon] = icon === 'sound' ? [Volume2, VolumeX] : [Power, PowerOff]
  return (
    <label
      className={
        stacked
          ? 'flex cursor-pointer flex-col items-center gap-1.5 text-center'
          : 'flex cursor-pointer items-center justify-between gap-3'
      }
    >
      <span
        className={
          labelHidden
            ? 'sr-only'
            : stacked
              ? 'text-xs font-bold text-balance'
              : 'text-sm font-semibold'
        }
      >
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="bg-nm-slate-800 dark:bg-nm-slate-200 relative h-[26px] w-[52px] shrink-0 rounded-full transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          aria-hidden
          className={`absolute top-0.5 flex size-[22px] items-center justify-center rounded-full transition-[left,background-color] duration-200 ease-[cubic-bezier(.4,0,.2,1)] ${
            checked ? 'bg-nm-yellow left-[28px]' : 'left-0.5 bg-white/60'
          }`}
        >
          {icon !== 'none' ? (
            // Both icons are stacked and crossfaded, so neither one pops in.
            <span className="relative flex size-3.5 items-center justify-center text-black">
              <OnIcon
                className={`absolute size-3.5 transition-all duration-200 ${
                  checked ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
                }`}
                strokeWidth={2.5}
              />
              <OffIcon
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
