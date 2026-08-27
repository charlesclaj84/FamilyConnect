import Link from 'next/link'
import { CheckCircle, AlertCircle, Clock, CalendarClock, HeartHandshake } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency-utils'
import { isOutstanding } from '@/lib/dues-utils'
import { type DuesSummary } from '@/app/actions/dues'
import { useT } from '@/components/layout/LocaleProvider'

interface Props {
  summary: DuesSummary[]
  /**
   * The dashboard's way through to [Dues](/dues). Off by default, because the other two
   * places this card appears both carry their own: Summary states the link under its
   * stat row, and Dues IS the destination — a button linking to the page you are on.
   *
   * This is the ONLY thing that may differ between the three renderings. Anything else
   * that wants to vary belongs in all of them or in none; see the header comment.
   */
  showViewLink?: boolean
  /** Sizing from the parent — `max-w-sm` on the dashboard, a grid cell elsewhere. */
  className?: string
}

/**
 * THE dues balance KPI. One component, rendered unchanged on the dashboard, in
 * [Summary](/account-summary)'s stat row and at the top of [Dues](/dues), because it
 * answers one question and had been answering it two different ways.
 *
 * They were two hand-rolled cards before. Both showed required money as the headline and
 * optional underneath — the rule was right in both — but nothing else about them matched:
 * different icon, different label, different type scale, one listed the schedules and one
 * gave a count of them, one replaced the figure with a sentence when nothing was required
 * and the other kept a `$0.00`. A member reading the dashboard and then opening My Summary
 * had to work out for themselves that the two cards were the same fact.
 *
 * So there is nothing to keep in step any more. If this card needs to differ between the
 * two pages, that difference is a prop with a reason written next to it, or it does not
 * happen.
 *
 * WHAT IT SAYS, and why in that order:
 *
 *   * The headline is REQUIRED money — the figure with a consequence attached. Optional is
 *     a separate, quieter line, so "you owe $50" can never silently include $200 of things
 *     nobody is asking for.
 *   * The attention colour — the gold chip, the accent bullets — is for required money
 *     outstanding and nothing else. An optional due left unpaid is not a problem to
 *     flag, and colouring the card for one would make the signal meaningless.
 *   * The figure is always a figure, including when it is `$0.00`. A KPI whose number
 *     disappears on the good news is a KPI you cannot compare with yesterday's; the good
 *     news goes on the line underneath, where the affirming tick is.
 *   * Opted-out dues appear in neither total. `isOutstanding` excludes them: a member who
 *     has declined an optional due is not carrying a balance on it, and listing it as
 *     "optional, unpaid" would re-ask a question they have already answered. They are
 *     counted once, as `declined`, in the footer — and the way to reverse it is in My
 *     Summary's table, not here.
 */
/**
 * One schedule's plan, in a line: what it costs and how often.
 *
 * SHARED BY BOTH LISTS, required and optional, because they were the same string written
 * twice — and the moment a catch-up had to be added, twice would have become "once, in
 * whichever list somebody was looking at". Same argument as this whole component.
 *
 * WHAT IT SAYS WHEN A MEMBER IS BEHIND. The steady installment on its own is a promise
 * this card cannot keep: a member switching to monthly in August owes $450 next, not $50,
 * and a KPI that says "$50/monthly" beside a "Remaining Balance" of $600 is inviting them
 * to work out the difference themselves. So the next figure leads and the steady one
 * follows it, in the same order My Summary's table puts them.
 *
 * `next` is used and never recomputed: it arrives clamped to the balance from
 * `duesPlanMath` on the server, and a second clamp here would be a second answer.
 */
function PlanLine({ summary: s }: { summary: DuesSummary }) {
  if (s.onSchedule) {
    return <>{s.schedule.label} — {formatCurrency(s.installmentCents)}/{s.cadence}</>
  }
  return (
    <>
      {s.schedule.label} — {formatCurrency(s.nextInstallmentCents)} next
      {s.followingInstallmentDate && <>, then {formatCurrency(s.followingInstallmentCents)}/{s.cadence}</>}
    </>
  )
}

export function DuesBalanceKpi({ summary, showViewLink = false, className }: Props) {
  const t = useT()
  const outstanding = summary.filter(isOutstanding)
  const requiredDue = outstanding.filter(s => s.required)
  const optionalDue = outstanding.filter(s => !s.required)
  const requiredCents = requiredDue.reduce((sum, s) => sum + s.remainingBalanceCents, 0)
  const optionalCents = optionalDue.reduce((sum, s) => sum + s.remainingBalanceCents, 0)
  const declinedCount = summary.filter(s => s.optedOut).length

  return (
    <div className={cn('space-y-3 rounded-2xl border bg-card p-5', className)}>
      <div className="flex items-center gap-2.5">
        <div className={cn('rounded-full p-1.5', requiredCents > 0 ? 'bg-brand-legacy' : 'bg-brand-affirm')}>
          <Clock className={cn('h-4 w-4', requiredCents > 0 ? 'text-brand-on-legacy' : 'text-brand-on-affirm')} />
        </div>
        <span className="text-sm font-medium text-muted-foreground">{t('cards.remainingBalance')}</span>
      </div>

      {summary.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('cards.noSchedules')}</p>
      ) : (
        <>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold">{formatCurrency(requiredCents)}</p>
            <span className="mb-1 text-sm text-muted-foreground">required</span>
          </div>

          {requiredCents === 0 ? (
            <p className="flex items-center gap-1.5 text-sm font-medium text-brand-affirm">
              <CheckCircle className="h-4 w-4 shrink-0" />
              {/* "Required dues", not "All dues": with an optional due outstanding on the
                  next line, a bare "all dues paid" would contradict it. */}
              {optionalCents > 0 ? t('cards.requiredPaid') : t('cards.allPaid')}
            </p>
          ) : (
            <ul className="space-y-1">
              {requiredDue.map(s => (
                <li key={s.schedule.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlertCircle className="h-3 w-3 shrink-0 text-brand-accent" />
                  <PlanLine summary={s} />
                </li>
              ))}
            </ul>
          )}

          {/* The optional half. Present only when there is something in it. The word
              "optional" carries it — an explanatory clause here only restated the
              definition of the word in front of it, and My Summary's table is where the
              choice is actually made. Each line takes the same icon slot the required
              lines above use, or the two lists indent differently and read as different
              kinds of thing. */}
          {optionalCents > 0 && (
            <div className="space-y-1 rounded-lg bg-muted/50 px-2.5 py-2">
              <p className="text-xs">
                <span className="font-medium">{formatCurrency(optionalCents)}</span>
                <span className="text-muted-foreground"> optional</span>
              </p>
              <ul className="space-y-0.5">
                {optionalDue.map(s => (
                  <li key={s.schedule.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <HeartHandshake className="h-3 w-3 shrink-0" />
                    <PlanLine summary={s} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CalendarClock rather than the Clock above it: the same glyph twice in one
              card reads as the same thing said twice, and this one is about schedules —
              which is the icon the Upcoming Dues rail item already uses for them. */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            {summary.length} schedule{summary.length !== 1 ? 's' : ''}
            {declinedCount > 0 && ` · ${declinedCount} declined`}
          </div>
        </>
      )}

      {/* ── `secondary` AND NOT `outline`, ON ALL FIVE DASHBOARD CARDS ────────────────
          Reported as "View Dues doesn't look like a button", and it was true of every card
          on the screen rather than this one: `outline` is
          `border-brand-primary/35 bg-transparent`, so on a white card it is text inside a
          barely-there rectangle. A member reads that as a link, and a link that is styled
          as a not-quite-button is worse than either.

          The fix is a FILLED variant rather than a heavier `outline`, and that choice is the
          interesting part. Strengthening `outline` in `components/ui/button.tsx` would have
          fixed all five here and moved every outline button in the app, and no single surface
          token can do it: `--card` is white and `--background` is cream, so whichever one the
          variant fills with is invisible on the other. A filled `secondary` is sand — distinct
          from both grounds — and its pair is measured (`--brand-on-soft` at 7.31 on
          `--brand-soft`), which `text-brand-ink` over an unknown ground was not.

          Not `default` and not gold: those are the page's primary action and the kit's hero
          pill respectively, and five card footers all shouting is how a screen stops having a
          primary action at all. */}
      {showViewLink && (
        <Link href="/accounting/dues-and-donations" className={buttonVariants({ size: 'sm', variant: 'secondary' }) + ' w-full justify-center'}>
          {t('cards.viewDues')}
        </Link>
      )}
    </div>
  )
}
