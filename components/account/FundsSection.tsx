'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Target, Award } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type FundWithStats } from '@/app/actions/funds'
import { useT } from '@/components/layout/LocaleProvider'

import { useMoney } from '@/components/layout/MoneyProvider'
// Member-initiated "open contributions" was removed along with the contributeToFund
// server action it called. The action was live, unpermissioned service-role code that
// happened to be unreachable because this flag was false — and a boolean hiding a
// button is not a gate. If open member giving becomes a product feature, it comes back
// with its own permission resource, not a flag.

interface Props {
  funds: FundWithStats[]
  /**
   * Whether to offer the way through to Accounting's Funds section.
   *
   * NAMED FOR WHAT IT DECIDES, not for who the caller is. It was `isAdmin` and was fed
   * `family-finances:edit`, which is a different question from the one the link asks:
   * the link goes to /admin/account?section=funds, so what it needs is that section's
   * own view grant, or it renders a destination that 404s for whoever follows it. Both
   * call sites pass `admin/account/funds:view` now.
   */
  canManage: boolean
}

function pctLabel(bps: number) {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`
}

export function FundsSection({ funds, canManage }: Props) {
  const t = useT()
  const money = useMoney()
  const [expanded, setExpanded] = useState<string | null>(null)

  // Nothing to show and nothing to do about it. Somebody who CAN set funds up still
  // gets the card, because "No funds set up yet" beside a Manage Funds button is the
  // one useful thing to say to them.
  if (funds.length === 0 && !canManage) return null

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="h-4 w-4 text-primary" />
          {t('funds.title')}
        </CardTitle>
        {canManage && (
          <Link href="/admin/accounting?section=funds" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
            {t('funds.manage')}
          </Link>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {funds.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('funds.none')}</p>
        ) : (
          funds.map(fund => {
            // ── THE TARGET IS THE MINIMUM, AND `goal_cents` IS NOT CONSULTED ──────
            // It read `goal_cents ?? minimum_cents` and labelled the result "goal" or
            // "minimum" accordingly, which was wrong in the way a stale column always is:
            // `createFund` stopped ASKING for a goal when the create form swapped that
            // field for a minimum, so the only funds carrying one are those made before
            // the swap. Those went on reporting "of $1,000 goal" — a figure nothing in the
            // product reads, on a bar drawn against a target nobody could edit any more,
            // beside an Accounting screen showing a different number for the same fund.
            //
            // `minimum_cents` is the figure that MEANS something: `routeContribution`
            // fills each fund up to it in priority order, so a bar drawn against it is
            // progress toward the thing the waterfall is actually doing. A fund with no
            // minimum has no target, so it draws no bar and states its balance — which is
            // the honest answer rather than a bar against nothing.
            //
            // The column itself is left alone. Dropping it is a migration, and
            // `dues_schedules.goal_cents` — a genuinely live figure on a donation drive —
            // is a different column with the same name.
            const target = fund.minimum_cents > 0 ? fund.minimum_cents : null
            const pct = target
              ? Math.max(0, Math.min(100, Math.round((fund.balance_cents / target) * 100)))
              : null
            const isOpen = expanded === fund.id
            return (
              <div key={fund.id} className="rounded-lg border overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : fund.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-start hover:bg-muted/50 transition-colors"
                >
                  <Target className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{fund.name}</p>
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{t('fnd.shareOfDues', { percent: pctLabel(fund.allocation_bps) })}</span>
                    </div>
                    {fund.description && (
                      <p className="text-xs text-muted-foreground truncate">{fund.description}</p>
                    )}
                    {pct !== null && (
                      <div className="mt-1 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="text-end shrink-0 text-xs text-muted-foreground">
                    <p className="font-medium text-sm text-foreground">{money(fund.balance_cents)}</p>
                    <p>{t('fnd.balanceWord')}</p>
                    {target && <p>{t('fnd.ofMinimum', { amount: money(target) })}</p>}
                  </div>
                  {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0 rtl:-scale-x-100" />}
                </button>
                {isOpen && (
                  <div className="border-t bg-muted/20 px-3 py-3 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Receives {pctLabel(fund.allocation_bps)} of routed dues.
                      {fund.minimum_cents > 0
                        && t('fnd.minimumBalanceIs', {
                          amount: money(fund.minimum_cents),
                        })}
                    </p>
                    {/* Transferred appears only when there is one, and it has to appear
                        then: without it these three stop adding up for any fund that has
                        taken part in a transfer, and a reader has no way to tell that
                        from an arithmetic bug. Signed, because it is the one figure here
                        that can point either way. */}
                    <p className="text-xs text-muted-foreground">
                      Contributed {money(fund.total_contributed_cents)} · Disbursed {money(fund.total_disbursed_cents)}
                      {fund.net_transfers_cents !== 0 && (
                        <> · Transferred {fund.net_transfers_cents < 0 ? '−' : '+'}{money(Math.abs(fund.net_transfers_cents))}</>
                      )}
                      {' '}· Balance {money(fund.balance_cents)}
                    </p>
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
