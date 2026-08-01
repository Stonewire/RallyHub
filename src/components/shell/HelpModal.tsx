import { IconClose, IconSupport } from '@/components/icons'
import { Link } from 'react-router-dom'

type HelpModalProps = {
  open: boolean
  onClose: () => void
}

/**
 * Help centre placeholder. Renders nothing when closed.
 *
 * ponytail: no article list or search box until the articles themselves exist.
 * Searching an empty array looked like a broken feature rather than an unfinished
 * one, so this says plainly that it is coming and routes people to support, which
 * is where they would have ended up anyway.
 */
export function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Help centre"
      className="fixed inset-0 z-80 flex items-center justify-center bg-black/45"
      onClick={onClose}
    >
      <div
        className="bg-nm-surface border-border rounded-nm-lg w-[420px] max-w-[92vw] border p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">Help Centre</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="hover:bg-muted rounded-nm-md flex size-[26px] items-center justify-center"
          >
            <IconClose className="size-3.5.5" />
          </button>
        </div>

        <div className="py-4 text-center">
          <div className="bg-muted mx-auto mb-3 flex size-11 items-center justify-center rounded-full">
            <IconSupport className="text-nm-neutral-600 size-5" />
          </div>
          <p className="mb-1 text-sm font-semibold">Coming soon</p>
          <p className="text-nm-neutral-500 mb-4 text-xs">
            Guides and answers are on the way. Until then our team can help you
            directly.
          </p>
          <Link
            to="/admin/support"
            onClick={onClose}
            className="bg-nm-yellow text-nm-charcoal rounded-nm-md inline-flex h-8 items-center px-3 text-xs font-semibold"
          >
            Contact support
          </Link>
        </div>
      </div>
    </div>
  )
}
