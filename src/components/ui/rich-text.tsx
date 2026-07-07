import { sanitizeRichText } from '@/lib/rich-text'
import { cn } from '@/lib/utils'

export function RichText({ html, className }: { html: string | null | undefined; className?: string }) {
  if (!html) return null
  return (
    <div className={cn(className)} dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }} />
  )
}
