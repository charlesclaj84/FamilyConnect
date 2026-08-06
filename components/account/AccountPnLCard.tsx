import { TrendingUp, TrendingDown, Scale, ArrowRightLeft, Wallet, CalendarClock } from 'lucide-react'
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
            <div className="p-1.5 rounded-full bg-green-100"><TrendingUp className="h-4 w-4 text-green-600" /></div>
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
            <div className="p-1.5 rounded-full bg-rose-100"><TrendingDown className="h-4 w-4 text-rose-600" /></div>
            <span className="text-sm text-muted-foreground font-medium">Total Spent</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(data.totalExpenseCents)}</p>
          <p className="text-xs text-muted-foreground">
            {data.events.length === 0 ? 'No event spending' : `Across ${data.events.length} event${data.events.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-full ${isPositive ? 'bg-green-100' : 'bg-rose-100'}`}>
              <Scale className={`h-4 w-4 ${isPositive ? 'text-green-600' : 'text-rose-600'}`} />
            </div>
            <span className="text-sm text-muted-foreground font-medium">Net Balance</span>
          </div>
          <p className={`text-3xl font-bold ${isPositive ? 'text-green-600' : 'text-rose-600'}`}>
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
                    <span className="text-sm font-semibold text-green-600">{formatCurrency(r.contributedCents)}</span>
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
                      In {formatCurrency(f.contributedCents)} · Disbursed {formatCurrency(f.disbursedCents)} · Spent {formatCurrency(f.expensedCents)}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold shrink-0 ${f.balanceCents >= 0 ? 'text-green-600' : 'text-rose-600'}`}>
                    {formatCurrency(f.balanceCents)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Event Ledger ── */}
      {data.events.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" /> Event Budgets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.events.map(ev => {
              const remaining = ev.totalBudgetedCents - ev.totalSpentCents
              const pct = ev.totalBudgetedCents > 0 ? Math.min(100, Math.round((ev.totalSpentCents / ev.totalBudgetedCents) * 100)) : 0
              const over = ev.totalSpentCents > ev.totalBudgetedCents && ev.totalBudgetedCents > 0
              return (
                <div key={ev.eventId} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{ev.eventName}</p>
                      {ev.backingFundName && <p className="text-xs text-muted-foreground">Backed by {ev.backingFundName}</p>}
                    </div>
                    <p className="text-xs text-muted-foreground text-right">
                      Budgeted {formatCurrency(ev.totalBudgetedCents)}<br />
                      Spent {formatCurrency(ev.totalSpentCents)}
                    </p>
                  </div>

                  {ev.totalBudgetedCents > 0 && (
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`h-full ${over ? 'bg-rose-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                    </div>
                  )}

                  {ev.lineItems.length > 0 && (
                    <div className="divide-y rounded-lg border">
                      {ev.lineItems.map(li => {
                        const liRemaining = li.budgetedCents - li.spentCents
                        return (
                          <div key={li.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                            <span className="font-medium">{li.title}</span>
                            <span className="text-muted-foreground">
                              {formatCurrency(li.spentCents)} / {formatCurrency(li.budgetedCents)} ·{' '}
                              <span className={liRemaining < 0 ? 'text-rose-600' : 'text-green-600'}>
                                {liRemaining < 0 ? `${formatCurrency(-liRemaining)} over` : `${formatCurrency(liRemaining)} left`}
                              </span>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {ev.unbudgetedSpentCents > 0 && (
                    <p className="text-xs text-muted-foreground">Unbudgeted spend: {formatCurrency(ev.unbudgetedSpentCents)}</p>
                  )}
                  <p className={`text-xs font-medium ${remaining < 0 ? 'text-rose-600' : 'text-green-600'}`}>
                    {remaining < 0 ? `${formatCurrency(-remaining)} over budget` : `${formatCurrency(remaining)} remaining`}
                  </p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
