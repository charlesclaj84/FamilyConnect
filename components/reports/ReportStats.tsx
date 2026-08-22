import { cn } from '@/lib/utils'

/**
 * The row of headline figures at the top of a report, and the empty state under it.
 *
 * ── ONE COMPONENT BECAUSE FOUR REPORTS SHIPPED AT ONCE ─────────────────────────────────
 * Gatherings, Elections, Meetings and Board & Offices all open the same way: four or five
 * counts, then a table. Four copies of that markup is how the Directory came to search accents
 * and the photo tagger did not — the same argument `lib/person-search.ts` makes one level down.
 * The Membership report deliberately does NOT use it: that one is donut charts with drill-down
 * rows, which is a different thing wearing the same word.
 *
 * ── A TONE IS A FINDING, NOT A DECORATION ──────────────────────────────────────────────
 * `tone` is the whole reason this takes a prop rather than rendering every tile alike. A
 * report is read for what is WRONG with it — tasks nobody has done, offices nobody holds — and
 * a figure that means "act on this" has to look different from one that means "here is the
 * size of the thing".
 *
 *   plain      the size of the thing. Most tiles.
 *   affirm     something completed. Approved tasks, minuted meetings.
 *   withheld   something outstanding — `--brand-withheld`, which AGENTS.md reserves for a
 *              capability being withheld and for an unpaid installment. An overdue task and a
 *              vacant office are the same kind of fact: not an error, not a deletion, but
 *              something the family has not done yet. `--destructive` is for a failure and
 *              `form-message.tsx` owns reporting one.
 *
 * There is no `destructive` tone and there must not be. Nothing on a report is an error.
 */
export type StatTone = 'plain' | 'affirm' | 'withheld'

export interface ReportStat {
  label: string
  /** Rendered as given. A caller formatting money or a percentage does it before this. */
  value: string | number
  /** One short line under the figure. Optional, and usually worth it. */
  hint?: string
  tone?: StatTone
}

const TONE: Record<StatTone, string> = {
  plain: 'text-foreground',
  affirm: 'text-brand-affirm',
  withheld: 'text-brand-withheld',
}

/**
 * `sm:grid-cols-2 lg:grid-cols-4` rather than a flex row: a row of five tiles at 390px wraps
 * into a ragged shape whose second line starts under the middle of the first, which is the
 * same failure `MainRail` fixed by stacking. A grid gives one column on a phone and equal
 * columns everywhere else, by construction.
 */
export function ReportStats({ stats, className }: { stats: ReportStat[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {stats.map(stat => (
        <div key={stat.label} className="rounded-xl border bg-card px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {stat.label}
          </dt>
          <dd className={cn('mt-1 text-2xl font-semibold tabular-nums', TONE[stat.tone ?? 'plain'])}>
            {stat.value}
          </dd>
          {stat.hint && <p className="mt-0.5 text-xs text-muted-foreground">{stat.hint}</p>}
        </div>
      ))}
    </dl>
  )
}

/**
 * "Your family has not done this yet" — which is a DIFFERENT sentence from "you were not
 * granted this", and the pages keep them apart deliberately. A caller without the grant gets
 * `notFound()` from the page guard and never reaches a report at all; this is only ever shown
 * over a report that genuinely has no rows.
 */
export function ReportEmpty({
  icon: Icon, message, hint,
}: {
  icon: React.ComponentType<{ className?: string }>
  message: string
  hint?: string
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-14 text-center">
      <Icon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {hint && <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
