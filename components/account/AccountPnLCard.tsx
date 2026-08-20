import { TrendingUp, TrendingDown, Scale, ArrowRightLeft, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/currency-utils'
import type { PnLData } from '@/app/actions/dues'

interface Props {
  data: PnLData
}

export function AccountPnLCard({ data }: Props) {
  const net = data.netCents
  const isPositive = net >= 0

  return (
    <div className="space-y-5">
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-full bg-brand-affirm"><TrendingUp className="h-4 w-4 text-brand-on-affirm" /></div>
            <span className="text-sm text-muted-foreground font-medium">Total Collected</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(data.totalCollectedCents)}</p>
          <div className="text-xs text-muted-foreground space-y-0.5">
            {/* Dues AND donations: both are dues_payments rows, so both are in this
                total. Labelling it "Dues" alone understated what came in. */}
            <p className="flex items-center justify-between gap-2"><span>Dues &amp; donations</span><span className="font-medium text-foreground">{formatCurrency(data.totalIncomeCents)}</span></p>
            <p className="flex items-center justify-between gap-2"><span>Contributions</span><span className="font-medium text-foreground">{formatCurrency(data.totalContributionsCents)}</span></p>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2.5">
            {/* Warm, not destructive: spending a fund down is what the fund is FOR, and a
                red chip on a normal state spends the alarm colour where nothing is wrong.
                Only the deficit arms below are destructive. */}
            <div className="p-1.5 rounded-full bg-brand-warm"><TrendingDown className="h-4 w-4 text-brand-on-warm" /></div>
            <span className="text-sm text-muted-foreground font-medium">Total Spent</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(data.totalExpenseCents)}</p>
          {/* IT COUNTED EVENT SPEND UNTIL 2026-08-19 and counts DISBURSEMENTS now — money
              that actually left a fund, which is the only outgoing this product records since
              the Events tables were dropped. The caption says which, because "Total Spent"
              over a figure whose source has changed is the kind of number a treasurer
              reconciles against a bank statement. */}
          <p className="text-xs text-muted-foreground">
            {data.totalExpenseCents === 0 ? 'Nothing paid out yet' : 'Paid out of the family’s funds'}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-full ${isPositive ? 'bg-brand-affirm' : 'bg-destructive/10'}`}>
              <Scale className={`h-4 w-4 ${isPositive ? 'text-brand-on-affirm' : 'text-destructive'}`} />
            </div>
            <span className="text-sm text-muted-foreground font-medium">Net Balance</span>
          </div>
          <p className={`text-3xl font-bold ${isPositive ? 'text-brand-affirm' : 'text-destructive'}`}>
            {isPositive ? '+' : ''}{formatCurrency(net)}
          </p>
          <p className="text-xs text-muted-foreground">{isPositive ? 'Running a surplus' : 'Running a deficit'}</p>
        </div>
      </div>

      {/* ── Income → Routing ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-primary" /> Income Routed to Funds
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.routing.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing has been routed to funds yet.</p>
          ) : (
            <div className="divide-y rounded-xl border">
              {data.routing.map(r => (
                <details key={r.fundId} className="px-4 py-2.5">
                  <summary className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-medium">{r.fundName}</span>
                    <span className="text-sm font-semibold text-brand-affirm">{formatCurrency(r.contributedCents)}</span>
                  </summary>
                  <ul className="mt-2 space-y-0.5 pl-1">
                    {r.bySource.map((s, i) => (
                      <li key={i} className="flex justify-between text-xs text-muted-foreground px-1 py-0.5">
                        <span>{s.label}</span>
                        <span className="ml-4 shrink-0">{formatCurrency(s.cents)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Fund Balances ── */}
      {data.funds.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" /> Fund Balances
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
                      In {formatCurrency(f.contributedCents)} · Disbursed {formatCurrency(f.disbursedCents)}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold shrink-0 ${f.balanceCents >= 0 ? 'text-brand-affirm' : 'text-destructive'}`}>
                    {formatCurrency(f.balanceCents)}
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
