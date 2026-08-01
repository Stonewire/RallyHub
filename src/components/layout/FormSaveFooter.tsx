import { useEffect, useRef, useState } from 'react'

import { NeoButton } from '@/components/neo-minimal'
import { cn } from '@/lib/utils'

type FormSaveFooterProps = {
  onSave: () => void
  saving?: boolean
  label?: string
  className?: string
  /**
   * Optional dirty flag. When provided, the button shows "Saved!" after a
   * successful save, reverts to `label` as soon as the form is dirty again,
   * and is disabled while there is nothing to save. When omitted, "Saved!"
   * auto-reverts after a short delay and the button is always enabled, so
   * callers that do not track dirtiness are unaffected.
   */
  dirty?: boolean
}

/**
 * Floating save button that rides the bottom-right of long forms.
 *
 * It used to be a full-width bar with its own border and blurred backdrop,
 * which read as another section of the page. A button that simply follows the
 * scroll is the same reach with none of the furniture.
 */
export function FormSaveFooter({
  onSave,
  saving = false,
  label = 'Save',
  className,
  dirty,
}: FormSaveFooterProps) {
  const [saved, setSaved] = useState(false)
  const prevSaving = useRef(saving)

  // Flip to "Saved!" when a save finishes (saving true -> false).
  useEffect(() => {
    if (prevSaving.current && !saving) setSaved(true)
    prevSaving.current = saving
  }, [saving])

  // Revert when the form becomes dirty again (controlled mode).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the dirty prop transitioning true, not derivable from render alone (depends on the saved/dirty history)
    if (dirty) setSaved(false)
  }, [dirty])

  // Uncontrolled fallback: auto-revert after a short delay.
  useEffect(() => {
    if (!saved || dirty !== undefined) return
    const t = setTimeout(() => setSaved(false), 2500)
    return () => clearTimeout(t)
  }, [saved, dirty])

  return (
    <div
      className={cn(
        // pointer-events-none so the strip never swallows clicks on the form
        // it floats over; the button itself takes them back.
        'pointer-events-none sticky bottom-6 z-20 mt-10 flex justify-end',
        className,
      )}
    >
      <NeoButton
        type="button"
        variant="primary"
        className="pointer-events-auto shadow-lg"
        disabled={saving || dirty === false}
        onClick={onSave}
        data-tour="form-save-button"
      >
        {saving ? 'Saving…' : saved ? 'Saved!' : label}
      </NeoButton>
    </div>
  )
}
