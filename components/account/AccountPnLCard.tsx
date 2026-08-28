import { TrendingUp, TrendingDown, Scale, ArrowRightLeft, Wallet, Landmark } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/currency-utils'
import type { PnLData } from '@/app/actions/dues'
import { useT } from '@/components/layout/LocaleProvider'

interface Props {
  /**
   * The reader's `Intl` tag, for the dates and figures below. A PROP rather than
   * `useIntlTag()`, because this is a Server Component. See lib/i18n/server.ts.
   */
  intl: string
  data: PnLData
}

/**
 * The statement itself — the three lines of a profit and loss, then where the money sits.
 *
 * ── THE CAPTIONS ARE ACCOUNTING WORDS NOW, AND ONE OF THEM WAS WRONG ────────────────
 * Renamed 2026-08-20, reading the screen as a treasurer would:
 *
 *   Total Collected  ->  Income        both are what came in, and "collected" says nothing
 *                                      about donations, which are half of this figure.
 *   Total Spent      ->  Expenses      matches the line it faces.
 *   Net Balance      ->  Net surplus   THE ONE THAT WAS WRONG. A BALANCE IS A STOCK — what
 *                        / Net deficit is held at a moment, which on this page is the fund
 *                                      balances further down. Income less expenses is a FLOW
 *                                      over a period, and calling it a balance invites
 *                                      somebody to reconcile it against the funds and find it
 *                                      does not tie. The two figures genuinely differ, and
 *                                      the reason is now stated on the page rather than left
 *                                      to be discovered by whoever is asked to explain it.
 *
 * ── THE PERIOD IS STATED, BECAUSE A STATEMENT WITHOUT ONE IS NOT A STATEMENT ────────
 * There is no date filter anywhere in `getFamilyPnL`: every figure is LIFE TO DATE, from the
 * family's first recorded entry. That was already true and nothing said so, which is how a
 * number ends up in a board pack under the wrong heading. Naming the period is the honest
 * minimum; a period selector is a feature, and this is not it.
 */
export function AccountPnLCard({ data, intl }: Props) {
  const t = useT()
  const net = data.netCents
  const isPositive = net >= 0
  const unrouted = data.unroutedIncomeCents

  return (
    <div className="space-y-5">
      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
        {t('pnl.lede')}
      </p>

      {/* ── The three lines ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-full bg-brand-affirm"><TrendingUp className="h-4 w-4 text-brand-on-affirm" /></div>
            <span className="text-sm text-muted-foreground font-medium">{t('money.income')}</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(data.totalCollectedCents, intl)}</p>
          <div className="text-xs text-muted-foreground space-y-0.5">
            {/* Dues AND donations: both are dues_payments rows, so both are in this
                total. Labelling it "Dues" alone understated what came in. */}
            <p className="flex items-center justify-between gap-2"><span>{t('pnl.duesAndDonations')}</span><span className="font-medium text-foreground">{formatCurrency(data.totalIncomeCents, intl)}</span></p>
            <p className="flex items-center justify-between gap-2"><span>{t('pnl.direct')}</span><span className="font-medium text-foreground">{formatCurrency(data.totalContributionsCents, intl)}</span></p>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2.5">
            {/* Warm, not destructive: spending a fund down is what the fund is FOR, and a
                red chip on a normal state spends the alarm colour where nothing is wrong.
                Only the deficit arms below are destructive. */}
            <div className="p-1.5 rounded-full bg-brand-warm"><TrendingDown className="h-4 w-4 text-brand-on-warm" /></div>
            <span className="text-sm text-muted-foreground font-medium">{t('money.expenses')}</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(data.totalExpenseCents, intl)}</p>
          {/* IT COUNTED EVENT SPEND UNTIL 2026-08-19 and counts DISBURSEMENTS now — money
              that actually left a fund, which is the only outgoing this product records since
              the Events tables were dropped. The caption says which, because a figure whose
              source has changed is the kind a treasurer reconciles against a bank statement. */}
          <p className="text-xs text-muted-foreground">
            {data.totalExpenseCents === 0 ? t('pnl.nothingPaidOut') : t('pnl.disbursed')}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-full ${isPositive ? 'bg-brand-affirm' : 'bg-destructive/10'}`}>
              <Scale className={`h-4 w-4 ${isPositive ? 'text-brand-on-affirm' : 'text-destructive'}`} />
            </div>
            <span className="text-sm text-muted-foreground font-medium">
              {isPositive ? t('pnl.surplus') : t('pnl.deficit')}
            </span>
          </div>
          <p className={`text-3xl font-bold ${isPositive ? 'text-brand-affirm' : 'text-destructive'}`}>
            {isPositive ? '+' : ''}{formatCurrency(net, intl)}
          </p>
          <p className="text-xs text-muted-foreground">{t('pnl.netLine')}</p>
        </div>
      </div>

      {/* ── WHERE THE COLLECTED MONEY IS SITTING ──────────────────────────────────────
          The line a treasurer asks for and no screen answered: dues that reached no fund,
          because no routing rule named one. It is NOT an error and is not drawn as one —
          money is unallocated for as long as it takes somebody to allocate it, and a family
          running one pot with no routing at all is running perfectly well. The marker is
          `--brand-withheld`, the token for an amount being held back rather than for a
          failure; `--destructive` owns errors (AGENTS.md, "Colours live in one place").

          A NEGATIVE FIGURE IS POSSIBLE and reads "routed beyond dues income": an
          administrator may contribute straight to a fund, so more can have been routed into
          funds than dues ever brought in. The sign is shown rather than clamped. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-2xl border bg-card px-5 py-4">
        <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Landmark className="h-4 w-4" />
          {unrouted < 0 ? t('pnl.routedBeyond') : t('pnl.notYetRouted')}
        </span>
        <span className={`text-xl font-semibold tabular-nums ${unrouted === 0 ? '' : 'text-brand-withheld'}`}>
          {formatCurrency(Math.abs(unrouted), intl)}
        </span>
        <p className="w-full text-xs text-muted-foreground">
          {unrouted === 0
            ? t('pnl.allRouted')
            : unrouted < 0
              ? t('pnl.overRouted')
              : t('pnl.unrouted')}
        </p>
      </div>

      {/* ── Income → Routing ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-primary" /> {t('pnl.routedHeading')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.routing.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('pnl.nothingRouted')}</p>
          ) : (
            <div className="divide-y rounded-xl border">
              {data.routing.map(r => (
                <details key={r.fundId} className="px-4 py-2.5">
                  <summary className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-medium">{r.fundName}</span>
                    <span className="text-sm font-semibold text-brand-affirm">{formatCurrency(r.contributedCents, intl)}</span>
                  </summary>
                  <ul className="mt-2 space-y-0.5 pl-1">
                    {r.bySource.map((s, i) => (
                      <li key={i} className="flex justify-between text-xs text-muted-foreground px-1 py-0.5">
                        <span>{s.label}</span>
                        <span className="ml-4 shrink-0">{formatCurrency(s.cents, intl)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Fund Balances ──
          A STOCK, NOT A FLOW, which is why the caption at the top stopped saying "Net
          Balance": these are what each fund holds now, and they do NOT sum to the net figure
          above. Three reasons, every one of them ordinary — dues that were never routed into
          a fund (the line above), contributions made straight to one, and transfers between
          them. A reader who tries to reconcile the two and is told none of this concludes
          that one of them is broken. */}
      {data.funds.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" /> {t('pnl.balancesToday')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y rounded-xl border">
              {data.funds.map(f => (
                <div key={f.fundId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{f.fundName}</p>
                    <p className="text-xs text-muted-foreground">
                      {/* TWO TERMS, NOT THREE. `expensedCents` was event spend and went with
                          the tables; a third figure reading $0.00 on every fund forever is
                          worse than one fewer figure. */}
                      In {formatCurrency(f.contributedCents, intl)} · Disbursed {formatCurrency(f.disbursedCents, intl)}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold shrink-0 ${f.balanceCents >= 0 ? 'text-brand-affirm' : 'text-destructive'}`}>
                    {formatCurrency(f.balanceCents, intl)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* THE EVENT BUDGETS CARD WAS HERE AND IS GONE (2026-08-19).
          It drew a bar per event of budgeted-against-spent, with its line items and its
          backing fund. `20260819000006` dropped `events`, `event_budget_items`,
          `event_expenses` and `funds.event_id`, so every figure it needed is gone.

          THE THING IT DID IS NOT GONE, it moved: a gathering carries `budget_cents` on a
          `fund_id` and each task carries a line against it, and `lib/gathering-budget.ts`
          draws exactly this comparison on the gathering's own page. That is a better home
          for it — a budget belongs to the occasion being planned, not to a statement. */}
    </div>
  )
}
