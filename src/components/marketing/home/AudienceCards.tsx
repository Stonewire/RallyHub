import { ArrowRight, Sparkles, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { NeoCard, NeoIconContainer } from '@/components/neo-minimal'

import { Reveal } from './Reveal'

export function AudienceCards() {
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-12">
        <Reveal className="max-w-2xl">
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.05em]">
            Built for the people who host
          </p>
          <h2 className="text-foreground font-display mt-3 text-3xl font-normal leading-[1.12] tracking-tight sm:text-4xl">
            Polished enough for clients.{' '}
            <span className="text-muted-foreground">Simple enough for your own team.</span>
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Reveal>
            <NeoCard className="flex h-full flex-col gap-5 p-8">
              <NeoIconContainer size="lg">
                <Sparkles className="size-6" aria-hidden />
              </NeoIconContainer>
              <h3 className="text-foreground text-2xl font-bold">Event professionals</h3>
              <p className="text-muted-foreground flex-1 leading-relaxed">
                Deliver a consistent, high-energy format while giving every client a distinct
                branded experience. Reuse your best games and duplicate complete event runs.
              </p>
              <Link
                to="/contact"
                className="text-foreground hover:text-foreground/80 inline-flex items-center gap-1.5 text-sm font-semibold"
              >
                See it in a demo
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </NeoCard>
          </Reveal>

          <Reveal delay={1}>
            <NeoCard className="flex h-full flex-col gap-5 p-8">
              <NeoIconContainer size="lg" accent>
                <Users className="size-6" aria-hidden />
              </NeoIconContainer>
              <h3 className="text-foreground text-2xl font-bold">People and culture teams</h3>
              <p className="text-muted-foreground flex-1 leading-relaxed">
                Run your own away day, conference energiser or team game without a production crew.
                The builder guides setup, and the facilitator view guides the live room.
              </p>
              <Link
                to="/register"
                className="text-foreground hover:text-foreground/80 inline-flex items-center gap-1.5 text-sm font-semibold"
              >
                Start building
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </NeoCard>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
