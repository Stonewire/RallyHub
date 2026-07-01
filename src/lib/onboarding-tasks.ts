export type OnboardingTask = {
  id: string
  title: string
  route: string
  linkLabel: string
  bullets: string[]
}

/** Client-admin onboarding checklist. Order matters — shown top to bottom. */
export const ONBOARDING_TASKS: OnboardingTask[] = [
  {
    id: 'dashboard',
    title: 'See your dashboard',
    route: '/admin',
    linkLabel: 'Open Dashboard',
    bullets: [
      'The four stat cards (upcoming, live, total events, games) jump straight to Events or Games.',
      'Recent events shows status and date at a glance — click one to open it.',
      'Quick links get you to Games, Team, Settings and Support without using the sidebar.',
    ],
  },
  {
    id: 'create-game',
    title: 'Create a game',
    route: '/admin/games',
    linkLabel: 'Open Games',
    bullets: [
      'Click New Game, pick a type, and fill in the challenge details.',
      'Games live in your library so you can reuse the same one across multiple events.',
      'Drag games into groups to keep a large library organised.',
    ],
  },
  {
    id: 'game-types',
    title: 'Understand the game types',
    route: '/admin/games',
    linkLabel: 'Open Games',
    bullets: [
      'Photo — teams submit a photo for the challenge.',
      'Video — same idea, video submissions.',
      'Text — a written answer or task.',
      'Quiz — multiple choice or open questions, scored automatically.',
      'Music Bingo — each team gets a 5×5 card from your music catalogue; clips play live and cards mark off as tracks are called.',
    ],
  },
  {
    id: 'events',
    title: 'Set up an event',
    route: '/admin/events',
    linkLabel: 'Open Events',
    bullets: [
      'Click Create New Event, name it, set the date, and attach games.',
      'Drag event cards between status columns, or use the status menu on a card.',
      'Duplicate an event to reuse the same setup for a repeat booking.',
    ],
  },
  {
    id: 'event-status',
    title: 'Event status — read this before your first event',
    route: '/admin/events',
    linkLabel: 'Open Events',
    bullets: [
      'Draft and Ready are safe to edit freely — nothing is billed yet.',
      'Switch an event to Active to go live — this is what makes the join and display links actually work for participants.',
      'Activating is one-way and starts billing: once active, the event can only move to Archived. Duplicate it to run it again.',
      'Participant links only work for 24 hours after activation, so set the event Active shortly before it starts — not days in advance.',
    ],
  },
  {
    id: 'org-settings',
    title: 'Set up your organisation',
    route: '/admin/settings',
    linkLabel: 'Open Settings',
    bullets: [
      'Profile tab — name, logo, brand colours and address.',
      'Tablet Password — the shared PIN for the tablet kiosk if you use score entry.',
      'Billing tab — plan, invoices, and promo codes.',
    ],
  },
  {
    id: 'promo-codes',
    title: 'Add a promo code',
    route: '/admin/settings?tab=billing',
    linkLabel: 'Open Billing',
    bullets: [
      'Open Settings → Billing.',
      'Enter your code in Add a promo code and click Add code.',
      'Event codes apply automatically on your next event activation; subscription codes apply to recurring billing.',
    ],
  },
  {
    id: 'support',
    title: 'Reach out to support',
    route: '/admin/support',
    linkLabel: 'Open Support',
    bullets: [
      'Open Support from the sidebar to send us a message any time.',
      'We reply in the same thread, so check back here for updates.',
    ],
  },
  {
    id: 'add-users',
    title: 'Add new users',
    route: '/admin/settings',
    linkLabel: 'Open Settings',
    bullets: [
      'On the Profile tab, find the Team section and click Add user.',
      'Give them a name, email and role — they get a temporary password for their first login.',
      'Event managers see a simpler Team page for adding facilitators only.',
    ],
  },
  {
    id: 'user-roles',
    title: 'Understand user roles',
    route: '/admin/settings',
    linkLabel: 'Open Settings',
    bullets: [
      'Client Admin — full access: settings, billing, users, events and games.',
      'Event Manager — runs events and games day to day, no access to settings or billing.',
      'Facilitator — signs into one live event to run it from the facilitator panel, no admin access.',
    ],
  },
]
