import type { LucideIcon } from 'lucide-react'
import type { PillarVignetteKind } from '@/components/marketing/PillarVignette'
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
 * ── THE ARTWORK IS DRAWN, NOT PHOTOGRAPHED ───────────────────────────────────
 * `vignette` names a panel in `components/marketing/PillarVignette.tsx`, which draws
 * the SHAPE of the job in tokens: a gathering spanning three days of a month strip,
 * the routing waterfall filling one fund before the next, three generations with a
 * marriage across the middle.
 *
 * IT REPLACED THREE PNGs THAT WERE NOT SCREENSHOTS. Every comment in this file, and
 * two on the pages that rendered them, described `events.png`, `finances.png` and
 * `family-tree.png` as product captures. All three were placeholder cards: a title,
 * the lockup, a line of stock prose, and **COMING SOON** in gold across the middle.
 * So the three flagship capabilities were each announced as unbuilt, in the largest
 * type on the catalogue, on a page that says in words three inches below that every
 * screen on it ships today. See that component's header for the rest, including what
 * the `alt` text was telling a screen reader in the meantime.
 *
 * A REAL CAPTURE IS STILL BETTER and is still owed — it needs a browser pointed at a
 * seeded family. When one arrives, this field becomes a static import again and the
 * vignette is deleted; the reason it was a static import and never a `/public` URL
 * string is worth keeping for that day, because the repo has shipped the bug once: a
 * string `src` that resolves to nothing renders an empty box in silence, whereas a
 * static import of a missing file fails `next build`.
 */

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
  /**
   * Which panel `PillarVignette` draws beside this pillar.
   *
   * THERE IS NO `imageAlt` ANY MORE, and its absence is a decision rather than an
   * omission. The vignette is `aria-hidden`: every fact it draws is written out in
   * `bullets` immediately beside it, so describing the drawing as well would read the
   * section twice — and the field it replaces is the one that told a screen reader
   * about "fund balances, dues collected against outstanding, and the routing
   * waterfall" in an image that contained none of them.
   */
  vignette: PillarVignetteKind
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
    vignette: 'gatherings',
  },
  {
    route: '/reporting/pl-summary',
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
    vignette: 'treasury',
  },
  {
    route: '/community/family-tree',
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
    // The screen that replaced both is `/community/family-tree`, and the words below are ITS words.
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
    vignette: 'family-record',
  },
]
