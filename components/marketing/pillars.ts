import type { LucideIcon } from 'lucide-react'
import type { StaticImageData } from 'next/image'
import { CalendarCheck, Wallet, Network } from 'lucide-react'

/**
 * The three jobs a family organization lives or dies on, defined ONCE.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
 * The landing page and `/features` were each carrying their own copy of these three
 * — same three jobs, same order, different words, different icons (Calendar vs
 * CalendarCheck, GitBranch vs Network) and different bullet counts (six vs four).
 * Two hand-maintained descriptions of one product is how a marketing site ends up
 * telling a visitor two things, and the visitor believes the weaker one.
 *
 * So the DATA lives here and the two pages differ only in how much of it they
 * render:
 *
 *   * the landing page takes `short` and the screenshot — a highlight,
 *   * `/features` takes `blurb` and `bullets` — the catalogue entry.
 *
 * Adding a pillar means adding it here, and both surfaces pick it up. Rewording
 * one cannot silently leave the other behind.
 *
 * ── `route` IS THE HONESTY MECHANISM, NOT A LINK ─────────────────────────────
 * Nothing navigates to it — `ACCOUNT_ROUTES` is deliberately just login and
 * register, so the public site never walks a visitor into `/coming-soon`. It is
 * here so both surfaces can ask `isFeatureFuture(route)` and badge themselves from
 * `lib/features.ts` rather than from somebody's memory of what shipped. Flip a
 * status in the registry and the marketing site corrects itself the same day.
 *
 * ── THE SCREENSHOTS ARE STATIC IMPORTS ───────────────────────────────────────
 * Not `/public` URL strings, and the difference is a bug this repo has already
 * shipped once: a string `src` that resolves to nothing renders an empty box in
 * silence, whereas a static import of a missing file fails `next build`. The
 * intrinsic width, height and blur placeholder come from the file too, so swapping
 * in a screenshot of a different shape needs no code change.
 *
 * They stay under `components/marketing/screenshots/` rather than `public/`:
 * AGENTS.md reserves `public/` for the three identity folders, and a static import
 * does not need to be there.
 */
import eventsShot from './screenshots/events.png'
import financesShot from './screenshots/finances.png'
import familyTreeShot from './screenshots/family-tree.png'

export interface Pillar {
  /** Route in `lib/features.ts` whose status decides the Coming Soon badge. Never linked. */
  route: string
  eyebrow: string
  title: string
  /** One sentence. The landing page's whole card. */
  short: string
  /** The fuller paragraph, for `/features`. */
  blurb: string
  /** `/features` only — the landing page deliberately shows none of these. */
  bullets: readonly string[]
  icon: LucideIcon
  /** Icon colour. Must clear 3:1 on a card in both themes. */
  tone: string
  /** The wash behind the icon. */
  chip: string
  image: StaticImageData
  /** What the screenshot SHOWS. The title is already on the page, so it does not repeat it. */
  imageAlt: string
}

export const PILLARS: readonly Pillar[] = [
  {
    route: '/events',
    eyebrow: 'Plan it all',
    title: 'Reunions that run themselves',
    short:
      'Save-the-dates, RSVPs by household and day-of check-in — the whole gathering in one place, with nobody chasing a spreadsheet the week before.',
    blurb:
      'From the first save-the-date to day-of check-in, the whole gathering lives in one place — and nobody is chasing a spreadsheet the week before.',
    bullets: [
      'Multi-day itineraries with nested sub-events',
      'Hotel room blocks with price estimates and booking deadlines',
      'RSVP for a whole household in one tap, not one email thread per family',
      'T-shirt sizes and meal counts totalled for you',
      'Day-of check-in, so you know who actually walked in',
      'Per-event budgets: line items against what was really spent',
    ],
    icon: CalendarCheck,
    tone: 'text-brand-affirm',
    chip: 'bg-brand-affirm/15',
    image: eventsShot,
    imageAlt:
      'The events screen: a multi-day reunion itinerary with its sub-events, RSVP counts and day-of check-in.',
  },
  {
    route: '/family-finances',
    eyebrow: 'Money, handled',
    title: 'A real treasury, not a shoebox',
    short:
      'Dues your members can actually afford, every dollar routed to the right fund automatically, and a profit and loss your treasurer can hand to the board.',
    blurb:
      'Collect dues your members can actually afford, route every dollar to the right fund automatically, and answer "where did the money go" with a report instead of an argument.',
    bullets: [
      'Dues at any cadence, with installment plans members can keep up with',
      'Automatic routing: the reunion fund fills first, the college fund follows',
      'Minimum-balance waterfalls, so no fund is quietly left short',
      'Contributions and disbursements on one full ledger',
      'Fund balances that update the moment dues come in',
      'A profit and loss your treasurer can hand to the board',
    ],
    icon: Wallet,
    tone: 'text-brand-accent',
    chip: 'bg-brand-accent/12',
    image: financesShot,
    imageAlt:
      'The finances screen: fund balances, dues collected against outstanding, and the routing waterfall that fills each fund in priority order.',
  },
  {
    route: '/family-tree',
    eyebrow: 'Know your family',
    title: 'The family record, kept properly',
    short:
      'The tree, the lineage and the directory — one living record the whole family maintains, rather than one exhausted historian.',
    blurb:
      'Who is related to whom, how to reach them, and the lineage that ties every branch together — maintained by the family rather than by one exhausted historian.',
    bullets: [
      'A multi-generation tree: parents, grandparents, children and spouses',
      'Step-relationships and ex-partners handled gracefully',
      'Direct lineage view, for tracing one line all the way back',
      'Add your children, and convert them to members when they grow up',
      'Profiles the family maintains: contact details, birthdays, t-shirt sizes',
      'A directory with search that handles real names — accents and all',
    ],
    icon: Network,
    // Ink, not Legacy gold. Gold is 2.30 on a card and an icon carrying meaning
    // needs 3:1 — gold is the WASH here, never the foreground.
    tone: 'text-brand-ink',
    chip: 'bg-brand-legacy/20',
    image: familyTreeShot,
    imageAlt:
      'The family tree screen: several generations laid out as connected cards, with spouses and children branching from each couple.',
  },
]
