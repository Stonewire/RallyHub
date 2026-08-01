import { cn } from '@/lib/utils'

export type ClientDetailTab = 'info' | 'billing' | 'events'

const TABS: { id: ClientDetailTab; label: string }[] = [
  { id: 'info', label: 'Client Info' },
  { id: 'billing', label: 'Billing' },
  { id: 'events', label: 'Events' },
]

type ClientDetailTabsProps = {
  activeTab: ClientDetailTab
  onTabChange: (tab: ClientDetailTab) => void
  showBillingAndEvents: boolean
}

// eslint-disable-next-line react-refresh/only-export-components -- URL-param helper shared with ClientDetailTabs' callers
export function normalizeClientDetailTab(
  value: string | null,
  showBillingAndEvents: boolean,
): ClientDetailTab {
  if (showBillingAndEvents && (value === 'billing' || value === 'events')) {
    return value
  }
  return 'info'
}

export function ClientDetailTabs({
  activeTab,
  onTabChange,
  showBillingAndEvents,
}: ClientDetailTabsProps) {
  const visibleTabs = showBillingAndEvents
    ? TABS
    : TABS.filter((tab) => tab.id === 'info')

  if (visibleTabs.length <= 1) return null

  // The tab strip used across the admin panel: centred, underlined, no pills.
  return (
    <div
      className="border-border mb-6 flex items-center justify-center gap-6 border-b"
      role="tablist"
      aria-label="Client sections"
    >
      {visibleTabs.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={activeTab === id}
          onClick={() => onTabChange(id)}
          className={cn(
            'relative px-1 pb-3 text-sm font-semibold transition-colors',
            activeTab === id
              ? 'text-foreground after:bg-primary after:absolute after:inset-x-0 after:-bottom-px after:h-0.5'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
