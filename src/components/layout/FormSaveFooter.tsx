import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  label,
  className,
  dirty,
}: FormSaveFooterProps) {
  const { t } = useTranslation('admin')
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
    const timer = setTimeout(() => setSaved(false), 2500)
    return () => clearTimeout(timer)
  }, [saved, dirty])

  return (
    <div
      className={cn(
        // pointer-events-none so the strip never swallows clicks on the form
        // it floats over; the button itself takes them back. On touch widths
        // (below xl) the floating chip sat ON TOP of form fields, so it
        // becomes a full-width bar with its own backdrop instead.
        'pointer-events-none sticky z-20 flex',
        'max-xl:bottom-0 max-xl:-mx-4 max-xl:mt-6 max-xl:border-t max-xl:border-border max-xl:bg-background/95 max-xl:px-4 max-xl:py-3 max-xl:backdrop-blur',
        'xl:bottom-6 xl:mt-10 xl:justify-end',
        className,
      )}
    >
      <NeoButton
        type="button"
        variant="primary"
        className="pointer-events-auto shadow-lg max-xl:w-full max-xl:justify-center"
        disabled={saving || dirty === false}
        onClick={onSave}
        data-tour="form-save-button"
      >
        {saving ? t('form.saving') : saved ? t('form.saved') : (label ?? t('common:save'))}
      </NeoButton>
    </div>
  )
}
