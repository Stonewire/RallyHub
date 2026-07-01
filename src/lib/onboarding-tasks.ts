export type OnboardingStep = {
  id: string
  title: string
  body: string[]
  /** Path (+ query) where the target element lives, for the "take me there" fallback. */
  route: string
  /** Matches a data-tour="..." attribute in the DOM. Omit for text-only steps. */
  target?: string
  /** 'click' = clicking the real target completes the step. 'manual' = a Next button does. */
  advanceOn: 'click' | 'manual'
  /** If already on this path when the step activates, complete it without waiting for a click. */
  skipIfPath?: string
}

/** Client-admin onboarding tour. Order matters — steps unlock one at a time. */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'dashboard-nav',
    title: 'See your dashboard',
    route: '/admin',
    target: 'nav-dashboard',
    advanceOn: 'click',
    skipIfPath: '/admin',
    body: [
      'Stat cards jump straight to Events or Games.',
      'Recent events shows status and date at a glance.',
      'Quick links reach Games, Team, Settings and Support.',
    ],
  },
  {
    id: 'games-nav',
    title: 'Open Games',
    route: '/admin/games',
    target: 'nav-games',
    advanceOn: 'click',
    skipIfPath: '/admin/games',
    body: ['Your game library lives here — reuse the same game across multiple events.'],
  },
  {
    id: 'create-game',
    title: 'Create a game',
    route: '/admin/games',
    target: 'new-game-button',
    advanceOn: 'click',
    body: ['Click Create New Game to start building a challenge.'],
  },
  {
    id: 'game-types',
    title: 'Choose a game type',
    route: '/admin/games/new',
    target: 'game-type-picker',
    advanceOn: 'manual',
    body: [
      'Photo — teams submit a photo for the challenge.',
      'Video — same idea, video submissions.',
      'Text — a written answer or task.',
      'Quiz — multiple choice or open questions, scored automatically.',
      'Music Bingo — each team gets a 5×5 card from your music catalogue; clips play live and cards mark off as tracks are called.',
    ],
  },
  {
    id: 'events-nav',
    title: 'Open Events',
    route: '/admin/events',
    target: 'nav-events',
    advanceOn: 'click',
    skipIfPath: '/admin/events',
    body: ['Schedule and manage your live sessions here.'],
  },
  {
    id: 'create-event',
    title: 'Set up an event',
    route: '/admin/events',
    target: 'new-event-button',
    advanceOn: 'click',
    body: ['Click Create New Event, name it, set the date, and attach games.'],
  },
  {
    id: 'event-status',
    title: 'Event status — read this before your first event',
    route: '/admin/events',
    target: 'event-status-menu',
    advanceOn: 'manual',
    body: [
      'Draft and Ready are safe to edit freely — nothing is billed yet.',
      'Active makes the join and display links actually work for participants — this starts billing and is one-way (only Archived after).',
      'Participant links only work for 24 hours after activation, so activate shortly before the event starts, not days ahead.',
    ],
  },
  {
    id: 'org-settings-nav',
    title: 'Set up your organisation',
    route: '/admin/settings',
    target: 'nav-org-settings',
    advanceOn: 'click',
    skipIfPath: '/admin/settings',
    body: [
      'Profile — name, logo, brand colours and address.',
      'Tablet Password — the shared PIN for the tablet kiosk if you use score entry.',
    ],
  },
  {
    id: 'billing-tab',
    title: 'Billing & promo codes',
    route: '/admin/settings',
    target: 'settings-tab-billing',
    advanceOn: 'click',
    body: ['Click Billing to see your plan, invoices and promo codes.'],
  },
  {
    id: 'promo-code',
    title: 'Add a promo code',
    route: '/admin/settings?tab=billing',
    target: 'promo-code-input',
    advanceOn: 'manual',
    body: [
      'Enter a code here and click Add code.',
      'Event codes apply automatically on your next event activation; subscription codes apply to recurring billing.',
    ],
  },
  {
    id: 'support-nav',
    title: 'Reach out to support',
    route: '/admin/support',
    target: 'nav-support',
    advanceOn: 'click',
    skipIfPath: '/admin/support',
    body: ['Send us a message any time — we reply in the same thread.'],
  },
  {
    id: 'add-users',
    title: 'Add new users',
    route: '/admin/settings',
    target: 'add-user-button',
    advanceOn: 'click',
    body: [
      'Click Add user to give someone a name, email and role.',
      'They get a temporary password for their first login.',
    ],
  },
  {
    id: 'user-roles',
    title: 'Understand user roles',
    route: '/admin/settings',
    advanceOn: 'manual',
    body: [
      'Client Admin — full access: settings, billing, users, events and games.',
      'Event Manager — runs events and games day to day, no access to settings or billing.',
      'Facilitator — signs into one live event to run it from the facilitator panel, no admin access.',
    ],
  },
]
