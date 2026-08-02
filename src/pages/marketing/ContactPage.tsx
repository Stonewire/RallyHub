import { RALLYHUB_CONTACT_EMAIL } from '@/constants/contact'
import { Link } from 'react-router-dom'

import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { PageHead } from '@/components/marketing/PageHead'
import { NeoButton, NeoCard } from '@/components/neo-minimal'

/** Placeholder — full contact form coming next. */
export function ContactPage() {
  return (
    <div className="neo-minimal-scope neo-minimal-inset flex min-h-svh flex-col">
      <PageHead
        title="Contact RallyHub"
        description="Book a demo or get in touch with the RallyHub team about live team events, pricing, and agency partnerships."
        path="/contact"
      />
      <MarketingHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <NeoCard className="w-full max-w-lg space-y-4 p-8 text-center">
          <h1 className="text-foreground text-2xl font-bold tracking-tight">Book a demo</h1>
          <p className="text-muted-foreground leading-relaxed">
            Our contact form is on the way. For now, reach out and we will set up a walkthrough of
            RallyHub for your team or agency.
          </p>
          <NeoButton variant="accent" asChild>
            <a href={`mailto:${RALLYHUB_CONTACT_EMAIL}`}>Email {RALLYHUB_CONTACT_EMAIL}</a>
          </NeoButton>
          <NeoButton variant="ghost" asChild>
            <Link to="/">Back to home</Link>
          </NeoButton>
        </NeoCard>
      </main>
      <MarketingFooter />
    </div>
  )
}
