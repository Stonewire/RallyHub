import { Globe, ShieldCheck, UserX, Vault, type LucideIcon } from 'lucide-react'

import { Reveal } from './Reveal'

const ITEMS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ShieldCheck,
    title: 'GDPR first',
    body: 'Built in the EU, for EU events.',
  },
  {
    icon: UserX,
    title: 'Players never create accounts',
    body: 'Join with a link or QR code. Play. Leave. No profiles, no app-store logins.',
  },
  {
    icon: Globe,
    title: 'Runs anywhere',
    body: 'A web app: play in the browser on any device, or install it straight from the browser on your own event tablets.',
  },
  {
    icon: Vault,
    title: 'Your data is yours',
    body: 'Client branding, game libraries and event history stay in your workspace.',
  },
]

export function TrustStrip() {
  return (
    <section className="border-t border-[var(--nm-border)] bg-[var(--nm-bg-surface)]">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
        <Reveal>
          <h2 className="text-foreground font-sans text-2xl font-extrabold leading-[1.15] tracking-tight sm:text-3xl">
            Boring where it should be boring.
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((item, i) => (
            <Reveal key={item.title} delay={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--nm-yellow)_22%,transparent)] text-[var(--nm-charcoal)] dark:text-[var(--nm-yellow)]">
                <item.icon className="size-4" aria-hidden />
              </span>
              <div>
                <h3 className="text-foreground text-sm font-bold">{item.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
