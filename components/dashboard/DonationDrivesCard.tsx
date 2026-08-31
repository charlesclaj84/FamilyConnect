import Link from 'next/link'
import { Check, HeartHandshake } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency-utils'
import { formatDate } from '@/lib/date-utils'
import type { DonationSummary } from '@/app/actions/dues'
import type { T } from '@/lib/i18n/t'

/**
 * The family's open donation drives, on the Dashboard.
 *
 * ── WHY IT IS HERE AND NOT ONLY ON MY SUMMARY ───────────────────────────────────────
 * A drive is the one thing in Accounting that asks the family for something it has not
 * already agreed to. Dues are owed and will be chased; a gift is offered, once, inside a
 * window that closes — and it lived exclusively behind Summary → Donations, which is two
 * clicks and a rail item away from the screen every member lands on. A drive nobody sees
 * is a drive nobody gives to, and unlike a due there is no second reminder.
 *
 * ── ONLY OPEN DRIVES, AND THAT IS THE WHOLE FILTER ──────────────────────────────────
 * A closed drive is history: its bar cannot move and the card would be asking for money
 * that can no longer be given. `DonationSummary.closed` is computed on the server against
 * one `today` — the same one every drive on the page is measured against — so two drives
 * cannot disagree about what day it is. Closed drives stay on My Summary, where the pane
 * is a record as well as an ask.
 *
 * ── IT DISAPPEARS WHEN THERE IS NOTHING TO SAY ──────────────────────────────────────
 * Unlike `FamilyTreeCard`, which renders for an empty tree on purpose because "no tree
 * yet" is the answer that most needs giving. There is no equivalent here: a family with
 * no drive open is not a family that has forgotten to run one, and a permanent "no
 * donation drives" panel would be a card that is empty for most families most of the
 * time.
 *
 * ── THREE, THEN A COUNT ─────────────────────────────────────────────────────────────
 * This shares a row with the dues balance inside At a Glance, so it has about half the wide
 * column, and a family may have any number of drives. Three is what fits without the card
 * becoming the page; the rest are named as a number with the way to reach them, never silently
 * dropped — the same rule `PersonMultiSelect`'s overflow count follows, and for the same
 * reason: a list that stops while LOOKING complete is how somebody concludes a drive does not
 * exist.
 *
 * ── ITS CHROME MATCHES `DuesBalanceKpi`, WHICH IS NOW BESIDE IT ─────────────────────
 * `rounded-2xl border bg-card p-5` and no shadow, because the two are one pair inside one
 * panel since 2026-08-22. It was a `rounded-3xl` card with `--shadow-card`, which was right
 * while it stood alone in the narrow column and reads as a mismatched pane the moment it has a
 * neighbour: two cards of one row with different corners and one of them floating.
 *
 * ── THE GATE IS NOT HERE ────────────────────────────────────────────────────────────
 * `donations` arrives already fetched under `donations:view` and only
 * when that feature is live — AGENTS.md §5, like every other panel on this page. A
 * `canSee` prop would be the wrong shape: the check belongs above the page's
 * `Promise.all`, where the query can be skipped rather than the result hidden.
 *
 * ── PRIVACY IS INHERITED, NOT RE-STATED ─────────────────────────────────────────────
 * Every figure below is either a family total or the reader's own; `getDonationProgress`
 * sums the rows inside itself and only the sums cross the boundary. A drive the reader
 * is a beneficiary of never reaches this component at all — the restrictive policies from
 * 20260811000000 refuse the schedule row, so there is no filtering to forget here.
 */
export function DonationDrivesCard({ donations, t, intl }: {
  /** The reader's `Intl` tag. A prop — this is a Server Component. */
  intl: string
  donations: DonationSummary[]
  /**
   * The reader's language, bound. Threaded from the page rather than resolved here: a
   * Server Component cannot read `LocaleProvider` and has no `user` of its own. See
   * `lib/i18n/server.ts`.
   */
  t: T
}) {
  // Soonest to close first, then the ones with no end date at all. A drive with a
  // deadline is the one worth acting on today, which is the whole reason this card is on
  // the landing screen rather than only on Donations.
  const open = donations
    .filter(d => !d.closed)
    .sort((a, b) => {
      const aEnd = a.schedule.end_date ?? '9999-12-31'
      const bEnd = b.schedule.end_date ?? '9999-12-31'
      return aEnd.localeCompare(bEnd) || a.schedule.label.localeCompare(b.schedule.label)
    })

  if (open.length === 0) return null

  const shown = open.slice(0, 3)
  const hidden = open.length - shown.length

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg">
        <HeartHandshake className="h-4 w-4 text-brand-accent" aria-hidden="true" />
        {t('dash.donations.title')}
      </h2>

      <ul className="space-y-4">
        {shown.map(d => <DriveRow key={d.schedule.id} donation={d} t={t} intl={intl} />)}
          intl={intl}
          intl={intl}
      </ul>

      {hidden > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t(hidden === 1 ? 'drives.moreOpenOne' : 'drives.moreOpenMany',
            { n: String(hidden) })}
        </p>
      )}

      <Link
        href="/accounting/dues-and-donations?pane=donations"
        className={cn(
          buttonVariants({ size: 'sm', variant: 'secondary' }),
          'mt-4 w-full justify-center',
        )}
      >
        {t('dash.donations.view')}
      </Link>
    </section>
  )
}

/**
 * One drive: what it is, how far the family has got, and what the reader has given.
 *
 * The three facts are on separate lines rather than run together, because this card is around
 * 20rem wide at `lg` — half the wide column, sharing its row with the balance — and a drive
 * called "Martha's Medical Fund" plus two currency amounts does not fit on one. The name gets
 * the line it needs; the figures share the next.
 */
function DriveRow({ donation: d, t, intl }: {
  /** The reader's `Intl` tag. A prop — this is a Server Component. */
  intl: string
  donation: DonationSummary
  /** Threaded one more hop, for the same reason the card takes it. */
  t: T
}) {
  const { schedule, goalCents, raisedCents, myGivenCents, progressPercent, goalMet } = d

  return (
    <li className="space-y-1.5">
      <p className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium" title={schedule.label}>
          {schedule.label}
        </span>
        {goalMet && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-affirm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-on-affirm">
            <Check className="h-3 w-3" aria-hidden="true" /> {t('dash.donations.met')}
          </span>
        )}
      </p>

      {/* Only where there is a goal to draw against. A drive with none reports its total
          in words below instead of a bar with an invented denominator. */}
      {goalCents != null && goalCents > 0 && (
        <GoalBar goalCents={goalCents} raisedCents={raisedCents} />
      )}

      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{formatCurrency(raisedCents, intl)}</span>
        {goalCents != null && goalCents > 0
          ? ` of ${formatCurrency(goalCents, intl)} · ${progressPercent}%`
          : ' raised'}
        {myGivenCents > 0
          && ` · ${t('drives.fromYou', {
            amount: formatCurrency(myGivenCents, intl),
          })}`}
      </p>

      {/* THE DEADLINE, and only when there is one. It is the fact that makes this urgent
          rather than informational, and it is the reason the list is sorted by it. */}
      {schedule.end_date && (
        <p className="text-xs text-muted-foreground">closes {formatDate(schedule.end_date, intl)}</p>
      )}
    </li>
  )
}

/**
 * A bar that keeps going past the goal — the same rule, and the same reasoning, as
 * `components/account/DonationsSection.tsx`.
 *
 * Under the goal the track IS the goal. Once it is passed the track rescales to the
 * amount raised, so the fill spans the full width and the goal moves inward to wherever
 * it now falls: the solid segment is everything up to the target, the lighter one is the
 * excess. Clamping at 100% would draw a drive that doubled its goal exactly like one that
 * scraped in, which is the opposite of what a fundraiser wants to see.
 *
 * `aria-hidden`, because the same numbers are stated in the line directly beneath it and
 * a `progressbar` role cannot honestly report a value above its own maximum.
 *
 * DELIBERATELY A SECOND COPY of that component's `GoalBar` rather than an import: that
 * one lives beside My Summary's row and is a private detail of it, and hoisting a
 * fourteen-line presentational helper into a shared module to save fourteen lines would
 * bind two screens' layouts together for nothing. If a third one appears, it is worth
 * moving — two is not.
 */
function GoalBar({ goalCents, raisedCents }: { goalCents: number; raisedCents: number }) {
  const over = raisedCents > goalCents
  const goalWidth = over
    ? (goalCents / raisedCents) * 100
    : Math.max(0, (raisedCents / goalCents) * 100)

  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <div
        className={cn('h-full', raisedCents >= goalCents ? 'bg-brand-affirm' : 'bg-primary')}
        style={{ width: `${goalWidth}%` }}
      />
      {over && <div className="h-full bg-brand-affirm/50" style={{ width: `${100 - goalWidth}%` }} />}
    </div>
  )
}
