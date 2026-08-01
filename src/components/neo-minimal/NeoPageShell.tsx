import { IconArrowLeft } from '@/components/icons'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { NeoButton } from '@/components/neo-minimal/NeoButton'
import { cn } from '@/lib/utils'

type NeoPageShellProps = {
  title: string
  subtitle?: ReactNode
  children?: ReactNode
  actions?: ReactNode
  backTo?: string
  backLabel?: string
  className?: string
  centeredHeader?: boolean
}

/** Neo-minimal page frame for RallyHub admin screens. */
export function NeoPageShell({
  title,
  subtitle,
  children,
  actions,
  backTo,
  backLabel = 'Back',
  className,
  centeredHeader = false,
}: NeoPageShellProps) {
  return (
    <div className={cn('flex w-full flex-1 pb-12', className)}>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {backTo ? (
          <NeoButton variant="ghost" size="sm" className="-ml-1 mb-4" asChild>
            <Link to={backTo}>
              <IconArrowLeft className="size-4" aria-hidden />
              {backLabel}
            </Link>
          </NeoButton>
        ) : null}
        <div className={`mb-6 flex flex-col gap-4 ${centeredHeader ? 'items-center text-center' : 'sm:flex-row sm:items-start sm:justify-between'}`}>
          <div className={`min-w-0 flex-1 space-y-1 ${centeredHeader ? 'flex flex-col items-center' : ''}`}>
            <h1 className="neo-page-title">{title}</h1>
            {subtitle ? <p className="neo-page-subtitle">{subtitle}</p> : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  )
}
