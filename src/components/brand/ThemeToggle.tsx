import { Moon, Sun } from 'lucide-react'

import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

type ThemeToggleProps = {
  className?: string
}

/** Compact light/dark switch. Reflects and flips the resolved theme. */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-lg border border-border/70 bg-card/60 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground',
        className,
      )}
    >
      {isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  )
}
