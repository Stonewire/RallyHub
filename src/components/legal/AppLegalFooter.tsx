import { LegalFooterLinks } from '@/components/legal/LegalFooterLinks'

export function AppLegalFooter() {
  return (
    <footer className="border-t border-[var(--nm-border)] bg-[var(--nm-bg-surface)]/50 mt-auto px-6 py-4 lg:px-8">
      <LegalFooterLinks inline className="justify-center sm:justify-start" />
    </footer>
  )
}
