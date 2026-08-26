import Link from 'next/link'
import { ClipboardList, Sparkles } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TIER_LABEL } from '@/lib/tiers'
import { TIER_PRICE, formatPlanPrice } from '@/lib/plans'

/**
 * What a Free family's gatherings are missing, said once.
 *
 * ── WHY A COMPONENT AND NOT A SENTENCE AT EACH SITE ────────────────────────────────
 * Three surfaces have to explain the same absence — the member's gathering page, the
 * organizer's console, and the scheduling form — and a paragraph written three times is three
 * answers to one question the moment one of them is edited. It is the same argument
 * `components/gatherings/status.ts` makes about a status colour, applied to copy.
 *
 * ── IT NAMES THE PLAN AND THE PRICE FROM THE REGISTRY, NEVER IN PROSE ──────────────
 * `TIER_LABEL` and `TIER_PRICE` are read rather than typed. AGENTS.md is explicit about the
 * second: *"a price in prose is still a price"*, and `TIER_PRICE` in `lib/plans.ts` is the one
 * place any figure is written down — typing "$5 a month" into a paragraph is how two pages come
 * to disagree, and the paragraph is the copy nobody thinks to check.
 *
 * The FEATURE list is prose and is deliberately not derived. It describes benefits rather than
 * routes, which is the distinction AGENTS.md draws between a plan BULLET (uncheckable prose,
 * kept in step by hand) and a tier TAG beside a route (derived, and must be). What it says has
 * to stay true of what Standard actually includes — the three keys are
 * `admin/gatherings/templates`, `gatherings/my-tasks` and `gatherings/budget` — and
 * `npm run marketing:check` does not walk this file, so that is a person's job.
 *
 * ── IT IS AN INVITATION, NOT A REFUSAL ────────────────────────────────────────────
 * `--brand-legacy` as a rule with `bg-brand-soft` under `text-brand-on-soft`, the treatment
 * every Dashboard banner uses — and NOT `--brand-withheld`, even though a withheld capability
 * is what that token is for. The distinction is the reader: `--brand-withheld` marks something
 * this family HAS and cannot currently reach, which is what a lapsed plan looks like. This is
 * something they have never had and might want, which is a different sentence and should not
 * be painted as a loss.
 */
export function PlanningUpsell({ variant = 'panel', className }: {
  /**
   * `panel` is the standalone card the two gathering screens render in place of the task
   * table. `inline` is the quieter one-line form for inside a form or a dialog, where a card
   * would be a second panel inside a panel.
   */
  variant?: 'panel' | 'inline'
  className?: string
}) {
  const price = TIER_PRICE.standard

  if (variant === 'inline') {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        <Sparkles className="mr-1 inline h-3 w-3 align-[-0.1em]" aria-hidden="true" />
        On {TIER_LABEL.free} a gathering is a date, a place and a description.{' '}
        <Link href="/upgrade" className="underline">{TIER_LABEL.standard}</Link>{' '}
        adds checklists, tasks handed out to relatives by name, and a budget drawn on a fund.
      </p>
    )
  }

  return (
    <section className={cn(
      'rounded-xl border border-brand-legacy/40 bg-brand-soft p-4 sm:p-5',
      className,
    )}>
      <div className="flex gap-3">
        <div className="mt-0.5 shrink-0 self-start rounded-lg bg-brand-primary p-1.5 text-brand-on-primary">
          <ClipboardList className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="text-sm font-medium text-brand-on-soft">
              Plan this gathering with {TIER_LABEL.standard}
            </h2>
            <p className="mt-0.5 text-xs text-brand-on-soft/80">
              {/* WHAT THEY HAVE, FIRST. A family on Free has a working feature, and leading
                  with what is missing would tell them otherwise — the gathering is on the
                  calendar and everybody can see it. */}
              Your gathering is on the calendar and every relative can see when and where it is.
              {TIER_LABEL.standard} is where it becomes a plan.
            </p>
          </div>

          <ul className="space-y-1.5 text-xs text-brand-on-soft/80">
            <li>
              <strong className="text-brand-on-soft">Checklists you write once.</strong> A
              reunion is the Welcome, the Picnic and the Send Off — build each as a template and
              schedule from it every year.
            </li>
            <li>
              <strong className="text-brand-on-soft">Jobs with names on them.</strong> Every step
              becomes a task held by one relative, who answers it and gets it approved or handed
              back with notes. Nobody has to remember who said they would bring the tables.
            </li>
            <li>
              <strong className="text-brand-on-soft">A budget drawn on a fund.</strong> What the
              gathering may spend, what each part of it claims, and whether that fits what the
              family actually has.
            </li>
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/upgrade" className={cn(buttonVariants({ size: 'sm' }), 'shrink-0')}>
              See {TIER_LABEL.standard}
            </Link>
            {price && (
              <span className="text-xs text-brand-on-soft/80">
                {formatPlanPrice(price.monthlyCents)} a month
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
