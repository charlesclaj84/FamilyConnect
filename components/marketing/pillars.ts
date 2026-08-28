import type { LucideIcon } from 'lucide-react'
import type { PillarVignetteKind } from '@/components/marketing/PillarVignette'
import { CalendarCheck, Wallet, Network } from 'lucide-react'
import { type T } from '@/lib/i18n/t'

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
 *
 * ── THE COPY IS A FUNCTION OF `t` AND THE REST OF THE ROW IS NOT ─────────────────
 * `pillars(t)` since the public site learned Spanish and French. What moved into the
 * catalogue is the eyebrow, the title, the two blurbs and the six bullets; what stayed
 * here is everything the reader does not read — the `route` this file's own header calls
 * the honesty mechanism, the icon, the two colour tokens and the vignette name.
 *
 * That division is the reason this conversion is safe. The whole argument above is that
 * ONE definition feeds two surfaces so they cannot drift; keying the words does not
 * weaken it, because both surfaces still call this one function and the catalogue is
 * itself gated — `i18n:check` reports a Spanish bullet by name once its English source
 * has been edited, which is a stronger guarantee than the original comment could make.
 *
 * The bullets are `mkt.pillar.<i>.b<n>`, indexed rather than named. Six bullets per
 * pillar, and the count is a constant here so a seventh is one number and one entry
 * rather than an edit in three catalogues that could each be forgotten differently.
 */

/** How many bullets each pillar carries on `/features`. See the header. */
const BULLETS_PER_PILLAR = 6

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

/**
 * The three pillars, in the reader's language.
 *
 * The order is the sales order and is deliberate: what you plan, what it costs, who your
 * family is. Both surfaces render them in this order and neither sorts.
 */
export function pillars(t: T): readonly Pillar[] {
  return SHAPES.map((shape, i) => ({
    ...shape,
    eyebrow: t(`mkt.pillar.${i}.eyebrow`),
    title: t(`mkt.pillar.${i}.title`),
    short: t(`mkt.pillar.${i}.short`),
    blurb: t(`mkt.pillar.${i}.blurb`),
    bullets: Array.from({ length: BULLETS_PER_PILLAR }, (_, n) =>
      t(`mkt.pillar.${i}.b${n}`)),
  }))
}

/**
 * Everything about a pillar the reader does not read.
 *
 * ── `route` IS STILL THE HONESTY MECHANISM ──────────────────────────────────────
 * `/gatherings`, not `/events`. That entry was renamed when Events was retired, and the
 * comment it replaced is worth keeping: both surfaces call `isFeatureFuture(pillar.route)`
 * to decide whether to draw a Coming Soon badge, and it is the React key. Left as
 * `/events` it would resolve against a registry entry that no longer exists — which is not
 * an error, it is a card that silently claims to have shipped.
 */
const SHAPES: readonly Omit<Pillar, 'eyebrow' | 'title' | 'short' | 'blurb' | 'bullets'>[] = [
  {
    route: '/gatherings',
    icon: CalendarCheck,
    tone: 'text-brand-affirm',
    chip: 'bg-brand-affirm/15',
    vignette: 'gatherings',
  },
  {
    route: '/reporting/pl-summary',
    icon: Wallet,
    tone: 'text-brand-accent',
    chip: 'bg-brand-accent/12',
    vignette: 'treasury',
  },
  {
    route: '/community/family-tree',
    icon: Network,
    // Ink, not Legacy gold. Gold is 2.30 on a card and an icon carrying meaning
    // needs 3:1 — gold is the WASH here, never the foreground.
    tone: 'text-brand-ink',
    chip: 'bg-brand-legacy/20',
    vignette: 'family-record',
  },
]
