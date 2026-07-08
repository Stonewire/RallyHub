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
   * successful save and reverts to `label` as soon as the form is dirty again.
   * When omitted, "Saved!" auto-reverts after a short delay.
   */
  dirty?: boolean
}

/** Sticky save bar visible at the bottom of long forms. */
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
        'border-border/80 bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-20 -mx-6 mt-10 border-t px-6 py-4 backdrop-blur sm:-mx-10 sm:px-10 lg:-mx-14 lg:px-14',
        className,
      )}
    >
      <div className="flex justify-end">
        <NeoButton
          type="button"
          variant="primary"
          disabled={saving}
          onClick={onSave}
          data-tour="form-save-button"
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : label}
        </NeoButton>
      </div>
    </div>
  )
}
