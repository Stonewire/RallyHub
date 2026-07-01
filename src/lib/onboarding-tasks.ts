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

/**
 * Client-admin onboarding tour, ordered like a real working session:
 * dashboard → org settings (profile, users, billing, promo codes) → games
 * (create a real test game) → events (create a real test event) → support.
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'dashboard',
    title: 'Your dashboard',
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
    id: 'org-settings-nav',
    title: 'Open Org Settings',
    route: '/admin/settings',
    target: 'nav-org-settings',
    advanceOn: 'click',
    skipIfPath: '/admin/settings',
    body: ['Start by setting up your organisation — this is what participants see on screen.'],
  },
  {
    id: 'org-profile',
    title: 'Your organisation profile',
    route: '/admin/settings',
    target: 'org-profile-form',
    advanceOn: 'manual',
    body: [
      'Name, logo and brand colours appear on join screens and displays.',
      'Company details and VAT go on your invoices.',
      'Tablet Password is the shared PIN for the tablet kiosk if you use score entry.',
    ],
  },
  {
    id: 'team-users',
    title: 'Team and users',
    route: '/admin/settings',
    target: 'add-user-button',
    advanceOn: 'manual',
    body: [
      'Add user creates an account with a temporary password for their first login.',
      'Client Admin — full access including settings and billing.',
      'Event Manager — runs events and games, no settings or billing.',
      'Facilitator — signs into one live event to run it, no admin access.',
    ],
  },
  {
    id: 'billing-tab',
    title: 'Open Billing',
    route: '/admin/settings',
    target: 'settings-tab-billing',
    advanceOn: 'click',
    body: ['Click the Billing tab to see your plan, invoices and promo codes.'],
  },
  {
    id: 'billing-plan',
    title: 'Your current plan',
    route: '/admin/settings?tab=billing',
    target: 'billing-plan',
    advanceOn: 'manual',
    body: [
      'Shows your plan, billing period and what each event activation costs.',
      'Plan changes will be available here once online billing is enabled.',
    ],
  },
  {
    id: 'billing-unpaid',
    title: 'Unpaid events',
    route: '/admin/settings?tab=billing',
    target: 'billing-unpaid',
    advanceOn: 'manual',
    body: [
      'Every event you activate creates an invoice that lands here until paid.',
      'Online payment arrives with the Stripe integration.',
    ],
  },
  {
    id: 'billing-history',
    title: 'Payment history',
    route: '/admin/settings?tab=billing',
    target: 'billing-history',
    advanceOn: 'manual',
    body: ['Paid and comped event invoices, most recent first.'],
  },
  {
    id: 'billing-subscription',
    title: 'Subscription',
    route: '/admin/settings?tab=billing',
    target: 'billing-subscription',
    advanceOn: 'manual',
    body: [
      'Your recurring plan fee — separate from the per-event charges above.',
    ],
  },
  {
    id: 'promo-codes',
    title: 'Promo codes',
    route: '/admin/settings?tab=billing',
    target: 'promo-code-input',
    advanceOn: 'manual',
    body: [
      'Got a code? Enter it here and click Add code — nothing to add right now.',
      'Event codes apply automatically on your next event activation; subscription codes on recurring billing.',
    ],
  },
  {
    id: 'games-nav',
    title: 'Open Games',
    route: '/admin/games',
    target: 'nav-games',
    advanceOn: 'click',
    skipIfPath: '/admin/games',
    body: ['Your game library — build a game once, reuse it across events.'],
  },
  {
    id: 'create-game',
    title: 'Create a test game',
    route: '/admin/games',
    target: 'new-game-button',
    advanceOn: 'click',
    body: ["Let's build one for real. Click Create New Game."],
  },
  {
    id: 'game-types',
    title: 'Pick a game type',
    route: '/admin/games/new',
    target: 'game-type-picker',
    advanceOn: 'click',
    body: [
      'Photo — teams submit a photo for the challenge.',
      'Video — same idea, video submissions.',
      'Text — a written answer or task.',
      'Quiz — multiple choice questions, scored automatically.',
      'Music Bingo — each team gets a 5×5 card from your music catalogue; clips play live.',
      'Pick Photo to keep the test simple — click a type to continue.',
    ],
  },
  {
    id: 'save-game',
    title: 'Fill it in and save',
    route: '/admin/games/new',
    target: 'form-save-button',
    advanceOn: 'click',
    body: [
      'Give it a name like "Test game", a short description, and set the points.',
      'Hit Save when you are done — it lands in your library.',
    ],
  },
  {
    id: 'events-nav',
    title: 'Open Events',
    route: '/admin/events',
    target: 'nav-events',
    advanceOn: 'click',
    skipIfPath: '/admin/events',
    body: ['Events are the live sessions your teams join.'],
  },
  {
    id: 'create-event',
    title: 'Create a test event',
    route: '/admin/events',
    target: 'new-event-button',
    advanceOn: 'click',
    body: ['Click Create New Event to set one up.'],
  },
  {
    id: 'save-event',
    title: 'Set it up and create',
    route: '/admin/events/new',
    target: 'form-save-button',
    advanceOn: 'click',
    body: [
      'Name it "Test event", pick a date, and attach the test game you just made.',
      'Click Create Event at the bottom when ready.',
    ],
  },
  {
    id: 'event-status',
    title: 'Event status — read this before your first real event',
    route: '/admin/events',
    target: 'event-status-menu',
    advanceOn: 'manual',
    body: [
      'Draft and Ready are safe to edit freely — nothing is billed yet.',
      'Active makes the join and display links work for participants — it starts billing and is one-way (only Archived after).',
      'Participant links only work for 24 hours after activation, so activate shortly before the event starts, not days ahead.',
      'Feel free to delete the test event afterwards — it is a draft, so nothing is billed.',
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
]
