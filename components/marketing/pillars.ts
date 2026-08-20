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
// ⚠ THE PIXELS IN THIS FILE ARE OF A SCREEN THAT NO LONGER EXISTS.
//
// `events.png` was captured from `/events`, which is deleted (2026-08-19) — it shows a
// multi-day itinerary with RSVP counts, none of which is in the product. It is still here
// because a `Pillar` must have an `image` (`next/image` reads the intrinsic size and the blur
// placeholder from the file, and a missing path fails `next build` rather than rendering an
// empty box), and because a screenshot cannot be re-captured from a script — it needs a
// browser, and Playwright is not a dependency of this repo.
//
// SO THE `imageAlt` BELOW IS DELIBERATELY GENERIC. An alt that named RSVPs would describe the
// image and advertise a feature we do not have; one that named tasks and assignees would
// advertise the right feature and describe the wrong image. Neither is acceptable, so it says
// only what is true of both.
//
// TO FIX IT: open `/gatherings/<id>` on a seeded family, capture at the same width as the
// other two shots, and replace this file. TODO.md carries the item.
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
  // THIS PILLAR SOLD THE EVENTS PRODUCT UNTIL 2026-08-19 — save-the-dates, hotel room blocks,
  // RSVPs by household, day-of check-in — and every one of those screens is now deleted. A
  // marketing page selling a feature by name that the product does not have is the failure
  // FutureFeature.md is largely a record of, so the copy is what Gatherings actually does:
  // a template, a gathering scheduled from it, a named relative holding each step, and an
  // organizer accepting the answer or handing it back.
  //
  // `route` IS LOAD-BEARING AND IS NOT DECORATION: `FeatureShowcase` and `/features` both
  // call `isFeatureFuture(pillar.route)` on it to decide whether to draw a Coming Soon badge,
  // and it is the React key. Left as `/events` it would resolve against a registry entry that
  // no longer exists.
  {
    route: '/gatherings',
    eyebrow: 'Plan it all',
    title: 'Reunions that run themselves',
    short:
      'Build the reunion from a checklist, hand every step to the relative who owns it, and see at a glance what has come back — with nobody chasing a spreadsheet the week before.',
    blurb:
      'A gathering is more than a date. Author the checklist once, schedule the reunion from it, and every step becomes somebody’s job with a due date against it.',
    bullets: [
      'Reusable templates: the checklist your family runs every year, written once',
      'Every step assigned to a named relative, with a due date',
      'Answers come back to an organizer, who accepts them or sends them back with notes',
      'A budget drawn on a real fund, with each task claiming its own line',
      'One gathering flagged premier, across the top of everyone’s dashboard',
      'The month calendar, with every gathering on the days it actually runs',
    ],
    icon: CalendarCheck,
    tone: 'text-brand-affirm',
    chip: 'bg-brand-affirm/15',
    image: eventsShot,
    // Generic on purpose — see the warning above the import. Do not make this specific until
    // the screenshot itself has been re-captured.
    imageAlt:
      'A planning screen in the product, showing one gathering laid out with its details.',
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
      'The Family Tree and the directory — one living record the whole family maintains, rather than one exhausted historian.',
    blurb:
      'Who is related to whom, how to reach them, and every branch traced back through the generations — maintained by the family rather than by one exhausted historian.',
    // ── "LINEAGE" AND "DIRECT LINEAGE" ARE NOT PRODUCT WORDS, AND MUST NOT COME BACK ──
    // This pillar sold a "Direct lineage view" and "convert them to members" until
    // 2026-08-19, and both named `/direct-lineage`, which was DELETED on 2026-08-13 (a
    // child is a person — AGENTS.md §4b). Nothing caught it for six days and nothing
    // could: the Coming Soon pill is derived per ROUTE from `isFeatureFuture()`, and a
    // route that has been deleted is not 'future', it is absent — so `getFeature()` finds
    // nothing, there is nothing to badge, and the bullet read as shipped.
    //
    // The screen that replaced both is `/family-tree`, and the words below are ITS words.
    // Tracing one line back is the tree's focus canvas plus its Bloodline toggle — but
    // "Bloodline" is an in-canvas control, not a thing to sell a family, so the bullet
    // names the outcome and leaves the control unnamed. Recording a relative with no
    // address and inviting them later are two ordinary things the tree does, not a
    // separate kind of person with a conversion step.
    bullets: [
      'A multi-generation tree: parents, grandparents, children and spouses',
      'Step-relationships and ex-partners handled gracefully',
      'Trace any branch back through the generations, one click at a time',
      'Record a relative who has no email yet, and invite them when they do',
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
