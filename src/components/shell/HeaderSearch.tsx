import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useGlobalSearch } from '@/hooks/use-global-search'
import type { SearchKind } from '@/lib/global-search'

const KIND_LABEL: Record<SearchKind, string> = {
  game: 'Game',
  event: 'Event',
  ticket: 'Ticket',
}

/** Header search input with a live results dropdown. */
export function HeaderSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const { results, isLoading } = useGlobalSearch(query)

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocumentClick)
    return () => document.removeEventListener('mousedown', onDocumentClick)
  }, [])

  const trimmed = query.trim()
  const showDropdown = open && trimmed.length >= 2 && !isLoading
  const hasResults = results.length > 0

  function go(to: string) {
    setOpen(false)
    setQuery('')
    navigate(to)
  }

  return (
    <div ref={boxRef} className="relative w-60">
      <Search
        className="text-nm-neutral-600 pointer-events-none absolute top-1/2 left-2.5 size-3 -translate-y-1/2"
        strokeWidth={2}
      />
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search…"
        aria-label="Search"
        className="border-input bg-nm-surface rounded-nm-md h-[26px] w-full border pr-2 pl-7 text-xs"
      />

      {showDropdown ? (
        <div className="border-border bg-nm-surface rounded-nm-md absolute top-[30px] left-0 z-60 w-80 overflow-hidden border shadow-lg">
          {hasResults ? (
            results.map((result) => (
              <button
                key={`${result.kind}-${result.id}`}
                type="button"
                onClick={() => go(result.to)}
                className="border-border hover:bg-muted flex w-full items-center gap-2 border-b px-3 py-2 text-left last:border-b-0"
              >
                <span className="bg-nm-slate-100 text-nm-slate-700 rounded-nm-sm shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                  {KIND_LABEL[result.kind]}
                </span>
                <span className="flex-1 truncate text-xs">{result.label}</span>
              </button>
            ))
          ) : (
            <p className="text-nm-neutral-500 px-3 py-3 text-xs">
              No matches for "{trimmed}"
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
