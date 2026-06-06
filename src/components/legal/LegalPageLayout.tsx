import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { PageHead } from '@/components/marketing/PageHead'
import { NeoCard } from '@/components/neo-minimal'
import { LEGAL_LAST_UPDATED } from '@/lib/legal-placeholders'

type LegalPageLayoutProps = {
  title: string
  description: string
  path: string
  children: ReactNode
}

export function LegalPageLayout({ title, description, path, children }: LegalPageLayoutProps) {
  return (
    <div className="neo-minimal-scope neo-minimal-inset flex min-h-svh flex-col">
      <PageHead title={title} description={description} path={path} />
      <MarketingHeader />
      <main className="flex-1 px-6 py-12 sm:px-10 lg:px-14">
        <div className="mx-auto max-w-3xl">
          <NeoCard className="space-y-8 p-8 sm:p-10">
            <header className="space-y-2 border-b border-[var(--nm-border)] pb-6">
              <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
                {title}
              </h1>
              <p className="text-muted-foreground text-sm">Last updated: {LEGAL_LAST_UPDATED}</p>
            </header>
            <div className="legal-prose space-y-8">{children}</div>
            <footer className="border-t border-[var(--nm-border)] pt-6">
              <p className="text-muted-foreground text-sm">
                Questions?{' '}
                <Link to="/contact" className="text-foreground font-medium underline-offset-4 hover:underline">
                  Contact us
                </Link>
                .
              </p>
            </footer>
          </NeoCard>
        </div>
      </main>
      <MarketingFooter />
    </div>
  )
}

export function LegalSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-foreground text-lg font-semibold tracking-tight">{title}</h2>
      <div className="text-muted-foreground space-y-3 text-sm leading-relaxed [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_a]:text-foreground [&_a]:underline-offset-4 [&_a]:hover:underline">
        {children}
      </div>
    </section>
  )
}
