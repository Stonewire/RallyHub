import { AccentButton } from '@/components/admin/AccentButton'
import { NeoButton } from '@/components/neo-minimal'
import { useRallyHubAdminUI } from '@/hooks/use-rallyhub-admin-ui'
import { cn } from '@/lib/utils'

type FormSaveFooterProps = {
  onSave: () => void
  saving?: boolean
  label?: string
  className?: string
}

/** Sticky save bar visible at the bottom of long forms. */
export function FormSaveFooter({
  onSave,
  saving = false,
  label = 'Save',
  className,
}: FormSaveFooterProps) {
  const neoUI = useRallyHubAdminUI()

  return (
    <div
      className={cn(
        'border-border/80 bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-20 -mx-6 mt-10 border-t px-6 py-4 backdrop-blur sm:-mx-10 sm:px-10 lg:-mx-14 lg:px-14',
        className,
      )}
    >
      <div className="flex justify-end">
        {neoUI ? (
          <NeoButton type="button" variant="primary" disabled={saving} onClick={onSave}>
            {saving ? 'Saving…' : label}
          </NeoButton>
        ) : (
          <AccentButton type="button" disabled={saving} onClick={onSave}>
            {saving ? 'Saving…' : label}
          </AccentButton>
        )}
      </div>
    </div>
  )
}
