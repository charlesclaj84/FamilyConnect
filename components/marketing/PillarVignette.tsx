import { Check, Clock, Search, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { T } from '@/lib/i18n/t'

/**
 * ── WHAT THIS REPLACED, AND WHY IT HAD TO GO ────────────────────────────────
 *
 * Three PNGs under `components/marketing/screenshots/`, described everywhere in the
 * tree as product screenshots. They were not. Every one of them was a placeholder
 * card — a title, the GENORRA lockup, a line of stock marketing prose, and the words
 * **COMING SOON** set in gold across the middle.
 *
 * So the strongest section of the catalogue — the three jobs the whole product is
 * sold on — was three large boxes announcing that Gatherings, the treasury and the
 * family tree were not built yet, on a page whose own heading three inches below
 * reads "Every card here is a screen that ships today". All three ship. A visitor
 * scanning that section learned the opposite of the truth, and it was the biggest,
 * most confidently-set thing on the page. The landing page carried the same three.
 *
 * The `alt` text made it worse rather than better: `finances.png` was announced to a
 * screen reader as "fund balances, dues collected against outstanding, and the
 * routing waterfall", none of which was in the image. A sighted visitor saw a
 * placeholder; a blind one was told a screenshot existed.
 *
 * ── WHY A DIAGRAM RATHER THAN A REAL CAPTURE ────────────────────────────────
 * A capture is better and is still worth doing — it needs a browser pointed at a
 * seeded family, which is a job with a login in it rather than a script. Until then
 * the choice is between a drawing that is honestly a drawing and a placeholder that
 * claims to be a photograph, and the drawing wins every time.
 *
 * These are deliberately SCHEMATIC. Rounded blocks, bars and initials — near enough
 * to the product to show the shape of the thing, far enough that nobody mistakes one
 * for a screenshot and nobody is disappointed on their first login.
 *
 * ── THE ONE RULE FOR EDITING THEM ───────────────────────────────────────────
 * **A vignette may only draw what its pillar's `bullets` already claim.** That is the
 * whole guard against this becoming the next `events.png`: the copy is reviewed, and
 * `npm run marketing:check` walks it against the registry, so a drawing that stays
 * inside the copy inherits both. A calendar strip is admissible because "the month
 * calendar, with every gathering on the days it actually runs" is a bullet. An RSVP
 * count would not be, and that is exactly how the last set died.
 *
 * NO CURRENCY FIGURES, for the same reason at one remove. A proportion is the fact
 * these pillars sell — this fund fills before that one — and a plausible-looking
 * total is a number somebody will quote back. The bars carry the argument without it.
 *
 * `aria-hidden` on all of it, with no `alt` and no label. Every fact each panel draws
 * is written out in the bullets immediately beside it, so announcing the drawing too
 * would read the section twice — and a decorative diagram that describes itself is
 * how alt text comes to make a claim nobody reviewed.
 *
 * ── ONE RENDERING AT TWO SIZES ──────────────────────────────────────────────
 * `/features` gives this about 34rem and the landing card about 22rem, and a single
 * fixed type scale cannot serve both: sized for the wide one it overflows the narrow
 * one, sized for the narrow one it is 9px type in a 550px panel. So the frame is a
 * `@container` and the panels step up one notch past 26rem.
 *
 * CONTAINER QUERIES RATHER THAN BREAKPOINTS, because the deciding width is the
 * PANEL's and not the window's: on `/features` this sits in a two-column row that
 * collapses at `lg`, so a viewport-keyed rule would jump to the large scale at the
 * exact moment the column got narrower. Two copies of the markup was the other
 * option, and two renderings of one thing is how a bullet added to one and not the
 * other stays invisible until somebody opens a phone.
 *
 * Animation is on `Reveal`'s `data-revealed` (see globals.css): the bars take their
 * measure as the panel arrives, once, and are pinned full under reduced motion.
 */

export type PillarVignetteKind = 'gatherings' | 'treasury' | 'family-record'

/**
 * 5:4. Both surfaces get the same ratio so the three landing cards start their copy
 * on one line — and so this can be swapped back for a real screenshot without either
 * layout moving.
 */
const FRAME =
  '@container relative aspect-[5/4] w-full overflow-hidden rounded-3xl border bg-card p-4 shadow-[var(--shadow-card)] @[26rem]:p-6'

export function PillarVignette({
  kind,
  t,
  className,
}: {
  kind: PillarVignetteKind
  /**
   * The reader's language, bound.
   *
   * ── A PROP, NOT `useMarketingT()`, AND THE REASON IS THE OTHER CALLER ────────────
   * Both call sites are Server Components — `/features` and `FeatureShowcase` — and the
   * second one's file opens by saying so: *"No 'use client'. This is data and markup — the
   * whole band renders on the server and ships no JS. Adding a hook or a handler here would
   * need the directive back."* A hook in HERE would put the directive back on that band by
   * the back door, and turn three drawings' worth of markup into shipped JavaScript.
   *
   * Passing it costs nothing: a function crossing a server-to-server boundary is passed by
   * reference and never serialized, and a missing prop is a type error. Same argument
   * `lib/i18n/server.ts` makes at length, and the same one `UpgradeScreen` rests on.
   *
   * `PlanningUpsell` went the other way on the same day and that is not an inconsistency —
   * ONE of its callers was already a client component, so the module was in the browser
   * bundle either way and `'use client'` cost nothing there. Here it would cost the whole
   * band.
   */
  t: T
  className?: string
}) {
  return (
    <div aria-hidden="true" className={cn(FRAME, className)}>
      {/* The same two atmospheric pools the marketing bands use, so a vignette reads
          as part of the site rather than as clip art dropped into it. */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-brand-legacy/10 blur-3xl" />
        <div className="absolute -bottom-14 -left-10 h-44 w-44 rounded-full bg-brand-accent/10 blur-3xl" />
      </div>
      {/* `justify-between` rather than a stack: the panels are shorter than the frame
          at the wide size, and spreading the three groups to the edges reads as a
          laid-out screen where a top-aligned stack reads as content that ran out. */}
      <div className="relative flex h-full flex-col justify-between">
        {kind === 'gatherings' && <Gatherings t={t} />}
        {kind === 'treasury' && <Treasury t={t} />}
        {kind === 'family-record' && <FamilyRecord t={t} />}
      </div>
    </div>
  )
}

/* ── Shared furniture ─────────────────────────────────────────────────────── */

/** The little header every panel opens with, so the three read as one set. */
function Caption({ children, meta }: { children: React.ReactNode; meta?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b pb-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-accent @[26rem]:text-xs">
        {children}
      </span>
      {meta && (
        <span className="shrink-0 text-[10px] text-muted-foreground @[26rem]:text-xs">{meta}</span>
      )}
    </div>
  )
}

/**
 * A measure filling from its baseline.
 *
 * `pct` is a width, never a colour — the two tones come from the tokens named in the
 * class, which is what keeps this file free of colour literals. The inner span carries
 * `gn-grow`, so the track stays put and only the fill moves.
 */
function Bar({ pct, tone, delay }: { pct: number; tone: string; delay: 1 | 2 | 3 | 4 }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted @[26rem]:h-2">
      <span
        className={cn('gn-grow block h-full rounded-full', `gn-grow-${delay}`, tone)}
        style={{ width: `${pct}%` }}
      />
    </span>
  )
}

/** Initials in a ring — the product's own avatar fallback, which is what a member
 *  without a photograph actually gets. */
function Initials({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold @[26rem]:size-7 @[26rem]:text-[10px]',
        tone,
      )}
    >
      {children}
    </span>
  )
}

const ROW = 'text-[11px] @[26rem]:text-sm'

/* ── 1. Gatherings ────────────────────────────────────────────────────────────
   Draws: a gathering spanning three days of a month strip, its steps held by named
   relatives with one still outstanding, and a budget line claimed against a fund.
   Every one of those four is a bullet on the pillar beside it. */
function Gatherings({ t }: { t: T }) {
  // Mon–Sun of the week the reunion runs. It goes Friday to Sunday, which is what
  // makes the calendar bullet's point: a three-day gathering fills three days rather
  // than sitting on one as a dot.
  //
  // ── THE DAY LETTERS ARE A KEY AND NOT `Intl`, WHICH IS UNUSUAL HERE ─────────────
  // AGENTS.md's rule is not to restate a fact the product derives, and weekday names are
  // derivable — `Intl.DateTimeFormat(intl, { weekday: 'narrow' })`. What it needs is a REAL
  // date, and this week is fabricated: the 11th to the 17th of no particular month of no
  // particular year, chosen so a three-day span reads as three days. Deriving would mean
  // inventing a date to derive FROM, which is a fact the drawing does not have.
  //
  // So it is one key holding seven comma-separated letters — `L,M,M,J,V,S,D` in Spanish and
  // French, which both start the week on Monday as this drawing does. A language starting on
  // Sunday would need the NUMBERS moved too, which is why the key is the whole row rather
  // than seven keys a translator could reorder into a week that does not match the dates.
  const DAYS = t('mkt.vignette.dayLetters').split(',').map((d, i) => ({ d, n: 11 + i }))
  const TASKS = [
    // The NAMES are people and are not translated — the same rule as the family names on the
    // quote cards, one level down. `who` is a first name in an illustration.
    { label: t('mkt.vignette.bookHall'), who: 'Marcus', done: true },
    { label: t('mkt.vignette.orderShirts'), who: 'Dee', done: true },
    { label: t('mkt.vignette.collectPhotos'), who: 'Aunt J', done: false },
  ]

  return (
    <>
      <div>
        {/* THE DATE RANGE IS COPY, for `DAYS`' reason above: there is no real date here to
            hand a formatter. `mkt.vignette.reunionDates` carries the whole range, so a
            language that writes the month first or the day first says so itself. */}
        <Caption meta={t('mkt.vignette.reunionDates')}>
          {t('mkt.vignette.reunionTitle')}
        </Caption>

        <div className="mt-3 @[26rem]:mt-4">
          <div className="grid grid-cols-7 gap-1 text-center text-[9px] text-muted-foreground @[26rem]:text-[10px]">
            {DAYS.map((day, i) => (
              <span key={i}>{day.d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {DAYS.map((day, i) => (
              <span
                key={i}
                className={cn(
                  'flex h-7 items-center justify-center rounded-md text-[9px] @[26rem]:h-10 @[26rem]:text-[11px]',
                  // The three days it runs are the ones that carry the gathering's
                  // colour; the rest of the week is an ordinary empty cell.
                  i >= 4
                    ? 'bg-brand-affirm/15 font-semibold text-foreground'
                    : 'bg-muted/70 text-muted-foreground',
                )}
              >
                {day.n}
              </span>
            ))}
          </div>
          {/* The span itself, laid under the three cells it covers — one bar rather
              than three chips, because "it runs ACROSS these days" is the fact. */}
          <div className="mt-1 grid grid-cols-7 gap-1">
            <span className="col-span-4" />
            <span className="gn-grow gn-grow-1 col-span-3 h-1.5 rounded-full bg-brand-affirm @[26rem]:h-2" />
          </div>
        </div>
      </div>

      <ul className="space-y-2 @[26rem]:space-y-3">
        {TASKS.map((task, i) => (
          <li key={task.label} className={cn('flex items-center gap-2.5', ROW)}>
            {task.done ? (
              <span
                className={cn(
                  'gn-pop inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-affirm text-brand-on-affirm @[26rem]:size-5',
                  `gn-pop-${(i + 1) as 1 | 2 | 3}`,
                )}
              >
                <Check className="size-2.5 @[26rem]:size-3" strokeWidth={3} />
              </span>
            ) : (
              // Outstanding, not failed. `--brand-withheld` is the token for a thing
              // the family has not done yet; `--destructive` would read as an error,
              // which a task with three weeks left on it is not.
              <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-brand-withheld/60 text-brand-withheld @[26rem]:size-5">
                <Clock className="size-2.5 @[26rem]:size-3" />
              </span>
            )}
            <span className={cn('truncate', task.done && 'text-muted-foreground line-through')}>
              {task.label}
            </span>
            <span className="ml-auto shrink-0 text-muted-foreground">{task.who}</span>
          </li>
        ))}
      </ul>

      <div>
        <div className="flex items-baseline justify-between text-[10px] text-muted-foreground @[26rem]:text-xs">
          <span>{t('mkt.vignette.budgetClaimed')}</span>
          <span>{t('mkt.vignette.reunionFund')}</span>
        </div>
        <div className="mt-1.5">
          <Bar pct={64} tone="bg-brand-primary" delay={3} />
        </div>
      </div>
    </>
  )
}

/* ── 2. Treasury ──────────────────────────────────────────────────────────────
   Draws: dues coming in against what is outstanding, and the routing waterfall —
   the reunion fund filling first, the next one following, the third still short.
   All three are bullets. */
function Treasury({ t }: { t: T }) {
  // FUND NAMES ARE TRANSLATED HERE AND WOULD NOT BE IN THE PRODUCT. A real family names its
  // own funds and nothing translates what they typed; these three are illustrative labels
  // standing in for what a family would write, so they read in the reader's language for the
  // same reason the drawing's other captions do.
  const FUNDS = [
    { name: t('mkt.vignette.reunionFund'), pct: 100, tone: 'bg-brand-affirm', full: true },
    { name: t('mkt.vignette.scholarshipFund'), pct: 58, tone: 'bg-brand-primary', full: false },
    { name: t('mkt.vignette.emergencyFund'), pct: 22, tone: 'bg-brand-warm', full: false },
  ] as const

  return (
    <>
      <div>
        <Caption meta={t('mkt.vignette.thisYear')}>
          {t('mkt.vignette.moneyWent')}
        </Caption>

        <div className="mt-3 @[26rem]:mt-5">
          <div className="flex items-baseline justify-between text-[10px] @[26rem]:text-xs">
            <span className="font-medium">{t('mkt.vignette.duesCollected')}</span>
            <span className="text-muted-foreground">{t('mkt.vignette.againstOutstanding')}</span>
          </div>
          <div className="mt-1.5">
            <Bar pct={72} tone="bg-brand-accent" delay={1} />
          </div>
        </div>
      </div>

      <div>
        <p className="text-[10px] text-muted-foreground @[26rem]:text-xs">
          {t('mkt.vignette.routed')}
        </p>
        <ul className="mt-2 space-y-2.5 @[26rem]:mt-3 @[26rem]:space-y-4">
          {FUNDS.map((fund, i) => (
            <li key={fund.name}>
              <div className={cn('flex items-center gap-2', ROW)}>
                <span className="truncate">{fund.name}</span>
                {fund.full && (
                  <span className="gn-pop gn-pop-1 ml-auto inline-flex size-4 items-center justify-center rounded-full bg-brand-affirm text-brand-on-affirm @[26rem]:size-5">
                    <Check className="size-2.5 @[26rem]:size-3" strokeWidth={3} />
                  </span>
                )}
              </div>
              <div className="mt-1">
                <Bar pct={fund.pct} tone={fund.tone} delay={(i + 2) as 2 | 3 | 4} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-2 border-t pt-3 text-[10px] text-muted-foreground @[26rem]:text-xs">
        <Wallet className="size-3.5 shrink-0 text-brand-accent @[26rem]:size-4" />
        <span>{t('mkt.vignette.oneLedger')}</span>
      </div>
    </>
  )
}

/* ── 3. The family record ─────────────────────────────────────────────────────
   Draws: three generations with a marriage across the middle, and a directory search
   that finds an accented name. Both are bullets, and the accent in "José" is the one
   the search bullet is specifically about.

   The connectors are borders on plain elements rather than an SVG path. The real
   canvas draws real edges; a diagram that tried to reproduce them at this size would
   be a smudge, and an SVG would need its own viewBox arithmetic to stay aligned as
   the container query changes every gap around it. */
function FamilyRecord({ t }: { t: T }) {
  const NODE =
    'flex items-center gap-1.5 truncate rounded-lg border bg-background px-2 py-1.5 text-[10px] @[26rem]:gap-2 @[26rem]:px-2.5 @[26rem]:py-2 @[26rem]:text-xs'
  const DROP = 'mx-auto block h-3.5 w-px bg-border @[26rem]:h-5'

  // ── EVERY ROW IS THE SAME TWO-COLUMN GRID, AND THAT IS THE WHOLE TRICK ──────
  // The first version laid each generation out as a flex row and centred a connector
  // under it, which is right only if the two nodes either side happen to be the same
  // width — and "Rosa" and "Manuel" are not, so the drop landed under Manuel and the
  // fork over the children sat left of both of them. In a fixed two-column grid every
  // node is exactly half the width, so a `mx-auto` rule inside a column lands on 25%
  // and 75% and a `mx-[25%]` rule spans precisely between them. The connectors are
  // then correct by construction rather than by a hand-tuned margin that a longer
  // name would break.
  return (
    <>
      <Caption meta={t('mkt.vignette.threeGenerations')}>
        {t('mkt.vignette.familyRecord')}
      </Caption>

      <div className="mx-auto w-full max-w-[15rem] @[26rem]:max-w-[19rem]">
        {/* Grandparents. The rule between them is the marriage. */}
        <div className="grid grid-cols-2 items-center gap-x-1.5 @[26rem]:gap-x-2">
          <span className={NODE}>
            <Initials tone="bg-brand-primary text-brand-on-primary">RA</Initials>
            Rosa
          </span>
          <span className={NODE}>
            <Initials tone="bg-brand-primary text-brand-on-primary">MA</Initials>
            Manuel
          </span>
        </div>
        <span className="mx-[25%] -mt-px block h-px bg-border" />

        <span className={cn('gn-grow gn-grow-1 origin-top', DROP)} />

        {/* Their son, and the wife who married in — the step-relationship bullet
            drawn rather than stated. */}
        <div className="grid grid-cols-2 items-center gap-x-1.5 @[26rem]:gap-x-2">
          <span className={NODE}>
            <Initials tone="bg-brand-warm text-brand-on-warm">JO</Initials>
            José
          </span>
          <span className={NODE}>
            <Initials tone="bg-brand-legacy text-brand-on-legacy">DE</Initials>
            Dee
          </span>
        </div>
        <span className="mx-[25%] -mt-px block h-px bg-border" />

        <span className={cn('gn-grow gn-grow-2 origin-top', DROP)} />

        {/* The fork over the two children: one rule from a quarter to three quarters,
            then a leg down the middle of each column. */}
        <span className="mx-[25%] block h-px bg-border" />
        <div className="grid grid-cols-2">
          <span className={DROP} />
          <span className={DROP} />
        </div>

        <div className="grid grid-cols-2 items-center gap-x-1.5 @[26rem]:gap-x-2">
          <span className={NODE}>
            <Initials tone="bg-brand-affirm text-brand-on-affirm">AM</Initials>
            Amara
          </span>
          <span className={NODE}>
            <Initials tone="bg-brand-affirm text-brand-on-affirm">TO</Initials>
            Tomás
          </span>
        </div>
      </div>

      {/* The directory, and the point of it: typing without the accent still finds the
          name that has one. */}
      <div className="flex items-center gap-2 rounded-xl border bg-background px-2.5 py-2 @[26rem]:px-3 @[26rem]:py-2.5">
        <Search className="size-3.5 shrink-0 text-muted-foreground @[26rem]:size-4" />
        <span className={cn('text-muted-foreground', ROW)}>jose</span>
        <span className={cn('ml-auto flex items-center gap-1.5', ROW)}>
          <Initials tone="bg-brand-warm text-brand-on-warm">JO</Initials>
          José
        </span>
      </div>
    </>
  )
}
