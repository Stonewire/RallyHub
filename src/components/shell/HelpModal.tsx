import { Search, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

type HelpArticle = { id: string; title: string; snippet: string }

// No help-content system exists yet. Add entries here when copy is ready;
// until then the modal correctly shows its empty state.
const HELP_ARTICLES: HelpArticle[] = []

type HelpModalProps = {
  open: boolean
  onClose: () => void
}

/** Searchable help centre. Renders nothing when closed. */
export function HelpModal({ open, onClose }: HelpModalProps) {
  const [query, setQuery] = useState('')

  if (!open) return null

  const trimmed = query.trim().toLowerCase()
  const matches = HELP_ARTICLES.filter(
    (article) =>
      article.title.toLowerCase().includes(trimmed) ||
      article.snippet.toLowerCase().includes(trimmed),
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Help centre"
      className="fixed inset-0 z-80 flex items-center justify-center bg-black/45"
      onClick={onClose}
    >
      <div
        className="bg-nm-surface border-border rounded-nm-lg flex max-h-[80vh] w-[520px] max-w-[92vw] flex-col border p-4 shadow-lg"
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
            <X className="size-3.5" strokeWidth={2} />
          </button>
        </div>

        <div className="relative mb-3">
          <Search
            className="text-nm-neutral-600 pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            strokeWidth={2}
          />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search help articles…"
            aria-label="Search help articles"
            className="border-input bg-nm-surface rounded-nm-md h-9 w-full border pr-3 pl-8 text-sm"
          />
        </div>

        {matches.length > 0 ? (
          <ul className="flex min-h-0 flex-col overflow-y-auto">
            {matches.map((article) => (
              <li
                key={article.id}
                className="border-border border-b py-2 last:border-b-0"
              >
                <p className="text-sm font-semibold">{article.title}</p>
                <p className="text-nm-neutral-500 text-xs">{article.snippet}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center">
            <p className="text-nm-neutral-500 mb-3 text-xs">
              No help articles match that yet. Our team can help directly.
            </p>
            <Link
              to="/admin/support"
              onClick={onClose}
              className="bg-nm-yellow text-nm-charcoal rounded-nm-md inline-flex h-8 items-center px-3 text-xs font-semibold"
            >
              Open a support ticket
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
