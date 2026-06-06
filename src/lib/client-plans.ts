export const CLIENT_PLAN_OPTIONS = [
  { value: 'free', label: 'Free' },
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'partner', label: 'Partner' },
] as const

export type ClientPlanValue = (typeof CLIENT_PLAN_OPTIONS)[number]['value']

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  partner: 'Partner',
  enterprise: 'Partner',
}

export function formatClientPlanLabel(plan: string | null | undefined): string {
  if (!plan?.trim()) return 'Free'
  return PLAN_LABELS[plan.toLowerCase()] ?? plan.charAt(0).toUpperCase() + plan.slice(1)
}

export function normalizeClientPlan(plan: string | null | undefined): ClientPlanValue {
  const key = plan?.toLowerCase()
  if (key === 'free' || key === 'starter' || key === 'pro' || key === 'partner') return key
  if (key === 'enterprise') return 'partner'
  return 'free'
}
