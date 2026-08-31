import { Check } from 'lucide-react'
import { GiveButton } from '@/components/account/GiveButton'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency-utils'
import { formatDate } from '@/lib/date-utils'
import type { DonationSummary } from '@/app/actions/dues'
import { type T } from '@/lib/i18n/t'

/**
 * The family's donation drives and how far the FAMILY has got toward each goal.
 *
 * NO HOOKS AND NO HANDLERS, which is what lets it render from either side of the client
 * boundary — [Summary](/accounting/summary) is a server component and the Dues & Donations
 * shell is `'use client'`, and both render this. The one interactive thing on a drive lives
 * in `GiveButton`, a client leaf, for exactly that reason; the property is the same one
 * `NextInstallmentsCard` is built around.
 *
 * Deliberately NOT modelled on the dues tables beside it. No installment, no next-due
 * date, no remaining balance, none of the attention colouring that marks money owed —
 * a goal not yet reached is not a debt, and framing it that way would turn an
 * invitation into a bill. Hence a progress bar: it reads as "how far along" rather than
 * "how much you are short".
 *
 * ── GIVING BY CARD IS REAL SINCE 2026-08-26, AND IS STILL NOT A DUE ────────────────
 * `Give` was a disabled span saying "coming soon" while only dues could be paid. It opens a
 * real checkout now — and the differences from the dues flow are deliberate rather than
 * unfinished: one drive at a time, no ceiling on the amount, and NO recurring option. See
 * `startDonationCheckout`, which argues each of the three.
 *
 * Every figure shown is either a family total or the reader's own. Nothing here
 * identifies another member's giving.
 *
 * TWO CALLERS SINCE 20260815000000, and neither passes the same list. [Donations](/donations)
 * hands it every drive, open and closed, because that screen is the full record;
 * [Summary](/account-summary) filters to the open ones and states the count of the rest,
 * because a digest is about what to do next. The filtering is the caller's job — this
 * component renders the drives it is given and takes no view on which they should be.
 *
 * Renders nothing at all on an empty list, which is right for a section inside a larger
 * page and NOT enough for a screen of its own: /donations answers that case itself,
 * because a blank page under a heading reads as something that failed to load.
 *
 * No card header and no card: whatever heading is above it names it, and a bordered
 * panel wrapping a list of already-bordered rows was a box inside a box. Each DRIVE
 * keeps its own border — that separates one drive from the next, which is a different
 * job from fencing off the list.
 */
export function DonationsSection({ donations, chargesReady = false, intl, t }: {
  /** The reader's `Intl` tag. A prop — this is a Server Component. */
  intl: string
  /**
   * The reader's translator. A PROP for the same reason `intl` beside it is one, and this
   * component SHIPPED with `useT()` in its body instead — a client hook in a module with no
   * `'use client'`, which throws *"Attempted to call useT() from the server"* and renders the
   * error boundary over the whole page. `npm run audit:client-hooks` is the gate.
   */
  t: T
  donations: DonationSummary[]
  /**
   * The family has a connected card processor whose card payments are active.
   *
   * DEFAULTS TO FALSE, so a caller that has not resolved it renders the screen it had
   * before rather than a button that fails at the till. Both callers pass it today; the
   * default is what makes adding a third caller safe rather than silently broken.
   */
  chargesReady?: boolean
}) {
  if (donations.length === 0) return null

  return (
    <div className="space-y-4">
      {donations.map(d => (
        <DonationRow key={d.schedule.id} donation={d} chargesReady={chargesReady} intl={intl} t={t} />
      ))}
    </div>
  )
}

/**
 * One drive: what it is, the window it runs in, and the family's progress to its goal.
 */
function DonationRow({ donation: d, chargesReady, intl, t }: {
  /** The reader's `Intl` tag. A prop — this is a Server Component. */
  intl: string
  /** The translator, threaded from the section above. See its prop for why it is not a hook. */
  t: T
  donation: DonationSummary
  chargesReady: boolean
}) {
  const { schedule, goalCents, raisedCents, myGivenCents, progressPercent, goalMet, closed } = d
  // What would meet the goal, or null when there is no goal or it is already met. Context
  // for the giver, never a proposed amount — see `GiveButton`.
  const toGoalCents = goalCents && goalCents > raisedCents ? goalCents - raisedCents : null
  const window = [
    schedule.start_date && `from ${formatDate(schedule.start_date, intl)}`,
    schedule.end_date && `${closed ? 'closed' : 'through'} ${formatDate(schedule.end_date, intl)}`,
  ].filter(Boolean).join(' · ')

  return (
    <div className={cn('rounded-xl border p-4 space-y-2.5', closed && 'opacity-70')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            {/* Description on hover, exactly as the dues rows above. */}
            <span
              className={cn(schedule.description && 'cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2')}
              title={schedule.description ?? undefined}
            >
              {schedule.label}
            </span>
            {goalMet && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-affirm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-on-affirm">
                <Check className="h-3 w-3" /> {t('drives.goalMet')}
              </span>
            )}
            {closed && (
              <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t('drives.closed')}
              </span>
            )}
          </p>
          {window && <p className="text-xs text-muted-foreground mt-0.5">{window}</p>}
        </div>

        {/* A CLOSED DRIVE TAKES NOTHING, and shows no button rather than a disabled one:
            its bar cannot move any more, and the action would be refused server-side too.
            A family with no processor also gets no button — the sentence explaining that
            is said once under the list rather than N times as a greyed-out control. */}
        {!closed && chargesReady && (
          <GiveButton
            scheduleId={schedule.id}
            label={schedule.label}
            toGoalCents={toGoalCents}
          />
        )}
      </div>

      {goalCents && goalCents > 0 ? (
        <>
          <GoalBar goalCents={goalCents} raisedCents={raisedCents} />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{formatCurrency(raisedCents, intl)}</span>
            {' raised of '}{formatCurrency(goalCents, intl)} · {progressPercent}%
            {raisedCents > goalCents
              && ` — ${t('drives.pastTheGoal', {
                amount: formatCurrency(raisedCents - goalCents, intl),
              })}`}
            {myGivenCents > 0
              && ` · ${t('drives.fromYou', {
                amount: formatCurrency(myGivenCents, intl),
              })}`}
          </p>
        </>
      ) : (
        // No goal set: there is nothing to draw a bar against, so just the total.
        <p className="text-xs text-muted-foreground">
          {raisedCents > 0
            ? <>{t('drives.raisedAmount', {
                amount: formatCurrency(raisedCents, intl),
              })}{myGivenCents > 0 && ` · ${t('drives.fromYou', {
                amount: formatCurrency(myGivenCents, intl),
              })}`}</>
            : t('drives.noGoal')}
        </p>
      )}
    </div>
  )
}

/**
 * A bar that keeps going past the goal.
 *
 * Under the goal the track IS the goal, so the fill is raised/goal and the far end is
 * the target. Once the goal is passed the track rescales to the amount raised: the
 * fill then spans the whole width, and the GOAL moves inward to wherever it now falls
 * — the darker segment is everything up to the target, the lighter one is the excess.
 *
 * That is what "past 100%" looks like on a fixed-width track. Clamping the fill at
 * 100% instead would draw a drive that raised double its goal identically to one that
 * scraped in, which is the opposite of what a fundraiser wants to see.
 *
 * aria-hidden because the same numbers are stated in the text directly beneath it,
 * and a progressbar role cannot honestly report a value above its own maximum.
 */
function GoalBar({ goalCents, raisedCents }: { goalCents: number; raisedCents: number }) {
  const over = raisedCents > goalCents
  // Where the goal sits on the track: the whole width until it is passed, then a
  // proportionally smaller share as the total grows beyond it.
  const goalWidth = over ? (goalCents / raisedCents) * 100 : Math.max(0, (raisedCents / goalCents) * 100)

  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex" aria-hidden="true">
      <div
        className={cn('h-full', over || raisedCents >= goalCents ? 'bg-brand-affirm' : 'bg-primary')}
        style={{ width: `${goalWidth}%` }}
      />
      {over && (
        // The excess, in a lighter wash of the same colour so the goal line reads as the
        // boundary between the two segments rather than needing a marker of its own.
        <div className="h-full bg-brand-affirm/50" style={{ width: `${100 - goalWidth}%` }} />
      )}
    </div>
  )
}
