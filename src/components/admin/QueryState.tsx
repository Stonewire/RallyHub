import { Skeleton } from '@/components/ui/skeleton'

export function QueryLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-lg" />
      ))}
    </div>
  )
}

export function QueryError({ message }: { message?: string }) {
  return (
    <p className="text-destructive text-sm" role="alert">
      {message ?? 'Something went wrong loading data.'}
    </p>
  )
}

export function NoOrganizationMessage() {
  return (
    <p className="text-muted-foreground text-sm leading-relaxed">
      Your account is not linked to an organization yet. Ask an administrator
      to assign your profile to an organization in Supabase.
    </p>
  )
}
