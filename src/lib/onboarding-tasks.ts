import { orgPath } from '@/lib/org-path'

export type OnboardingStep = {
  id: string
  /** i18n key (admin namespace) for the step heading. */
  titleKey: string
  /** i18n keys (admin namespace), one per bullet line. */
  bodyKeys: string[]
  /** Path (+ query) where the target element lives, for the "take me there" fallback. */
  route: string
  /** Matches a data-tour="..." attribute in the DOM. Omit for text-only steps. */
  target?: string
  /** 'click' = clicking the real target completes the step. 'manual' = a Next button does. */
  advanceOn: 'click' | 'manual'
  /** If already on this path when the step activates, complete it without waiting for a click. */
  skipIfPath?: string
  /** Settings/billing/team steps: hidden from event_manager tours (no access). */
  clientAdminOnly?: boolean
}

/** The tour a given role actually sees (event managers skip settings/billing). */
export function onboardingStepsForRole(role: string | null, clientSlug: string | null): OnboardingStep[] {
  const steps = role === 'client_admin' ? ONBOARDING_STEPS : ONBOARDING_STEPS.filter((s) => !s.clientAdminOnly)
  return applyOrgPathToSteps(steps, clientSlug)
}

/** Apply orgPath to all route and skipIfPath fields in onboarding steps. */
function applyOrgPathToSteps(steps: OnboardingStep[], clientSlug: string | null): OnboardingStep[] {
  return steps.map((step) => ({
    ...step,
    route: orgPath(clientSlug, step.route),
    skipIfPath: step.skipIfPath ? orgPath(clientSlug, step.skipIfPath) : undefined,
  }))
}

/**
 * Client-admin onboarding tour, ordered like a real working session:
 * dashboard, org settings (profile, users, billing, promo codes), games
 * (create a real test game), events (create a real test event), support.
 *
 * Copy lives in the admin locale files under onboarding.steps.*; the
 * checklist resolves titleKey/bodyKeys at render time so a language switch
 * applies straight away.
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'dashboard',
    titleKey: 'onboarding.steps.dashboard.title',
    route: '/admin',
    target: 'nav-dashboard',
    advanceOn: 'click',
    skipIfPath: '/admin',
    bodyKeys: [
      'onboarding.steps.dashboard.body1',
      'onboarding.steps.dashboard.body2',
      'onboarding.steps.dashboard.body3',
    ],
  },
  {
    id: 'org-settings-nav',
    clientAdminOnly: true,
    titleKey: 'onboarding.steps.orgSettingsNav.title',
    route: '/admin/settings',
    target: 'nav-org-settings',
    advanceOn: 'click',
    skipIfPath: '/admin/settings',
    bodyKeys: ['onboarding.steps.orgSettingsNav.body1'],
  },
  {
    id: 'org-profile',
    clientAdminOnly: true,
    titleKey: 'onboarding.steps.orgProfile.title',
    route: '/admin/settings',
    target: 'org-profile-form',
    advanceOn: 'manual',
    bodyKeys: [
      'onboarding.steps.orgProfile.body1',
      'onboarding.steps.orgProfile.body2',
      'onboarding.steps.orgProfile.body3',
    ],
  },
  {
    id: 'team-users',
    clientAdminOnly: true,
    titleKey: 'onboarding.steps.teamUsers.title',
    route: '/admin/settings',
    target: 'add-user-button',
    advanceOn: 'manual',
    bodyKeys: [
      'onboarding.steps.teamUsers.body1',
      'onboarding.steps.teamUsers.body2',
      'onboarding.steps.teamUsers.body3',
      'onboarding.steps.teamUsers.body4',
    ],
  },
  {
    id: 'billing-tab',
    clientAdminOnly: true,
    titleKey: 'onboarding.steps.billingTab.title',
    route: '/admin/settings',
    // Billing moved from a tab on the settings page to a top-level sidebar
    // item in the new design, so this step targets the nav entry.
    target: 'nav-billing',
    advanceOn: 'click',
    bodyKeys: ['onboarding.steps.billingTab.body1'],
  },
  {
    id: 'billing-plan',
    clientAdminOnly: true,
    titleKey: 'onboarding.steps.billingPlan.title',
    route: '/admin/settings?tab=billing',
    target: 'billing-plan',
    advanceOn: 'manual',
    bodyKeys: [
      'onboarding.steps.billingPlan.body1',
      'onboarding.steps.billingPlan.body2',
    ],
  },
  {
    id: 'billing-unpaid',
    clientAdminOnly: true,
    titleKey: 'onboarding.steps.billingUnpaid.title',
    route: '/admin/settings?tab=billing',
    target: 'billing-unpaid',
    advanceOn: 'manual',
    bodyKeys: [
      'onboarding.steps.billingUnpaid.body1',
      'onboarding.steps.billingUnpaid.body2',
    ],
  },
  {
    id: 'billing-history',
    clientAdminOnly: true,
    titleKey: 'onboarding.steps.billingHistory.title',
    route: '/admin/settings?tab=billing',
    target: 'billing-history',
    advanceOn: 'manual',
    bodyKeys: ['onboarding.steps.billingHistory.body1'],
  },
  {
    id: 'billing-subscription',
    clientAdminOnly: true,
    titleKey: 'onboarding.steps.billingSubscription.title',
    route: '/admin/settings?tab=billing',
    target: 'billing-subscription',
    advanceOn: 'manual',
    bodyKeys: ['onboarding.steps.billingSubscription.body1'],
  },
  {
    id: 'promo-codes',
    clientAdminOnly: true,
    titleKey: 'onboarding.steps.promoCodes.title',
    route: '/admin/settings?tab=billing',
    target: 'promo-code-input',
    advanceOn: 'manual',
    bodyKeys: [
      'onboarding.steps.promoCodes.body1',
      'onboarding.steps.promoCodes.body2',
    ],
  },
  {
    id: 'games-nav',
    titleKey: 'onboarding.steps.gamesNav.title',
    route: '/admin/games',
    target: 'nav-games',
    advanceOn: 'click',
    skipIfPath: '/admin/games',
    bodyKeys: ['onboarding.steps.gamesNav.body1'],
  },
  {
    id: 'create-game',
    titleKey: 'onboarding.steps.createGame.title',
    route: '/admin/games',
    target: 'new-game-button',
    advanceOn: 'click',
    bodyKeys: ['onboarding.steps.createGame.body1'],
  },
  {
    id: 'game-types',
    titleKey: 'onboarding.steps.gameTypes.title',
    route: '/admin/games/new',
    target: 'game-type-picker',
    advanceOn: 'click',
    bodyKeys: [
      'onboarding.steps.gameTypes.body1',
      'onboarding.steps.gameTypes.body2',
      'onboarding.steps.gameTypes.body3',
      'onboarding.steps.gameTypes.body4',
      'onboarding.steps.gameTypes.body5',
      'onboarding.steps.gameTypes.body6',
    ],
  },
  {
    id: 'save-game',
    titleKey: 'onboarding.steps.saveGame.title',
    route: '/admin/games/new',
    target: 'form-save-button',
    advanceOn: 'click',
    bodyKeys: [
      'onboarding.steps.saveGame.body1',
      'onboarding.steps.saveGame.body2',
    ],
  },
  {
    id: 'events-nav',
    titleKey: 'onboarding.steps.eventsNav.title',
    route: '/admin/events',
    target: 'nav-events',
    advanceOn: 'click',
    skipIfPath: '/admin/events',
    bodyKeys: ['onboarding.steps.eventsNav.body1'],
  },
  {
    id: 'create-event',
    titleKey: 'onboarding.steps.createEvent.title',
    route: '/admin/events',
    target: 'new-event-button',
    advanceOn: 'click',
    bodyKeys: ['onboarding.steps.createEvent.body1'],
  },
  {
    id: 'save-event',
    titleKey: 'onboarding.steps.saveEvent.title',
    route: '/admin/events/new',
    target: 'form-save-button',
    advanceOn: 'click',
    bodyKeys: [
      'onboarding.steps.saveEvent.body1',
      'onboarding.steps.saveEvent.body2',
    ],
  },
  {
    id: 'event-status',
    titleKey: 'onboarding.steps.eventStatus.title',
    route: '/admin/events',
    target: 'event-status-menu',
    advanceOn: 'manual',
    bodyKeys: [
      'onboarding.steps.eventStatus.body1',
      'onboarding.steps.eventStatus.body2',
      'onboarding.steps.eventStatus.body3',
      'onboarding.steps.eventStatus.body4',
    ],
  },
  {
    id: 'support-nav',
    titleKey: 'onboarding.steps.supportNav.title',
    route: '/admin/support',
    target: 'nav-support',
    advanceOn: 'click',
    skipIfPath: '/admin/support',
    bodyKeys: ['onboarding.steps.supportNav.body1'],
  },
]
