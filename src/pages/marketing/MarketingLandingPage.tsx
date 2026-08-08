import { PageHead } from '@/components/marketing/PageHead'
import { AudienceCards } from '@/components/marketing/home/AudienceCards'
import { BrandingPreview } from '@/components/marketing/home/BrandingPreview'
import { DemoContactSection } from '@/components/marketing/home/DemoContactSection'
import { EventBuilderShowcase } from '@/components/marketing/home/EventBuilderShowcase'
import { FacilitatorShowcase } from '@/components/marketing/home/FacilitatorShowcase'
import { LiveViewsShowcase } from '@/components/marketing/home/LiveViewsShowcase'
import { MarketingHero } from '@/components/marketing/home/MarketingHero'
import { MarketingHomeFooter } from '@/components/marketing/home/MarketingHomeFooter'
import { MarketingHomeHeader } from '@/components/marketing/home/MarketingHomeHeader'
import { MixedEventRun } from '@/components/marketing/home/MixedEventRun'
import { PricingMaths } from '@/components/marketing/home/PricingMaths'
import { PricingSection } from '@/components/marketing/home/PricingSection'
import { ProofStrip } from '@/components/marketing/home/ProofStrip'
import { ScrollProgress } from '@/components/marketing/home/Reveal'
import { StoreShowcase } from '@/components/marketing/home/StoreShowcase'
import { TrustStrip } from '@/components/marketing/home/TrustStrip'

export function MarketingLandingPage() {
  return (
    <div className="mkt neo-minimal-scope min-h-svh overflow-x-clip bg-[var(--nm-bg-base)]">
      <PageHead
        title="RallyHub — Event software for people who run events"
        description="Design your team-building games once, brand them for every client, and run the whole event live from one screen. Quests, quizzes, puzzles and music bingo on one leaderboard. Players join in the browser. Event set-up in about 10 minutes."
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
        <StoreShowcase />
        <PricingMaths />
        <TrustStrip />
        <AudienceCards />
        <PricingSection />
        <DemoContactSection />
      </main>

      <MarketingHomeFooter />
    </div>
  )
}
