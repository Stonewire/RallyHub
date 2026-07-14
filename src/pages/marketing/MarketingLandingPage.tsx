import { PageHead } from '@/components/marketing/PageHead'
import { AudienceCards } from '@/components/marketing/home/AudienceCards'
import { BrandingPreview } from '@/components/marketing/home/BrandingPreview'
import { DemoContactSection } from '@/components/marketing/home/DemoContactSection'
import { EventBuilderShowcase } from '@/components/marketing/home/EventBuilderShowcase'
import { FacilitatorShowcase } from '@/components/marketing/home/FacilitatorShowcase'
import { HowItWorks } from '@/components/marketing/home/HowItWorks'
import { LiveViewsShowcase } from '@/components/marketing/home/LiveViewsShowcase'
import { MarketingHero } from '@/components/marketing/home/MarketingHero'
import { MarketingHomeFooter } from '@/components/marketing/home/MarketingHomeFooter'
import { MarketingHomeHeader } from '@/components/marketing/home/MarketingHomeHeader'
import { MixedEventRun } from '@/components/marketing/home/MixedEventRun'
import { PricingSection } from '@/components/marketing/home/PricingSection'
import { ProofStrip } from '@/components/marketing/home/ProofStrip'
import { ScrollProgress } from '@/components/marketing/home/Reveal'

export function MarketingLandingPage() {
  return (
    <div className="mkt neo-minimal-scope min-h-svh overflow-x-clip bg-[var(--nm-bg-base)]">
      <PageHead
        title="RallyHub — One link, one leaderboard, your whole team event"
        description="RallyHub is the all-in-one platform for live team events. Build quests, quizzes and music bingo into one branded run, host from a single control room, and keep every team on one live leaderboard. Players join in the browser, no app required."
        path="/"
        ogImage="/og-image.jpg"
      />
      <ScrollProgress />
      <MarketingHomeHeader />

      <main id="main">
        <MarketingHero />
        <ProofStrip />
        <MixedEventRun />
        <EventBuilderShowcase />
        <FacilitatorShowcase />
        <LiveViewsShowcase />
        <BrandingPreview />
        <HowItWorks />
        <AudienceCards />
        <PricingSection />
        <DemoContactSection />
      </main>

      <MarketingHomeFooter />
    </div>
  )
}
