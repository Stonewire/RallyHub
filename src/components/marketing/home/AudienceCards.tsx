import { ArrowRight, Beer, Users } from 'lucide-react'

import { NeoCard, NeoIconContainer } from '@/components/neo-minimal'

import { Reveal } from './Reveal'

export function AudienceCards() {
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-12">
        <Reveal className="max-w-2xl">
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.05em]">
            Beyond agencies
          </p>
          <h2 className="text-foreground font-sans mt-3 text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-4xl">
            Not an agency? <span className="text-muted-foreground">Still your kind of party.</span>
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Reveal>
            <NeoCard className="flex h-full flex-col gap-5 p-8">
              <NeoIconContainer size="lg">
                <Users className="size-6" aria-hidden />
              </NeoIconContainer>
              <h3 className="text-foreground text-2xl font-bold">Companies</h3>
              <p className="text-muted-foreground flex-1 leading-relaxed">
                Running your own team day? Build it yourself with the same tools the pros use, or
                grab a ready-made format and go. No event-planning degree required.
              </p>
              <a
                href="#contact"
                className="text-foreground hover:text-foreground/80 inline-flex items-center gap-1.5 text-sm font-semibold"
              >
                Book a demo
                <ArrowRight className="size-4" aria-hidden />
              </a>
            </NeoCard>
          </Reveal>

          <Reveal delay={1}>
            <NeoCard className="flex h-full flex-col gap-5 p-8">
              <NeoIconContainer size="lg" accent>
                <Beer className="size-6" aria-hidden />
              </NeoIconContainer>
              <h3 className="text-foreground text-2xl font-bold">Venues and hosts</h3>
              <p className="text-muted-foreground flex-1 leading-relaxed">
                Quiz night every Thursday? Music bingo on Fridays? Set it up once, rebrand it
                never, run it weekly from a phone.
              </p>
              <a
                href="#contact"
                className="text-foreground hover:text-foreground/80 inline-flex items-center gap-1.5 text-sm font-semibold"
              >
                Book a demo
                <ArrowRight className="size-4" aria-hidden />
              </a>
            </NeoCard>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
