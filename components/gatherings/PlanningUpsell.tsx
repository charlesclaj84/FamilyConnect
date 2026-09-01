'use client'

import Link from 'next/link'
import { ClipboardList, Sparkles } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { useIntlTag, useT } from '@/components/layout/LocaleProvider'
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
 * ── IT IS A CLIENT COMPONENT, AND IT WAS DUAL-USE BEFORE THAT ─────────────────────
 * Two callers, and until 2026-08-27 they were on opposite sides of the RSC boundary: a
 * Server Component page (`/gatherings/[id]`) and a client one
 * (`AdminGatheringDetailClient`). A module with no directive takes the client-ness of
 * whoever imports it, so this rendered as a server component in one graph and a client
 * component in the other — which is not a property to rely on. It cannot call `useT()`
 * in that state, and a `useState` added by a later edit would have broken the server
 * page silently.
 *
 * `'use client'` resolves it and costs the server page nothing: the module was already
 * in the browser bundle through its other caller, and this is static markup with no
 * interactivity, so there is no hydration to pay for either. The alternative — `t` and
 * `intl` as props — works from both sides (server-to-server by reference, client-to-client
 * as an ordinary closure) and was rejected: it leaves the dual-use ambiguity in place and
 * puts two props on a card that has no other reason for any.
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
  const t = useT()
  const intl = useIntlTag()
  const price = TIER_PRICE.standard

  if (variant === 'inline') {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        <Sparkles className="me-1 inline h-3 w-3 align-[-0.1em]" aria-hidden="true" />
        {/* TWO KEYS WITH THE LINK BETWEEN THEM, not one key with markup in it. The
            catalogue holds strings and nothing else — a `<Link>` inside a translated value
            would need a parser, and a translator who moved the anchor would move a route.
            The plan NAME is the link's whole text, which is why the split lands where it
            does: Spanish and French both open the clause with the subject too. */}
        {t('gath.upsell.inlineHave', { plan: TIER_LABEL.free })}{' '}
        <Link href="/upgrade" className="underline">{TIER_LABEL.standard}</Link>{' '}
        {t('gath.upsell.inlineAdds')}
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
              {t('gath.upsell.title', { plan: TIER_LABEL.standard })}
            </h2>
            <p className="mt-0.5 text-xs text-brand-on-soft/80">
              {/* WHAT THEY HAVE, FIRST. A family on Free has a working feature, and leading
                  with what is missing would tell them otherwise — the gathering is on the
                  calendar and everybody can see it. */}
              {t('gath.upsell.lede', { plan: TIER_LABEL.standard })}
            </p>
          </div>

          <ul className="space-y-1.5 text-xs text-brand-on-soft/80">
            {/* A LEAD AND A BODY PER BULLET, two keys rather than one with `<strong>` in it.
                Same rule as the inline form above: the catalogue holds no markup. */}
            <li>
              <strong className="text-brand-on-soft">{t('gath.upsell.checklistsLead')}</strong>{' '}
              {t('gath.upsell.checklistsBody')}
            </li>
            <li>
              <strong className="text-brand-on-soft">{t('gath.upsell.jobsLead')}</strong>{' '}
              {t('gath.upsell.jobsBody')}
            </li>
            <li>
              <strong className="text-brand-on-soft">{t('gath.upsell.budgetLead')}</strong>{' '}
              {t('gath.upsell.budgetBody')}
            </li>
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/upgrade" className={cn(buttonVariants({ size: 'sm' }), 'shrink-0')}>
              {t('gath.upsell.cta', { plan: TIER_LABEL.standard })}
            </Link>
            {price && (
              <span className="text-xs text-brand-on-soft/80">
                {t('bill.perMonth', { amount: formatPlanPrice(price.monthlyCents, intl) })}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
