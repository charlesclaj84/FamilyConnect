'use client'

import { AlertTriangle, TrendingUp } from 'lucide-react'
import { COLLAPSING_CELL, RowMeta, MetaDot } from '@/components/ui/table-collapse'
import { SortTh, useTableSort } from '@/components/ui/sortable-header'
import { formatCurrency } from '@/lib/currency-utils'
import { formatDate } from '@/lib/date-utils'
import { TIERS, TIER_LABEL, type FamilyTier } from '@/lib/tiers'
import { cn } from '@/lib/utils'
import { DonutChart, sliceColor } from '@/components/reports/DonutChart'
import type { CountSlice } from '@/lib/membership-report'
import type { T } from '@/lib/i18n/t'
import { useIntlTag, useT } from '@/components/layout/LocaleProvider'
import type { StaffSubscriptionPage, StaffSubscriptionRow, StaffSubscriptionSummary } from '@/app/actions/staff/subscriptions'

/**
 * The platform's paying customers, and the four figures above them.
 *
 * ── EVERY FIGURE HERE IS THE PLATFORM'S OWN REVENUE. NONE IS A FAMILY'S DUES ───────
 * AGENTS.md's first rule about money in this product: `platform_payments` is what a family
 * pays GENORRA and `dues_payments` is what a relative pays their family, and the two ledgers
 * must never meet. `listStaffSubscriptions` reads only the first. A figure on this screen that
 * had drifted into the second would report GENORRA's revenue as several times what it is, on
 * the one screen somebody would quote in a board meeting — so if a column is ever added here,
 * check which ledger it came from first.
 *
 * ── A REFUSED READ SAYS SO RATHER THAN RENDERING ZEROS ─────────────────────────────
 * §8, and it matters more here than almost anywhere: zeros on this screen read as a platform
 * with no customers, which is both alarming and false. `summary.failed` is what the action
 * sets when any of its three reads was refused, and the whole screen becomes one sentence.
 *
 * ── AND THE TWO TIER COLUMNS ARE NOT A DUPLICATE ───────────────────────────────────
 * `tier` is what is IN FORCE — the only thing any gate in the product reads. `paidTier` is
 * what the last payment bought. They differ in exactly the cases somebody opens this screen
 * for: a card that failed (tier still high, nothing being paid), and a downgrade already
 * promised (paid for more than they will have next month).
 */
/**
 * The four platform figures — paying, MRR, lifetime, needs attention.
 *
 * ── ITS OWN COMPONENT SO TWO SCREENS CANNOT DISAGREE ────────────────────────────────
 * Lifted out of the page below on 2026-08-31, when the Overview started showing the same
 * band above its Families and Accounts cards. Copying the four `Figure`s would have been
 * two renderings of one answer — and the failure mode is the one AGENTS.md keeps returning
 * to: invisible until somebody puts the two screens side by side, by which time they have
 * drifted for a reason nobody recorded. `mrrCents`' caption in particular is a claim about
 * what the figure excludes, and a stale copy of that sentence is worse than none.
 *
 * IT TAKES THE SUMMARY, NEVER THE WHOLE PAGE. The Overview has no use for `rows`, and a
 * component that demanded them would make the caller fetch a list to draw four numbers.
 */
export function StaffSubscriptionFigures({ summary }: { summary: StaffSubscriptionSummary }) {
  const t = useT()
  const intl = useIntlTag()
  return (
    // ── THE FOUR FIGURES ────────────────────────────────────────────────────
    // `mrrCents` excludes prepaid terms and cancelling families, and the caption says so —
    // a figure labelled "monthly" that folded in a twelfth of an annual prepayment would
    // invent a subscription nobody has. `listStaffSubscriptions` argues it.
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Figure label={t('stf.subPaying')} value={String(summary.paying)} tone="affirm" />
      <Figure
        label={t('stf.subMrr')}
        value={formatCurrency(summary.mrrCents, intl)}
        hint={t('stf.subMrrHint')}
        tone="affirm"
      />
      <Figure
        label={t('stf.subLifetime')}
        value={formatCurrency(summary.lifetimeCents, intl)}
        tone="plain"
      />
      {/* Withheld rather than destructive: a failed card is not an error in this product,
          it is a state a family is in and somebody has to act on. The dues ladder takes
          the same reading of an unpaid installment. */}
      <Figure
        label={t('stf.subAttention')}
        value={String(summary.delinquent + summary.leaving)}
        hint={t('stf.subAttentionHint', {
          delinquent: String(summary.delinquent),
          leaving: String(summary.leaving),
        })}
        tone={summary.delinquent + summary.leaving > 0 ? 'withheld' : 'plain'}
      />
    </dl>
  )
}

/**
 * Which tier every family on the platform is on, as a ring.
 *
 * ── `DonutChart` RATHER THAN A SECOND CHART ─────────────────────────────────────────
 * `components/reports/DonutChart.tsx` already draws a ring from `CountSlice`s, already has a
 * checked palette in both themes, already handles the empty case and the single-slice case,
 * and already labels itself for a screen reader. Writing a pie here would have been a second
 * charting idiom in the codebase, differing in whichever of those four somebody forgot.
 *
 * It takes `t` as a PROP rather than calling `useT()`, and that is a property of the chart
 * worth preserving — it carries no `'use client'` directive of its own, so it renders from
 * either side of the boundary. This file is a client module, so it passes its own `t` down.
 *
 * ── IT COUNTS FAMILIES, AND THE FIGURES ABOVE COUNT MONEY ───────────────────────────
 * Deliberately a different population from every other figure on this screen, which is why
 * it is its own band with its own caption rather than a fifth `Figure`. `summary.byTier`
 * comes from `families` — EVERY family — while `paying`, `mrrCents` and the table below all
 * come from `platform_billing_accounts`, which most Free families have no row in. Reading the
 * ring as a share of paying customers would be wrong, so the caption says what it counts.
 *
 * TIERS IN PLAN ORDER, not by size. `TIERS` is the array whose ORDER is the semantics
 * (AGENTS.md: `TIER_RANK`, `tierMeets` and `planAddsBetween` all read it), so free · standard
 * · plus · premium is the order a reader already has in their head from `/pricing` — and it
 * keeps a tier's colour stable as the counts move, which sorting by size would not.
 */
function TierMix({ byTier, t }: { byTier: Record<FamilyTier, number>; t: T }) {
  const total = TIERS.reduce((sum, tier) => sum + (byTier[tier] ?? 0), 0)
  const slices: CountSlice[] = TIERS.map(tier => ({
    key: tier,
    label: TIER_LABEL[tier],
    count: byTier[tier] ?? 0,
    percent: total === 0 ? 0 : Math.round(((byTier[tier] ?? 0) / total) * 100),
  }))

  // A platform with no families at all. The donut renders its own em-dash for a zero total,
  // but a band captioned "families by plan" over an empty ring says less than nothing — and
  // this is reachable on a fresh deployment rather than being theoretical.
  if (total === 0) return null

  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="text-base font-semibold">{t('stf.tierMixHeading')}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{t('stf.tierMixHint')}</p>
      {/* The ring beside the legend on a wide screen and above it on a phone — the same
          arrangement `MembershipReportView` uses, and for its reason: the numbers are what
          the reader came for and must never be off the edge. */}
      <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <DonutChart
          slices={slices}
          palette="categorical"
          label={t('stf.tierMixHeading')}
          centerValue={total}
          centerLabel={t(total === 1 ? 'stf.familyOne' : 'stf.familyMany')}
          t={t}
        />
        {/* A LIST, NOT A TABLE. Four rows of a swatch, a name and two numbers is not a thing
            anybody compares down a column, and `DonutChart`'s own legend in the reports
            section is coupled to that screen's drill-down behaviour, which has no meaning
            here. The counts are `tabular-nums` so they line up anyway. */}
        <dl className="w-full min-w-0 space-y-1.5">
          {slices.map((slice, index) => (
            <div key={slice.key} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: sliceColor('categorical', index) }}
              />
              <dt className="min-w-0 flex-1 truncate">{slice.label}</dt>
              <dd className="shrink-0 tabular-nums font-medium">{slice.count}</dd>
              <dd className="w-12 shrink-0 text-right tabular-nums text-xs text-muted-foreground">
                {slice.percent}%
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

export function StaffSubscriptionsClient({ data }: { data: StaffSubscriptionPage }) {
  const t = useT()
  const intl = useIntlTag()
  const { rows, summary } = data

  // ── SORTING, AND THE DEFAULT IS A CONSTANT KEY ────────────────────────────────────
  // `listStaffSubscriptions` sorts three deep — live standing first, then lifetime
  // descending, then name — and its own comment says why: "a support engineer opening this
  // screen is looking for a customer, and a list led by families that have never paid buries
  // them." A single-key hook cannot express that, and it does not have to.
  //
  // `sortRows` IS STABLE, so an extractor that returns the same value for every row reorders
  // nothing: the incoming order survives intact. That is the whole trick, and it is cheaper
  // than the alternative used on `/reporting/dues-projections`, which reproduces only the
  // PRIMARY key and leans on stability for the other two. A constant reproduces all three by
  // construction, whatever they are, and keeps doing so if the server order ever changes.
  //
  // No heading is spread with it, so nothing shows an active arrow until a column is pressed
  // — honest, because until then no column is what the table is ordered by.
  //
  // STANDING SORTS ON A RANK, which is the `DuesProjections` exception rather than the
  // printed-label rule: the order is not invented here, it is the branch order `Standing`
  // below already renders in, and ascending puts the families somebody has to act on first.
  // The two must move together — see the note on `standingRank`.
  const { rows: sorted, sortProps } = useTableSort(rows, {
    incoming: () => 0,
    family: r => r.familyName,
    plan: r => TIER_LABEL[r.tier],
    paidThrough: r => r.paidThrough,
    standing: r => standingRank(r),
    lifetime: r => r.lifetimeCents,
  }, 'incoming')

  if (summary.failed) {
    return (
      <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-brand-withheld">
        {t('stf.subscriptionsReadFailed')}
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <StaffSubscriptionFigures summary={summary} />

      <TierMix byTier={summary.byTier} t={t} />

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('stf.subNoneYet')}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <SortTh label={t('stf.subFamily')} {...sortProps('family')} className="px-3 py-2 text-xs font-medium" />
                <SortTh label={t('stf.subPlan')} {...sortProps('plan')} className={cn('px-3 py-2 text-xs font-medium', COLLAPSING_CELL)} />
                <SortTh label={t('stf.subPaidThrough')} {...sortProps('paidThrough')} className={cn('px-3 py-2 text-xs font-medium', COLLAPSING_CELL)} />
                <SortTh label={t('stf.subStanding')} {...sortProps('standing')} className="px-3 py-2 text-xs font-medium" />
                <SortTh label={t('stf.subLifetimeShort')} align="right" {...sortProps('lifetime')} className="px-3 py-2 text-xs font-medium" />
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => (
                <tr key={row.familyCode} className="border-b align-top last:border-0 sm:align-middle">
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{row.familyName}</p>
                    {/* Below `sm` the two folded columns come and sit here — see LedgerTable
                        and AGENTS.md's "On a phone a table narrows". */}
                    <RowMeta>
                      <span className="font-mono text-xs">{row.familyCode}</span>
                      <MetaDot />
                      <span>{TIER_LABEL[row.tier]}</span>
                      {row.paidThrough && (
                        <>
                          <MetaDot />
                          <span>{formatDate(row.paidThrough, intl)}</span>
                        </>
                      )}
                    </RowMeta>
                  </td>
                  <td className={cn('px-3 py-2.5', COLLAPSING_CELL)}>
                    <p>{TIER_LABEL[row.tier]}</p>
                    {/* Only when the two DISAGREE. A second line repeating the first is
                        noise on every row, and the disagreement is the whole reason both
                        are here. */}
                    {row.paidTier && row.paidTier !== row.tier && (
                      <p className="text-xs text-brand-withheld">
                        {t('stf.subPaidFor', { tier: TIER_LABEL[row.paidTier] })}
                      </p>
                    )}
                    {row.mode && (
                      <p className="text-xs text-muted-foreground">{t(`stf.subMode.${row.mode}`)}</p>
                    )}
                  </td>
                  <td className={cn('px-3 py-2.5 whitespace-nowrap', COLLAPSING_CELL)}>
                    {row.paidThrough
                      ? formatDate(row.paidThrough, intl)
                      : <span className="text-muted-foreground">—</span>}
                    {row.scheduledTier && row.scheduledTierOn && (
                      <p className="text-xs text-brand-withheld">
                        {t('stf.subScheduled', {
                          tier: TIER_LABEL[row.scheduledTier],
                          on: formatDate(row.scheduledTierOn, intl) ?? row.scheduledTierOn,
                        })}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Standing row={row} />
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap font-medium">
                    {formatCurrency(row.lifetimeCents, intl)}
                    {row.lastPaidAt && (
                      <p className="text-xs font-normal text-muted-foreground">
                        {formatDate(row.lastPaidAt.slice(0, 10), intl)}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Figure({ label, value, hint, tone }: {
  label: string
  value: string
  hint?: string
  tone: 'plain' | 'affirm' | 'withheld'
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn(
        'mt-0.5 text-2xl font-bold leading-tight',
        tone === 'affirm' && 'text-brand-ink',
        tone === 'withheld' && 'text-brand-withheld',
      )}>
        {value}
      </dd>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/**
 * What state this customer is in, as one chip.
 *
 * ── ORDER IS PRECEDENCE, AND THE FIRST TWO ARE THE ONES SOMEBODY ACTS ON ───────────
 * A delinquent family that is also cancelling is delinquent: the failed payment is the thing
 * to ring them about, and the cancellation is what happens if nobody does. Reading the
 * branches top to bottom is reading the support queue.
 */
/**
 * Where a row sorts in the Standing column, mirroring `Standing`'s branch order below.
 *
 * ── A RANK, WHICH THE REST OF THIS CODEBASE USUALLY REFUSES ─────────────────────────
 * Enum columns elsewhere sort on the PRINTED LABEL, because a rank would have to be invented
 * and an order the heading does not describe is a control meaning something other than it
 * says. This is the exception `DuesProjections`' Standing column already is: the order is not
 * invented here — it is the order the four branches are written in, which is itself a
 * judgement about urgency somebody already made — and ascending therefore puts the families a
 * support engineer has to act on at the top.
 *
 * Sorting on the label would be worse than useless here for a second reason: the label of the
 * paid branch is STRIPE'S OWN WORD, verbatim and untranslated, so an alphabetical Standing
 * column would order by whether Stripe said `active` or `trialing`.
 *
 * THE TWO MUST MOVE TOGETHER. If a branch is added to `Standing`, add it here — a column
 * ordered by a set of states that is not the set it renders is the drift this codebase keeps
 * finding in copied logic.
 */
function standingRank(row: StaffSubscriptionRow): number {
  if (row.delinquentSince) return 0
  if (row.cancelAtPeriodEnd) return 1
  if (!row.paidThrough) return 3
  return 2
}

function Standing({ row }: { row: StaffSubscriptionRow }) {
  const t = useT()
  const intl = useIntlTag()

  if (row.delinquentSince) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-warm/15 px-2 py-0.5 text-xs font-medium text-brand-withheld">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        {t('stf.subDelinquentSince', { on: formatDate(row.delinquentSince.slice(0, 10), intl) ?? '' })}
      </span>
    )
  }
  if (row.cancelAtPeriodEnd) {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-brand-withheld">
        {t('stf.subLeaving')}
      </span>
    )
  }
  if (!row.paidThrough) {
    return <span className="text-xs text-muted-foreground">{t('stf.subNeverPaid')}</span>
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-affirm px-2 py-0.5 text-xs font-medium text-brand-on-affirm">
      <TrendingUp className="h-3 w-3" aria-hidden="true" />
      {/* Stripe's own word, verbatim, when there is one — `active`, `past_due`, `trialing`.
          Not translated and not prettified: it is what the Stripe Dashboard says, and a
          support engineer with both screens open must be able to match them. */}
      {row.subscriptionStatus ?? t('stf.subPaid')}
    </span>
  )
}
