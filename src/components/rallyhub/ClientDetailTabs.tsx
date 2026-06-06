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

  return (
    <div className="border-border/80 mb-8 flex gap-1 border-b">
      {visibleTabs.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onTabChange(id)}
          className={cn(
            'text-foreground -mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
            activeTab === id
              ? 'border-[#FFCB03]'
              : 'text-muted-foreground border-transparent hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
