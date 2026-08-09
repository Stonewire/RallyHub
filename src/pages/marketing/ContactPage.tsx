import { PageHead } from '@/components/marketing/PageHead'
import { DemoContactSection } from '@/components/marketing/home/DemoContactSection'
import { MarketingHomeFooter } from '@/components/marketing/home/MarketingHomeFooter'
import { MarketingHomeHeader } from '@/components/marketing/home/MarketingHomeHeader'

/** Standalone /contact: the same working demo form the home page uses. */
export function ContactPage() {
  return (
    <div className="mkt flex min-h-svh flex-col overflow-x-clip">
      <PageHead
        title="Book a RallyHub demo"
        description="Book 30 minutes with the RallyHub team. We will build an event in front of you, brand it like one of your clients, and run you through it as a player."
        path="/contact"
      />
      <MarketingHomeHeader />
      {/* Coal ground so the short page does not leave an ivory band above the footer. */}
      <main id="main" className="flex-1" style={{ background: 'var(--mk-coal)' }}>
        <DemoContactSection />
      </main>
      <MarketingHomeFooter />
    </div>
  )
}
